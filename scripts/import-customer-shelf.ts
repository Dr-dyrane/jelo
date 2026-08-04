import { createHash } from 'node:crypto';
import postgres, { type TransactionSql } from 'postgres';
import { LEGACY_SHELF_IMPORT_MANIFEST } from '@/lib/customer/legacy-shelf-import-manifest';
import {
  parseLegacyShelfImportOptions,
  selectExactlyOneVerifiedTarget,
} from '@/lib/customer/legacy-shelf-import-policy';
import { verifyLegacyShelfImportSourceFromGit } from '@/lib/customer/legacy-shelf-import-source';
import { normalizedCustomerProductEntityRef } from '@/lib/customer/product-request-model';
import { requireAdminDatabaseUrl } from './lib/admin-database';

type ResolvedIdentity = {
  identity_version_id: string;
};

type LegacyShelfImportReport = {
  completion: 'already-completed';
  acceptedResolved: number;
  pendingResolved: number;
  routineResolved: number;
  routineStepResolved: number;
} | {
  completion: 'pending' | 'completed';
  acceptedResolved: number;
  acceptedExisting: number;
  acceptedPlannedInsert: number;
  acceptedInserted: number;
  acceptedFinal: number;
  pendingResolved: number;
  pendingExisting: number;
  pendingPlannedInsert: number;
  pendingInserted: number;
  pendingFinal: number;
  routineResolved: number;
  routineExisting: number;
  routinePlannedInsert: number;
  routineInserted: number;
  routineFinal: number;
  routineStepResolved: number;
  routineStepExisting: number;
  routineStepPlannedInsert: number;
  routineStepInserted: number;
  routineStepFinal: number;
};

function hasExactSet(expected: readonly string[], actual: readonly string[]) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return expectedSet.size === expected.length
    && actualSet.size === actual.length
    && expectedSet.size === actualSet.size
    && [...expectedSet].every(value => actualSet.has(value));
}

function deterministicLegacyUuid(ownerSubject: string, kind: string, reference: string) {
  const bytes = createHash('sha256')
    .update('jelocare-legacy-private-data-v1\0')
    .update(LEGACY_SHELF_IMPORT_MANIFEST.id)
    .update('\0')
    .update(ownerSubject)
    .update('\0')
    .update(kind)
    .update('\0')
    .update(reference)
    .digest()
    .subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function deterministicLegacyRequestId(ownerSubject: string, legacyId: string) {
  const bytes = createHash('sha256')
    .update('jelocare-legacy-product-request-v1\0')
    .update(LEGACY_SHELF_IMPORT_MANIFEST.id)
    .update('\0')
    .update(ownerSubject)
    .update('\0')
    .update(legacyId)
    .digest()
    .subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function importWithinTransaction(
  transaction: TransactionSql,
  options: ReturnType<typeof parseLegacyShelfImportOptions>,
): Promise<LegacyShelfImportReport> {
  const manifest = LEGACY_SHELF_IMPORT_MANIFEST;
  await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;

  if (options.apply) {
    await transaction`lock table public.customer_shelf_import_receipts in share row exclusive mode`;
  }

  const candidates = options.apply
    ? await transaction<{ id: string }[]>`
        select auth_user.id
        from neon_auth."user" auth_user
        where auth_user.id = ${options.ownerSubject}
          and pg_catalog.to_jsonb(auth_user) ? 'emailVerified'
          and coalesce((pg_catalog.to_jsonb(auth_user) ->> 'emailVerified')::boolean, false) = true
          and pg_catalog.to_jsonb(auth_user) ? 'banned'
          and coalesce((pg_catalog.to_jsonb(auth_user) ->> 'banned')::boolean, false) = false
        for update of auth_user
      `
    : await transaction<{ id: string }[]>`
        select auth_user.id
        from neon_auth."user" auth_user
        where auth_user.id = ${options.ownerSubject}
          and pg_catalog.to_jsonb(auth_user) ? 'emailVerified'
          and coalesce((pg_catalog.to_jsonb(auth_user) ->> 'emailVerified')::boolean, false) = true
          and pg_catalog.to_jsonb(auth_user) ? 'banned'
          and coalesce((pg_catalog.to_jsonb(auth_user) ->> 'banned')::boolean, false) = false
      `;
  const ownerSubject = selectExactlyOneVerifiedTarget(candidates);
  await transaction`select pg_catalog.set_config('app.customer_subject', ${ownerSubject}, true)`;

  const [receipt] = await transaction<{
    accepted_count: number;
    pending_request_count: number;
    routine_count: number;
    routine_step_count: number;
    source_commit: string;
    source_products_sha256: string;
  }[]>`
    select
      accepted_count,
      pending_request_count,
      routine_count,
      routine_step_count,
      source_commit,
      source_products_sha256
    from public.customer_shelf_import_receipts
    where manifest_id = ${manifest.id}
      and owner_subject = ${ownerSubject}
    limit 1
  `;
  if (receipt && (
    receipt.accepted_count !== manifest.accepted.length
    || receipt.source_commit !== manifest.source.commit
    || receipt.source_products_sha256 !== manifest.source.products.sha256
    || ![0, manifest.pendingRequests.length].includes(receipt.pending_request_count)
    || ![0, manifest.routines.length].includes(receipt.routine_count)
    || ![0, manifest.routines.flatMap(routine => routine.steps).length].includes(receipt.routine_step_count)
    || (receipt.routine_count === 0) !== (receipt.routine_step_count === 0)
  )) {
    throw new Error('Existing legacy import receipt does not match the reviewed manifest.');
  }
  if (
    receipt?.pending_request_count === manifest.pendingRequests.length
    && receipt.routine_count === manifest.routines.length
    && receipt.routine_step_count === manifest.routines.flatMap(routine => routine.steps).length
  ) {
    return {
      completion: 'already-completed',
      acceptedResolved: manifest.accepted.length,
      pendingResolved: manifest.pendingRequests.length,
      routineResolved: manifest.routines.length,
      routineStepResolved: manifest.routines.flatMap(routine => routine.steps).length,
    };
  }

  const acceptedIdentityIds: string[] = [];
  for (const item of manifest.accepted) {
    const rowLock = options.apply
      ? transaction`for share of version, product`
      : transaction``;
    const identities = await transaction<ResolvedIdentity[]>`
      select version.identity_version_id
      from public.catalogue_product_identity_versions version
      join public.products product on product.id = version.product_id
      where version.slug_at_review = ${item.identityVersion.slugAtReview}
        and version.brand_at_review = ${item.identityVersion.brandAtReview}
        and version.variant_at_review = ${item.identityVersion.variantAtReview}
        and version.size_at_review = ${item.identityVersion.sizeAtReview}
        and version.version_number = ${manifest.requiredIdentity.versionNumber}
        and version.provenance = ${manifest.requiredIdentity.provenance}
        and version.public_eligibility_basis = ${manifest.requiredIdentity.publicEligibilityBasis}
        and version.package_version_at_review = ${manifest.requiredIdentity.packageVersion}
        and version.formula_version_at_review = ${manifest.requiredIdentity.formulaVersion}
        and version.lifecycle_state = ${manifest.requiredIdentity.lifecycleState}
        and product.is_published = true
      ${rowLock}
    `;
    if (identities.length !== 1 || !identities[0]) {
      throw new Error('A reviewed legacy binding did not resolve exactly once.');
    }
    acceptedIdentityIds.push(identities[0].identity_version_id);
  }
  if (new Set(acceptedIdentityIds).size !== manifest.accepted.length) {
    throw new Error('Reviewed legacy bindings did not resolve to distinct identities.');
  }

  const pendingRequestIds = manifest.pendingRequests.map(item => (
    deterministicLegacyRequestId(ownerSubject, item.legacyId)
  ));
  if (new Set(pendingRequestIds).size !== manifest.pendingRequests.length) {
    throw new Error('Pending legacy request IDs did not resolve distinctly.');
  }
  const acceptedIdentityByLegacyId = new Map<string, string>(
    manifest.accepted.map((item, index) => [item.legacyId, acceptedIdentityIds[index]!] as const),
  );
  const pendingRequestByLegacyId = new Map<string, string>(
    manifest.pendingRequests.map((item, index) => [item.legacyId, pendingRequestIds[index]!] as const),
  );
  const routineIds = manifest.routines.map(routine => (
    deterministicLegacyUuid(ownerSubject, 'routine', routine.legacyId)
  ));
  const routineStepBindings = manifest.routines.flatMap((routine, routineIndex) => (
    routine.steps.map(step => ({
      routine,
      routineId: routineIds[routineIndex]!,
      step,
      stepId: deterministicLegacyUuid(
        ownerSubject,
        'routine-step',
        `${routine.legacyId}:${step.position}`,
      ),
    }))
  ));
  const routineStepIds = routineStepBindings.map(binding => binding.stepId);
  if (
    new Set(routineIds).size !== manifest.routines.length
    || new Set(routineStepIds).size !== routineStepBindings.length
  ) {
    throw new Error('Reviewed legacy routine IDs did not resolve distinctly.');
  }

  for (const item of manifest.pendingRequests) {
    const [exactMatch] = await transaction<{ slug: string }[]>`
      select product.slug
      from public.catalogue_product_identity_versions version
      join public.products product on product.id = version.product_id
      where version.lifecycle_state = 'active'
        and product.is_published = true
        and pg_catalog.lower(pg_catalog.btrim(version.brand_at_review)) = ${item.request.brand.toLowerCase()}
        and pg_catalog.lower(pg_catalog.btrim(version.variant_at_review)) = ${item.request.fullPackName.toLowerCase()}
        and pg_catalog.lower(pg_catalog.btrim(version.size_at_review)) = ${item.request.printedSizeVariant.toLowerCase()}
      limit 1
    `;
    if (exactMatch) {
      throw new Error('A pending legacy request now has an active exact catalogue identity.');
    }
  }

  if (options.apply) {
    await transaction`lock table public.customer_shelf_items in share row exclusive mode`;
    await transaction`lock table public.customer_product_requests in share row exclusive mode`;
    await transaction`lock table public.customer_routines in share row exclusive mode`;
    await transaction`lock table public.customer_routine_steps in share row exclusive mode`;
  }

  const existingAcceptedRows = await transaction<{ product_identity_version_id: string }[]>`
    select product_identity_version_id
    from public.customer_shelf_items
    where owner_subject = ${ownerSubject}
  `;
  const existingAcceptedSet = new Set(
    existingAcceptedRows.map(item => item.product_identity_version_id),
  );
  const acceptedExisting = acceptedIdentityIds.filter(id => existingAcceptedSet.has(id));
  // A receipt from the earlier five-item import is authoritative evidence that
  // its accepted rows were already offered once. During the 5 -> 5+9 receipt
  // upgrade, never re-add an accepted Shelf row the customer later removed.
  const acceptedToAdd = receipt
    ? []
    : acceptedIdentityIds.filter(id => !existingAcceptedSet.has(id));

  const existingPendingRows = await transaction<{ id: string }[]>`
    select id
    from public.customer_product_requests
    where owner_subject = ${ownerSubject}
      and id = any(${pendingRequestIds}::uuid[])
  `;
  const existingPendingSet = new Set(existingPendingRows.map(item => item.id));
  const pendingExisting = pendingRequestIds.filter(id => existingPendingSet.has(id));
  const pendingToAdd = pendingRequestIds.filter(id => !existingPendingSet.has(id));

  const existingRoutineRows = await transaction<{ id: string }[]>`
    select id
    from public.customer_routines
    where owner_subject = ${ownerSubject}
      and id = any(${routineIds}::uuid[])
  `;
  const existingRoutineSet = new Set(existingRoutineRows.map(item => item.id));
  const routineExisting = routineIds.filter(id => existingRoutineSet.has(id));
  const routineToAdd = routineIds.filter(id => !existingRoutineSet.has(id));

  const existingRoutineStepRows = await transaction<{ id: string }[]>`
    select id
    from public.customer_routine_steps
    where owner_subject = ${ownerSubject}
      and id = any(${routineStepIds}::uuid[])
  `;
  const existingRoutineStepSet = new Set(existingRoutineStepRows.map(item => item.id));
  const routineStepExisting = routineStepIds.filter(id => existingRoutineStepSet.has(id));
  const routineStepToAdd = routineStepIds.filter(id => !existingRoutineStepSet.has(id));

  const acceptedInserted: string[] = [];
  const pendingInserted: string[] = [];
  const routineInserted: string[] = [];
  const routineStepInserted: string[] = [];
  let acceptedFinal = acceptedExisting;
  let pendingFinal = pendingExisting;
  let routineFinal = routineExisting;
  let routineStepFinal = routineStepExisting;

  if (options.apply) {
    for (const identityVersionId of acceptedToAdd) {
      const insertedRows = await transaction<{ product_identity_version_id: string }[]>`
        insert into public.customer_shelf_items (
          owner_subject,
          product_identity_version_id,
          save_origin
        ) values (
          ${ownerSubject},
          ${identityVersionId},
          'legacy_pages_v1_0'
        )
        on conflict (owner_subject, product_identity_version_id) do nothing
        returning product_identity_version_id
      `;
      if (insertedRows[0]) acceptedInserted.push(insertedRows[0].product_identity_version_id);
    }
    if (!hasExactSet(acceptedToAdd, acceptedInserted)) {
      throw new Error('Legacy Shelf inserts did not match the planned accepted identities.');
    }

    for (const [index, item] of manifest.pendingRequests.entries()) {
      const requestId = pendingRequestIds[index]!;
      const insertedRows = await transaction<{ id: string }[]>`
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
          origin_reference,
          submitted_at
        ) values (
          ${requestId},
          ${ownerSubject},
          'pending',
          ${item.request.brand},
          ${item.request.fullPackName},
          ${item.request.printedSizeVariant},
          ${item.request.category},
          ${item.request.retailerLabel},
          ${item.request.sourceUrl},
          ${normalizedCustomerProductEntityRef(item.request)},
          false,
          'legacy_pages_v1_0',
          ${`${manifest.id}:${item.legacyId}`},
          now()
        )
        on conflict (id) do nothing
        returning id
      `;
      if (insertedRows[0]) pendingInserted.push(insertedRows[0].id);
      await transaction`select public.sync_customer_product_request_research_signal(${requestId})`;
    }
    if (!hasExactSet(pendingToAdd, pendingInserted)) {
      throw new Error('Legacy pending request inserts did not match the planned identities.');
    }

    for (const [index, routine] of manifest.routines.entries()) {
      const routineId = routineIds[index]!;
      const insertedRows = await transaction<{ id: string }[]>`
        insert into public.customer_routines (
          id,
          owner_subject,
          name,
          origin,
          origin_reference
        ) values (
          ${routineId},
          ${ownerSubject},
          ${routine.name},
          'legacy_pages_v1_0',
          ${`${manifest.id}:${routine.legacyId}`}
        )
        on conflict (id) do nothing
        returning id
      `;
      if (insertedRows[0]) routineInserted.push(insertedRows[0].id);
    }
    if (!hasExactSet(routineToAdd, routineInserted)) {
      throw new Error('Legacy routine inserts did not match the planned routines.');
    }

    for (const binding of routineStepBindings) {
      const { reference } = binding.step;
      const productIdentityVersionId = reference.state === 'catalogue'
        ? acceptedIdentityByLegacyId.get(reference.legacyId) ?? null
        : null;
      const productRequestId = reference.state === 'product_request'
        ? pendingRequestByLegacyId.get(reference.legacyId) ?? null
        : null;
      if (
        (reference.state === 'catalogue' && !productIdentityVersionId)
        || (reference.state === 'product_request' && !productRequestId)
      ) {
        throw new Error('A reviewed legacy routine reference did not resolve exactly once.');
      }
      const insertedRows = await transaction<{ id: string }[]>`
        insert into public.customer_routine_steps (
          id,
          routine_id,
          owner_subject,
          position,
          label,
          instruction,
          reference_state,
          product_identity_version_id,
          product_request_id
        ) values (
          ${binding.stepId},
          ${binding.routineId},
          ${ownerSubject},
          ${binding.step.position},
          ${binding.step.label},
          ${binding.step.instruction},
          ${reference.state},
          ${productIdentityVersionId},
          ${productRequestId}
        )
        on conflict (id) do nothing
        returning id
      `;
      if (insertedRows[0]) routineStepInserted.push(insertedRows[0].id);
    }
    if (!hasExactSet(routineStepToAdd, routineStepInserted)) {
      throw new Error('Legacy routine step inserts did not match the planned steps.');
    }

    const finalAcceptedRows = await transaction<{ product_identity_version_id: string }[]>`
      select product_identity_version_id
      from public.customer_shelf_items
      where owner_subject = ${ownerSubject}
        and product_identity_version_id = any(${acceptedIdentityIds}::uuid[])
    `;
    acceptedFinal = finalAcceptedRows.map(item => item.product_identity_version_id);
    if (!receipt && !hasExactSet(acceptedIdentityIds, acceptedFinal)) {
      throw new Error('The final Shelf does not contain the exact accepted identity set.');
    }

    const finalPendingRows = await transaction<{
      id: string;
      lifecycle_state: string;
      origin: string;
      brand: string | null;
      full_pack_name: string | null;
      printed_size_variant: string | null;
      category: string | null;
      retailer_label: string | null;
      source_url: string | null;
      normalized_entity_ref: string | null;
      photo_identification_consent: boolean;
      matched_identity_version_id: string | null;
      origin_reference: string | null;
    }[]>`
      select
        id,
        lifecycle_state,
        origin,
        brand,
        full_pack_name,
        printed_size_variant,
        category,
        retailer_label,
        source_url,
        normalized_entity_ref,
        photo_identification_consent,
        matched_identity_version_id,
        origin_reference
      from public.customer_product_requests
      where owner_subject = ${ownerSubject}
        and id = any(${pendingRequestIds}::uuid[])
    `;
    pendingFinal = finalPendingRows.map(item => item.id);
    const finalPendingById = new Map(finalPendingRows.map(item => [item.id, item]));
    const pendingTupleDrift = manifest.pendingRequests.some((item, index) => {
      const row = finalPendingById.get(pendingRequestIds[index]!);
      return !row
        || row.lifecycle_state !== 'pending'
        || row.origin !== 'legacy_pages_v1_0'
        || row.brand !== item.request.brand
        || row.full_pack_name !== item.request.fullPackName
        || row.printed_size_variant !== item.request.printedSizeVariant
        || row.category !== item.request.category
        || row.retailer_label !== item.request.retailerLabel
        || row.source_url !== item.request.sourceUrl
        || row.normalized_entity_ref !== normalizedCustomerProductEntityRef(item.request)
        || row.photo_identification_consent
        || row.matched_identity_version_id !== null
        || row.origin_reference !== `${manifest.id}:${item.legacyId}`;
    });
    if (
      !hasExactSet(pendingRequestIds, pendingFinal)
      || pendingTupleDrift
    ) {
      throw new Error('The final Shelf does not contain the exact pending request set.');
    }

    const finalRoutineRows = await transaction<{
      id: string;
      name: string;
      origin: string;
      origin_reference: string | null;
    }[]>`
      select id, name, origin, origin_reference
      from public.customer_routines
      where owner_subject = ${ownerSubject}
        and id = any(${routineIds}::uuid[])
    `;
    routineFinal = finalRoutineRows.map(row => row.id);
    const finalRoutineById = new Map(finalRoutineRows.map(row => [row.id, row]));
    const routineTupleDrift = manifest.routines.some((routine, index) => {
      const row = finalRoutineById.get(routineIds[index]!);
      return !row
        || row.name !== routine.name
        || row.origin !== 'legacy_pages_v1_0'
        || row.origin_reference !== `${manifest.id}:${routine.legacyId}`;
    });
    if (!hasExactSet(routineIds, routineFinal) || routineTupleDrift) {
      throw new Error('The final import does not contain the exact reviewed routines.');
    }

    const finalRoutineStepRows = await transaction<{
      id: string;
      routine_id: string;
      position: number;
      label: string;
      instruction: string;
      reference_state: string;
      product_identity_version_id: string | null;
      product_request_id: string | null;
    }[]>`
      select
        id,
        routine_id,
        position,
        label,
        instruction,
        reference_state,
        product_identity_version_id,
        product_request_id
      from public.customer_routine_steps
      where owner_subject = ${ownerSubject}
        and id = any(${routineStepIds}::uuid[])
    `;
    routineStepFinal = finalRoutineStepRows.map(row => row.id);
    const finalRoutineStepById = new Map(finalRoutineStepRows.map(row => [row.id, row]));
    const routineStepTupleDrift = routineStepBindings.some(binding => {
      const row = finalRoutineStepById.get(binding.stepId);
      const { reference } = binding.step;
      const productIdentityVersionId = reference.state === 'catalogue'
        ? acceptedIdentityByLegacyId.get(reference.legacyId) ?? null
        : null;
      const productRequestId = reference.state === 'product_request'
        ? pendingRequestByLegacyId.get(reference.legacyId) ?? null
        : null;
      return !row
        || row.routine_id !== binding.routineId
        || row.position !== binding.step.position
        || row.label !== binding.step.label
        || row.instruction !== binding.step.instruction
        || row.reference_state !== reference.state
        || row.product_identity_version_id !== productIdentityVersionId
        || row.product_request_id !== productRequestId;
    });
    if (!hasExactSet(routineStepIds, routineStepFinal) || routineStepTupleDrift) {
      throw new Error('The final import does not contain the exact reviewed routine steps.');
    }

    await transaction`
      insert into public.customer_shelf_import_receipts (
        manifest_id,
        owner_subject,
        source_commit,
        source_products_sha256,
        accepted_count,
        pending_request_count,
        routine_count,
        routine_step_count
      ) values (
        ${manifest.id},
        ${ownerSubject},
        ${manifest.source.commit},
        ${manifest.source.products.sha256},
        ${acceptedIdentityIds.length},
        ${pendingRequestIds.length},
        ${routineIds.length},
        ${routineStepIds.length}
      )
      on conflict (manifest_id, owner_subject) do update
      set pending_request_count = excluded.pending_request_count,
          routine_count = excluded.routine_count,
          routine_step_count = excluded.routine_step_count
    `;
  }

  return {
    completion: options.apply ? 'completed' : 'pending',
    acceptedResolved: acceptedIdentityIds.length,
    acceptedExisting: acceptedExisting.length,
    acceptedPlannedInsert: acceptedToAdd.length,
    acceptedInserted: acceptedInserted.length,
    acceptedFinal: acceptedFinal.length,
    pendingResolved: pendingRequestIds.length,
    pendingExisting: pendingExisting.length,
    pendingPlannedInsert: pendingToAdd.length,
    pendingInserted: pendingInserted.length,
    pendingFinal: pendingFinal.length,
    routineResolved: routineIds.length,
    routineExisting: routineExisting.length,
    routinePlannedInsert: routineToAdd.length,
    routineInserted: routineInserted.length,
    routineFinal: routineFinal.length,
    routineStepResolved: routineStepIds.length,
    routineStepExisting: routineStepExisting.length,
    routineStepPlannedInsert: routineStepToAdd.length,
    routineStepInserted: routineStepInserted.length,
    routineStepFinal: routineStepFinal.length,
  };
}

async function main() {
  const options = parseLegacyShelfImportOptions(process.argv.slice(2), process.env);
  verifyLegacyShelfImportSourceFromGit();
  const connectionString = requireAdminDatabaseUrl();

  const sql = postgres(connectionString, { max: 1, prepare: false });
  try {
    const work = (transaction: TransactionSql) => importWithinTransaction(transaction, options);
    const report = options.apply
      ? await sql.begin(work)
      : await sql.begin('read only', work);

    const mode = options.apply ? 'APPLIED' : 'DRY RUN';
    const detail = report.completion === 'already-completed'
      ? ''
      : `; accepted-existing=${report.acceptedExisting}; accepted-would-insert=${report.acceptedPlannedInsert}; accepted-inserted=${report.acceptedInserted}; accepted-final=${report.acceptedFinal}; pending-existing=${report.pendingExisting}; pending-would-insert=${report.pendingPlannedInsert}; pending-inserted=${report.pendingInserted}; pending-final=${report.pendingFinal}; routines-existing=${report.routineExisting}; routines-would-insert=${report.routinePlannedInsert}; routines-inserted=${report.routineInserted}; routines-final=${report.routineFinal}; routine-steps-existing=${report.routineStepExisting}; routine-steps-would-insert=${report.routineStepPlannedInsert}; routine-steps-inserted=${report.routineStepInserted}; routine-steps-final=${report.routineStepFinal}`;
    console.log(`${mode}: target verified; completion=${report.completion}; accepted=${report.acceptedResolved}; pending=${report.pendingResolved}; routines=${report.routineResolved}; routine-steps=${report.routineStepResolved}${detail}.`);
  } finally {
    await sql.end();
  }
}

main().catch(() => {
  console.error('Customer Shelf import failed. No private target details were printed.');
  process.exitCode = 1;
});
