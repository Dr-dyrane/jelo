import { createHash } from 'node:crypto';
import { canonicalGtin, isValidGtin } from './gtin';

export const catalogueManufacturerSkuLabels = [
  'SKU',
  'Manufacturer SKU',
  'Product code',
] as const;

export type CatalogueManufacturerSkuLabel = typeof catalogueManufacturerSkuLabels[number];

export type CatalogueCanonicalProductIdentifier =
  | {
    kind: 'gtin';
    value: string;
  }
  | {
    kind: 'manufacturer-sku';
    value: string;
    label: CatalogueManufacturerSkuLabel;
  };

export const catalogueOfficialProductCrosswalkSchemaVersion = 2 as const;

export type CatalogueCanonicalManufacturerProductKey = {
  basis: 'manufacturer-sku' | 'official-product-id' | 'official-product-route';
  value: string;
  manufacturerHost: string;
  sourceLocator: string;
  sourceText: string;
  sourceTextSha256: string;
};

/**
 * Route-independent product/package identity. This prevents the same official product from being
 * entered once by GTIN and again by manufacturer SKU under a display-name alias.
 */
export type CatalogueOfficialProductIdentityCrosswalk = {
  schemaVersion: typeof catalogueOfficialProductCrosswalkSchemaVersion;
  /**
   * Stable manufacturer-owned identity. Capture digests and display names may change while this
   * key remains constant. Conversely, distinct SKUs on one multi-variant page remain distinct.
   */
  canonicalManufacturerProductKey: CatalogueCanonicalManufacturerProductKey;
  /**
   * Digest of the complete retained official representation from which this capture was
   * extracted. It protects capture integrity but is deliberately excluded from durable identity.
   */
  officialSourceResponseSha256: string;
  officialProductUrl: string;
  variant: string;
  size: string;
  packageVersion: string;
};

/**
 * Intake data is decoded before a route can be trusted, so callers may carry
 * either discriminator in this broad descriptor. `catalogueCanonicalIdentifierFor`
 * is the one runtime authority that accepts exactly one coherent route.
 */
export type CatalogueCandidateIdentityDescriptor = {
  gtin?: string;
  canonicalIdentifier?: CatalogueCanonicalProductIdentifier;
  officialProductCrosswalk?: CatalogueOfficialProductIdentityCrosswalk;
};

const manufacturerSkuPattern = /^[A-Z0-9](?:[A-Z0-9._/-]{1,62}[A-Z0-9])?$/;
const gtinShapedNumericPattern = /^(?:\d{8}|\d{12,14})$/;
const sha256Pattern = /^[0-9a-f]{64}$/;
const manufacturerProductIdPattern = /^[A-Z0-9](?:[A-Z0-9._:/-]{1,126}[A-Z0-9])?$/i;

export function normalizedManufacturerSku(value: string) {
  return value.normalize('NFKC').trim().toUpperCase();
}

export function validManufacturerSku(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const normalized = normalizedManufacturerSku(value);
  return normalized.length >= 3
    && normalized.length <= 64
    && manufacturerSkuPattern.test(normalized)
    && !gtinShapedNumericPattern.test(normalized)
    && !isValidGtin(normalized)
    && !['DEFAULT', 'UNKNOWN', 'NONE', 'N/A', 'NA', 'NOT-APPLICABLE'].includes(normalized);
}

export function validManufacturerSkuLabel(value: unknown): value is CatalogueManufacturerSkuLabel {
  return (catalogueManufacturerSkuLabels as readonly unknown[]).includes(value);
}

/**
 * Resolves the one canonical identity route accepted by catalogue intake.
 *
 * Existing GTIN-only candidates remain valid without a migration. An explicit GTIN discriminator
 * may be added, but it must match the legacy `gtin` field. The manufacturer-SKU route is mutually
 * exclusive with every GTIN field and is therefore unable to become a quiet fallback.
 */
export function catalogueCanonicalIdentifierFor(
  identity: CatalogueCandidateIdentityDescriptor,
): CatalogueCanonicalProductIdentifier | undefined {
  const explicit = identity.canonicalIdentifier;
  const gtin = 'gtin' in identity ? identity.gtin : undefined;
  if (!explicit) {
    return isValidGtin(gtin ?? '')
      ? { kind: 'gtin', value: canonicalGtin(gtin ?? '') }
      : undefined;
  }

  if (explicit.kind === 'gtin') {
    if (
      !isValidGtin(explicit.value)
      || !isValidGtin(gtin ?? '')
      || canonicalGtin(explicit.value) !== canonicalGtin(gtin ?? '')
    ) return undefined;
    return { kind: 'gtin', value: canonicalGtin(explicit.value) };
  }

  if (
    explicit.kind !== 'manufacturer-sku'
    || Object.prototype.hasOwnProperty.call(identity, 'gtin')
    || !('officialProductCrosswalk' in identity)
    || !identity.officialProductCrosswalk
    || !catalogueOfficialProductCrosswalkValid(identity.officialProductCrosswalk)
    || identity.officialProductCrosswalk.canonicalManufacturerProductKey.basis
      !== 'manufacturer-sku'
    || normalizedManufacturerSku(
      identity.officialProductCrosswalk.canonicalManufacturerProductKey.value,
    ) !== normalizedManufacturerSku(explicit.value)
    || !validManufacturerSku(explicit.value)
    || !validManufacturerSkuLabel(explicit.label)
  ) return undefined;

  return {
    kind: 'manufacturer-sku',
    value: normalizedManufacturerSku(explicit.value),
    label: explicit.label,
  };
}

export function catalogueGtinForIdentity(identity: CatalogueCandidateIdentityDescriptor) {
  return 'gtin' in identity && typeof identity.gtin === 'string'
    ? identity.gtin
    : undefined;
}

export function normalizedCrosswalkUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return undefined;
    url.search = '';
    url.hash = '';
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    return url.href;
  } catch {
    return undefined;
  }
}

function normalizedCrosswalkText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizedManufacturerHost(value: string) {
  return value.trim().toLowerCase().replace(/^www\./, '');
}

function normalizedOfficialProductRoute(value: string) {
  try {
    const pathname = value.startsWith('/')
      ? value
      : new URL(value).pathname;
    return pathname.replace(/\/+/g, '/').replace(/\/+$/, '') || '/';
  } catch {
    return undefined;
  }
}

function sourceTextSha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function catalogueCanonicalManufacturerProductKeyValid(
  key: CatalogueCanonicalManufacturerProductKey | undefined,
  officialProductUrl: string,
) {
  const normalizedUrl = normalizedCrosswalkUrl(officialProductUrl);
  if (!key || !normalizedUrl) return false;
  const officialUrl = new URL(normalizedUrl);
  const officialHost = normalizedManufacturerHost(officialUrl.hostname);
  if (
    normalizedManufacturerHost(key.manufacturerHost) !== officialHost
    || key.sourceLocator.trim().length < 3
    || key.sourceText.trim().length < 3
    || !sha256Pattern.test(key.sourceTextSha256)
    || sourceTextSha256(key.sourceText) !== key.sourceTextSha256
  ) return false;

  if (key.basis === 'manufacturer-sku') {
    return validManufacturerSku(key.value)
      && normalizedCrosswalkText(key.sourceText)
        .includes(normalizedCrosswalkText(key.value));
  }
  if (key.basis === 'official-product-id') {
    return manufacturerProductIdPattern.test(key.value)
      && normalizedCrosswalkText(key.sourceText)
        .includes(normalizedCrosswalkText(key.value));
  }
  if (key.basis !== 'official-product-route') return false;
  return normalizedOfficialProductRoute(key.value) === normalizedOfficialProductRoute(normalizedUrl)
    && key.sourceText.includes(officialUrl.pathname);
}

export function catalogueOfficialRouteManufacturerProductKey(
  officialProductUrl: string,
): CatalogueCanonicalManufacturerProductKey | undefined {
  const normalizedUrl = normalizedCrosswalkUrl(officialProductUrl);
  if (!normalizedUrl) return undefined;
  const url = new URL(normalizedUrl);
  const route = normalizedOfficialProductRoute(normalizedUrl);
  if (!route) return undefined;
  return {
    basis: 'official-product-route',
    value: route,
    manufacturerHost: normalizedManufacturerHost(url.hostname),
    sourceLocator: 'Official product URL route',
    sourceText: normalizedUrl,
    sourceTextSha256: sourceTextSha256(normalizedUrl),
  };
}

export function catalogueOfficialProductCrosswalkValid(
  crosswalk: CatalogueOfficialProductIdentityCrosswalk | undefined,
) {
  return Boolean(
    crosswalk
    && crosswalk.schemaVersion === catalogueOfficialProductCrosswalkSchemaVersion
    && catalogueCanonicalManufacturerProductKeyValid(
      crosswalk.canonicalManufacturerProductKey,
      crosswalk.officialProductUrl,
    )
    && sha256Pattern.test(crosswalk.officialSourceResponseSha256)
    && normalizedCrosswalkUrl(crosswalk.officialProductUrl)
    && normalizedCrosswalkText(crosswalk.variant)
    && normalizedCrosswalkText(crosswalk.size)
    && normalizedCrosswalkText(crosswalk.packageVersion),
  );
}

export function catalogueOfficialProductCrosswalkKey(
  crosswalk: CatalogueOfficialProductIdentityCrosswalk,
) {
  const officialProductUrl = normalizedCrosswalkUrl(crosswalk.officialProductUrl);
  if (!officialProductUrl || !catalogueOfficialProductCrosswalkValid(crosswalk)) return undefined;
  return [
    normalizedManufacturerHost(crosswalk.canonicalManufacturerProductKey.manufacturerHost),
    crosswalk.canonicalManufacturerProductKey.basis,
    normalizedCrosswalkText(crosswalk.canonicalManufacturerProductKey.value),
    normalizedCrosswalkText(crosswalk.size),
    normalizedCrosswalkText(crosswalk.packageVersion),
  ].join('\n');
}

/**
 * Alias-resistant uniqueness key. The crosswalk still retains and validates the exact official
 * variant and URL, but one retained official product representation/size/package cannot evade a
 * collision through spelling, display-copy, URL aliases, tracking-query, trailing-slash, or
 * identifier-route changes.
 */
export function catalogueOfficialProductPackageKey(
  crosswalk: CatalogueOfficialProductIdentityCrosswalk,
) {
  const officialProductUrl = normalizedCrosswalkUrl(crosswalk.officialProductUrl);
  if (!officialProductUrl || !catalogueOfficialProductCrosswalkValid(crosswalk)) return undefined;
  return [
    normalizedManufacturerHost(crosswalk.canonicalManufacturerProductKey.manufacturerHost),
    crosswalk.canonicalManufacturerProductKey.basis,
    normalizedCrosswalkText(crosswalk.canonicalManufacturerProductKey.value),
    normalizedCrosswalkText(crosswalk.size),
    normalizedCrosswalkText(crosswalk.packageVersion),
  ].join('\n');
}

/**
 * Secondary collision key for cross-route identity. A manufacturer page can legitimately expose
 * several distinct SKU variants, so this key is not a canonical identity by itself. It prevents
 * that same official route/size/package from being admitted once through a GTIN/route key and
 * again through a manufacturer-SKU key.
 */
export function catalogueOfficialProductRoutePackageKey(
  crosswalk: CatalogueOfficialProductIdentityCrosswalk,
) {
  const officialProductUrl = normalizedCrosswalkUrl(crosswalk.officialProductUrl);
  if (!officialProductUrl || !catalogueOfficialProductCrosswalkValid(crosswalk)) return undefined;
  const url = new URL(officialProductUrl);
  const route = normalizedOfficialProductRoute(officialProductUrl);
  if (!route) return undefined;
  return [
    normalizedManufacturerHost(url.hostname),
    route,
    normalizedCrosswalkText(crosswalk.size),
    normalizedCrosswalkText(crosswalk.packageVersion),
  ].join('\n');
}

export function catalogueOfficialProductCrosswalkRouteClass(
  crosswalk: CatalogueOfficialProductIdentityCrosswalk,
) {
  if (!catalogueOfficialProductCrosswalkValid(crosswalk)) return undefined;
  return crosswalk.canonicalManufacturerProductKey.basis === 'manufacturer-sku'
    ? 'manufacturer-sku' as const
    : 'official-route' as const;
}

/**
 * Structural grounding used before retained bytes are reopened. Manufacturer-SKU keys must point
 * at the exact reviewed SKU field; route keys must point at the retained official URL; product IDs
 * must be quoted by a reviewed field in the same official extraction.
 */
export function catalogueOfficialProductCrosswalkKeyGrounded(
  crosswalk: CatalogueOfficialProductIdentityCrosswalk,
  extraction: {
    sourceUrl: string;
    fields: Record<string, unknown>;
  },
) {
  const key = crosswalk.canonicalManufacturerProductKey;
  if (
    !catalogueOfficialProductCrosswalkValid(crosswalk)
    || normalizedCrosswalkUrl(extraction.sourceUrl)
      !== normalizedCrosswalkUrl(crosswalk.officialProductUrl)
  ) return false;

  if (key.basis === 'official-product-route') {
    return normalizedOfficialProductRoute(key.value)
      === normalizedOfficialProductRoute(extraction.sourceUrl)
      && key.sourceText === normalizedCrosswalkUrl(extraction.sourceUrl);
  }

  const reviewedFields: Array<{ value: string; locator: string; sourceText: string }> = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const record = value as Record<string, unknown>;
    if (
      typeof record.value === 'string'
      && typeof record.locator === 'string'
      && typeof record.sourceText === 'string'
    ) {
      reviewedFields.push(record as { value: string; locator: string; sourceText: string });
    }
    Object.values(record).forEach(visit);
  };
  visit(extraction.fields);
  return reviewedFields.some(field => (
    field.locator === key.sourceLocator
    && field.sourceText === key.sourceText
    && (
      key.basis === 'manufacturer-sku'
        ? normalizedManufacturerSku(field.value) === normalizedManufacturerSku(key.value)
        : normalizedCrosswalkText(field.value) === normalizedCrosswalkText(key.value)
    )
  ));
}

export function catalogueCanonicalIdentifierKey(
  brand: string,
  identifier: CatalogueCanonicalProductIdentifier,
) {
  if (identifier.kind === 'gtin') return `gtin:${canonicalGtin(identifier.value)}`;
  const normalizedBrand = brand
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return `manufacturer-sku:${normalizedBrand}:${normalizedManufacturerSku(identifier.value)}`;
}
