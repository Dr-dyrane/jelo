export const CUSTOMER_PRODUCT_REQUEST_LIFECYCLE_STATES = [
  'draft',
  'pending',
  'in_review',
  'needs_info',
  'matched',
  'published',
  'withdrawn',
] as const;

export type CustomerProductRequestLifecycleState =
  typeof CUSTOMER_PRODUCT_REQUEST_LIFECYCLE_STATES[number];

export type CustomerProductRequestOrigin = 'customer' | 'legacy_pages_v1_0';

export type CustomerProductRequest = {
  id: string;
  revision: number;
  lifecycleState: CustomerProductRequestLifecycleState;
  brand: string;
  fullPackName: string;
  printedSizeVariant: string;
  category: string | null;
  retailerLabel: string | null;
  sourceUrl: string | null;
  origin: CustomerProductRequestOrigin;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  normalizedEntityRef: string;
  matchedIdentityVersionId: string | null;
  photo: {
    present: boolean;
    identificationConsent: boolean;
  };
};

export type CustomerProductRequestPresentationViewModel = {
  requests: readonly CustomerProductRequest[];
  selectedRequest: CustomerProductRequest | null;
};

const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}]/gu;

export function normalizeCustomerProductRequestText(value: string) {
  return value
    .normalize('NFKC')
    .replace(CONTROL_OR_FORMAT, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function normalizeCustomerProductIdentityPart(value: string) {
  return normalizeCustomerProductRequestText(value).toLocaleLowerCase('en-US');
}

function fnv1a(value: string, offset: number) {
  let hash = offset >>> 0;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function normalizedCustomerProductEntityRef(input: {
  brand: string;
  fullPackName: string;
  printedSizeVariant: string;
}) {
  const identityText = [input.brand, input.fullPackName, input.printedSizeVariant]
    .map(normalizeCustomerProductIdentityPart)
    .join('|');
  const readable = identityText
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  const digest = `${fnv1a(identityText, 0x811c9dc5)}${fnv1a(identityText, 0x9e3779b9)}`;
  const available = 160 - 'custom::'.length - digest.length;
  const prefix = [...readable].slice(0, available).join('').replace(/-+$/g, '') || 'product';
  return `custom:${prefix}:${digest}`;
}

export function customerProductRequestIdentityLabel(input: {
  brand: string;
  fullPackName: string;
  printedSizeVariant: string;
}) {
  return [...`${input.brand} · ${input.fullPackName} · ${input.printedSizeVariant}`]
    .slice(0, 120)
    .join('');
}
