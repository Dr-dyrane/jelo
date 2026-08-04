import 'server-only';

import { LEGACY_SHELF_IMPORT_MANIFEST } from './legacy-shelf-import-manifest';
import {
  normalizedCustomerProductEntityRef,
  type CustomerProductRequest,
  type CustomerProductRequestPresentationViewModel,
} from './product-request-model';

const SYNTHETIC_TIMESTAMP = '2026-08-03T00:00:00.000Z';

const SYNTHETIC_LEGACY_PRODUCT_REQUESTS: readonly CustomerProductRequest[] =
  LEGACY_SHELF_IMPORT_MANIFEST.pendingRequests.map((entry, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    revision: 0,
    lifecycleState: 'pending',
    brand: entry.request.brand,
    fullPackName: entry.request.fullPackName,
    printedSizeVariant: entry.request.printedSizeVariant,
    category: entry.request.category,
    retailerLabel: entry.request.retailerLabel,
    sourceUrl: entry.request.sourceUrl,
    origin: 'legacy_pages_v1_0',
    createdAt: SYNTHETIC_TIMESTAMP,
    updatedAt: SYNTHETIC_TIMESTAMP,
    submittedAt: SYNTHETIC_TIMESTAMP,
    normalizedEntityRef: normalizedCustomerProductEntityRef(entry.request),
    matchedIdentityVersionId: null,
    photo: {
      present: false,
      identificationConsent: false,
    },
  }));

function toPresentationRequest(request: CustomerProductRequest): CustomerProductRequest {
  return {
    id: request.id,
    revision: request.revision,
    lifecycleState: request.lifecycleState,
    brand: request.brand,
    fullPackName: request.fullPackName,
    printedSizeVariant: request.printedSizeVariant,
    category: request.category,
    retailerLabel: request.retailerLabel,
    sourceUrl: request.sourceUrl,
    origin: request.origin,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    submittedAt: request.submittedAt,
    normalizedEntityRef: request.normalizedEntityRef,
    matchedIdentityVersionId: request.matchedIdentityVersionId,
    photo: {
      present: request.photo.present,
      identificationConsent: request.photo.identificationConsent,
    },
  };
}

export function createSyntheticProductRequestPresentation(
  selectedRequestId?: string,
): CustomerProductRequestPresentationViewModel {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Synthetic product requests are available only in development.');
  }
  const requests = SYNTHETIC_LEGACY_PRODUCT_REQUESTS.map(toPresentationRequest);
  return {
    requests,
    selectedRequest: selectedRequestId
      ? requests.find(request => request.id === selectedRequestId) ?? null
      : null,
  };
}
