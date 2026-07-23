import { createHash } from 'node:crypto';
import { canonicalGtin, isValidGtin } from './gtin';

export const catalogueExactOfferEvidenceSchemaVersion = 1 as const;
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

export type ReviewedExactOfferEvidence = {
  schemaVersion: typeof catalogueExactOfferEvidenceSchemaVersion;
  method:
    | 'reviewed-exact-offer-field-extraction'
    | 'reviewed-browser-dom-exact-offer-field-extraction';
  listingUrl: string;
  responseUrl: string;
  responseSha256: string;
  responseDigestScope: 'decoded-response-body' | 'rendered-dom-outerhtml';
  responseMimeType: MarketEvidenceMimeType;
  responseByteSize: number;
  retrievedAt: string;
  browserCapture?: {
    surface: 'Codex in-app browser';
    documentReadyState: 'complete';
    pageTitle: string;
  };
  fields: {
    gtin: {
      label: ExactOfferGtinLabel;
      value: string;
      locator: string;
      sourceText: string;
      responseRole?: 'listing-response' | 'package-barcode-image' | 'official-identity-correlation';
    };
    title: { value: string; locator: string; sourceText: string };
    size: { value: string; locator: string; sourceText: string };
    price: { value: number; currency: 'NGN'; locator: string; sourceText: string };
    stock: { value: ExactOfferStock; locator: string; sourceText: string };
  };
  supplementalResponses?: ReviewedPackageBarcodeResponse[];
  reviewer: string;
  reviewedAt: string;
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
  priceNgn: number;
  stock: ExactOfferStock;
  evidence?: ReviewedExactOfferEvidence;
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

function sameUrl(left: unknown, right: unknown) {
  if (!validHttps(left) || !validHttps(right)) return false;
  return new URL(left as string).href === new URL(right as string).href;
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

function priceSourceMatches(sourceText: string, priceNgn: number) {
  if (!Number.isSafeInteger(priceNgn) || priceNgn <= 0) return false;
  const plain = String(priceNgn);
  const grouped = priceNgn.toLocaleString('en-US').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:\\bNGN\\b|₦)\\s*(?:${plain}|${grouped})(?:\\.00)?(?![\\d.,])`, 'i').test(sourceText);
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
  if (stock === 'in-stock') return /^(?:in stock|\d+ in stock|available|available now)$/.test(value);
  if (stock === 'low-stock') return /^(?:low stock|only \d+ left|\d+ units? left|few left)$/.test(value);
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

export function reviewedExactOfferEvidenceValid(
  offer: ExactOfferEvidenceSubject,
  candidateGtin: string | undefined,
  asOf: number,
) {
  const evidence = offer.evidence;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return false;
  const fields = evidence.fields;
  const rawResponseEvidence = evidence.method === 'reviewed-exact-offer-field-extraction'
    && evidence.responseDigestScope === 'decoded-response-body'
    && evidence.browserCapture == null;
  const browserResponseEvidence = evidence.method === 'reviewed-browser-dom-exact-offer-field-extraction'
    && evidence.responseDigestScope === 'rendered-dom-outerhtml'
    && evidence.responseMimeType === 'text/html'
    && evidence.browserCapture?.surface === 'Codex in-app browser'
    && evidence.browserCapture.documentReadyState === 'complete'
    && evidence.browserCapture.pageTitle.trim().length >= 3;
  if (
    evidence.schemaVersion !== catalogueExactOfferEvidenceSchemaVersion
    || (!rawResponseEvidence && !browserResponseEvidence)
    || !sameUrl(evidence.listingUrl, offer.listingUrl)
    || !sameUrl(evidence.responseUrl, offer.listingUrl)
    || !hashPattern.test(evidence.responseSha256)
    || !['application/json', 'text/html'].includes(evidence.responseMimeType)
    || !Number.isSafeInteger(evidence.responseByteSize)
    || evidence.responseByteSize <= 0
    || !fields
    || typeof fields !== 'object'
    || !fieldShape(fields.gtin)
    || !fieldShape(fields.title)
    || !fieldShape(fields.size)
    || !fieldShape(fields.price)
    || !fieldShape(fields.stock)
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

  const label = expectedLabel(offer.observedGtinBasis);
  const gtinResponseRole = fields.gtin.responseRole ?? 'listing-response';
  const exactVariantAndSize = offer.observedGtinBasis === 'exact-variant-and-size';
  const packageBarcodeValid = gtinResponseRole === 'package-barcode-image'
    && label != null
    && Array.isArray(evidence.supplementalResponses)
    && evidence.supplementalResponses.length === 1
    && reviewedPackageBarcodeResponseValid(
      evidence.supplementalResponses[0],
      offer.listingUrl,
      fields.gtin.value,
      label,
      reviewedAt!,
      asOf,
    );
  return Boolean(
    label
    && fields.gtin.label === label
    && typeof fields.gtin.value === 'string'
    && isValidGtin(fields.gtin.value)
    && isValidGtin(candidateGtin ?? '')
    && canonicalGtin(fields.gtin.value) === canonicalGtin(candidateGtin ?? '')
    && sourceTextContainsExactGtin(fields.gtin.sourceText, fields.gtin.value)
    && sourceNamesLabel(fields.gtin.sourceText, label)
    && (
      exactVariantAndSize
        ? (
          offer.observedGtin == null
          && gtinResponseRole === 'official-identity-correlation'
          && /official\s+(?:catalogue\s+)?identity/i.test(fields.gtin.sourceText)
        )
        : (
          isValidGtin(offer.observedGtin ?? '')
          && canonicalGtin(fields.gtin.value) === canonicalGtin(offer.observedGtin ?? '')
          && (gtinResponseRole === 'listing-response' || packageBarcodeValid)
        )
    )
    && typeof fields.title.value === 'string'
    && normalized(fields.title.value) === normalized(offer.observedTitle)
    && normalized(fields.title.sourceText).includes(normalized(fields.title.value))
    && typeof fields.size.value === 'string'
    && measurementTokens(fields.size.value).join('|') === measurementTokens(offer.observedSize).join('|')
    && sourceTextContainsExactSize(fields.size.sourceText, fields.size.value)
    && typeof fields.price.value === 'number'
    && fields.price.value === offer.priceNgn
    && fields.price.currency === 'NGN'
    && priceSourceMatches(fields.price.sourceText, fields.price.value)
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
