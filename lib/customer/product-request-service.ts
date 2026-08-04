import 'server-only';

import { createHash } from 'node:crypto';
import type { CustomerAccessIdentity } from './access-policy';
import {
  deletePrivateCustomerProductRequestImage,
  readPrivateCustomerProductRequestImage,
  storePrivateCustomerProductRequestImage,
} from './product-request-image';
import {
  normalizedCustomerProductEntityRef,
  type CustomerProductRequest,
} from './product-request-model';
import {
  postgresCustomerProductRequestRepository,
  type CustomerProductRequestIdentityFields,
  type CustomerProductRequestMutationOutcome,
} from './product-request-repository';
import {
  isCustomerProductRequestPhotoConsentOnlyRevocation,
  type CreateCustomerProductRequestInput,
  type CustomerProductRequestMutationInput,
  type UpdateCustomerProductRequestInput,
} from './product-request-schema';
import { isValidCustomerShelfOwnerSubject } from './shelf-policy';

type ProductRequestRepository = typeof postgresCustomerProductRequestRepository;

export type CustomerProductRequestReadResult =
  | { status: 'ready'; requests: CustomerProductRequest[] }
  | { status: 'unavailable'; requests: []; message: string };

export type CustomerProductRequestItemResult =
  | { status: 'ready'; request: CustomerProductRequest }
  | { status: 'not_found'; message: string }
  | { status: 'unavailable'; message: string };

export type CustomerProductRequestActionResult =
  | CustomerProductRequestMutationOutcome
  | { status: 'unavailable'; message: string };

function persistableOwner(identity: CustomerAccessIdentity) {
  return identity.source === 'session' && isValidCustomerShelfOwnerSubject(identity.subject)
    ? identity.subject
    : null;
}

function identityFields(input: {
  brand: string;
  fullPackName: string;
  printedSizeVariant: string;
  category: string | null;
  retailerLabel: string | null;
  sourceUrl: string | null;
  photoIdentificationConsent: boolean;
}): CustomerProductRequestIdentityFields {
  return {
    ...input,
    normalizedEntityRef: normalizedCustomerProductEntityRef(input),
  };
}

function fingerprint(kind: string, payload: Record<string, unknown>) {
  return createHash('sha256')
    .update(JSON.stringify({ kind, ...payload }), 'utf8')
    .digest('hex');
}

async function cleanupQueuedBlobs(
  repository: ProductRequestRepository,
  ownerSubject: string,
  requestId: string,
) {
  try {
    const pathnames = await repository.pendingBlobCleanup(ownerSubject, requestId);
    for (const pathname of pathnames) {
      try {
        await deletePrivateCustomerProductRequestImage(pathname);
        await repository.completeBlobCleanup(ownerSubject, requestId, pathname);
      } catch {
        // The private pathname remains in the owner-isolated cleanup queue for a retry.
      }
    }
  } catch {
    // Cleanup is durable in the database and must not roll back the customer mutation.
  }
}

async function discardUnattachedBlob(
  repository: ProductRequestRepository,
  ownerSubject: string,
  requestId: string,
  pathname: string,
) {
  try {
    await deletePrivateCustomerProductRequestImage(pathname);
  } catch {
    try {
      await repository.queueBlobCleanup(ownerSubject, requestId, pathname);
    } catch {
      console.error('Private customer product request image cleanup could not be queued.');
    }
  }
}

export function createCustomerProductRequestService(
  repository: ProductRequestRepository = postgresCustomerProductRequestRepository,
) {
  return {
    async list(identity: CustomerAccessIdentity): Promise<CustomerProductRequestReadResult> {
      const owner = persistableOwner(identity);
      if (!owner) {
        return { status: 'unavailable', requests: [], message: 'Product requests are unavailable in preview.' };
      }
      try {
        return { status: 'ready', requests: await repository.list(owner) };
      } catch {
        console.error('Customer product request list unavailable.');
        return { status: 'unavailable', requests: [], message: 'Product requests are unavailable right now.' };
      }
    },

    async get(identity: CustomerAccessIdentity, requestId: string): Promise<CustomerProductRequestItemResult> {
      const owner = persistableOwner(identity);
      if (!owner) return { status: 'unavailable', message: 'Product requests are unavailable in preview.' };
      try {
        const request = await repository.get(owner, requestId);
        return request
          ? { status: 'ready', request }
          : { status: 'not_found', message: 'Product request not found.' };
      } catch {
        console.error('Customer product request read unavailable.');
        return { status: 'unavailable', message: 'Product request is unavailable right now.' };
      }
    },

    async create(
      identity: CustomerAccessIdentity,
      input: CreateCustomerProductRequestInput,
    ): Promise<CustomerProductRequestActionResult> {
      const owner = persistableOwner(identity);
      if (!owner) return { status: 'unavailable', message: 'Product requests cannot be saved in preview.' };
      const requestIdentity = identityFields(input);
      try {
        return await repository.create({
          ownerSubject: owner,
          idempotencyKey: input.idempotencyKey,
          fingerprint: fingerprint('create', {
            ...requestIdentity,
            submit: input.submit,
          }),
          identity: requestIdentity,
          submit: input.submit,
        });
      } catch {
        console.error('Customer product request creation unavailable.');
        return { status: 'unavailable', message: 'Could not save the product request.' };
      }
    },

    async update(
      identity: CustomerAccessIdentity,
      requestId: string,
      input: UpdateCustomerProductRequestInput,
    ): Promise<CustomerProductRequestActionResult> {
      const owner = persistableOwner(identity);
      if (!owner) return { status: 'unavailable', message: 'Product requests cannot be changed in preview.' };
      try {
        const current = await repository.get(owner, requestId);
        if (!current) return { status: 'not_found' };
        if (isCustomerProductRequestPhotoConsentOnlyRevocation(input)) {
          return await repository.revokePhotoIdentificationConsent({
            ownerSubject: owner,
            requestId,
            expectedRevision: input.revision,
            idempotencyKey: input.idempotencyKey,
            fingerprint: fingerprint('consent_revoke', {
              requestId,
              expectedRevision: input.revision,
              photoIdentificationConsent: false,
            }),
          });
        }
        const requestIdentity = identityFields({
          brand: input.brand ?? current.brand,
          fullPackName: input.fullPackName ?? current.fullPackName,
          printedSizeVariant: input.printedSizeVariant ?? current.printedSizeVariant,
          category: input.category === undefined ? current.category : input.category,
          retailerLabel: input.retailerLabel === undefined ? current.retailerLabel : input.retailerLabel,
          sourceUrl: input.sourceUrl === undefined ? current.sourceUrl : input.sourceUrl,
          photoIdentificationConsent: input.photoIdentificationConsent
            ?? current.photo.identificationConsent,
        });
        return await repository.update({
          ownerSubject: owner,
          requestId,
          expectedRevision: input.revision,
          idempotencyKey: input.idempotencyKey,
          fingerprint: fingerprint(input.submit ? 'submit' : 'update', {
            requestId,
            expectedRevision: input.revision,
            brand: input.brand,
            fullPackName: input.fullPackName,
            printedSizeVariant: input.printedSizeVariant,
            category: input.category,
            retailerLabel: input.retailerLabel,
            sourceUrl: input.sourceUrl,
            photoIdentificationConsent: input.photoIdentificationConsent,
            submit: input.submit === true,
          }),
          identity: requestIdentity,
          submit: input.submit === true,
        });
      } catch {
        console.error('Customer product request update unavailable.');
        return { status: 'unavailable', message: 'Could not update the product request.' };
      }
    },

    async withdraw(
      identity: CustomerAccessIdentity,
      requestId: string,
      input: CustomerProductRequestMutationInput,
    ): Promise<CustomerProductRequestActionResult> {
      const owner = persistableOwner(identity);
      if (!owner) return { status: 'unavailable', message: 'Product requests cannot be withdrawn in preview.' };
      try {
        const result = await repository.withdraw({
          ownerSubject: owner,
          requestId,
          expectedRevision: input.revision,
          idempotencyKey: input.idempotencyKey,
          fingerprint: fingerprint('withdraw', {
            requestId,
            expectedRevision: input.revision,
          }),
        });
        if (result.status === 'withdrawn') await cleanupQueuedBlobs(repository, owner, requestId);
        return result;
      } catch {
        console.error('Customer product request withdrawal unavailable.');
        return { status: 'unavailable', message: 'Could not withdraw the product request.' };
      }
    },

    async replaceImage(
      identity: CustomerAccessIdentity,
      requestId: string,
      input: CustomerProductRequestMutationInput,
      file: File,
    ): Promise<CustomerProductRequestActionResult> {
      const owner = persistableOwner(identity);
      if (!owner) return { status: 'unavailable', message: 'Photos cannot be saved in preview.' };
      let stored: Awaited<ReturnType<typeof storePrivateCustomerProductRequestImage>> | null = null;
      try {
        const current = await repository.get(owner, requestId);
        if (!current) return { status: 'not_found' };
        stored = await storePrivateCustomerProductRequestImage({
          ownerSubject: owner,
          requestId,
          idempotencyKey: input.idempotencyKey,
          file,
        });
        const result = await repository.replaceImage({
          ownerSubject: owner,
          requestId,
          expectedRevision: input.revision,
          idempotencyKey: input.idempotencyKey,
          fingerprint: fingerprint('image_replace', {
            requestId,
            expectedRevision: input.revision,
            contentSha256: stored.contentSha256,
          }),
          image: stored,
        });
        if (result.status === 'updated') {
          await cleanupQueuedBlobs(repository, owner, requestId);
        } else {
          await discardUnattachedBlob(repository, owner, requestId, stored.blobPathname);
        }
        return result;
      } catch (error) {
        if (stored) await discardUnattachedBlob(repository, owner, requestId, stored.blobPathname);
        const imageError = error instanceof Error && [
          'unsupported_image_type',
          'invalid_image_size',
          'image_type_mismatch',
          'invalid_processed_image',
        ].includes(error.message);
        return {
          status: 'unavailable',
          message: imageError
            ? 'Use one JPEG, PNG, or WebP photo up to 4 MB.'
            : 'Could not save the private photo.',
        };
      }
    },

    async removeImage(
      identity: CustomerAccessIdentity,
      requestId: string,
      input: CustomerProductRequestMutationInput,
    ): Promise<CustomerProductRequestActionResult> {
      const owner = persistableOwner(identity);
      if (!owner) return { status: 'unavailable', message: 'Photos cannot be changed in preview.' };
      try {
        const result = await repository.removeImage({
          ownerSubject: owner,
          requestId,
          expectedRevision: input.revision,
          idempotencyKey: input.idempotencyKey,
          fingerprint: fingerprint('image_remove', {
            requestId,
            expectedRevision: input.revision,
          }),
        });
        if (result.status === 'updated') await cleanupQueuedBlobs(repository, owner, requestId);
        return result;
      } catch {
        console.error('Customer product request image removal unavailable.');
        return { status: 'unavailable', message: 'Could not remove the private photo.' };
      }
    },

    async readImage(identity: CustomerAccessIdentity, requestId: string) {
      const owner = persistableOwner(identity);
      if (!owner) return null;
      try {
        const access = await repository.imageAccess(owner, requestId);
        return access
          ? await readPrivateCustomerProductRequestImage(access.blobPathname)
          : null;
      } catch {
        console.error('Customer product request image read unavailable.');
        return null;
      }
    },
  };
}

export const customerProductRequestService = createCustomerProductRequestService();
