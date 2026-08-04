import type { CustomerPortalProduct } from '@/lib/customer/portal-model';
import {
  CUSTOMER_PRODUCT_REQUEST_LIFECYCLE_STATES,
  type CustomerProductRequest,
  type CustomerProductRequestLifecycleState,
} from '@/lib/customer/product-request-model';

export const PRODUCT_REQUEST_LIFECYCLE_STATES = CUSTOMER_PRODUCT_REQUEST_LIFECYCLE_STATES;

export type ProductRequestLifecycleState = CustomerProductRequestLifecycleState;
export type ProductRequest = CustomerProductRequest;

export type ProductRequestFields = Pick<
  ProductRequest,
  | 'brand'
  | 'fullPackName'
  | 'printedSizeVariant'
  | 'category'
  | 'retailerLabel'
  | 'sourceUrl'
> & {
  photoIdentificationConsent: boolean;
};

export const PRODUCT_REQUEST_FIELD_LIMITS = {
  brand: 120,
  fullPackName: 240,
  printedSizeVariant: 120,
  category: 80,
  retailerLabel: 160,
  sourceUrl: 2_048,
  photoBytes: 4 * 1024 * 1024,
} as const;

export const PRODUCT_REQUEST_LIFECYCLE_LABELS: Record<ProductRequestLifecycleState, string> = {
  draft: 'Draft',
  pending: 'Pending',
  in_review: 'In review',
  needs_info: 'Needs info',
  matched: 'Matched',
  published: 'Published',
  withdrawn: 'Withdrawn',
};

export const MUTED_PRODUCT_REQUEST_STATES = new Set<ProductRequestLifecycleState>([
  'pending',
  'in_review',
  'needs_info',
]);

export const EDITABLE_PRODUCT_REQUEST_IDENTITY_STATES = new Set<ProductRequestLifecycleState>([
  'draft',
  'pending',
  'needs_info',
]);

export function canEditProductRequestIdentity(request: ProductRequest) {
  return EDITABLE_PRODUCT_REQUEST_IDENTITY_STATES.has(request.lifecycleState);
}

export function canManageProductRequestPhoto(request: ProductRequest) {
  return request.lifecycleState !== 'published' && request.lifecycleState !== 'withdrawn';
}

export function canRevokeProductRequestPhotoConsent(request: ProductRequest) {
  return request.lifecycleState !== 'withdrawn' && request.photo.identificationConsent;
}

export function normalizeProductIdentity(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function canonicalIdentityAliases(product: CustomerPortalProduct) {
  return [
    product.name,
    `${product.brand} ${product.name}`,
    `${product.name} ${product.size}`,
    `${product.brand} ${product.name} ${product.size}`,
  ].map(normalizeProductIdentity);
}

export function findExactCanonicalIdentity(
  catalogue: readonly CustomerPortalProduct[],
  query: string,
) {
  const normalizedQuery = normalizeProductIdentity(query);
  if (!normalizedQuery) return undefined;
  return catalogue.find((product) => canonicalIdentityAliases(product).includes(normalizedQuery));
}

export function searchCanonicalIdentities(
  catalogue: readonly CustomerPortalProduct[],
  query: string,
  limit = 6,
) {
  const normalizedQuery = normalizeProductIdentity(query);
  if (!normalizedQuery) return [];
  const terms = normalizedQuery.split(' ');
  return catalogue
    .map((product) => {
      const identity = normalizeProductIdentity(
        `${product.brand} ${product.name} ${product.size} ${product.category}`,
      );
      const matchedTerms = terms.filter((term) => identity.includes(term)).length;
      return { product, matchedTerms, exact: canonicalIdentityAliases(product).includes(normalizedQuery) };
    })
    .filter((entry) => entry.matchedTerms === terms.length)
    .sort((left, right) => Number(right.exact) - Number(left.exact)
      || left.product.name.localeCompare(right.product.name))
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.product);
}

export function productRequestFingerprint(value: unknown) {
  const stable = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(stable);
    if (input && typeof input === 'object') {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, stable(entry)]),
      );
    }
    return input;
  };
  return JSON.stringify(stable(value));
}

export type RetryKey = { fingerprint: string; idempotencyKey: string };

export function retryKeyFor(
  previous: RetryKey | null,
  payload: unknown,
  createKey: () => string = createProductRequestIdempotencyKey,
): RetryKey {
  const fingerprint = productRequestFingerprint(payload);
  return previous?.fingerprint === fingerprint
    ? previous
    : { fingerprint, idempotencyKey: createKey() };
}

export function createProductRequestIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `me-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function isProductRequest(value: unknown): value is ProductRequest {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProductRequest>;
  return typeof candidate.id === 'string'
    && typeof candidate.revision === 'number'
    && PRODUCT_REQUEST_LIFECYCLE_STATES.includes(candidate.lifecycleState as ProductRequestLifecycleState)
    && typeof candidate.brand === 'string'
    && typeof candidate.fullPackName === 'string'
    && typeof candidate.printedSizeVariant === 'string'
    && (candidate.origin === 'customer' || candidate.origin === 'legacy_pages_v1_0');
}

export function createProductRequestFields(request?: ProductRequest): ProductRequestFields {
  return {
    brand: request?.brand ?? '',
    fullPackName: request?.fullPackName ?? '',
    printedSizeVariant: request?.printedSizeVariant ?? '',
    category: request?.category ?? null,
    retailerLabel: request?.retailerLabel ?? null,
    sourceUrl: request?.sourceUrl ?? null,
    photoIdentificationConsent: request?.photo?.identificationConsent ?? false,
  };
}

export function requestFieldPayload(fields: ProductRequestFields) {
  const optional = (value: string | null) => value?.trim() || undefined;
  return {
    brand: fields.brand.trim(),
    fullPackName: fields.fullPackName.trim(),
    printedSizeVariant: fields.printedSizeVariant.trim(),
    category: optional(fields.category),
    retailerLabel: optional(fields.retailerLabel),
    sourceUrl: optional(fields.sourceUrl),
    photoIdentificationConsent: fields.photoIdentificationConsent,
  };
}

export function validateProductRequestFields(fields: ProductRequestFields) {
  const payload = requestFieldPayload(fields);
  if (!payload.brand) return 'Enter the brand printed on the pack.';
  if (!payload.fullPackName) return 'Enter the full product name printed on the pack.';
  if (!payload.printedSizeVariant) return 'Enter the printed size or variant.';
  if (payload.sourceUrl) {
    try {
      const source = new URL(payload.sourceUrl);
      if (source.protocol !== 'https:') return 'Use a secure https product link.';
    } catch {
      return 'Enter a complete product link.';
    }
  }
  return null;
}
