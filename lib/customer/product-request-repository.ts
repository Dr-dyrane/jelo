import 'server-only';

import { createHash } from 'node:crypto';
import type { TransactionSql } from 'postgres';
import {
  assertCustomerShelfRlsRole,
  getCustomerShelfPostgresClient,
} from './shelf-database';
import { isValidCustomerShelfOwnerSubject } from './shelf-policy';
import type {
  CustomerProductRequest,
  CustomerProductRequestLifecycleState,
} from './product-request-model';

export type CustomerProductRequestIdentityFields = {
  brand: string;
  fullPackName: string;
  printedSizeVariant: string;
  category: string | null;
  retailerLabel: string | null;
  sourceUrl: string | null;
  normalizedEntityRef: string;
  photoIdentificationConsent: boolean;
};

export type CustomerProductRequestImageMetadata = {
  blobPathname: string;
  byteSize: number;
  pixelWidth: number;
  pixelHeight: number;
  contentSha256: string;
};

type MutationOperation =
  | 'create'
  | 'update'
  | 'consent_revoke'
  | 'submit'
  | 'withdraw'
  | 'image_replace'
  | 'image_remove';

export type CustomerProductRequestMutationOutcome =
  | { status: 'created' | 'updated'; request: CustomerProductRequest; replayed: boolean }
  | { status: 'withdrawn'; requestId: string; revision: number; replayed: boolean }
  | { status: 'active_catalogue_match'; canonicalSlug: string }
  | { status: 'revision_conflict'; revision: number; lifecycleState: CustomerProductRequestLifecycleState }
  | { status: 'state_conflict'; lifecycleState: CustomerProductRequestLifecycleState }
  | { status: 'idempotency_conflict' }
  | { status: 'not_found' };

type RequestRow = {
  id: string;
  revision: number;
  lifecycle_state: CustomerProductRequestLifecycleState;
  brand: string;
  full_pack_name: string;
  printed_size_variant: string;
  category: string | null;
  retailer_label: string | null;
  source_url: string | null;
  origin: CustomerProductRequest['origin'];
  created_at: Date | string;
  updated_at: Date | string;
  submitted_at: Date | string | null;
  normalized_entity_ref: string;
  matched_identity_version_id: string | null;
  photo_identification_consent: boolean;
  photo_present: boolean;
};

type MutationRow = {
  request_id: string;
  operation: MutationOperation;
  request_fingerprint_sha256: string;
  result_revision: number;
};

type CurrentStateRow = {
  revision: number;
  lifecycle_state: CustomerProductRequestLifecycleState;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;

function requiredOwnerSubject(ownerSubject: string) {
  const owner = ownerSubject.trim();
  if (!isValidCustomerShelfOwnerSubject(owner)) throw new Error('Customer product request owner is unavailable.');
  return owner;
}

function requiredUuid(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!UUID.test(normalized)) throw new Error('Customer product request is unavailable.');
  return normalized;
}

function requiredFingerprint(value: string) {
  if (!SHA256.test(value)) throw new Error('Customer product request mutation is unavailable.');
  return value;
}

function deterministicRequestId(ownerSubject: string, idempotencyKey: string) {
  const bytes = createHash('sha256')
    .update('jelocare-customer-product-request-v1\0')
    .update(ownerSubject)
    .update('\0')
    .update(idempotencyKey)
    .digest()
    .subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function mapRequestRow(row: RequestRow): CustomerProductRequest {
  return {
    id: row.id,
    revision: row.revision,
    lifecycleState: row.lifecycle_state,
    brand: row.brand,
    fullPackName: row.full_pack_name,
    printedSizeVariant: row.printed_size_variant,
    category: row.category,
    retailerLabel: row.retailer_label,
    sourceUrl: row.source_url,
    origin: row.origin,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    submittedAt: row.submitted_at === null ? null : new Date(row.submitted_at).toISOString(),
    normalizedEntityRef: row.normalized_entity_ref,
    matchedIdentityVersionId: row.matched_identity_version_id,
    photo: {
      present: row.photo_present,
      identificationConsent: row.photo_identification_consent,
    },
  };
}

async function configureCustomerTransaction(transaction: TransactionSql, ownerSubject: string) {
  await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
  await assertCustomerShelfRlsRole(transaction as ReturnType<typeof getCustomerShelfPostgresClient>);
  await transaction`select pg_catalog.set_config('app.customer_subject', ${ownerSubject}, true)`;
}

async function selectRequest(
  transaction: TransactionSql,
  ownerSubject: string,
  requestId: string,
) {
  const [row] = await transaction<RequestRow[]>`
    select
      request.id,
      request.revision,
      request.lifecycle_state,
      request.brand,
      request.full_pack_name,
      request.printed_size_variant,
      request.category,
      request.retailer_label,
      request.source_url,
      request.origin,
      request.created_at,
      request.updated_at,
      request.submitted_at,
      request.normalized_entity_ref,
      request.matched_identity_version_id,
      request.photo_identification_consent,
      (image.request_id is not null) as photo_present
    from public.customer_product_requests request
    left join public.customer_product_request_images image
      on image.owner_subject = request.owner_subject
      and image.request_id = request.id
    where request.owner_subject = ${ownerSubject}
      and request.id = ${requestId}
      and request.lifecycle_state <> 'withdrawn'
  `;
  return row ? mapRequestRow(row) : null;
}

async function findMutation(
  transaction: TransactionSql,
  ownerSubject: string,
  idempotencyKey: string,
) {
  const [row] = await transaction<MutationRow[]>`
    select request_id, operation, request_fingerprint_sha256, result_revision
    from public.customer_product_request_mutations
    where owner_subject = ${ownerSubject}
      and idempotency_key = ${idempotencyKey}
  `;
  return row ?? null;
}

function mutationMatches(
  mutation: MutationRow,
  requestId: string,
  operation: MutationOperation,
  fingerprint: string,
) {
  return mutation.request_id === requestId
    && mutation.operation === operation
    && mutation.request_fingerprint_sha256 === fingerprint;
}

async function exactActiveCatalogueMatch(
  transaction: TransactionSql,
  identity: CustomerProductRequestIdentityFields,
) {
  const [match] = await transaction<{ slug: string }[]>`
    select product.slug
    from public.catalogue_product_identity_versions version
    join public.products product on product.id = version.product_id
    where version.lifecycle_state = 'active'
      and product.is_published = true
      and pg_catalog.lower(
        pg_catalog.regexp_replace(pg_catalog.btrim(version.brand_at_review), '[[:space:]]+', ' ', 'g')
      ) = ${identity.brand.toLocaleLowerCase('en-US')}
      and pg_catalog.lower(
        pg_catalog.regexp_replace(pg_catalog.btrim(version.variant_at_review), '[[:space:]]+', ' ', 'g')
      ) = ${identity.fullPackName.toLocaleLowerCase('en-US')}
      and pg_catalog.lower(
        pg_catalog.regexp_replace(pg_catalog.btrim(version.size_at_review), '[[:space:]]+', ' ', 'g')
      ) = ${identity.printedSizeVariant.toLocaleLowerCase('en-US')}
    order by version.version_number desc, version.identity_version_id
    limit 1
  `;
  return match?.slug ?? null;
}

async function insertMutation(
  transaction: TransactionSql,
  input: {
    ownerSubject: string;
    idempotencyKey: string;
    requestId: string;
    operation: MutationOperation;
    fingerprint: string;
    resultRevision: number;
  },
) {
  await transaction`
    insert into public.customer_product_request_mutations (
      owner_subject,
      idempotency_key,
      request_id,
      operation,
      request_fingerprint_sha256,
      result_revision
    ) values (
      ${input.ownerSubject},
      ${input.idempotencyKey},
      ${input.requestId},
      ${input.operation},
      ${input.fingerprint},
      ${input.resultRevision}
    )
  `;
}

async function priorMutationOutcome(
  transaction: TransactionSql,
  input: {
    ownerSubject: string;
    idempotencyKey: string;
    requestId: string;
    operation: MutationOperation;
    fingerprint: string;
    successStatus: 'created' | 'updated' | 'withdrawn';
  },
): Promise<CustomerProductRequestMutationOutcome | null> {
  const mutation = await findMutation(transaction, input.ownerSubject, input.idempotencyKey);
  if (!mutation) return null;
  if (!mutationMatches(mutation, input.requestId, input.operation, input.fingerprint)) {
    return { status: 'idempotency_conflict' };
  }
  if (input.successStatus === 'withdrawn') {
    const [receipt] = await transaction<CurrentStateRow[]>`
      select revision, lifecycle_state
      from public.customer_product_requests
      where owner_subject = ${input.ownerSubject}
        and id = ${input.requestId}
        and lifecycle_state = 'withdrawn'
    `;
    return receipt
      ? {
          status: 'withdrawn',
          requestId: input.requestId,
          revision: receipt.revision,
          replayed: true,
        }
      : { status: 'not_found' };
  }
  const request = await selectRequest(transaction, input.ownerSubject, input.requestId);
  return request
    ? { status: input.successStatus, request, replayed: true }
    : { status: 'not_found' };
}

async function currentConflict(
  transaction: TransactionSql,
  ownerSubject: string,
  requestId: string,
  expectedRevision: number,
) {
  const [current] = await transaction<CurrentStateRow[]>`
    select revision, lifecycle_state
    from public.customer_product_requests
    where owner_subject = ${ownerSubject}
      and id = ${requestId}
  `;
  if (!current) return { status: 'not_found' as const };
  if (current.revision !== expectedRevision) {
    return {
      status: 'revision_conflict' as const,
      revision: current.revision,
      lifecycleState: current.lifecycle_state,
    };
  }
  return { status: 'state_conflict' as const, lifecycleState: current.lifecycle_state };
}

export const postgresCustomerProductRequestRepository = {
  async list(ownerSubject: string) {
    const owner = requiredOwnerSubject(ownerSubject);
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await configureCustomerTransaction(transaction, owner);
      const rows = await transaction<RequestRow[]>`
        select
          request.id,
          request.revision,
          request.lifecycle_state,
          request.brand,
          request.full_pack_name,
          request.printed_size_variant,
          request.category,
          request.retailer_label,
          request.source_url,
          request.origin,
          request.created_at,
          request.updated_at,
          request.submitted_at,
          request.normalized_entity_ref,
          request.matched_identity_version_id,
          request.photo_identification_consent,
          (image.request_id is not null) as photo_present
        from public.customer_product_requests request
        left join public.customer_product_request_images image
          on image.owner_subject = request.owner_subject
          and image.request_id = request.id
        where request.owner_subject = ${owner}
          and request.lifecycle_state <> 'withdrawn'
        order by request.updated_at desc, request.id
      `;
      return rows.map(mapRequestRow);
    });
  },

  async get(ownerSubject: string, requestId: string) {
    const owner = requiredOwnerSubject(ownerSubject);
    const id = requiredUuid(requestId);
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await configureCustomerTransaction(transaction, owner);
      return selectRequest(transaction, owner, id);
    });
  },

  async create(input: {
    ownerSubject: string;
    idempotencyKey: string;
    fingerprint: string;
    identity: CustomerProductRequestIdentityFields;
    submit: boolean;
  }): Promise<CustomerProductRequestMutationOutcome> {
    const owner = requiredOwnerSubject(input.ownerSubject);
    const key = requiredUuid(input.idempotencyKey);
    const fingerprint = requiredFingerprint(input.fingerprint);
    const requestId = deterministicRequestId(owner, key);
    const operation = 'create' as const;
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await configureCustomerTransaction(transaction, owner);
      const prior = await priorMutationOutcome(transaction, {
        ownerSubject: owner, idempotencyKey: key, requestId, operation, fingerprint,
        successStatus: 'created',
      });
      if (prior) return prior;

      const canonicalSlug = await exactActiveCatalogueMatch(transaction, input.identity);
      if (canonicalSlug) return { status: 'active_catalogue_match', canonicalSlug };

      const [inserted] = await transaction<{ id: string; revision: number }[]>`
        insert into public.customer_product_requests (
          id,
          owner_subject,
          lifecycle_state,
          brand,
          full_pack_name,
          printed_size_variant,
          category,
          retailer_label,
          source_url,
          normalized_entity_ref,
          photo_identification_consent,
          origin,
          submitted_at
        ) values (
          ${requestId},
          ${owner},
          ${input.submit ? 'pending' : 'draft'},
          ${input.identity.brand},
          ${input.identity.fullPackName},
          ${input.identity.printedSizeVariant},
          ${input.identity.category},
          ${input.identity.retailerLabel},
          ${input.identity.sourceUrl},
          ${input.identity.normalizedEntityRef},
          ${input.identity.photoIdentificationConsent},
          'customer',
          ${input.submit ? new Date() : null}
        )
        on conflict (id) do nothing
        returning id, revision
      `;
      if (!inserted) {
        const raced = await priorMutationOutcome(transaction, {
          ownerSubject: owner, idempotencyKey: key, requestId, operation, fingerprint,
          successStatus: 'created',
        });
        return raced ?? { status: 'idempotency_conflict' };
      }

      await transaction`select public.sync_customer_product_request_research_signal(${requestId})`;
      await insertMutation(transaction, {
        ownerSubject: owner,
        idempotencyKey: key,
        requestId,
        operation,
        fingerprint,
        resultRevision: inserted.revision,
      });
      const request = await selectRequest(transaction, owner, requestId);
      if (!request) throw new Error('Created customer product request is unavailable.');
      return { status: 'created', request, replayed: false };
    });
  },

  async update(input: {
    ownerSubject: string;
    requestId: string;
    expectedRevision: number;
    idempotencyKey: string;
    fingerprint: string;
    identity: CustomerProductRequestIdentityFields;
    submit: boolean;
  }): Promise<CustomerProductRequestMutationOutcome> {
    const owner = requiredOwnerSubject(input.ownerSubject);
    const id = requiredUuid(input.requestId);
    const key = requiredUuid(input.idempotencyKey);
    const fingerprint = requiredFingerprint(input.fingerprint);
    const operation = input.submit ? 'submit' as const : 'update' as const;
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await configureCustomerTransaction(transaction, owner);
      const prior = await priorMutationOutcome(transaction, {
        ownerSubject: owner, idempotencyKey: key, requestId: id, operation, fingerprint,
        successStatus: 'updated',
      });
      if (prior) return prior;

      const canonicalSlug = await exactActiveCatalogueMatch(transaction, input.identity);
      if (canonicalSlug) return { status: 'active_catalogue_match', canonicalSlug };

      const [updated] = await transaction<{ revision: number }[]>`
        update public.customer_product_requests
        set brand = ${input.identity.brand},
            full_pack_name = ${input.identity.fullPackName},
            printed_size_variant = ${input.identity.printedSizeVariant},
            category = ${input.identity.category},
            retailer_label = ${input.identity.retailerLabel},
            source_url = ${input.identity.sourceUrl},
            normalized_entity_ref = ${input.identity.normalizedEntityRef},
            photo_identification_consent = ${input.identity.photoIdentificationConsent},
            lifecycle_state = case
              when ${input.submit} and lifecycle_state in ('draft', 'needs_info') then 'pending'
              else lifecycle_state
            end,
            submitted_at = case
              when ${input.submit} then coalesce(submitted_at, now())
              else submitted_at
            end,
            revision = revision + 1,
            updated_at = now()
        where owner_subject = ${owner}
          and id = ${id}
          and revision = ${input.expectedRevision}
          and lifecycle_state in ('draft', 'pending', 'needs_info')
        returning revision
      `;
      if (!updated) {
        const raced = await priorMutationOutcome(transaction, {
          ownerSubject: owner, idempotencyKey: key, requestId: id, operation, fingerprint,
          successStatus: 'updated',
        });
        return raced ?? currentConflict(transaction, owner, id, input.expectedRevision);
      }

      await transaction`select public.sync_customer_product_request_research_signal(${id})`;
      await insertMutation(transaction, {
        ownerSubject: owner,
        idempotencyKey: key,
        requestId: id,
        operation,
        fingerprint,
        resultRevision: updated.revision,
      });
      const request = await selectRequest(transaction, owner, id);
      if (!request) throw new Error('Updated customer product request is unavailable.');
      return { status: 'updated', request, replayed: false };
    });
  },

  async revokePhotoIdentificationConsent(input: {
    ownerSubject: string;
    requestId: string;
    expectedRevision: number;
    idempotencyKey: string;
    fingerprint: string;
  }): Promise<CustomerProductRequestMutationOutcome> {
    const owner = requiredOwnerSubject(input.ownerSubject);
    const id = requiredUuid(input.requestId);
    const key = requiredUuid(input.idempotencyKey);
    const fingerprint = requiredFingerprint(input.fingerprint);
    const operation = 'consent_revoke' as const;
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await configureCustomerTransaction(transaction, owner);
      const prior = await priorMutationOutcome(transaction, {
        ownerSubject: owner, idempotencyKey: key, requestId: id, operation, fingerprint,
        successStatus: 'updated',
      });
      if (prior) return prior;

      const [updated] = await transaction<{ revision: number }[]>`
        update public.customer_product_requests
        set photo_identification_consent = false,
            revision = revision + 1,
            updated_at = now()
        where owner_subject = ${owner}
          and id = ${id}
          and revision = ${input.expectedRevision}
          and lifecycle_state <> 'withdrawn'
          and photo_identification_consent = true
        returning revision
      `;
      if (!updated) {
        const raced = await priorMutationOutcome(transaction, {
          ownerSubject: owner, idempotencyKey: key, requestId: id, operation, fingerprint,
          successStatus: 'updated',
        });
        return raced ?? currentConflict(transaction, owner, id, input.expectedRevision);
      }

      await insertMutation(transaction, {
        ownerSubject: owner,
        idempotencyKey: key,
        requestId: id,
        operation,
        fingerprint,
        resultRevision: updated.revision,
      });
      const request = await selectRequest(transaction, owner, id);
      if (!request) throw new Error('Customer product request is unavailable after consent revocation.');
      return { status: 'updated', request, replayed: false };
    });
  },

  async withdraw(input: {
    ownerSubject: string;
    requestId: string;
    expectedRevision: number;
    idempotencyKey: string;
    fingerprint: string;
  }): Promise<CustomerProductRequestMutationOutcome> {
    const owner = requiredOwnerSubject(input.ownerSubject);
    const id = requiredUuid(input.requestId);
    const key = requiredUuid(input.idempotencyKey);
    const fingerprint = requiredFingerprint(input.fingerprint);
    const operation = 'withdraw' as const;
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await configureCustomerTransaction(transaction, owner);
      const prior = await priorMutationOutcome(transaction, {
        ownerSubject: owner, idempotencyKey: key, requestId: id, operation, fingerprint,
        successStatus: 'withdrawn',
      });
      if (prior) return prior;

      const [current] = await transaction<CurrentStateRow[]>`
        select revision, lifecycle_state
        from public.customer_product_requests
        where owner_subject = ${owner}
          and id = ${id}
      `;
      if (!current) return { status: 'not_found' };
      if (current.lifecycle_state === 'withdrawn') {
        await insertMutation(transaction, {
          ownerSubject: owner, idempotencyKey: key, requestId: id, operation, fingerprint,
          resultRevision: current.revision,
        });
        return {
          status: 'withdrawn', requestId: id, revision: current.revision, replayed: true,
        };
      }

      const [updated] = await transaction<{ revision: number }[]>`
        update public.customer_product_requests
        set lifecycle_state = 'withdrawn',
            brand = null,
            full_pack_name = null,
            printed_size_variant = null,
            category = null,
            retailer_label = null,
            source_url = null,
            normalized_entity_ref = null,
            origin_reference = null,
            photo_identification_consent = false,
            revision = revision + 1,
            updated_at = now()
        where owner_subject = ${owner}
          and id = ${id}
          and revision = ${input.expectedRevision}
        returning revision
      `;
      if (!updated) {
        const raced = await priorMutationOutcome(transaction, {
          ownerSubject: owner, idempotencyKey: key, requestId: id, operation, fingerprint,
          successStatus: 'withdrawn',
        });
        return raced ?? currentConflict(transaction, owner, id, input.expectedRevision);
      }

      const removedImages = await transaction<{ blob_pathname: string }[]>`
        delete from public.customer_product_request_images
        where owner_subject = ${owner}
          and request_id = ${id}
        returning blob_pathname
      `;
      for (const image of removedImages) {
        await transaction`
          insert into public.customer_product_request_blob_cleanup (
            owner_subject, request_id, blob_pathname
          ) values (${owner}, ${id}, ${image.blob_pathname})
          on conflict (owner_subject, blob_pathname) do nothing
        `;
      }
      await transaction`select public.sync_customer_product_request_research_signal(${id})`;
      await insertMutation(transaction, {
        ownerSubject: owner, idempotencyKey: key, requestId: id, operation, fingerprint,
        resultRevision: updated.revision,
      });
      return {
        status: 'withdrawn', requestId: id, revision: updated.revision, replayed: false,
      };
    });
  },

  async replaceImage(input: {
    ownerSubject: string;
    requestId: string;
    expectedRevision: number;
    idempotencyKey: string;
    fingerprint: string;
    image: CustomerProductRequestImageMetadata;
  }): Promise<CustomerProductRequestMutationOutcome> {
    const owner = requiredOwnerSubject(input.ownerSubject);
    const id = requiredUuid(input.requestId);
    const key = requiredUuid(input.idempotencyKey);
    const fingerprint = requiredFingerprint(input.fingerprint);
    const operation = 'image_replace' as const;
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await configureCustomerTransaction(transaction, owner);
      const prior = await priorMutationOutcome(transaction, {
        ownerSubject: owner, idempotencyKey: key, requestId: id, operation, fingerprint,
        successStatus: 'updated',
      });
      if (prior) return prior;

      const [updated] = await transaction<{ revision: number }[]>`
        update public.customer_product_requests
        set revision = revision + 1,
            updated_at = now()
        where owner_subject = ${owner}
          and id = ${id}
          and revision = ${input.expectedRevision}
          and lifecycle_state not in ('published', 'withdrawn')
        returning revision
      `;
      if (!updated) {
        const raced = await priorMutationOutcome(transaction, {
          ownerSubject: owner, idempotencyKey: key, requestId: id, operation, fingerprint,
          successStatus: 'updated',
        });
        return raced ?? currentConflict(transaction, owner, id, input.expectedRevision);
      }

      const [oldImage] = await transaction<{ blob_pathname: string }[]>`
        select blob_pathname
        from public.customer_product_request_images
        where owner_subject = ${owner}
          and request_id = ${id}
      `;
      await transaction`
        insert into public.customer_product_request_images (
          owner_subject,
          request_id,
          blob_pathname,
          media_type,
          byte_size,
          pixel_width,
          pixel_height,
          content_sha256
        ) values (
          ${owner},
          ${id},
          ${input.image.blobPathname},
          'image/webp',
          ${input.image.byteSize},
          ${input.image.pixelWidth},
          ${input.image.pixelHeight},
          ${input.image.contentSha256}
        )
        on conflict (request_id) do update
        set blob_pathname = excluded.blob_pathname,
            media_type = excluded.media_type,
            byte_size = excluded.byte_size,
            pixel_width = excluded.pixel_width,
            pixel_height = excluded.pixel_height,
            content_sha256 = excluded.content_sha256,
            updated_at = now()
      `;
      if (oldImage && oldImage.blob_pathname !== input.image.blobPathname) {
        await transaction`
          insert into public.customer_product_request_blob_cleanup (
            owner_subject, request_id, blob_pathname
          ) values (${owner}, ${id}, ${oldImage.blob_pathname})
          on conflict (owner_subject, blob_pathname) do nothing
        `;
      }
      await insertMutation(transaction, {
        ownerSubject: owner, idempotencyKey: key, requestId: id, operation, fingerprint,
        resultRevision: updated.revision,
      });
      const request = await selectRequest(transaction, owner, id);
      if (!request) throw new Error('Customer product request image is unavailable.');
      return { status: 'updated', request, replayed: false };
    });
  },

  async removeImage(input: {
    ownerSubject: string;
    requestId: string;
    expectedRevision: number;
    idempotencyKey: string;
    fingerprint: string;
  }): Promise<CustomerProductRequestMutationOutcome> {
    const owner = requiredOwnerSubject(input.ownerSubject);
    const id = requiredUuid(input.requestId);
    const key = requiredUuid(input.idempotencyKey);
    const fingerprint = requiredFingerprint(input.fingerprint);
    const operation = 'image_remove' as const;
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await configureCustomerTransaction(transaction, owner);
      const prior = await priorMutationOutcome(transaction, {
        ownerSubject: owner, idempotencyKey: key, requestId: id, operation, fingerprint,
        successStatus: 'updated',
      });
      if (prior) return prior;

      const [updated] = await transaction<{ revision: number }[]>`
        update public.customer_product_requests
        set revision = revision + 1,
            updated_at = now()
        where owner_subject = ${owner}
          and id = ${id}
          and revision = ${input.expectedRevision}
          and lifecycle_state not in ('published', 'withdrawn')
        returning revision
      `;
      if (!updated) {
        const raced = await priorMutationOutcome(transaction, {
          ownerSubject: owner, idempotencyKey: key, requestId: id, operation, fingerprint,
          successStatus: 'updated',
        });
        return raced ?? currentConflict(transaction, owner, id, input.expectedRevision);
      }

      const removed = await transaction<{ blob_pathname: string }[]>`
        delete from public.customer_product_request_images
        where owner_subject = ${owner}
          and request_id = ${id}
        returning blob_pathname
      `;
      for (const image of removed) {
        await transaction`
          insert into public.customer_product_request_blob_cleanup (
            owner_subject, request_id, blob_pathname
          ) values (${owner}, ${id}, ${image.blob_pathname})
          on conflict (owner_subject, blob_pathname) do nothing
        `;
      }
      await insertMutation(transaction, {
        ownerSubject: owner, idempotencyKey: key, requestId: id, operation, fingerprint,
        resultRevision: updated.revision,
      });
      const request = await selectRequest(transaction, owner, id);
      if (!request) throw new Error('Customer product request is unavailable after image removal.');
      return { status: 'updated', request, replayed: false };
    });
  },

  async imageAccess(ownerSubject: string, requestId: string) {
    const owner = requiredOwnerSubject(ownerSubject);
    const id = requiredUuid(requestId);
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await configureCustomerTransaction(transaction, owner);
      const [image] = await transaction<{ blob_pathname: string; media_type: string }[]>`
        select image.blob_pathname, image.media_type
        from public.customer_product_request_images image
        join public.customer_product_requests request
          on request.owner_subject = image.owner_subject
          and request.id = image.request_id
        where image.owner_subject = ${owner}
          and image.request_id = ${id}
          and request.lifecycle_state <> 'withdrawn'
      `;
      return image
        ? { blobPathname: image.blob_pathname, mediaType: image.media_type }
        : null;
    });
  },

  async pendingBlobCleanup(ownerSubject: string, requestId: string) {
    const owner = requiredOwnerSubject(ownerSubject);
    const id = requiredUuid(requestId);
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await configureCustomerTransaction(transaction, owner);
      const rows = await transaction<{ blob_pathname: string }[]>`
        select blob_pathname
        from public.customer_product_request_blob_cleanup
        where owner_subject = ${owner}
          and request_id = ${id}
        order by queued_at, blob_pathname
        limit 20
      `;
      return rows.map(row => row.blob_pathname);
    });
  },

  async queueBlobCleanup(ownerSubject: string, requestId: string, blobPathname: string) {
    const owner = requiredOwnerSubject(ownerSubject);
    const id = requiredUuid(requestId);
    const sql = getCustomerShelfPostgresClient();
    await sql.begin(async transaction => {
      await configureCustomerTransaction(transaction, owner);
      await transaction`
        insert into public.customer_product_request_blob_cleanup (
          owner_subject, request_id, blob_pathname
        ) values (${owner}, ${id}, ${blobPathname})
        on conflict (owner_subject, blob_pathname) do nothing
      `;
    });
  },

  async completeBlobCleanup(ownerSubject: string, requestId: string, blobPathname: string) {
    const owner = requiredOwnerSubject(ownerSubject);
    const id = requiredUuid(requestId);
    const sql = getCustomerShelfPostgresClient();
    await sql.begin(async transaction => {
      await configureCustomerTransaction(transaction, owner);
      await transaction`
        delete from public.customer_product_request_blob_cleanup
        where owner_subject = ${owner}
          and request_id = ${id}
          and blob_pathname = ${blobPathname}
      `;
    });
  },
};
