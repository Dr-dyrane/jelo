import { createHash } from 'node:crypto';
import { canonicalGtin, isValidGtin } from './gtin';
import {
  catalogueRetainedRecordShapeValid,
  sourceTextNamesCatalogueBrandField,
  type CatalogueRetainedRecord,
} from './retained-record';

export const catalogueExactOfferEvidenceSchemaVersion = 1 as const;
export const catalogueExactOfferManufacturerSkuEvidenceSchemaVersion = 3 as const;
export const catalogueExactOfferRetainedGtinEvidenceSchemaVersion = 4 as const;
export const catalogueRegulatoryEvidenceSchemaVersion = 2 as const;

export type ExactOfferGtinLabel = 'GTIN' | 'EAN' | 'UPC';
export type ExactOfferGtinBasis =
  | 'explicit-gtin'
  | 'explicit-ean'
  | 'explicit-upc'
  | 'exact-variant-and-size';
export type ExactOfferStock = 'in-stock' | 'low-stock' | 'out-of-stock';
export type MarketEvidenceMimeType = 'application/json' | 'text/html';
export type MarketEvidenceImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export type ReviewedPackageBarcodeResponse = {
  role: 'package-barcode-image';
  sourceUrl: string;
  responseUrl: string;
  responseSha256: string;
  responseMimeType: MarketEvidenceImageMimeType;
  responseByteSize: number;
  retrievedAt: string;
  listingLocator: string;
  listingSourceText: string;
  barcode: {
    symbology: 'EAN-13' | 'UPC-A';
    value: string;
    locator: string;
    sourceText: string;
  };
};

export type ReviewedPackageRegulatoryLabelResponse = {
  role: 'package-regulatory-label-image';
  listingUrl: string;
  sourceUrl: string;
  responseUrl: string;
  responseSha256: string;
  responseMimeType: MarketEvidenceImageMimeType;
  responseByteSize: number;
  retrievedAt: string;
  listingLocator: string;
  listingSourceText: string;
  fields: {
    gtin: {
      label: ExactOfferGtinLabel;
      symbology: 'EAN-13' | 'UPC-A';
      value: string;
      locator: string;
      sourceText: string;
    };
    registrationNumber: {
      value: string;
      locator: string;
      sourceText: string;
    };
  };
};

type ReviewedExactOfferEvidenceBase = {
  method:
    | 'reviewed-exact-offer-field-extraction'
    | 'reviewed-browser-dom-exact-offer-field-extraction'
    | 'reviewed-browser-accessibility-exact-offer-field-extraction';
  listingUrl: string;
  responseUrl: string;
  responseSha256: string;
  responseDigestScope: 'decoded-response-body' | 'rendered-dom-outerhtml' | 'rendered-accessibility-tree';
  responseMimeType: MarketEvidenceMimeType;
  responseByteSize: number;
  retrievedAt: string;
  browserCapture?: {
    surface: 'Codex in-app browser';
    documentReadyState: 'complete';
    pageTitle: string;
  };
  fields: {
    title: { value: string; locator: string; sourceText: string };
    size: { value: string; locator: string; sourceText: string };
    packageVersion?: { value: string; locator: string; sourceText: string };
    price: { value: number; currency: 'NGN'; locator: string; sourceText: string };
    stock: { value: ExactOfferStock; locator: string; sourceText: string };
  };
  reviewer: string;
  reviewedAt: string;
};

type ReviewedManufacturerSkuIdentityCorrelation = {
    basis: 'official-manufacturer-sku-and-exact-variant-size-package';
    manufacturerSku: {
      value: string;
      label: 'SKU' | 'Manufacturer SKU' | 'Product code';
    };
    officialProductUrl: string;
    officialIdentitySnapshotPath: string;
    officialIdentitySnapshotSha256: string;
};

/**
 * The established GTIN-bound evidence contract remains the compatibility type
 * used by existing catalogue fixtures and external approval records.
 * Manufacturer-SKU evidence is additive through
 * `ReviewedCatalogueExactOfferEvidence`.
 */
export type ReviewedExactOfferEvidence =
  ReviewedExactOfferEvidenceBase & {
    schemaVersion: typeof catalogueExactOfferEvidenceSchemaVersion;
    fields: ReviewedExactOfferEvidenceBase['fields'] & {
      gtin: {
        label: ExactOfferGtinLabel;
        value: string;
        locator: string;
        sourceText: string;
        responseRole?: 'listing-response' | 'package-barcode-image' | 'official-identity-correlation';
      };
    };
    supplementalResponses?: ReviewedPackageBarcodeResponse[];
  };

/**
 * A GTIN-bound offer can retain the exact response record without invalidating
 * established schema-1 evidence. The response itself is reopened and verified
 * at the repository boundary; this runtime shape keeps the path, response
 * digest, byte bounds, and retained fragment digest explicit meanwhile.
 */
export type ReviewedRetainedGtinExactOfferEvidence =
  ReviewedExactOfferEvidenceBase & {
    schemaVersion: typeof catalogueExactOfferRetainedGtinEvidenceSchemaVersion;
    responseSnapshotPath: string;
    offerRecord: CatalogueRetainedRecord;
    fields: ReviewedExactOfferEvidenceBase['fields'] & {
      gtin: ReviewedExactOfferEvidence['fields']['gtin'];
    };
    supplementalResponses?: ReviewedPackageBarcodeResponse[];
  };

export type ReviewedManufacturerSkuExactOfferEvidence =
  ReviewedExactOfferEvidenceBase & {
    schemaVersion: typeof catalogueExactOfferManufacturerSkuEvidenceSchemaVersion;
    responseSnapshotPath: string;
    offerRecord: CatalogueRetainedRecord;
    fields: ReviewedExactOfferEvidenceBase['fields'] & {
      brand: { value: string; locator: string; sourceText: string };
      gtin?: never;
    };
    identityCorrelation: ReviewedManufacturerSkuIdentityCorrelation;
    supplementalResponses?: never;
  };

/**
 * Intake records are decoded before their route is trusted, so this boundary
 * deliberately models the union as a broad shape. Runtime validation below
 * proves the exact GTIN or manufacturer-SKU route before publication.
 */
export type ReviewedCatalogueExactOfferEvidence = ReviewedExactOfferEvidenceBase & {
  schemaVersion:
    | typeof catalogueExactOfferEvidenceSchemaVersion
    | typeof catalogueExactOfferManufacturerSkuEvidenceSchemaVersion
    | typeof catalogueExactOfferRetainedGtinEvidenceSchemaVersion;
  fields: ReviewedExactOfferEvidenceBase['fields'] & {
    gtin?: ReviewedExactOfferEvidence['fields']['gtin'];
    brand?: ReviewedManufacturerSkuExactOfferEvidence['fields']['brand'];
  };
  supplementalResponses?: ReviewedPackageBarcodeResponse[];
  responseSnapshotPath?: string;
  offerRecord?: CatalogueRetainedRecord;
  identityCorrelation?: ReviewedManufacturerSkuIdentityCorrelation;
};

type RegulatoryEvidenceBase = {
  schemaVersion: typeof catalogueRegulatoryEvidenceSchemaVersion;
  authority: 'NAFDAC';
  sourceUrl: string;
  locator: string;
  sourceText: string;
  sourceExcerptSha256: string;
  responseUrl: string;
  responseSha256: string;
  responseDigestScope: 'decoded-response-body';
  responseMimeType: MarketEvidenceMimeType;
  responseByteSize: number;
  retrievedAt: string;
  observedAt: string;
  reviewedAt: string;
  reviewer: string;
};

export type ReviewedRegulatoryEvidence = RegulatoryEvidenceBase & (
  | {
    status: 'matched';
    matchBasis: 'manufacturer-gtin';
    candidateGtin: string;
    registrationNumber: string;
    registrationStatus: {
      value: 'active';
      locator: string;
      sourceText: string;
    };
    expiry?: {
      value: string;
      locator: string;
      sourceText: string;
    };
  }
  | {
    status: 'matched';
    matchBasis: 'package-registration-number';
    candidateGtin: string;
    registrationNumber: string;
    registeredProductName: {
      value: string;
      locator: string;
      sourceText: string;
    };
    packageResponse: ReviewedPackageRegulatoryLabelResponse;
    registrationStatus: {
      value: 'active';
      locator: string;
      sourceText: string;
    };
    expiry?: {
      value: string;
      locator: string;
      sourceText: string;
    };
  }
  | {
    status: 'not-required';
    candidateGtin: string;
    subjectProductOrClass: string;
    rationale: string;
  }
);

export type ExactOfferEvidenceSubject = {
  listingUrl: string;
  observedAt: string;
  observedTitle: string;
  observedSize: string;
  observedGtin?: string;
  observedGtinBasis?: ExactOfferGtinBasis;
  observedPackageVersion?: string;
  priceNgn: number;
  stock: ExactOfferStock;
  evidence?: ReviewedCatalogueExactOfferEvidence;
};

export type ExactOfferCandidateIdentifier =
  | { kind: 'gtin'; value: string }
  | {
    kind: 'manufacturer-sku';
    value: string;
    label: 'SKU' | 'Manufacturer SKU' | 'Product code';
    officialProductUrl: string;
    officialIdentitySnapshotPath: string;
    officialIdentitySnapshotSha256: string;
    brand: string;
    officialBrandAliases: readonly string[];
    variant: string;
  };

const hashPattern = /^[0-9a-f]{64}$/;
const regulatoryEvidenceMaxAgeMs = 90 * 86_400_000;
const nafdacAuthorityHosts = new Set([
  'nafdac.gov.ng',
  'greenbook.nafdac.gov.ng',
  'registration.nafdac.gov.ng',
]);

function validHttps(value: unknown) {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function manufacturerOfferTitleMatchesIdentity(
  title: string,
  identity: Extract<ExactOfferCandidateIdentifier, { kind: 'manufacturer-sku' }>,
) {
  const normalizedTitle = normalized(title);
  const normalizedVariant = normalized(identity.variant);
  return [identity.brand, ...identity.officialBrandAliases]
    .map(normalized)
    .some(brand => (
      normalizedTitle === normalizedVariant
      || normalizedTitle === `${brand} ${normalizedVariant}`
      || (
        normalizedVariant.startsWith(`${brand} `)
        && normalizedTitle === normalizedVariant
      )
    ));
}

function sameUrl(left: unknown, right: unknown) {
  if (!validHttps(left) || !validHttps(right)) return false;
  return new URL(left as string).href === new URL(right as string).href;
}

function exactWooStoreApiProductResponseUrl(
  responseUrl: unknown,
  listingUrl: unknown,
) {
  if (!validHttps(responseUrl) || !validHttps(listingUrl)) return false;
  const response = new URL(responseUrl as string);
  const listing = new URL(listingUrl as string);
  const normalizedHost = (url: URL) =>
    url.hostname.replace(/^www\./, '').toLowerCase();
  return normalizedHost(response) === normalizedHost(listing)
    && response.port === listing.port
    && response.username === ''
    && response.password === ''
    && /^\/wp-json\/wc\/store\/v1\/products\/[1-9]\d*$/.test(response.pathname)
    && response.search === ''
    && response.hash === '';
}

function parsedPastDate(value: unknown, asOf: number) {
  if (typeof value !== 'string') return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= asOf + 5 * 60_000 ? parsed : undefined;
}

function normalized(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function measurementTokens(value: string) {
  const tokens: string[] = [];
  for (const match of value.toLowerCase().matchAll(
    /\b(\d+(?:[.,]\d+)?)\s*(fl\.?\s*oz|ml|cl|l|mg|kg|g|oz|count|pcs?|pieces?|pack)\b/g,
  )) {
    const amount = Number(match[1].replace(',', '.'));
    const amountToken = Number.isFinite(amount) ? String(amount).replace('.', 'd') : match[1];
    const unitToken = match[2].replace(/[^a-z]/g, '').replace(/^pieces?$/, 'pc').replace(/^pcs?$/, 'pc');
    tokens.push(`${amountToken}${unitToken}`);
  }
  return tokens;
}

function sourceTextContainsExactGtin(sourceText: string, gtin: string) {
  const escaped = gtin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\D)${escaped}(?:\\D|$)`).test(sourceText);
}

function sourceTextContainsExactIdentifier(sourceText: string, identifier: string) {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i').test(sourceText);
}

function sourceTextContainsExactSize(sourceText: string, size: string) {
  const expected = measurementTokens(size);
  const observed = new Set(measurementTokens(sourceText));
  return expected.length > 0 && expected.every(token => observed.has(token));
}

function fieldShape(value: unknown): value is { value: unknown; locator: string; sourceText: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const field = value as Record<string, unknown>;
  return typeof field.locator === 'string'
    && field.locator.trim().length >= 8
    && typeof field.sourceText === 'string'
    && field.sourceText.trim().length >= 3
    && 'value' in field;
}

function wooStorePriceSourceMatches(sourceText: string, priceNgn: number) {
  try {
    const value = JSON.parse(sourceText) as {
      price?: unknown;
      currency_code?: unknown;
      currency_minor_unit?: unknown;
    };
    if (
      !value
      || typeof value !== 'object'
      || typeof value.price !== 'string'
      || !/^\d+$/.test(value.price)
      || value.currency_code !== 'NGN'
      || !Number.isSafeInteger(value.currency_minor_unit)
      || (value.currency_minor_unit as number) < 0
      || (value.currency_minor_unit as number) > 2
    ) return false;
    const minorPrice = Number(value.price);
    return Number.isSafeInteger(minorPrice)
      && minorPrice / 10 ** (value.currency_minor_unit as number) === priceNgn;
  } catch {
    return false;
  }
}

function priceSourceMatches(
  sourceText: string,
  priceNgn: number,
  retainedWooRecord = false,
) {
  const minorUnits = priceNgn * 100;
  if (
    !Number.isFinite(priceNgn)
    || priceNgn <= 0
    || Math.abs(Math.round(minorUnits) - minorUnits) > Number.EPSILON * Math.max(1, Math.abs(minorUnits)) * 4
  ) return false;
  const plain = String(priceNgn).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const grouped = priceNgn.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(priceNgn) ? 0 : 2,
    maximumFractionDigits: 2,
  }).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:\\bNGN(?=\\s*\\d)|₦)\\s*(?:${plain}|${grouped})(?:\\.00)?(?![\\d.,])`, 'i').test(sourceText)
    || (retainedWooRecord && wooStorePriceSourceMatches(sourceText, priceNgn));
}

function expectedLabel(basis: ExactOfferGtinBasis | undefined): ExactOfferGtinLabel | undefined {
  if (basis === 'explicit-gtin') return 'GTIN';
  if (basis === 'explicit-ean') return 'EAN';
  if (basis === 'explicit-upc') return 'UPC';
  if (basis === 'exact-variant-and-size') return 'GTIN';
  return undefined;
}

function stockSourceMatches(sourceText: string, stock: ExactOfferStock) {
  const value = normalized(sourceText).replace(/^availability\s+/, '');
  if (stock === 'in-stock') return /^(?:in stock(?:\s+(?:and\s+)?ready to ship)?|\d+ in stock|available|available now)$/.test(value);
  if (stock === 'low-stock') return /^(?:low stock|only \d+ left(?: in stock)?|[1-5] in stock|\d+ units? left|few left)$/.test(value);
  return /^(?:out of stock|sold out|unavailable)$/.test(value);
}

function reviewedPackageBarcodeResponseValid(
  response: ReviewedPackageBarcodeResponse,
  listingUrl: string,
  expectedGtin: string,
  expectedLabel: ExactOfferGtinLabel,
  reviewedAt: number,
  asOf: number,
) {
  if (
    response.role !== 'package-barcode-image'
    || !validHttps(response.sourceUrl)
    || !sameUrl(response.responseUrl, response.sourceUrl)
    || !hashPattern.test(response.responseSha256)
    || !['image/jpeg', 'image/png', 'image/webp'].includes(response.responseMimeType)
    || !Number.isSafeInteger(response.responseByteSize)
    || response.responseByteSize <= 0
    || typeof response.listingLocator !== 'string'
    || response.listingLocator.trim().length < 8
    || typeof response.listingSourceText !== 'string'
    || !response.listingSourceText.includes(response.sourceUrl)
    || typeof response.barcode?.locator !== 'string'
    || response.barcode.locator.trim().length < 8
    || typeof response.barcode.sourceText !== 'string'
    || !sourceTextContainsExactGtin(response.barcode.sourceText, expectedGtin)
    || response.barcode.value !== expectedGtin
  ) return false;

  const retrievedAt = parsedPastDate(response.retrievedAt, asOf);
  if (retrievedAt == null || retrievedAt > reviewedAt) return false;

  const expectedSymbology = expectedLabel === 'EAN'
    ? 'EAN-13'
    : expectedLabel === 'UPC'
      ? 'UPC-A'
      : undefined;
  if (!expectedSymbology || response.barcode.symbology !== expectedSymbology) return false;

  const listingHost = new URL(listingUrl).hostname.replace(/^www\./, '').toLowerCase();
  const sourceHost = new URL(response.sourceUrl).hostname.replace(/^www\./, '').toLowerCase();
  const sourcePath = new URL(response.sourceUrl).pathname.toLowerCase();
  return sourceHost === listingHost
    || (sourceHost === 'i0.wp.com' && sourcePath.startsWith(`/${listingHost}/`));
}

function reviewedPackageRegulatoryLabelResponseValid(
  response: ReviewedPackageRegulatoryLabelResponse,
  candidateGtin: string,
  registrationNumber: string,
  reviewedAt: number,
  asOf: number,
) {
  const gtin = response.fields?.gtin;
  const registration = response.fields?.registrationNumber;
  if (
    response.role !== 'package-regulatory-label-image'
    || !validHttps(response.listingUrl)
    || !validHttps(response.sourceUrl)
    || !sameUrl(response.responseUrl, response.sourceUrl)
    || !hashPattern.test(response.responseSha256)
    || !['image/jpeg', 'image/png', 'image/webp'].includes(response.responseMimeType)
    || !Number.isSafeInteger(response.responseByteSize)
    || response.responseByteSize <= 0
    || typeof response.listingLocator !== 'string'
    || response.listingLocator.trim().length < 8
    || typeof response.listingSourceText !== 'string'
    || !response.listingSourceText.includes(response.sourceUrl)
    || !fieldShape(gtin)
    || !fieldShape(registration)
    || !isValidGtin(gtin.value as string)
    || canonicalGtin(gtin.value as string) !== canonicalGtin(candidateGtin)
    || !sourceTextContainsExactGtin(gtin.sourceText, candidateGtin)
    || !sourceNamesLabel(gtin.sourceText, gtin.label)
    || (gtin.label === 'EAN' && gtin.symbology !== 'EAN-13')
    || (gtin.label === 'UPC' && gtin.symbology !== 'UPC-A')
    || !['EAN', 'UPC'].includes(gtin.label)
    || typeof registration.value !== 'string'
    || registration.value !== registrationNumber
    || !sourceTextContainsExactIdentifier(registration.sourceText, registrationNumber)
    || !/(?:nafdac|registration|reg\.?\s*no)/i.test(registration.sourceText)
  ) return false;

  const retrievedAt = parsedPastDate(response.retrievedAt, asOf);
  if (retrievedAt == null || retrievedAt > reviewedAt) return false;
  const listingHost = new URL(response.listingUrl).hostname.replace(/^www\./, '').toLowerCase();
  const sourceHost = new URL(response.sourceUrl).hostname.replace(/^www\./, '').toLowerCase();
  const sourcePath = new URL(response.sourceUrl).pathname.toLowerCase();
  return sourceHost === listingHost
    || (sourceHost === 'i0.wp.com' && sourcePath.startsWith(`/${listingHost}/`));
}

function activeRegistrationSourceMatches(sourceText: string) {
  const value = normalized(sourceText).replace(/^(?:registration\s+)?status\s+/, '');
  return value === 'active';
}

function sourceNamesLabel(sourceText: string, label: ExactOfferGtinLabel) {
  const pattern = label === 'GTIN'
    ? /(?:^|[^a-z0-9])gtin(?:-?1[234])?(?:[^a-z0-9]|$)/i
    : label === 'EAN'
      ? /(?:^|[^a-z0-9])ean(?:-?13)?(?:[^a-z0-9]|$)/i
      : /(?:^|[^a-z0-9])upc(?:-?[ae])?(?:[^a-z0-9]|$)/i;
  return pattern.test(sourceText);
}

function retainedOfferSnapshotPathValid(
  snapshotPath: unknown,
  mimeType: MarketEvidenceMimeType,
) {
  const extension = mimeType === 'application/json' ? 'json' : 'html';
  return typeof snapshotPath === 'string'
    && new RegExp(
      '^data/catalogue-offer-source-evidence/'
      + '[a-z0-9]+(?:-[a-z0-9]+)*--[a-z0-9]+(?:-[a-z0-9]+)*'
      + `\\.${extension}$`,
    ).test(snapshotPath);
}

function retainedCompleteWooProductMetadataValid(
  record: CatalogueRetainedRecord | undefined,
  responseByteSize: number,
  responseSha256: string,
  responseUrl: unknown,
  listingUrl: unknown,
) {
  if (
    !record
    || !catalogueRetainedRecordShapeValid(record)
    || record.byteStart !== 0
    || record.byteEnd !== responseByteSize
    || !hashPattern.test(responseSha256)
    || !exactWooStoreApiProductResponseUrl(responseUrl, listingUrl)
  ) return false;

  const retainedByteSize = Buffer.byteLength(record.sourceText, 'utf8');
  const retainedSha256 = createHash('sha256')
    .update(record.sourceText)
    .digest('hex');
  if (
    retainedByteSize !== responseByteSize
    || retainedSha256 !== record.sourceFragmentSha256
    || retainedSha256 !== responseSha256
  ) return false;

  let product: Record<string, unknown>;
  try {
    const parsed = JSON.parse(record.sourceText) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    product = parsed as Record<string, unknown>;
  } catch {
    return false;
  }
  const productId = Number(
    new URL(responseUrl as string).pathname.split('/').filter(Boolean).at(-1),
  );
  return (
    product.id === productId
    && typeof product.permalink === 'string'
    && sameUrl(product.permalink, listingUrl)
  );
}

export function reviewedExactOfferEvidenceValid(
  offer: ExactOfferEvidenceSubject,
  candidateIdentity: string | undefined | ExactOfferCandidateIdentifier,
  asOf: number,
) {
  const canonicalIdentity: ExactOfferCandidateIdentifier | undefined = typeof candidateIdentity === 'string'
    ? { kind: 'gtin', value: candidateIdentity }
    : candidateIdentity;
  const evidence = offer.evidence;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return false;
  const fields = evidence.fields;
  const hasGtinField = Object.prototype.hasOwnProperty.call(fields, 'gtin');
  const hasBrandField = Object.prototype.hasOwnProperty.call(fields, 'brand');
  const gtinField = 'gtin' in fields ? fields.gtin : undefined;
  const brandField = 'brand' in fields ? fields.brand : undefined;
  const identityCorrelation = 'identityCorrelation' in evidence
    ? evidence.identityCorrelation
    : undefined;
  const supplementalResponses = 'supplementalResponses' in evidence
    ? evidence.supplementalResponses
    : undefined;
  const rawResponseEvidence = evidence.method === 'reviewed-exact-offer-field-extraction'
    && evidence.responseDigestScope === 'decoded-response-body'
    && evidence.browserCapture == null;
  const browserResponseEvidence = evidence.method === 'reviewed-browser-dom-exact-offer-field-extraction'
    && evidence.responseDigestScope === 'rendered-dom-outerhtml'
    && evidence.responseMimeType === 'text/html'
    && evidence.browserCapture?.surface === 'Codex in-app browser'
    && evidence.browserCapture.documentReadyState === 'complete'
    && evidence.browserCapture.pageTitle.trim().length >= 3;
  const accessibleBrowserResponseEvidence = (
    evidence.method === 'reviewed-browser-accessibility-exact-offer-field-extraction'
    && evidence.responseDigestScope === 'rendered-accessibility-tree'
    && evidence.responseMimeType === 'text/html'
    && evidence.browserCapture?.surface === 'Codex in-app browser'
    && evidence.browserCapture.documentReadyState === 'complete'
    && evidence.browserCapture.pageTitle.trim().length >= 3
  );
  const schemaVersionValid = canonicalIdentity?.kind === 'manufacturer-sku'
    ? evidence.schemaVersion
      === catalogueExactOfferManufacturerSkuEvidenceSchemaVersion
    : (
      evidence.schemaVersion === catalogueExactOfferEvidenceSchemaVersion
      || evidence.schemaVersion
        === catalogueExactOfferRetainedGtinEvidenceSchemaVersion
    );
  const responseUrlValid = evidence.schemaVersion
    === catalogueExactOfferRetainedGtinEvidenceSchemaVersion
    ? exactWooStoreApiProductResponseUrl(evidence.responseUrl, offer.listingUrl)
    : sameUrl(evidence.responseUrl, offer.listingUrl);
  if (
    !schemaVersionValid
    || (!rawResponseEvidence && !browserResponseEvidence && !accessibleBrowserResponseEvidence)
    || !sameUrl(evidence.listingUrl, offer.listingUrl)
    || !responseUrlValid
    || !hashPattern.test(evidence.responseSha256)
    || !['application/json', 'text/html'].includes(evidence.responseMimeType)
    || !Number.isSafeInteger(evidence.responseByteSize)
    || evidence.responseByteSize <= 0
    || !fields
    || typeof fields !== 'object'
    || (
      canonicalIdentity?.kind === 'gtin'
        ? (!hasGtinField || !fieldShape(gtinField))
        : (hasGtinField || !hasBrandField || !fieldShape(brandField))
    )
    || !fieldShape(fields.title)
    || !fieldShape(fields.size)
    || !fieldShape(fields.price)
    || !fieldShape(fields.stock)
    || (fields.packageVersion != null && !fieldShape(fields.packageVersion))
    || typeof evidence.reviewer !== 'string'
    || evidence.reviewer.trim().length < 2
  ) return false;

  const retrievedAt = parsedPastDate(evidence.retrievedAt, asOf);
  const reviewedAt = parsedPastDate(evidence.reviewedAt, asOf);
  const observedAt = parsedPastDate(offer.observedAt, asOf);
  if (
    retrievedAt == null
    || reviewedAt == null
    || observedAt == null
    || retrievedAt !== observedAt
    || reviewedAt < retrievedAt
  ) return false;

  const exactVariantAndSize = offer.observedGtinBasis === 'exact-variant-and-size';
  const label = expectedLabel(offer.observedGtinBasis);
  const gtinResponseRole = gtinField?.responseRole ?? 'listing-response';
  const candidateGtin = canonicalIdentity?.kind === 'gtin' ? canonicalIdentity.value : undefined;
  const packageBarcodeValid = gtinResponseRole === 'package-barcode-image'
    && gtinField != null
    && label != null
    && Array.isArray(supplementalResponses)
    && supplementalResponses.length === 1
    && reviewedPackageBarcodeResponseValid(
      supplementalResponses[0],
      offer.listingUrl,
      gtinField.value,
      label,
      reviewedAt!,
      asOf,
    );
  const identityBindingValid = canonicalIdentity?.kind === 'manufacturer-sku'
    ? (
      exactVariantAndSize
      && offer.observedGtin == null
      && gtinField == null
      && 'responseSnapshotPath' in evidence
      && retainedOfferSnapshotPathValid(
        evidence.responseSnapshotPath,
        evidence.responseMimeType,
      )
      && 'offerRecord' in evidence
      && catalogueRetainedRecordShapeValid(evidence.offerRecord)
      && (!supplementalResponses || supplementalResponses.length === 0)
      && identityCorrelation?.basis
        === 'official-manufacturer-sku-and-exact-variant-size-package'
      && identityCorrelation.manufacturerSku.value === canonicalIdentity.value
      && identityCorrelation.manufacturerSku.label === canonicalIdentity.label
      && sameUrl(
        identityCorrelation.officialProductUrl,
        canonicalIdentity.officialProductUrl,
      )
      && identityCorrelation.officialIdentitySnapshotPath
        === canonicalIdentity.officialIdentitySnapshotPath
      && hashPattern.test(identityCorrelation.officialIdentitySnapshotSha256)
      && identityCorrelation.officialIdentitySnapshotSha256
        === canonicalIdentity.officialIdentitySnapshotSha256
      && typeof brandField?.value === 'string'
      && [canonicalIdentity.brand, ...canonicalIdentity.officialBrandAliases]
        .map(normalized)
        .includes(normalized(brandField.value))
      && sourceTextNamesCatalogueBrandField(
        brandField.sourceText,
        brandField.value,
      )
      && manufacturerOfferTitleMatchesIdentity(
        fields.title.value as string,
        canonicalIdentity,
      )
    )
    : Boolean(
      label
      && gtinField
      && gtinField.label === label
      && typeof gtinField.value === 'string'
      && isValidGtin(gtinField.value)
      && isValidGtin(candidateGtin ?? '')
      && canonicalGtin(gtinField.value) === canonicalGtin(candidateGtin ?? '')
      && sourceTextContainsExactGtin(gtinField.sourceText, gtinField.value)
      && sourceNamesLabel(gtinField.sourceText, label)
      && (
        exactVariantAndSize
          ? (
            offer.observedGtin == null
            && gtinResponseRole === 'official-identity-correlation'
            && /official\s+(?:catalogue\s+)?identity/i.test(gtinField.sourceText)
          )
          : (
            isValidGtin(offer.observedGtin ?? '')
            && canonicalGtin(gtinField.value) === canonicalGtin(offer.observedGtin ?? '')
            && (gtinResponseRole === 'listing-response' || packageBarcodeValid)
          )
      )
      && identityCorrelation == null
    );
  const retainedGtinMetadataValid = evidence.schemaVersion
    !== catalogueExactOfferRetainedGtinEvidenceSchemaVersion
    || (
      canonicalIdentity?.kind === 'gtin'
      && evidence.method === 'reviewed-exact-offer-field-extraction'
      && evidence.responseDigestScope === 'decoded-response-body'
      && evidence.responseMimeType === 'application/json'
      && evidence.browserCapture == null
      && retainedOfferSnapshotPathValid(
        evidence.responseSnapshotPath,
        evidence.responseMimeType,
      )
      && retainedCompleteWooProductMetadataValid(
        evidence.offerRecord,
        evidence.responseByteSize,
        evidence.responseSha256,
        evidence.responseUrl,
        offer.listingUrl,
      )
    );
  return Boolean(
    identityBindingValid
    && retainedGtinMetadataValid
    && typeof fields.title.value === 'string'
    && normalized(fields.title.value) === normalized(offer.observedTitle)
    && normalized(fields.title.sourceText).includes(normalized(fields.title.value))
    && typeof fields.size.value === 'string'
    && measurementTokens(fields.size.value).join('|') === measurementTokens(offer.observedSize).join('|')
    && sourceTextContainsExactSize(fields.size.sourceText, fields.size.value)
    && (
      offer.observedPackageVersion == null
        ? fields.packageVersion == null
        : (
          fields.packageVersion != null
          && typeof fields.packageVersion.value === 'string'
          && normalized(fields.packageVersion.value) === normalized(offer.observedPackageVersion)
          && normalized(fields.packageVersion.sourceText).includes(normalized(fields.packageVersion.value))
        )
    )
    && typeof fields.price.value === 'number'
    && fields.price.value === offer.priceNgn
    && fields.price.currency === 'NGN'
    && priceSourceMatches(
      fields.price.sourceText,
      fields.price.value,
      evidence.schemaVersion === catalogueExactOfferRetainedGtinEvidenceSchemaVersion,
    )
    && typeof fields.stock.value === 'string'
    && fields.stock.value === offer.stock
    && stockSourceMatches(fields.stock.sourceText, fields.stock.value)
  );
}

export function regulatoryEvidenceExcerptSha256(sourceText: string) {
  return createHash('sha256')
    .update(`jelocare-nafdac-regulatory-evidence-v1\n${sourceText}\n`)
    .digest('hex');
}

export function reviewedRegulatoryEvidenceValid(
  evidence: ReviewedRegulatoryEvidence | undefined,
  expectedStatus: 'matched' | 'not-required',
  candidateGtin: string | undefined,
  asOf: number,
) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return false;
  if (
    evidence.schemaVersion !== catalogueRegulatoryEvidenceSchemaVersion
    || evidence.authority !== 'NAFDAC'
    || evidence.status !== expectedStatus
    || !validHttps(evidence.sourceUrl)
    || !nafdacAuthorityHosts.has(new URL(evidence.sourceUrl).hostname.toLowerCase())
    || !sameUrl(evidence.responseUrl, evidence.sourceUrl)
    || typeof evidence.locator !== 'string'
    || evidence.locator.trim().length < 8
    || typeof evidence.sourceText !== 'string'
    || evidence.sourceText.trim().length < 8
    || !hashPattern.test(evidence.sourceExcerptSha256)
    || regulatoryEvidenceExcerptSha256(evidence.sourceText) !== evidence.sourceExcerptSha256
    || !hashPattern.test(evidence.responseSha256)
    || evidence.responseDigestScope !== 'decoded-response-body'
    || !['application/json', 'text/html'].includes(evidence.responseMimeType)
    || !Number.isSafeInteger(evidence.responseByteSize)
    || evidence.responseByteSize <= 0
    || typeof evidence.reviewer !== 'string'
    || evidence.reviewer.trim().length < 2
  ) return false;

  const observedAt = parsedPastDate(evidence.observedAt, asOf);
  const retrievedAt = parsedPastDate(evidence.retrievedAt, asOf);
  const reviewedAt = parsedPastDate(evidence.reviewedAt, asOf);
  if (
    observedAt == null
    || retrievedAt == null
    || reviewedAt == null
    || observedAt !== retrievedAt
    || reviewedAt < retrievedAt
    || retrievedAt < asOf - regulatoryEvidenceMaxAgeMs
  ) return false;

  if (evidence.status === 'matched') {
    const registrationStatus = evidence.registrationStatus;
    if (
      !fieldShape(registrationStatus)
      || registrationStatus.value !== 'active'
      || !activeRegistrationSourceMatches(registrationStatus.sourceText)
      || !normalized(evidence.sourceText).includes(normalized(registrationStatus.sourceText))
    ) return false;
    if (Object.prototype.hasOwnProperty.call(evidence, 'expiry')) {
      const expiryEvidence = evidence.expiry;
      if (
        !fieldShape(expiryEvidence)
        || typeof expiryEvidence.value !== 'string'
        || !sourceTextContainsExactIdentifier(expiryEvidence.sourceText, expiryEvidence.value)
        || !normalized(evidence.sourceText).includes(normalized(expiryEvidence.sourceText))
      ) return false;
      const expiry = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(expiryEvidence.value)
        ? `${expiryEvidence.value}T23:59:59.999Z`
        : expiryEvidence.value);
      if (!Number.isFinite(expiry) || expiry < asOf) return false;
    }
    const identityMatches = isValidGtin(evidence.candidateGtin)
      && isValidGtin(candidateGtin ?? '')
      && canonicalGtin(evidence.candidateGtin) === canonicalGtin(candidateGtin ?? '');
    const registrationMatches = typeof evidence.registrationNumber === 'string'
      && evidence.registrationNumber.trim().length >= 3
      && sourceTextContainsExactIdentifier(evidence.sourceText, evidence.registrationNumber);
    if (!identityMatches || !registrationMatches) return false;
    if (evidence.matchBasis === 'manufacturer-gtin') {
      return sourceTextContainsExactGtin(evidence.sourceText, evidence.candidateGtin)
        && sourceNamesLabel(evidence.sourceText, 'GTIN');
    }
    return evidence.matchBasis === 'package-registration-number'
      && fieldShape(evidence.registeredProductName)
      && typeof evidence.registeredProductName.value === 'string'
      && evidence.registeredProductName.value.trim().length >= 3
      && normalized(evidence.registeredProductName.sourceText).includes(
        normalized(evidence.registeredProductName.value),
      )
      && normalized(evidence.sourceText).includes(normalized(evidence.registeredProductName.sourceText))
      && reviewedPackageRegulatoryLabelResponseValid(
        evidence.packageResponse,
        evidence.candidateGtin,
        evidence.registrationNumber,
        reviewedAt!,
        asOf,
      );
  }

  return isValidGtin(evidence.candidateGtin)
    && isValidGtin(candidateGtin ?? '')
    && canonicalGtin(evidence.candidateGtin) === canonicalGtin(candidateGtin ?? '')
    && typeof evidence.subjectProductOrClass === 'string'
    && evidence.subjectProductOrClass.trim().length >= 8
    && /(?:scope|exempt|not.required|categor|class)/i.test(evidence.locator)
    && normalized(evidence.sourceText).includes(normalized(evidence.subjectProductOrClass))
    && typeof evidence.rationale === 'string'
    && evidence.rationale.trim().length >= 24
    && normalized(evidence.sourceText).includes(normalized(evidence.rationale));
}
