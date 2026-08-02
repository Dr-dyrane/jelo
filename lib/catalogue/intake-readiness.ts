import { createHash } from 'node:crypto';
import cataloguePackshotIsolations from '@/data/catalogue-packshot-isolations.json';
import { canonicalGtin, isValidGtin } from './gtin';
import {
  cataloguePackshotIsolationRecordFor,
  cataloguePackshotIsolationRecordValid,
  type CataloguePackshotIsolationRecord,
} from './packshot-isolation-record';
import {
  catalogueCanonicalIdentifierFor,
  catalogueCanonicalIdentifierKey,
  catalogueGtinForIdentity,
  catalogueOfficialProductPackageKey,
  catalogueOfficialProductCrosswalkRouteClass,
  catalogueOfficialProductCrosswalkKeyGrounded,
  catalogueOfficialProductCrosswalkSchemaVersion,
  catalogueOfficialProductCrosswalkValid,
  catalogueOfficialProductRoutePackageKey,
  normalizedManufacturerSku,
  validManufacturerSku,
  validManufacturerSkuLabel,
  type CatalogueCanonicalProductIdentifier,
  type CatalogueManufacturerSkuLabel,
  type CatalogueOfficialProductIdentityCrosswalk,
} from './canonical-identity';
import {
  catalogueRetainedRecordShapeValid,
  sourceTextNamesCatalogueBrandField,
  type CatalogueRetainedRecord,
} from './retained-record';
import { nigeriaRetailers } from '@/data/retailers';
import { assertRetailerResponseScope } from '@/modules/retail-intelligence/response-scope';
import { reviewedBrandSellerEvidenceValid } from './brand-seller-evidence';
import {
  reviewedExactOfferEvidenceValid,
  type ReviewedCatalogueExactOfferEvidence,
  type ReviewedRegulatoryEvidence,
} from './market-evidence';
import {
  assertCataloguePublicationImageLocation,
  cataloguePublicationImageMaxBytes,
  cataloguePublicationImageMaxSide,
  cataloguePublicationImageMinSide,
  isCataloguePublicationImageMimeType,
  type CataloguePublicationImageMimeType,
} from './publication-image-policy';

export const catalogueIntakeSchemaVersion = 8 as const;
export const catalogueGenerationRecordSchemaVersion = 1 as const;
export const catalogueIdentityExtractionSchemaVersion = 3 as const;
export const catalogueBrowserIdentityExtractionSchemaVersion = 4 as const;
export const catalogueCorroboratedIdentityExtractionSchemaVersion = 5 as const;
export const catalogueAccessibleCorroboratedIdentityExtractionSchemaVersion = 6 as const;
export const catalogueManufacturerSkuIdentityExtractionSchemaVersion = 8 as const;
export const catalogueMarketObservationSchemaVersion = 1 as const;
export const catalogueRegulatorySearchObservationSchemaVersion = 1 as const;

/**
 * Reviewed browser surfaces whose rendered DOM may bind identity evidence. A surface qualifies
 * only when an operator drives it, sees the rendered page and attributes the review. Adding one
 * widens what counts as a reviewed capture, so extend this list deliberately—never to make a
 * specific candidate pass.
 */
export const reviewedBrowserCaptureSurfaces = [
  'Codex in-app browser',
  'Claude Code in-app browser',
] as const;
export type ReviewedBrowserCaptureSurface = typeof reviewedBrowserCaptureSurfaces[number];
function reviewedBrowserSurface(surface: string) {
  return (reviewedBrowserCaptureSurfaces as readonly string[]).includes(surface);
}

export type CatalogueIntakePriority = 'essential' | 'important' | 'exploratory';
export type CatalogueIntakeStage = 'identity' | 'care' | 'nigeria' | 'rights' | 'editorial' | 'approval-ready';
export type CatalogueNigeriaMarketRoute = 'tier-a' | 'brand-authorized';
export type CatalogueSourceAssetMimeType = 'image/avif' | 'image/jpeg' | 'image/png' | 'image/webp';
export type CatalogueIdentityEvidenceMimeType =
  | 'application/json'
  | 'application/pdf'
  | 'image/avif'
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'text/html'
  | 'text/javascript';

type CatalogueOfficialIdentityExtractionBase = {
  candidateId: string;
  sourceUrl: string;
  responseUrl: string;
  retrievedAt: string;
  fields: {
    gtin: { value: string; locator: string; sourceText: string };
    variant: { value: string; locator: string; sourceText: string };
    size: { value: string; locator: string; sourceText: string };
  };
  sourceResponseSha256: string;
  sourceResponseMimeType: Exclude<CatalogueIdentityEvidenceMimeType, 'application/json'>;
  sourceResponseByteSize: number;
  supplementalResponses?: Array<{
    role: 'official-pack-image';
    sourceUrl: string;
    responseUrl: string;
    retrievedAt: string;
    responseSha256: string;
    responseMimeType: 'image/avif' | 'image/jpeg' | 'image/png' | 'image/webp';
    responseByteSize: number;
  }>;
  reviewer: string;
  reviewedAt: string;
};

type CatalogueCorroboratedIdentifierExtraction = {
  sourceUrl: string;
  responseUrl: string;
  retrievedAt: string;
  fields: {
    gtin: { value: string; locator: string; sourceText: string };
    variant: { value: string; locator: string; sourceText: string };
    size: { value: string; locator: string; sourceText: string };
  };
  sourceResponseSha256: string;
  sourceResponseMimeType: 'text/html';
  sourceResponseByteSize: number;
  responseDigestScope: 'rendered-dom-outerhtml';
  method: 'reviewed-browser-dom-independent-ean-corroboration';
  browserCapture: {
    surface: ReviewedBrowserCaptureSurface;
    documentReadyState: 'complete';
    pageTitle: string;
  };
  reviewer: string;
  reviewedAt: string;
};

type CatalogueAccessibleCorroboratedIdentifierExtraction = {
  sourceUrl: string;
  responseUrl: string;
  retrievedAt: string;
  fields: {
    gtin: { value: string; locator: string; sourceText: string };
    variant: { value: string; locator: string; sourceText: string };
    size: { value: string; locator: string; sourceText: string };
  };
  sourceResponseSha256: string;
  sourceResponseMimeType: 'text/html';
  sourceResponseByteSize: number;
  responseDigestScope: 'rendered-accessibility-tree';
  method: 'reviewed-browser-accessibility-independent-ean-corroboration';
  browserCapture: {
    surface: ReviewedBrowserCaptureSurface;
    documentReadyState: 'complete';
    pageTitle: string;
  };
  reviewer: string;
  reviewedAt: string;
};

/**
 * Machine-recheckable proof that an official source publishes no manufacturer identifier.
 *
 * A Shopify-shaped official page can quote `"sku":"","barcode":null` directly, but a custom
 * storefront has no such object, and prose ("the page shows no barcode") is not re-verifiable.
 * This records the search itself: the exact digest scope that was searched, the exact terms, and
 * the resulting match count. A later reviewer re-fetches the source, confirms the bound response
 * digest still matches, re-runs the same case-insensitive search and must observe the same zero.
 *
 * `searchedTerms` must cover every required identifier term, so a narrow search cannot manufacture
 * an absence. Matching is whole-word and case-insensitive: a substring search would count "ean"
 * inside "cleanser" and make a genuine absence impossible to record.
 */
export const requiredIdentifierAbsenceTerms = ['barcode', 'ean', 'gtin', 'upc'] as const;
export type CatalogueIdentifierAbsenceProof = {
  searchScope: 'complete-rendered-dom-outerhtml';
  searchedTerms: readonly string[];
  matchStrategy: 'whole-word' | 'structured-key-variants';
  caseInsensitive: true;
  matchCount: 0;
};

function identifierAbsenceProofValid(
  proof: CatalogueIdentifierAbsenceProof | undefined,
  extraction: { responseDigestScope: string },
) {
  if (!proof) return false;
  const searched = new Set((proof.searchedTerms ?? []).map(term => term.trim().toLowerCase()));
  return Boolean(
    proof.searchScope === 'complete-rendered-dom-outerhtml'
    && extraction.responseDigestScope === 'rendered-dom-outerhtml'
    && ['whole-word', 'structured-key-variants'].includes(proof.matchStrategy)
    && proof.caseInsensitive === true
    && proof.matchCount === 0
    && Array.isArray(proof.searchedTerms)
    && requiredIdentifierAbsenceTerms.every(term => searched.has(term)),
  );
}

export type CatalogueCorroboratedIdentityExtraction = {
  schemaVersion: typeof catalogueCorroboratedIdentityExtractionSchemaVersion;
  candidateId: string;
  sourceUrl: string;
  responseUrl: string;
  retrievedAt: string;
  fields: {
    gtin: {
      value: string;
      locator: string;
      sourceText: string;
    };
    variant: { value: string; locator: string; sourceText: string };
    size: { value: string; locator: string; sourceText: string };
    manufacturerIdentifierStatus: {
      value: 'not-published';
      locator: string;
      sourceText: string;
      absenceProof?: CatalogueIdentifierAbsenceProof;
    };
    packageVersion: {
      value: string;
      locator: string;
      sourceText: string;
      evidenceUrl: string;
    };
  };
  sourceResponseSha256: string;
  sourceResponseMimeType: 'text/html';
  sourceResponseByteSize: number;
  supplementalResponses: Array<{
    role: 'official-pack-image';
    sourceUrl: string;
    responseUrl: string;
    retrievedAt: string;
    responseSha256: string;
    responseMimeType: 'image/avif' | 'image/jpeg' | 'image/png' | 'image/webp';
    responseByteSize: number;
  }>;
  responseDigestScope: 'rendered-dom-outerhtml';
  method: 'reviewed-browser-dom-identity-with-independent-ean-corroboration';
  browserCapture: {
    surface: ReviewedBrowserCaptureSurface;
    documentReadyState: 'complete';
    pageTitle: string;
  };
  identifierCorroborations: CatalogueCorroboratedIdentifierExtraction[];
  reviewer: string;
  reviewedAt: string;
};

export type CatalogueAccessibleCorroboratedIdentityExtraction = {
  schemaVersion: typeof catalogueAccessibleCorroboratedIdentityExtractionSchemaVersion;
  candidateId: string;
  sourceUrl: string;
  responseUrl: string;
  retrievedAt: string;
  fields: {
    gtin: {
      value: string;
      locator: string;
      sourceText: string;
    };
    variant: { value: string; locator: string; sourceText: string };
    size: { value: string; locator: string; sourceText: string };
    packageVersion: {
      value: string;
      locator: string;
      sourceText: string;
      evidenceUrl: string;
    };
  };
  sourceResponseSha256: string;
  sourceResponseMimeType: 'text/html';
  sourceResponseByteSize: number;
  supplementalResponses: Array<{
    role: 'official-pack-image';
    sourceUrl: string;
    responseUrl: string;
    retrievedAt: string;
    responseSha256: string;
    responseMimeType: 'image/avif' | 'image/jpeg' | 'image/png' | 'image/webp';
    responseByteSize: number;
  }>;
  responseDigestScope: 'rendered-accessibility-tree';
  method: 'reviewed-browser-accessibility-identity-with-independent-ean-corroboration';
  browserCapture: {
    surface: ReviewedBrowserCaptureSurface;
    documentReadyState: 'complete';
    pageTitle: string;
  };
  identifierCorroborations: CatalogueAccessibleCorroboratedIdentifierExtraction[];
  reviewer: string;
  reviewedAt: string;
};

type CatalogueManufacturerSkuIdentityExtractionBase = {
  schemaVersion: typeof catalogueManufacturerSkuIdentityExtractionSchemaVersion;
  candidateId: string;
  sourceUrl: string;
  responseUrl: string;
  retrievedAt: string;
  productRecord: CatalogueRetainedRecord;
  fields: {
    manufacturerBrand: {
      value: string;
      locator: string;
      sourceText: string;
    };
    manufacturerBrandAliases?: Array<{
      value: string;
      locator: string;
      sourceText: string;
    }>;
    manufacturerSku: {
      value: string;
      label: CatalogueManufacturerSkuLabel;
      locator: string;
      sourceText: string;
    };
    variant: { value: string; locator: string; sourceText: string };
    size: { value: string; locator: string; sourceText: string };
    packageVersion: {
      value: string;
      locator: string;
      sourceText: string;
      reviewedMedia?: {
        sourceUrl: string;
        sourceAssetUrl: string;
        sourceAssetSha256: string;
      };
    };
    gtinPublicationStatus: {
      value: 'not-published';
      locator: string;
      sourceText: string;
      absenceProof?: CatalogueIdentifierAbsenceProof;
    };
  };
  sourceResponseSha256: string;
  sourceResponseByteSize: number;
  sourceSnapshotPath: string;
  supplementalResponses?: never;
  reviewer: string;
  reviewedAt: string;
};

/**
 * Schema 8 retains the exact official representation used for a manufacturer-SKU route.
 *
 * A rendered product page remains useful when the manufacturer exposes the SKU only in its DOM.
 * Shopify's canonical `/products/<handle>.js` response is stronger when it publishes `vendor`,
 * `sku`, and `barcode` as structured fields, so it is retained as exact JSON rather than being
 * transformed into synthetic HTML. Both routes bind one complete product record and fail closed
 * when its bytes, URL, record range, or structured identifier scan changes.
 */
export type CatalogueManufacturerSkuIdentityExtraction =
  CatalogueManufacturerSkuIdentityExtractionBase & (
    | {
      sourceResponseMimeType: 'text/html';
      responseDigestScope: 'rendered-dom-outerhtml';
      method: 'reviewed-browser-dom-official-manufacturer-sku-identity';
      browserCapture: {
        surface: ReviewedBrowserCaptureSurface;
        documentReadyState: 'complete';
        pageTitle: string;
      };
    }
    | {
      sourceResponseMimeType: 'application/json' | 'text/javascript';
      responseDigestScope: 'decoded-response-body';
      method: 'reviewed-exact-official-manufacturer-sku-response';
      browserCapture?: never;
    }
  );

export type CatalogueOfficialIdentityExtraction =
  | (CatalogueOfficialIdentityExtractionBase & (
    | {
      schemaVersion: typeof catalogueIdentityExtractionSchemaVersion;
      responseDigestScope: 'decoded-response-body';
      method: 'reviewed-exact-identity-field-extraction';
    }
    | {
      schemaVersion: typeof catalogueBrowserIdentityExtractionSchemaVersion;
      responseDigestScope: 'rendered-dom-outerhtml';
      method: 'reviewed-browser-dom-identity-field-extraction';
      browserCapture: {
        surface: ReviewedBrowserCaptureSurface;
        documentReadyState: 'complete';
        pageTitle: string;
      };
    }
  ))
  | CatalogueCorroboratedIdentityExtraction
  | CatalogueAccessibleCorroboratedIdentityExtraction
  | CatalogueManufacturerSkuIdentityExtraction;

type CatalogueOfficialIdentityEvidenceBase = {
  url: string;
  observedVariant: string;
  observedSize: string;
  observedPackageVersion?: string;
  snapshotKind: 'canonical-extraction';
  snapshotPath: string;
  snapshotSha256: string;
  snapshotMimeType: 'application/json';
  snapshotByteSize: number;
  retrievedAt: string;
};

export type CatalogueOfficialGtinIdentityEvidence = CatalogueOfficialIdentityEvidenceBase & {
  observedGtin: string;
  canonicalExtraction: Exclude<
    CatalogueOfficialIdentityExtraction,
    CatalogueManufacturerSkuIdentityExtraction
  >;
};

export type CatalogueOfficialManufacturerSkuIdentityEvidence =
  CatalogueOfficialIdentityEvidenceBase & {
    identityKind: 'manufacturer-sku';
    observedGtin?: never;
    observedManufacturerSku: string;
    observedManufacturerSkuLabel: CatalogueManufacturerSkuLabel;
    canonicalExtraction: CatalogueManufacturerSkuIdentityExtraction;
  };

/**
 * Preserve the established GTIN evidence name for compiler and fixture
 * compatibility. Candidate-aware callers that can handle either route use
 * the explicitly wider evidence type.
 */
export type CatalogueOfficialIdentityEvidence = CatalogueOfficialGtinIdentityEvidence;
/**
 * Intake JSON is decoded before its identity route is trusted. Keep this
 * boundary broad enough for immutable record migrations; the readiness and
 * artifact gates prove the exact GTIN or manufacturer-SKU shape.
 */
export type CatalogueCandidateOfficialIdentityEvidence =
  CatalogueOfficialIdentityEvidenceBase & {
    observedGtin?: string;
    identityKind?: 'manufacturer-sku';
    observedManufacturerSku?: string;
    observedManufacturerSkuLabel?: CatalogueManufacturerSkuLabel;
    canonicalExtraction: CatalogueOfficialIdentityExtraction;
  };

export type CatalogueGenerationRecordContent = {
  schemaVersion: typeof catalogueGenerationRecordSchemaVersion;
  provider: string;
  model: string;
  prompt: string;
  inputs: Array<{
    url: string;
    sha256: string;
  }>;
  outputSha256: string;
  generatedAt: string;
};

export type CatalogueGenerationRecord = CatalogueGenerationRecordContent & {
  recordSha256: string;
};

export type CatalogueIntakeOffer = {
  retailer: string;
  retailerStatus: 'directory-listed' | 'provisional';
  listingUrl: string;
  observedAt: string;
  observedTitle: string;
  reviewedTitleAlias?: string;
  observedSize: string;
  observedGtin?: string;
  observedGtinBasis?: 'explicit-gtin' | 'explicit-ean' | 'explicit-upc' | 'exact-variant-and-size';
  observedPackageVersion?: string;
  retailerSku?: string;
  priceNgn: number;
  stock: 'in-stock' | 'low-stock' | 'out-of-stock';
  evidence?: ReviewedCatalogueExactOfferEvidence;
};

export type CatalogueMarketObservationExclusionReason =
  | 'retailer-identifier-only'
  | 'retailer-identifier-conflicts-with-candidate'
  | 'manufacturer-identifier-mismatch'
  | 'package-barcode-missing'
  | 'package-variant-conflict'
  | 'retailer-provisional'
  | 'listing-no-longer-current'
  | 'marketplace-seller-unverified';

type CatalogueMarketObservationTextField = {
  value: string;
  locator: string;
  sourceText: string;
};

export type CatalogueMarketObservation = {
  retailer: string;
  retailerStatus: 'directory-listed' | 'provisional';
  listingUrl: string;
  observedAt: string;
  observedTitle: string;
  observedSize: string;
  priceNgn: number;
  stock: 'in-stock' | 'low-stock' | 'out-of-stock';
  disposition: 'excluded-from-exact-comparison';
  exclusionReasons: CatalogueMarketObservationExclusionReason[];
  evidence: {
    schemaVersion: typeof catalogueMarketObservationSchemaVersion;
    method: 'reviewed-retailer-observation';
    responseUrl: string;
    responseSha256: string;
    responseDigestScope: 'decoded-response-body';
    responseMimeType: 'text/html';
    responseByteSize: number;
    retrievedAt: string;
    fields: {
      title: CatalogueMarketObservationTextField;
      size: CatalogueMarketObservationTextField;
      price: {
        value: number;
        currency: 'NGN';
        locator: string;
        sourceText: string;
      };
      stock: {
        value: CatalogueMarketObservation['stock'];
        locator: string;
        sourceText: string;
      };
      retailerIdentifier?: CatalogueMarketObservationTextField & {
        label: 'SKU' | 'EAN' | 'GTIN' | 'UPC';
      };
      packageVariantConflict?: CatalogueMarketObservationTextField;
    };
    reviewer: string;
    reviewedAt: string;
  };
};

export type CatalogueRegulatorySearchObservation = {
  schemaVersion: typeof catalogueRegulatorySearchObservationSchemaVersion;
  authority: 'NAFDAC';
  method: 'reviewed-public-registry-search';
  sourceUrl: string;
  responseUrl: string;
  responseDigestScope: 'decoded-response-body';
  responseSha256: string;
  responseMimeType: 'application/json';
  responseByteSize: number;
  retrievedAt: string;
  query: {
    field: 'product-name';
    value: string;
  };
  result: {
    recordsTotal: number;
    recordsFiltered: 0;
    dataCount: 0;
  };
  disposition: 'no-active-public-match';
  caveat: string;
  reviewer: string;
  reviewedAt: string;
};

type CatalogueCandidateIdentityBase = {
  officialProductUrl?: string;
  checkedAt?: string;
  basis?: 'official-brand';
  packageVersion?: string;
};

export type CatalogueGtinCandidateIdentity = CatalogueCandidateIdentityBase & {
  gtin?: string;
  canonicalIdentifier?: Extract<CatalogueCanonicalProductIdentifier, { kind: 'gtin' }>;
  officialProductCrosswalk?: CatalogueOfficialProductIdentityCrosswalk;
  officialEvidence?: CatalogueOfficialGtinIdentityEvidence;
};

export type CatalogueManufacturerSkuCandidateIdentity = CatalogueCandidateIdentityBase & {
  gtin?: never;
  canonicalIdentifier: Extract<CatalogueCanonicalProductIdentifier, { kind: 'manufacturer-sku' }>;
  officialProductCrosswalk: CatalogueOfficialProductIdentityCrosswalk;
  officialEvidence?: CatalogueOfficialManufacturerSkuIdentityEvidence;
};

export type CatalogueCandidateIdentity = CatalogueCandidateIdentityBase & {
  gtin?: string;
  canonicalIdentifier?: CatalogueCanonicalProductIdentifier;
  officialProductCrosswalk?: CatalogueOfficialProductIdentityCrosswalk;
  officialEvidence?: CatalogueCandidateOfficialIdentityEvidence;
};

export type CatalogueIntakeCandidate = {
  id: string;
  brand: string;
  brandAliases?: string[];
  name: string;
  variant: string;
  size: string;
  category: 'Face care' | 'Hair & scalp' | 'Body care' | 'Makeup' | 'Fragrance' | 'Personal care';
  reason: string;
  priority: CatalogueIntakePriority;
  gapIds: string[];
  demandEvidenceUrls: string[];
  identity: CatalogueCandidateIdentity;
  care: {
    status: 'pending' | 'reviewed';
    formulaArchetype?: string;
    careTier?: 'daily-care' | 'targeted-care' | 'professional-referral';
    reviewScope?: 'catalogue-supportive-care';
    advisoryBoundary?: string;
    manufacturerEvidenceUrl?: string;
    independentClinicalGuidanceUrl?: string;
    evidenceUrls: string[];
    reviewedAt?: string;
    reviewer?: string;
  };
  nigeria: {
    regulatoryStatus: 'pending' | 'matched' | 'not-required';
    regulatoryEvidence?: ReviewedRegulatoryEvidence;
    regulatorySearches?: CatalogueRegulatorySearchObservation[];
    tierAIdentityEvidenceUrl?: string;
    brandAuthorizationEvidenceUrl?: string;
    exactOffers: CatalogueIntakeOffer[];
    excludedObservations: CatalogueMarketObservation[];
  };
  asset: {
    rightsStatus: 'unresolved' | 'documented';
    origin?:
      | 'licensed-original-photograph'
      | 'official-brand-media'
      | 'owned-editorial-photograph'
      | 'owned-identity-verified-render';
    role?: 'packshot';
    rightsUrl?: string;
    sourceUrl?: string;
    sourceAssetSha256?: string;
    sourceAssetMimeType?: CatalogueSourceAssetMimeType;
    sourceAssetByteSize?: number;
    sourceAssetWidth?: number;
    sourceAssetHeight?: number;
    sourceAssetRetrievedAt?: string;
    generationRecord?: CatalogueGenerationRecord;
    publicImageUrl?: string;
    publicImageSha256?: string;
    publicImageMimeType?: CataloguePublicationImageMimeType;
    publicImageByteSize?: number;
    width?: number;
    height?: number;
    packaging?: 'intact' | 'clipped' | 'unknown';
    backgroundTreatment?:
      | 'none'
      | 'styled-composite'
      | 'source-pixel-isolation'
      | 'identity-verified-render'
      | 'automated-removal'
      | 'unknown';
    labelVariantSizeUnchanged?: boolean;
    packagingInvented?: boolean;
    manualSourceOutputQa?: boolean;
    artReviewedAt?: string;
    artReviewer?: string;
    presentationQuality?: 'magazine-ready' | 'ordinary' | 'unknown';
  };
};

export type CatalogueIntakeManifest = {
  schemaVersion: typeof catalogueIntakeSchemaVersion;
  updatedAt: string;
  candidates: CatalogueIntakeCandidate[];
};

export type CatalogueIntakeBlocker =
  | 'identity-gtin-missing-or-invalid'
  | 'identity-manufacturer-sku-missing-or-invalid'
  | 'identity-official-source-missing'
  | 'identity-official-evidence-invalid'
  | 'identity-check-missing-or-future'
  | 'identity-size-not-measurable'
  | 'care-review-missing'
  | 'care-evidence-missing'
  | 'care-independent-guidance-missing'
  | 'care-advisory-boundary-missing'
  | 'nigeria-exact-offer-missing'
  | 'nigeria-offer-identity-unbound'
  | 'nigeria-market-route-insufficient'
  | 'asset-rights-missing'
  | 'asset-origin-ineligible'
  | 'asset-rights-source-missing'
  | 'asset-source-snapshot-invalid'
  | 'asset-isolation-record-missing'
  | 'asset-generation-record-missing'
  | 'asset-review-chronology-invalid'
  | 'asset-final-image-role-invalid'
  | 'asset-final-image-missing'
  | 'asset-final-image-invalid'
  | 'asset-final-image-untrusted-location'
  | 'asset-final-image-too-small'
  | 'asset-automated-cutout'
  | 'asset-background-treatment-unresolved'
  | 'asset-packaging-not-intact'
  | 'asset-identity-qa-missing'
  | 'asset-not-magazine-ready';

export type CatalogueIntakeDecision = {
  candidate: CatalogueIntakeCandidate;
  stage: CatalogueIntakeStage;
  blockers: CatalogueIntakeBlocker[];
  nextAction: string;
  approvalDraftReady: boolean;
  freshExactOffers: CatalogueIntakeOffer[];
  excludedMarketObservations: CatalogueMarketObservation[];
  unresolvedRegulatorySearches: CatalogueRegulatorySearchObservation[];
  nigeriaMarketRoute?: CatalogueNigeriaMarketRoute;
};

const hashPattern = /^[0-9a-f]{64}$/;
const regulatorySearchMaxAgeMs = 90 * 24 * 60 * 60 * 1_000;
const measurableSize = /\b\d+(?:[.,]\d+)?\s*(?:ml|cl|l|mg|g|kg|oz|fl\.?\s*oz|count|pcs?|pieces?|pack)\b/i;
const priorityOrder: Record<CatalogueIntakePriority, number> = { essential: 0, important: 1, exploratory: 2 };
const stageProgress: Record<CatalogueIntakeStage, number> = {
  identity: 0,
  care: 1,
  nigeria: 2,
  rights: 3,
  editorial: 4,
  'approval-ready': 5,
};
const rawIdentityEvidenceMimeTypes: readonly Exclude<CatalogueIdentityEvidenceMimeType, 'application/json'>[] = [
  'application/pdf',
  'image/avif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/html',
  'text/javascript',
];
const packshotEligibleOrigins = [
  'licensed-original-photograph',
  'official-brand-media',
  'owned-editorial-photograph',
  'owned-identity-verified-render',
] as const;
const reviewedOfficialCareHosts: Readonly<Record<string, readonly string[]>> = {
  anua: ['anua.com'],
  aquarich: ['www.aquarich.net'],
  balanceactiveformula: ['www.balanceactiveformula.com'],
  beautyformulas: ['www.beautyformulas.co.uk'],
  benton: ['bentoncosmetics.com'],
  cerave: ['africa.cerave.com', 'www.cerave.com', 'www.cerave.co.uk'],
  cecred: ['cecred.com'],
  delacruz: ['dlclabs.com'],
  dang: ['danglifestyle.co', 'international.danglifestyle.co'],
  danglifestyle: ['danglifestyle.co', 'international.danglifestyle.co'],
  danglifestyleinc: ['danglifestyle.co', 'international.danglifestyle.co'],
  dove: ['www.dove.com'],
  eucerin: ['www.eucerin-cewa.com'],
  facefacts: ['facefacts.me'],
  garnier: ['www.garnier.co.uk'],
  keracare: ['keracare.com'],
  larocheposay: ['www.laroche-posay.co.uk', 'www.laroche-posay.fr'],
  nivea: ['www.nivea.com.ng'],
  nineless: ['ninelessshop.com'],
  olay: ['www.olay.com'],
  prequel: ['prequelskin.com', 'www.prequelskin.com'],
  sheamoisture: ['www.sheamoisture.com'],
  simple: ['www.simpleskincare.com', 'www.simple.co.uk'],
  skinbyzaron: ['www.zaroncosmetics.com'],
  tresemme: ['www.tresemme.com'],
};
const reviewedCandidateManufacturerCareUrls: Readonly<Record<string, readonly string[]>> = {
  'balance-salicylic-acid-zinc-clarifying-toner-200ml': [
    'https://www.balanceactiveformula.com/products/balance-active-formula-salicylic-acid-zinc-clarifying-toner-200ml',
  ],
  'cerave-moisturising-cream-454g': [
    'https://africa.cerave.com/en/our-products/moisturizers/moisturising-cream',
  ],
  'cerave-sa-smoothing-cleanser-473ml': [
    'https://www.cerave.co.uk/skincare/cleansers/sa-smoothing-cleanser',
  ],
  'laroche-posay-mela-b3-serum-30ml': [
    'https://www.laroche-posay.co.uk/en_GB/mela-b3-intense-anti-dark-spot-serum/3337875890021.html',
  ],
  'prequel-gleanser-glycolic-acid-cleanser-400ml': [
    'https://prequelskin.com/products/gleanser-glycerin-and-glycolic-acid-cleanser',
  ],
  'tresemme-keratin-smooth-weightless-conditioner-828ml': [
    'https://www.tresemme.com/ca/en/p/tresemm%C3%A9-keratin-smooth-weightless-conditioner.html/00022400011738',
  ],
};
const reviewedOfficialIdentityHosts: Readonly<Record<string, readonly string[]>> = {
  anua: ['anua.com'],
  aquarich: ['www.aquarich.net'],
  balanceactiveformula: ['www.balanceactiveformula.com'],
  beautyformulas: ['www.beautyformulas.co.uk'],
  benton: ['bentoncosmetics.com', 'cafe24img.poxo.com'],
  cerave: [
    'africa.cerave.com',
    'www.cerave.com',
    'www.cerave.co.uk',
    'uk.lorealdermatologicalbeautypartnershop.com',
  ],
  cecred: ['cecred.com'],
  delacruz: ['dlclabs.com'],
  dang: ['danglifestyle.co', 'international.danglifestyle.co'],
  danglifestyle: ['danglifestyle.co', 'international.danglifestyle.co'],
  danglifestyleinc: ['danglifestyle.co', 'international.danglifestyle.co'],
  dove: ['www.dove.com', 'assets.unileversolutions.com'],
  eucerin: ['www.eucerin-cewa.com'],
  facefacts: ['facefacts.me'],
  garnier: ['www.garnier.co.uk'],
  keracare: ['keracare.com'],
  larocheposay: [
    'www.laroche-posay.co.uk',
    'www.laroche-posay.fr',
    'uk.lorealdermatologicalbeautypartnershop.com',
  ],
  nivea: ['www.nivea.com.ng', 'img.nivea.com'],
  nineless: ['ninelessshop.com'],
  olay: ['www.olay.com'],
  prequel: ['prequelskin.com', 'www.prequelskin.com'],
  sheamoisture: ['www.sheamoisture.com', 'assets.unileversolutions.com'],
  simple: ['www.simpleskincare.com', 'www.simple.co.uk', 'assets.unileversolutions.com'],
  skinbyzaron: [
    'www.zaroncosmetics.com',
    'zaronproducts.nyc3.cdn.digitaloceanspaces.com',
  ],
  tresemme: ['www.tresemme.com', 'assets.unileversolutions.com'],
};
const reviewedCandidateIdentifierCorroborationUrls: Readonly<Record<string, readonly string[]>> = {
  'benton-honest-cleansing-foam-150g': [
    'https://www.miintrade.com/benton/287-benton-honest-cleansing-foam-8809540510251.html',
    'https://www.iherb.com/pr/benton-honest-cleansing-foam-5-29-oz-150-g/74831',
  ],
  'cerave-pm-facial-moisturising-lotion-52ml': [
    'https://www.superdrug.com/skin/face-skin-care/moisturising-lotions/cerave-pm-facial-moisturising-lotion-normal-to-dry-skin-52ml/p/774868',
    'https://www.ebay.co.uk/p/11022362284',
  ],
  'facefacts-vitamin-c-body-lotion-400ml': [
    'https://www.ebay.co.uk/itm/186887831738',
    'https://www.eapollowholesale.co.uk/face-facts-vitamin-c-body-lotion-400ml.html',
  ],
  'nineless-a-control-10-azelaic-acid-serum-30ml': [
    'https://www.happii.dk/Ansigtspleje/Nineless-A-Control-10-Azelaic-Acid-Serum-30-ml/3353734',
    'https://qudobeauty.com/product/nine-less-a-control-10-azelaic-acid-serum-30ml/',
  ],
  'nineless-mela-pro-rice-txa-toner-200ml': [
    'https://qudobeauty.com/product/nineless-mela-pro-rice-txa-toner-200ml/',
    'https://www.shop-apotheke.com/beauty/upmU2WTME/nine-less-mela-pro-rice-txa-face-toner.htm',
  ],
  'skin-by-zaron-vitamin-c-body-wash-650ml': [
    'https://lamifragrance.com/product/skin-by-zaron-vitamin-c-body-wash/',
    'https://www.csigrocery.com/shop/skincare/face/body-face-wash/skin-by-zaron-vitamin-c-body-2/',
  ],
  'facefacts-ceramide-oil-control-foaming-cleanser-400ml': [
    'https://sianwholesale.com/brands/face_facts?p=2',
    'https://www.ebay.co.uk/itm/406162080305',
  ],
  'facefacts-ceramide-hydrating-gentle-cleanser-400ml': [
    'https://lamifragrance.com/product/face-facts-ceramide-hydrating-gentle/',
    'https://www.ebay.co.uk/itm/277901941087',
  ],
  'facefacts-ceramide-foaming-cleanser-400ml': [
    'https://lamifragrance.com/product/face-facts-ceramide-foaming-cleanser/',
    'https://beautyfree.gr/en/gel-foam/38505-face-facts-ceramide-skin-barrier-complex-foaming-cleanser-400ml-5031413936636.html',
  ],
  'facefacts-ceramide-blemish-gel-moisturiser-50ml': [
    'https://sianwholesale.com/face-facts-ceramide-blemish-gel-moisturiser-50ml5031413935691.html',
    'https://lamifragrance.com/product/face-facts-ceramide-blemish-gel-moisturiser/',
  ],
  'facefacts-ceramide-moisturising-gel-cream-50ml': [
    'https://icosmo.com.ua/ru/face-facts/421327',
    'https://skintoc.com/products/face-facts-ceramide-moisturising-gel-cream-50-ml',
  ],
};
const reviewedIndependentClinicalGuidanceUrls = new Set([
  'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?audience=consumer&setid=4a1591e8-6135-4b22-b54c-5553c2dc0540',
  'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=5d501ba0-a6f9-4f0d-86d5-0e8d9302737f',
  'https://www.aad.org/public/diseases/acne/diy/types-breakouts',
  'https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment',
  'https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101',
  'https://www.aad.org/public/everyday-care/skin-care-basics/dry/pick-moisturizer',
  'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
  'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
  'https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-apply-sunscreen',
  'https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips',
  'https://www.nhs.uk/tests-and-treatments/emollients/',
  'https://www.nhs.uk/conditions/keratosis-pilaris/',
  'https://www.nhs.uk/medicines/benzoyl-peroxide/about-benzoyl-peroxide/',
  'https://pubmed.ncbi.nlm.nih.gov/34596890/',
  'https://pubmed.ncbi.nlm.nih.gov/38722460/',
]);

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error('Generation record contains a non-serializable value.');
    return serialized;
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter(key => record[key] !== undefined)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

export function catalogueIdentityExtractionCanonicalJson(extraction: CatalogueOfficialIdentityExtraction) {
  return `${stableJson(extraction)}\n`;
}

function catalogueIdentityExtractionBytes(extraction: CatalogueOfficialIdentityExtraction) {
  return Buffer.from(catalogueIdentityExtractionCanonicalJson(extraction), 'utf8');
}

export function catalogueIdentityExtractionSha256(extraction: CatalogueOfficialIdentityExtraction) {
  return createHash('sha256').update(catalogueIdentityExtractionBytes(extraction)).digest('hex');
}

export function catalogueIdentityExtractionByteSize(extraction: CatalogueOfficialIdentityExtraction) {
  return catalogueIdentityExtractionBytes(extraction).byteLength;
}

export function catalogueGenerationRecordSha256(record: CatalogueGenerationRecordContent) {
  return createHash('sha256')
    .update(`jelocare-catalogue-generation-record-v1\n${stableJson(record)}`)
    .digest('hex');
}

function validHttps(value: string | undefined) {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function validPastDate(value: string | undefined, asOf: number) {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) && parsed <= asOf + 5 * 60_000;
}

function sameGtin(left: string | undefined, right: string | undefined) {
  return Boolean(
    left
    && right
    && isValidGtin(left)
    && isValidGtin(right)
    && canonicalGtin(left) === canonicalGtin(right),
  );
}

function regulatorySearchObservationValid(
  candidate: CatalogueIntakeCandidate,
  observation: CatalogueRegulatorySearchObservation,
  asOf: number,
) {
  const retrievedAt = Date.parse(observation.retrievedAt);
  const reviewedAt = Date.parse(observation.reviewedAt);
  const identityCheckedAt = Date.parse(candidate.identity.checkedAt ?? '');
  const expectedQuery = normalized(`${candidate.brand} ${candidate.name}`);
  const source = observation.sourceUrl === 'https://www.nafdac.emdex.ng/';
  const response = observation.responseUrl === observation.sourceUrl;
  return observation.schemaVersion === catalogueRegulatorySearchObservationSchemaVersion
    && observation.authority === 'NAFDAC'
    && observation.method === 'reviewed-public-registry-search'
    && source
    && response
    && observation.responseDigestScope === 'decoded-response-body'
    && hashPattern.test(observation.responseSha256)
    && observation.responseMimeType === 'application/json'
    && Number.isInteger(observation.responseByteSize)
    && observation.responseByteSize > 0
    && observation.query.field === 'product-name'
    && normalized(observation.query.value) === expectedQuery
    && Number.isInteger(observation.result.recordsTotal)
    && observation.result.recordsTotal >= 0
    && observation.result.recordsFiltered === 0
    && observation.result.dataCount === 0
    && observation.disposition === 'no-active-public-match'
    && /not proof of non-registration/i.test(observation.caveat)
    && observation.reviewer.trim().length > 0
    && validPastDate(observation.retrievedAt, asOf)
    && validPastDate(observation.reviewedAt, asOf)
    && retrievedAt >= identityCheckedAt
    && reviewedAt >= retrievedAt
    && asOf - retrievedAt <= regulatorySearchMaxAgeMs;
}

function normalized(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizedSize(value: string) {
  const measurementTokens: string[] = [];
  const remainder = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(
      /\b(\d+(?:[.,]\d+)?)\s*(fl\.?\s*oz|ml|cl|l|mg|kg|g|oz|count|pcs?|pieces?|pack)\b/g,
      (_match, rawAmount: string, rawUnit: string) => {
        const amount = Number(rawAmount.replace(',', '.'));
        const amountToken = Number.isFinite(amount) ? String(amount).replace('.', 'd') : rawAmount;
        const unitToken = rawUnit.replace(/[^a-z]/g, '').replace(/^pieces?$/, 'pc').replace(/^pcs?$/, 'pc');
        measurementTokens.push(`${amountToken}${unitToken}`);
        return ' ';
      },
    );
  return [...measurementTokens.sort(), normalized(remainder)].filter(Boolean).join(' ');
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

function identityExtractionFieldValid(value: unknown): value is { value: string; locator: string; sourceText: string } {
  if (!value || typeof value !== 'object') return false;
  const field = value as Record<string, unknown>;
  return typeof field.value === 'string'
    && typeof field.locator === 'string'
    && field.locator.trim().length >= 8
    && typeof field.sourceText === 'string'
    && field.sourceText.trim().length >= 3;
}

function supplementalIdentityResponsesValid(
  candidate: CatalogueIntakeCandidate,
  extraction: CatalogueOfficialIdentityExtraction,
  asOf: number,
) {
  const responses = extraction.supplementalResponses;
  if (responses === undefined) return true;
  if (!Array.isArray(responses) || responses.length < 1 || responses.length > 4) return false;

  const sourceUrls = new Set<string>();
  for (const response of responses) {
    if (
      !response
      || response.role !== 'official-pack-image'
      || !validHttps(response.sourceUrl)
      || !sameUrl(response.sourceUrl, response.responseUrl)
      || !reviewedOfficialIdentitySource(candidate, response.sourceUrl)
      || !validPastDate(response.retrievedAt, asOf)
      || Date.parse(response.retrievedAt) > Date.parse(extraction.reviewedAt)
      || !hashPattern.test(response.responseSha256)
      || !['image/avif', 'image/jpeg', 'image/png', 'image/webp'].includes(response.responseMimeType)
      || !Number.isSafeInteger(response.responseByteSize)
      || response.responseByteSize <= 0
    ) return false;
    sourceUrls.add(new URL(response.sourceUrl).href);
  }
  return sourceUrls.size === responses.length;
}

function sourceTextContainsExactGtin(sourceText: string, gtin: string) {
  const escaped = gtin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\D)${escaped}(?:\\D|$)`).test(sourceText);
}

function sourceTextContainsExactIdentifier(sourceText: string, identifier: string) {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i').test(sourceText);
}

function sourceNamesManufacturerSkuLabel(sourceText: string, label: CatalogueManufacturerSkuLabel) {
  const pattern = label === 'SKU'
    ? /(?:^|[^a-z0-9])sku(?:[^a-z0-9]|$)/i
    : label === 'Manufacturer SKU'
      ? /(?:^|[^a-z0-9])manufacturer\s+sku(?:[^a-z0-9]|$)/i
      : /(?:^|[^a-z0-9])product\s+code(?:[^a-z0-9]|$)/i;
  return pattern.test(sourceText);
}

function officialNullIdentifierFieldValid(
  status: CatalogueManufacturerSkuIdentityExtraction['fields']['gtinPublicationStatus'],
  manufacturerSku: CatalogueManufacturerSkuIdentityExtraction['fields']['manufacturerSku'],
) {
  const escapedSku = manufacturerSku.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return /(?:^|[^a-z0-9])barcode(?:[^a-z0-9]|$)/i.test(status.locator)
    && /["']?barcode["']?\s*:\s*null/i.test(status.sourceText)
    && new RegExp(`["']?sku["']?\\s*:\\s*["']${escapedSku}["']`, 'i').test(status.sourceText);
}

function extractionNamesExplicitManufacturerIdentifier(field: { value: string; locator: string; sourceText: string }) {
  const explicitLabel = /(?:^|[^a-z0-9])(?:barcode|gtin(?:-?1[234])?|ean(?:-?13)?s?|upc(?:-?[ae])?)(?:[^a-z0-9]|$)/i;
  if (explicitLabel.test(field.locator) || explicitLabel.test(field.sourceText)) return true;

  // Some reviewed manufacturer pages publish their EAN-shaped identifier as
  // the same SKU and MPN. Requiring both labels keeps a lone retailer SKU or
  // generic product ID from being promoted to canonical identity evidence.
  const escapedValue = field.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])sku[^\\n;]{0,40}${escapedValue}(?:\\D|$)`, 'i').test(field.sourceText)
    && new RegExp(`(?:^|[^a-z0-9])mpn[^\\n;]{0,40}${escapedValue}(?:\\D|$)`, 'i').test(field.sourceText);
}

function sourceTextContainsExactSize(sourceText: string, size: string) {
  const expected = measurementTokens(size);
  const observed = new Set(measurementTokens(sourceText));
  return expected.length > 0 && expected.every(token => observed.has(token));
}

function normalizedIdentity(candidate: CatalogueIntakeCandidate) {
  return [normalized(candidate.brand), normalized(candidate.name), normalizedSize(candidate.size)].join('|');
}

function sameUrl(left: string | undefined, right: string | undefined) {
  if (!validHttps(left) || !validHttps(right)) return false;
  return new URL(left ?? '').href === new URL(right ?? '').href;
}

function canonicalOneHandleProductPath(pathname: string) {
  return /^\/products\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname);
}

function exactOfficialManufacturerResponseUrl(
  extraction: CatalogueManufacturerSkuIdentityExtraction,
  officialProductUrl: string,
) {
  if (!sameUrl(extraction.sourceUrl, officialProductUrl)) return false;
  if (extraction.sourceResponseMimeType === 'text/html') {
    return sameUrl(extraction.responseUrl, extraction.sourceUrl);
  }
  if (!validHttps(extraction.responseUrl)) return false;
  const source = new URL(extraction.sourceUrl);
  const response = new URL(extraction.responseUrl);
  const productPath = source.pathname.replace(/\/+$/, '');
  const parameters = Array.from(response.searchParams.entries());
  const parameterNames = new Set(parameters.map(([name]) => name));
  const validShopifyLocalization = parameters.length === 0 || (
    parameters.length === 3
    && parameterNames.size === 3
    && parameterNames.has('country')
    && parameterNames.has('currency')
    && parameterNames.has('v')
    && /^[A-Z]{2}$/.test(response.searchParams.get('country') ?? '')
    && /^[A-Z]{3}$/.test(response.searchParams.get('currency') ?? '')
    && /^\d+$/.test(response.searchParams.get('v') ?? '')
  );
  return source.origin === response.origin
    && source.search === ''
    && source.hash === ''
    && canonicalOneHandleProductPath(productPath)
    && response.pathname === `${productPath}.js`
    && response.hash === ''
    && validShopifyLocalization;
}

function manufacturerIdentityCaptureValid(
  extraction: CatalogueManufacturerSkuIdentityExtraction,
) {
  if (
    extraction.sourceResponseMimeType === 'application/json'
    || extraction.sourceResponseMimeType === 'text/javascript'
  ) {
    return extraction.responseDigestScope === 'decoded-response-body'
      && extraction.method === 'reviewed-exact-official-manufacturer-sku-response'
      && !Object.prototype.hasOwnProperty.call(extraction, 'browserCapture');
  }
  return extraction.responseDigestScope === 'rendered-dom-outerhtml'
    && extraction.method === 'reviewed-browser-dom-official-manufacturer-sku-identity'
    && reviewedBrowserSurface(extraction.browserCapture.surface)
    && extraction.browserCapture.documentReadyState === 'complete'
    && extraction.browserCapture.pageTitle.trim().length >= 3;
}

function sameShopifyMediaRevision(left: string, right: string) {
  if (!validHttps(left) || !validHttps(right)) return false;
  const leftUrl = new URL(left);
  const rightUrl = new URL(right);
  const leftFile = leftUrl.pathname.split('/').at(-1);
  const rightFile = rightUrl.pathname.split('/').at(-1);
  const leftVersion = leftUrl.searchParams.get('v');
  const rightVersion = rightUrl.searchParams.get('v');
  return Boolean(
    leftFile
    && leftFile === rightFile
    && leftVersion
    && leftVersion === rightVersion,
  );
}

function reviewedManufacturerPackageVersionValid(
  candidate: CatalogueIntakeCandidate,
  field: CatalogueManufacturerSkuIdentityExtraction['fields']['packageVersion'],
) {
  if (normalized(field.sourceText).includes(normalized(field.value))) return true;
  const media = field.reviewedMedia;
  return Boolean(
    media
    && validHttps(media.sourceUrl)
    && validHttps(media.sourceAssetUrl)
    && sameUrl(field.sourceText, media.sourceUrl)
    && sameShopifyMediaRevision(media.sourceUrl, media.sourceAssetUrl)
    && hashPattern.test(media.sourceAssetSha256)
    && reviewedOfficialIdentitySource(candidate, media.sourceAssetUrl)
    && sameUrl(candidate.asset.sourceUrl, media.sourceAssetUrl)
    && candidate.asset.sourceAssetSha256 === media.sourceAssetSha256
  );
}

function sameBrandOfficialCareSource(candidate: CatalogueIntakeCandidate, evidenceUrl: string | undefined) {
  if (!validHttps(evidenceUrl)) return false;
  const evidenceHost = new URL(evidenceUrl ?? '').hostname.toLowerCase();
  const brandKey = normalized(candidate.brand).replace(/\s/g, '');
  return reviewedOfficialCareHosts[brandKey]?.includes(evidenceHost) ?? false;
}

export function catalogueBrandAuthorizationSourceValid(
  candidate: CatalogueIntakeCandidate,
  evidenceUrl: string | undefined,
) {
  return validHttps(evidenceUrl)
    && sameBrandOfficialCareSource(candidate, evidenceUrl)
    && reviewedOfficialIdentitySource(candidate, candidate.identity.officialProductUrl);
}

function candidateScopedManufacturerCareSource(candidate: CatalogueIntakeCandidate, evidenceUrl: string | undefined) {
  if (!sameBrandOfficialCareSource(candidate, evidenceUrl)) return false;
  if (sameUrl(evidenceUrl, candidate.identity.officialProductUrl)) return true;
  return reviewedCandidateManufacturerCareUrls[candidate.id]?.some(url => sameUrl(url, evidenceUrl)) ?? false;
}

function reviewedOfficialIdentitySource(candidate: CatalogueIntakeCandidate, evidenceUrl: string | undefined) {
  if (!validHttps(evidenceUrl)) return false;
  const evidenceHost = new URL(evidenceUrl ?? '').hostname.toLowerCase();
  const brandKey = normalized(candidate.brand).replace(/\s/g, '');
  return reviewedOfficialIdentityHosts[brandKey]?.includes(evidenceHost) ?? false;
}

function reviewedIdentifierCorroborationSource(
  candidate: CatalogueIntakeCandidate,
  evidenceUrl: string | undefined,
) {
  if (!validHttps(evidenceUrl)) return false;
  return reviewedCandidateIdentifierCorroborationUrls[candidate.id]
    ?.some(url => sameUrl(url, evidenceUrl)) ?? false;
}

function corroboratedIdentityEvidenceValid(
  candidate: CatalogueIntakeCandidate,
  evidence: CatalogueOfficialGtinIdentityEvidence,
  extraction: CatalogueCorroboratedIdentityExtraction,
  asOf: number,
) {
  const checkedAt = Date.parse(candidate.identity.checkedAt ?? '');
  const retrievedAt = Date.parse(evidence.retrievedAt);
  const extractionReviewedAt = Date.parse(extraction.reviewedAt);
  const packageVersion = candidate.identity.packageVersion;
  const identifierStatus = extraction.fields.manufacturerIdentifierStatus;
  const packageVersionField = extraction.fields.packageVersion;
  const compositeGtin = extraction.fields.gtin;
  const officialVariant = extraction.fields.variant;
  const officialSize = extraction.fields.size;
  const observedIdentityName = normalized(`${candidate.brand} ${candidate.name}`);
  const officialFieldIdentity = normalized(`${candidate.brand} ${officialVariant.value}`);

  if (
    evidence.snapshotKind !== 'canonical-extraction'
    || evidence.snapshotPath !== `data/catalogue-identity-evidence/${candidate.id}.json`
    || evidence.snapshotMimeType !== 'application/json'
    || !reviewedOfficialIdentitySource(candidate, evidence.url)
    || !sameUrl(evidence.url, candidate.identity.officialProductUrl)
    || !sameUrl(extraction.sourceUrl, evidence.url)
    || !sameUrl(extraction.responseUrl, extraction.sourceUrl)
    || extraction.candidateId !== candidate.id
    || extraction.responseDigestScope !== 'rendered-dom-outerhtml'
    || extraction.method !== 'reviewed-browser-dom-identity-with-independent-ean-corroboration'
    || extraction.sourceResponseMimeType !== 'text/html'
    || !hashPattern.test(extraction.sourceResponseSha256)
    || !Number.isSafeInteger(extraction.sourceResponseByteSize)
    || extraction.sourceResponseByteSize <= 0
    || !reviewedBrowserSurface(extraction.browserCapture.surface)
    || extraction.browserCapture.documentReadyState !== 'complete'
    || extraction.browserCapture.pageTitle.trim().length < 3
    || extraction.retrievedAt !== evidence.retrievedAt
    || !validPastDate(extraction.retrievedAt, asOf)
    || !validPastDate(extraction.reviewedAt, asOf)
    || !Number.isFinite(checkedAt)
    || !Number.isFinite(retrievedAt)
    || !Number.isFinite(extractionReviewedAt)
    || extractionReviewedAt < retrievedAt
    || extractionReviewedAt > checkedAt
    || !identityExtractionFieldValid(officialVariant)
    || !identityExtractionFieldValid(officialSize)
    || !identityExtractionFieldValid(compositeGtin)
    || !identityExtractionFieldValid(identifierStatus)
    || !identityExtractionFieldValid(packageVersionField)
    || !extractionNamesExplicitManufacturerIdentifier(compositeGtin)
    || !sameGtin(compositeGtin.value, evidence.observedGtin)
    || !sourceTextContainsExactGtin(compositeGtin.sourceText, compositeGtin.value)
    || officialFieldIdentity !== observedIdentityName
    || !normalized(officialVariant.sourceText).includes(normalized(officialVariant.value))
    || normalizedSize(officialSize.value) !== normalizedSize(candidate.size)
    || !sourceTextContainsExactSize(officialSize.sourceText, officialSize.value)
    || identifierStatus.value !== 'not-published'
    // Non-publication is proven either by quoting the official empty identifier fields, or by a
    // bound, re-runnable absence search over the same rendered document. Prose alone never passes.
    || !(
      (
        /["']?barcode["']?\s*:\s*null/i.test(identifierStatus.sourceText)
        && /["']?sku["']?\s*:\s*["']{2}/i.test(identifierStatus.sourceText)
      )
      || identifierAbsenceProofValid(identifierStatus.absenceProof, extraction)
    )
    || !packageVersion?.trim()
    || normalized(packageVersionField.value) !== normalized(packageVersion)
    || normalized(evidence.observedPackageVersion ?? '') !== normalized(packageVersion)
    || !validHttps(packageVersionField.evidenceUrl)
    || !sameGtin(evidence.observedGtin, catalogueGtinForIdentity(candidate.identity))
    || normalized(evidence.observedVariant) !== normalized(candidate.variant)
    || normalizedSize(evidence.observedSize) !== normalizedSize(candidate.size)
    || !hashPattern.test(evidence.snapshotSha256)
    || !Number.isSafeInteger(evidence.snapshotByteSize)
    || evidence.snapshotByteSize <= 0
    || evidence.snapshotSha256 !== catalogueIdentityExtractionSha256(extraction)
    || evidence.snapshotByteSize !== catalogueIdentityExtractionByteSize(extraction)
    || !supplementalIdentityResponsesValid(candidate, extraction, asOf)
    || !extraction.supplementalResponses.some(response => sameUrl(
      response.sourceUrl,
      packageVersionField.evidenceUrl,
    ))
    || typeof extraction.reviewer !== 'string'
    || extraction.reviewer.trim().length < 2
  ) return false;

  if (
    !Array.isArray(extraction.identifierCorroborations)
    || extraction.identifierCorroborations.length < 2
    || extraction.identifierCorroborations.length > 3
  ) return false;

  const sourceUrls = new Set<string>();
  const sourceHosts = new Set<string>();
  const corroboratedBrandNames = [candidate.brand, ...(candidate.brandAliases ?? [])].map(normalized);
  for (const corroboration of extraction.identifierCorroborations) {
    const corroborationRetrievedAt = Date.parse(corroboration.retrievedAt);
    const corroborationReviewedAt = Date.parse(corroboration.reviewedAt);
    const fields = corroboration.fields;
    if (
      !reviewedIdentifierCorroborationSource(candidate, corroboration.sourceUrl)
      || !sameUrl(corroboration.sourceUrl, corroboration.responseUrl)
      || corroboration.method !== 'reviewed-browser-dom-independent-ean-corroboration'
      || corroboration.responseDigestScope !== 'rendered-dom-outerhtml'
      || corroboration.sourceResponseMimeType !== 'text/html'
      || !hashPattern.test(corroboration.sourceResponseSha256)
      || !Number.isSafeInteger(corroboration.sourceResponseByteSize)
      || corroboration.sourceResponseByteSize <= 0
      || !reviewedBrowserSurface(corroboration.browserCapture.surface)
      || corroboration.browserCapture.documentReadyState !== 'complete'
      || corroboration.browserCapture.pageTitle.trim().length < 3
      || !validPastDate(corroboration.retrievedAt, asOf)
      || !validPastDate(corroboration.reviewedAt, asOf)
      || !Number.isFinite(corroborationRetrievedAt)
      || !Number.isFinite(corroborationReviewedAt)
      || corroborationReviewedAt < corroborationRetrievedAt
      || corroborationReviewedAt > checkedAt
      || !identityExtractionFieldValid(fields.gtin)
      || !identityExtractionFieldValid(fields.variant)
      || !identityExtractionFieldValid(fields.size)
      || !extractionNamesExplicitManufacturerIdentifier(fields.gtin)
      || !sameGtin(fields.gtin.value, evidence.observedGtin)
      || !sourceTextContainsExactGtin(fields.gtin.sourceText, fields.gtin.value)
      || !corroboratedBrandNames.some(brand => normalized(fields.variant.value).includes(brand))
      || !normalized(fields.variant.value).includes(normalized(candidate.name))
      || !normalized(fields.variant.sourceText).includes(normalized(fields.variant.value))
      || normalizedSize(fields.size.value) !== normalizedSize(candidate.size)
      || !sourceTextContainsExactSize(fields.size.sourceText, fields.size.value)
      || typeof corroboration.reviewer !== 'string'
      || corroboration.reviewer.trim().length < 2
    ) return false;

    const url = new URL(corroboration.sourceUrl);
    sourceUrls.add(url.href);
    sourceHosts.add(url.hostname.replace(/^www\./, '').toLowerCase());
  }
  return sourceUrls.size === extraction.identifierCorroborations.length
    && sourceHosts.size === extraction.identifierCorroborations.length;
}

function accessibleCorroboratedIdentityEvidenceValid(
  candidate: CatalogueIntakeCandidate,
  evidence: CatalogueOfficialGtinIdentityEvidence,
  extraction: CatalogueAccessibleCorroboratedIdentityExtraction,
  asOf: number,
) {
  const checkedAt = Date.parse(candidate.identity.checkedAt ?? '');
  const retrievedAt = Date.parse(evidence.retrievedAt);
  const extractionReviewedAt = Date.parse(extraction.reviewedAt);
  const packageVersion = candidate.identity.packageVersion;
  const packageVersionField = extraction.fields.packageVersion;
  const compositeGtin = extraction.fields.gtin;
  const officialVariant = extraction.fields.variant;
  const officialSize = extraction.fields.size;
  const observedIdentityName = normalized(`${candidate.brand} ${candidate.name}`);
  const officialFieldIdentity = normalized(`${candidate.brand} ${officialVariant.value}`);

  if (
    evidence.snapshotKind !== 'canonical-extraction'
    || evidence.snapshotPath !== `data/catalogue-identity-evidence/${candidate.id}.json`
    || evidence.snapshotMimeType !== 'application/json'
    || !reviewedOfficialIdentitySource(candidate, evidence.url)
    || !sameUrl(evidence.url, candidate.identity.officialProductUrl)
    || !sameUrl(extraction.sourceUrl, evidence.url)
    || !sameUrl(extraction.responseUrl, extraction.sourceUrl)
    || extraction.candidateId !== candidate.id
    || extraction.responseDigestScope !== 'rendered-accessibility-tree'
    || extraction.method !== 'reviewed-browser-accessibility-identity-with-independent-ean-corroboration'
    || extraction.sourceResponseMimeType !== 'text/html'
    || !hashPattern.test(extraction.sourceResponseSha256)
    || !Number.isSafeInteger(extraction.sourceResponseByteSize)
    || extraction.sourceResponseByteSize <= 0
    || !reviewedBrowserSurface(extraction.browserCapture.surface)
    || extraction.browserCapture.documentReadyState !== 'complete'
    || extraction.browserCapture.pageTitle.trim().length < 3
    || extraction.retrievedAt !== evidence.retrievedAt
    || !validPastDate(extraction.retrievedAt, asOf)
    || !validPastDate(extraction.reviewedAt, asOf)
    || !Number.isFinite(checkedAt)
    || !Number.isFinite(retrievedAt)
    || !Number.isFinite(extractionReviewedAt)
    || extractionReviewedAt < retrievedAt
    || extractionReviewedAt > checkedAt
    || !identityExtractionFieldValid(officialVariant)
    || !identityExtractionFieldValid(officialSize)
    || !identityExtractionFieldValid(compositeGtin)
    || !identityExtractionFieldValid(packageVersionField)
    || !extractionNamesExplicitManufacturerIdentifier(compositeGtin)
    || !sameGtin(compositeGtin.value, evidence.observedGtin)
    || !sourceTextContainsExactGtin(compositeGtin.sourceText, compositeGtin.value)
    || officialFieldIdentity !== observedIdentityName
    || !normalized(officialVariant.sourceText).includes(normalized(officialVariant.value))
    || normalizedSize(officialSize.value) !== normalizedSize(candidate.size)
    || !sourceTextContainsExactSize(officialSize.sourceText, officialSize.value)
    || !packageVersion?.trim()
    || normalized(packageVersionField.value) !== normalized(packageVersion)
    || normalized(evidence.observedPackageVersion ?? '') !== normalized(packageVersion)
    || !validHttps(packageVersionField.evidenceUrl)
    || !sameGtin(evidence.observedGtin, catalogueGtinForIdentity(candidate.identity))
    || normalized(evidence.observedVariant) !== normalized(candidate.variant)
    || normalizedSize(evidence.observedSize) !== normalizedSize(candidate.size)
    || !hashPattern.test(evidence.snapshotSha256)
    || !Number.isSafeInteger(evidence.snapshotByteSize)
    || evidence.snapshotByteSize <= 0
    || evidence.snapshotSha256 !== catalogueIdentityExtractionSha256(extraction)
    || evidence.snapshotByteSize !== catalogueIdentityExtractionByteSize(extraction)
    || !supplementalIdentityResponsesValid(candidate, extraction, asOf)
    || !extraction.supplementalResponses.some(response => sameUrl(
      response.sourceUrl,
      packageVersionField.evidenceUrl,
    ))
    || typeof extraction.reviewer !== 'string'
    || extraction.reviewer.trim().length < 2
  ) return false;

  if (
    !Array.isArray(extraction.identifierCorroborations)
    || extraction.identifierCorroborations.length < 2
    || extraction.identifierCorroborations.length > 3
  ) return false;

  const sourceUrls = new Set<string>();
  const sourceHosts = new Set<string>();
  const corroboratedBrandNames = [candidate.brand, ...(candidate.brandAliases ?? [])].map(normalized);
  const candidateNameTokens = normalized(candidate.name).split(' ').filter(token => token.length > 2);
  for (const corroboration of extraction.identifierCorroborations) {
    const corroborationRetrievedAt = Date.parse(corroboration.retrievedAt);
    const corroborationReviewedAt = Date.parse(corroboration.reviewedAt);
    const fields = corroboration.fields;
    const corroborationVariant = normalized(fields.variant.value);
    const corroborationVariantTokens = new Set(corroborationVariant.split(' '));
    if (
      !reviewedIdentifierCorroborationSource(candidate, corroboration.sourceUrl)
      || !sameUrl(corroboration.sourceUrl, corroboration.responseUrl)
      || corroboration.method !== 'reviewed-browser-accessibility-independent-ean-corroboration'
      || corroboration.responseDigestScope !== 'rendered-accessibility-tree'
      || corroboration.sourceResponseMimeType !== 'text/html'
      || !hashPattern.test(corroboration.sourceResponseSha256)
      || !Number.isSafeInteger(corroboration.sourceResponseByteSize)
      || corroboration.sourceResponseByteSize <= 0
      || !reviewedBrowserSurface(corroboration.browserCapture.surface)
      || corroboration.browserCapture.documentReadyState !== 'complete'
      || corroboration.browserCapture.pageTitle.trim().length < 3
      || !validPastDate(corroboration.retrievedAt, asOf)
      || !validPastDate(corroboration.reviewedAt, asOf)
      || !Number.isFinite(corroborationRetrievedAt)
      || !Number.isFinite(corroborationReviewedAt)
      || corroborationReviewedAt < corroborationRetrievedAt
      || corroborationReviewedAt > checkedAt
      || !identityExtractionFieldValid(fields.gtin)
      || !identityExtractionFieldValid(fields.variant)
      || !identityExtractionFieldValid(fields.size)
      || !extractionNamesExplicitManufacturerIdentifier(fields.gtin)
      || !sameGtin(fields.gtin.value, evidence.observedGtin)
      || !sourceTextContainsExactGtin(fields.gtin.sourceText, fields.gtin.value)
      || !corroboratedBrandNames.some(brand => corroborationVariant.includes(brand))
      || !candidateNameTokens.every(token => corroborationVariantTokens.has(token))
      || !normalized(fields.variant.sourceText).includes(corroborationVariant)
      || normalizedSize(fields.size.value) !== normalizedSize(candidate.size)
      || !sourceTextContainsExactSize(fields.size.sourceText, fields.size.value)
      || typeof corroboration.reviewer !== 'string'
      || corroboration.reviewer.trim().length < 2
    ) return false;

    const url = new URL(corroboration.sourceUrl);
    sourceUrls.add(url.href);
    sourceHosts.add(url.hostname.replace(/^www\./, '').toLowerCase());
  }
  return sourceUrls.size === extraction.identifierCorroborations.length
    && sourceHosts.size === extraction.identifierCorroborations.length;
}

function manufacturerSkuIdentityEvidenceValid(
  candidate: CatalogueIntakeCandidate,
  evidence: CatalogueOfficialManufacturerSkuIdentityEvidence,
  extraction: CatalogueManufacturerSkuIdentityExtraction,
  asOf: number,
) {
  const canonicalIdentifier = catalogueCanonicalIdentifierFor(candidate.identity);
  const officialProductCrosswalk = 'officialProductCrosswalk' in candidate.identity
    ? candidate.identity.officialProductCrosswalk
    : undefined;
  const checkedAt = Date.parse(candidate.identity.checkedAt ?? '');
  const retrievedAt = Date.parse(evidence.retrievedAt);
  const reviewedAt = Date.parse(extraction.reviewedAt);
  const manufacturerSku = extraction.fields.manufacturerSku;
  const manufacturerBrand = extraction.fields.manufacturerBrand;
  const manufacturerBrandAliases = extraction.fields.manufacturerBrandAliases ?? [];
  const variant = extraction.fields.variant;
  const size = extraction.fields.size;
  const packageVersion = extraction.fields.packageVersion;
  const gtinStatus = extraction.fields.gtinPublicationStatus;

  return Boolean(
    canonicalIdentifier?.kind === 'manufacturer-sku'
    && evidence.identityKind === 'manufacturer-sku'
    && !Object.prototype.hasOwnProperty.call(evidence, 'observedGtin')
    && catalogueOfficialProductCrosswalkValid(officialProductCrosswalk)
    && catalogueOfficialProductCrosswalkKeyGrounded(
      officialProductCrosswalk!,
      extraction as CatalogueManufacturerSkuIdentityExtraction & {
        fields: Record<string, unknown>;
      },
    )
    && officialProductCrosswalk?.canonicalManufacturerProductKey.basis === 'manufacturer-sku'
    && normalizedManufacturerSku(
      officialProductCrosswalk?.canonicalManufacturerProductKey.value ?? '',
    ) === canonicalIdentifier.value
    && officialProductCrosswalk?.schemaVersion
      === catalogueOfficialProductCrosswalkSchemaVersion
    && officialProductCrosswalk?.officialSourceResponseSha256
      === extraction.sourceResponseSha256
    && sameUrl(
      officialProductCrosswalk?.officialProductUrl,
      evidence.url,
    )
    && normalized(officialProductCrosswalk?.variant ?? '') === normalized(evidence.observedVariant)
    && normalizedSize(officialProductCrosswalk?.size ?? '') === normalizedSize(evidence.observedSize)
    && normalized(officialProductCrosswalk?.packageVersion ?? '')
      === normalized(evidence.observedPackageVersion ?? '')
    && evidence.snapshotKind === 'canonical-extraction'
    && evidence.snapshotPath === `data/catalogue-identity-evidence/${candidate.id}.json`
    && evidence.snapshotMimeType === 'application/json'
    && reviewedOfficialIdentitySource(candidate, evidence.url)
    && sameUrl(evidence.url, candidate.identity.officialProductUrl)
    && sameUrl(extraction.sourceUrl, evidence.url)
    && exactOfficialManufacturerResponseUrl(extraction, evidence.url)
    && extraction.candidateId === candidate.id
    && extraction.schemaVersion === catalogueManufacturerSkuIdentityExtractionSchemaVersion
    && manufacturerIdentityCaptureValid(extraction)
    && extraction.sourceSnapshotPath
      === (
        `data/catalogue-identity-source-evidence/${candidate.id}.`
        + (extraction.sourceResponseMimeType === 'text/html' ? 'html' : 'json')
      )
    && catalogueRetainedRecordShapeValid(extraction.productRecord)
    && hashPattern.test(extraction.sourceResponseSha256)
    && Number.isSafeInteger(extraction.sourceResponseByteSize)
    && extraction.sourceResponseByteSize > 0
    && extraction.retrievedAt === evidence.retrievedAt
    && validPastDate(extraction.retrievedAt, asOf)
    && validPastDate(extraction.reviewedAt, asOf)
    && Number.isFinite(checkedAt)
    && Number.isFinite(retrievedAt)
    && Number.isFinite(reviewedAt)
    && reviewedAt >= retrievedAt
    && reviewedAt <= checkedAt
    && identityExtractionFieldValid(manufacturerBrand)
    && normalized(manufacturerBrand.value) === normalized(candidate.brand)
    && sourceTextNamesCatalogueBrandField(
      manufacturerBrand.sourceText,
      manufacturerBrand.value,
    )
    && Array.isArray(manufacturerBrandAliases)
    && manufacturerBrandAliases.every(alias => (
      identityExtractionFieldValid(alias)
      && normalized(alias.value) !== normalized(candidate.brand)
      && sourceTextNamesCatalogueBrandField(alias.sourceText, alias.value)
    ))
    && new Set(manufacturerBrandAliases.map(alias => normalized(alias.value))).size
      === manufacturerBrandAliases.length
    && identityExtractionFieldValid(manufacturerSku)
    && validManufacturerSku(manufacturerSku.value)
    && validManufacturerSkuLabel(manufacturerSku.label)
    && manufacturerSku.label === canonicalIdentifier.label
    && normalizedManufacturerSku(manufacturerSku.value) === canonicalIdentifier.value
    && sourceNamesManufacturerSkuLabel(manufacturerSku.sourceText, manufacturerSku.label)
    && sourceTextContainsExactIdentifier(manufacturerSku.sourceText, manufacturerSku.value)
    && identityExtractionFieldValid(variant)
    && normalized(variant.value) === normalized(candidate.variant)
    && normalized(variant.sourceText).includes(normalized(variant.value))
    && identityExtractionFieldValid(size)
    && normalizedSize(size.value) === normalizedSize(candidate.size)
    && sourceTextContainsExactSize(size.sourceText, size.value)
    && identityExtractionFieldValid(packageVersion)
    && candidate.identity.packageVersion?.trim()
    && normalized(packageVersion.value) === normalized(candidate.identity.packageVersion)
    && reviewedManufacturerPackageVersionValid(candidate, packageVersion)
    && identityExtractionFieldValid(gtinStatus)
    && gtinStatus.value === 'not-published'
    && (
      identifierAbsenceProofValid(gtinStatus.absenceProof, extraction)
      || officialNullIdentifierFieldValid(gtinStatus, manufacturerSku)
    )
    && (
      !gtinStatus.absenceProof
      || gtinStatus.absenceProof.matchStrategy === 'structured-key-variants'
    )
    && typeof evidence.observedManufacturerSku === 'string'
    && normalizedManufacturerSku(evidence.observedManufacturerSku) === canonicalIdentifier.value
    && evidence.observedManufacturerSkuLabel === canonicalIdentifier.label
    && normalized(evidence.observedVariant) === normalized(candidate.variant)
    && normalizedSize(evidence.observedSize) === normalizedSize(candidate.size)
    && normalized(evidence.observedPackageVersion ?? '') === normalized(candidate.identity.packageVersion)
    && hashPattern.test(evidence.snapshotSha256)
    && Number.isSafeInteger(evidence.snapshotByteSize)
    && evidence.snapshotByteSize > 0
    && evidence.snapshotSha256 === catalogueIdentityExtractionSha256(extraction)
    && evidence.snapshotByteSize === catalogueIdentityExtractionByteSize(extraction)
    && typeof extraction.reviewer === 'string'
    && extraction.reviewer.trim().length >= 2
  );
}

function officialIdentityEvidenceValid(candidate: CatalogueIntakeCandidate, asOf: number) {
  const evidence = candidate.identity.officialEvidence;
  if (!evidence) return false;
  if (evidence.identityKind === 'manufacturer-sku') {
    if (
      Object.prototype.hasOwnProperty.call(evidence, 'observedGtin')
      || typeof evidence.observedManufacturerSku !== 'string'
      || !validManufacturerSkuLabel(evidence.observedManufacturerSkuLabel)
      || evidence.canonicalExtraction.schemaVersion
        !== catalogueManufacturerSkuIdentityExtractionSchemaVersion
    ) return false;
    return manufacturerSkuIdentityEvidenceValid(
      candidate,
      evidence as CatalogueOfficialManufacturerSkuIdentityEvidence,
      evidence.canonicalExtraction,
      asOf,
    );
  }
  if (
    Object.prototype.hasOwnProperty.call(evidence, 'identityKind')
    || Object.prototype.hasOwnProperty.call(evidence, 'observedManufacturerSku')
    || Object.prototype.hasOwnProperty.call(evidence, 'observedManufacturerSkuLabel')
    || !Object.prototype.hasOwnProperty.call(evidence, 'observedGtin')
    || typeof evidence.observedGtin !== 'string'
  ) return false;
  const gtinEvidence = evidence as CatalogueOfficialGtinIdentityEvidence;
  const extraction = evidence.canonicalExtraction;
  const officialProductCrosswalk = candidate.identity.officialProductCrosswalk;
  if (
    officialProductCrosswalk
    && (
      !catalogueOfficialProductCrosswalkValid(officialProductCrosswalk)
      || !catalogueOfficialProductCrosswalkKeyGrounded(
        officialProductCrosswalk,
        extraction as typeof extraction & { fields: Record<string, unknown> },
      )
      || officialProductCrosswalk.officialSourceResponseSha256
        !== evidence.canonicalExtraction.sourceResponseSha256
      || !sameUrl(officialProductCrosswalk.officialProductUrl, evidence.url)
      || normalized(officialProductCrosswalk.variant) !== normalized(evidence.observedVariant)
      || normalizedSize(officialProductCrosswalk.size) !== normalizedSize(evidence.observedSize)
      || normalized(officialProductCrosswalk.packageVersion)
        !== normalized(evidence.observedPackageVersion ?? '')
    )
  ) return false;
  if (
    extraction.schemaVersion === catalogueCorroboratedIdentityExtractionSchemaVersion
  ) return corroboratedIdentityEvidenceValid(candidate, gtinEvidence, extraction, asOf);
  if (
    extraction.schemaVersion === catalogueAccessibleCorroboratedIdentityExtractionSchemaVersion
  ) return accessibleCorroboratedIdentityEvidenceValid(candidate, gtinEvidence, extraction, asOf);

  const checkedAt = Date.parse(candidate.identity.checkedAt ?? '');
  const retrievedAt = Date.parse(evidence?.retrievedAt ?? '');
  const extractionRepresentationValid = extraction && (
    (
      extraction.schemaVersion === catalogueIdentityExtractionSchemaVersion
      && extraction.method === 'reviewed-exact-identity-field-extraction'
      && extraction.responseDigestScope === 'decoded-response-body'
      && !('browserCapture' in extraction)
    )
    || (
      extraction.schemaVersion === catalogueBrowserIdentityExtractionSchemaVersion
      && extraction.method === 'reviewed-browser-dom-identity-field-extraction'
      && extraction.responseDigestScope === 'rendered-dom-outerhtml'
      && extraction.sourceResponseMimeType === 'text/html'
      && reviewedBrowserSurface(extraction.browserCapture.surface)
      && extraction.browserCapture.documentReadyState === 'complete'
      && extraction.browserCapture.pageTitle.trim().length >= 3
    )
  );
  return Boolean(
    evidence
    && typeof evidence.url === 'string'
    && typeof evidence.observedGtin === 'string'
    && typeof evidence.observedVariant === 'string'
    && typeof evidence.observedSize === 'string'
    && typeof evidence.snapshotSha256 === 'string'
    && typeof evidence.snapshotMimeType === 'string'
    && typeof evidence.snapshotByteSize === 'number'
    && typeof evidence.retrievedAt === 'string'
    && reviewedOfficialIdentitySource(candidate, evidence.url)
    && evidence.snapshotKind === 'canonical-extraction'
    && evidence.snapshotPath === `data/catalogue-identity-evidence/${candidate.id}.json`
    && evidence.snapshotMimeType === 'application/json'
    && extraction
    && extractionRepresentationValid
    && typeof extraction.candidateId === 'string'
    && extraction.candidateId === candidate.id
    && extraction.fields
    && identityExtractionFieldValid(extraction.fields.gtin)
    && identityExtractionFieldValid(extraction.fields.variant)
    && identityExtractionFieldValid(extraction.fields.size)
    && extractionNamesExplicitManufacturerIdentifier(extraction.fields.gtin)
    && typeof extraction.sourceUrl === 'string'
    && typeof extraction.responseUrl === 'string'
    && typeof extraction.retrievedAt === 'string'
    && sameUrl(extraction.sourceUrl, evidence.url)
    && sameUrl(extraction.responseUrl, extraction.sourceUrl)
    && extraction.retrievedAt === evidence.retrievedAt
    && sameGtin(extraction.fields.gtin.value, evidence.observedGtin)
    && normalized(extraction.fields.variant.value) === normalized(evidence.observedVariant)
    && normalizedSize(extraction.fields.size.value) === normalizedSize(evidence.observedSize)
    && sourceTextContainsExactGtin(extraction.fields.gtin.sourceText, extraction.fields.gtin.value)
    && normalized(extraction.fields.variant.sourceText).includes(normalized(extraction.fields.variant.value))
    && sourceTextContainsExactSize(extraction.fields.size.sourceText, extraction.fields.size.value)
    && typeof extraction.sourceResponseSha256 === 'string'
    && hashPattern.test(extraction.sourceResponseSha256)
    && rawIdentityEvidenceMimeTypes.includes(extraction.sourceResponseMimeType)
    && Number.isSafeInteger(extraction.sourceResponseByteSize)
    && extraction.sourceResponseByteSize > 0
    && supplementalIdentityResponsesValid(candidate, extraction, asOf)
    && typeof extraction.reviewer === 'string'
    && extraction.reviewer.trim().length >= 2
    && typeof extraction.reviewedAt === 'string'
    && validPastDate(extraction.reviewedAt, asOf)
    && Date.parse(extraction.reviewedAt) >= Date.parse(extraction.retrievedAt)
    && Date.parse(extraction.reviewedAt) <= checkedAt
    && sameUrl(evidence.url, candidate.identity.officialProductUrl)
    && sameGtin(evidence.observedGtin, catalogueGtinForIdentity(candidate.identity))
    && normalized(evidence.observedVariant) === normalized(candidate.variant)
    && normalizedSize(evidence.observedSize) === normalizedSize(candidate.size)
    && hashPattern.test(evidence.snapshotSha256)
    && Number.isSafeInteger(evidence.snapshotByteSize)
    && evidence.snapshotByteSize > 0
    && evidence.snapshotSha256 === catalogueIdentityExtractionSha256(extraction)
    && evidence.snapshotByteSize === catalogueIdentityExtractionByteSize(extraction)
    && validPastDate(evidence.retrievedAt, asOf)
    && Number.isFinite(checkedAt)
    && retrievedAt <= checkedAt
  );
}

function generationRecordContent(record: CatalogueGenerationRecord): CatalogueGenerationRecordContent {
  return {
    schemaVersion: record.schemaVersion,
    provider: record.provider,
    model: record.model,
    prompt: record.prompt,
    inputs: record.inputs.map(input => ({ ...input })),
    outputSha256: record.outputSha256,
    generatedAt: record.generatedAt,
  };
}

function generationRecordValid(candidate: CatalogueIntakeCandidate, asOf: number) {
  const record = candidate.asset.generationRecord;
  if (
    !record
    || record.schemaVersion !== catalogueGenerationRecordSchemaVersion
    || typeof record.provider !== 'string'
    || !record.provider.trim()
    || typeof record.model !== 'string'
    || !record.model.trim()
    || typeof record.prompt !== 'string'
    || !record.prompt.trim()
    || !Array.isArray(record.inputs)
    || !record.inputs.length
    || typeof record.outputSha256 !== 'string'
    || !hashPattern.test(record.outputSha256)
    || typeof record.recordSha256 !== 'string'
    || !hashPattern.test(record.recordSha256)
    || typeof record.generatedAt !== 'string'
    || !validPastDate(record.generatedAt, asOf)
  ) return false;

  const inputKeys = new Set<string>();
  for (const input of record.inputs) {
    if (
      !input
      || typeof input.url !== 'string'
      || !validHttps(input.url)
      || typeof input.sha256 !== 'string'
      || !hashPattern.test(input.sha256)
    ) return false;
    inputKeys.add(`${input.url}\n${input.sha256}`);
  }
  if (inputKeys.size !== record.inputs.length) return false;
  if (
    !candidate.asset.sourceUrl
    || !candidate.asset.sourceAssetSha256
    || !record.inputs.some(input => (
      input.url === candidate.asset.sourceUrl
      && input.sha256 === candidate.asset.sourceAssetSha256
    ))
    || record.inputs.some(input => input.sha256 === record.outputSha256)
    || record.outputSha256 !== candidate.asset.publicImageSha256
  ) return false;

  const sourceRetrievedAt = Date.parse(candidate.asset.sourceAssetRetrievedAt ?? '');
  const generatedAt = Date.parse(record.generatedAt);
  if (!Number.isFinite(sourceRetrievedAt) || generatedAt < sourceRetrievedAt) return false;

  return catalogueGenerationRecordSha256(generationRecordContent(record)) === record.recordSha256;
}

function canonicalRetailerOffer(offer: CatalogueIntakeOffer) {
  const retailer = nigeriaRetailers.find(item => normalized(item.name) === normalized(offer.retailer));
  if (!retailer) return undefined;

  const listing = new URL(offer.listingUrl);
  const homepage = new URL(retailer.homepage);
  const host = (value: URL) => value.hostname.replace(/^www\./, '').toLowerCase();
  if (host(listing) !== host(homepage)) return undefined;

  return {
    ...offer,
    retailer: retailer.name,
    retailerStatus: retailer.reviewStatus,
  } satisfies CatalogueIntakeOffer;
}

function reviewedOfferTitleAlias(candidate: CatalogueIntakeCandidate, offer: CatalogueIntakeOffer) {
  const alias = offer.reviewedTitleAlias?.trim();
  if (!alias) return undefined;

  const tokens = (value: string) => normalized(value)
    .split(' ')
    .filter(token => token.length >= 3);
  const candidateTokens = new Set(tokens(`${candidate.name} ${candidate.variant}`));
  const aliasTokens = Array.from(new Set(tokens(alias)));
  const observedTokens = new Set(tokens(offer.observedTitle));

  return aliasTokens.length >= 3
    && aliasTokens.every(token => candidateTokens.has(token))
    && aliasTokens.every(token => observedTokens.has(token))
    ? alias
    : undefined;
}

const marketObservationExclusionReasons: readonly CatalogueMarketObservationExclusionReason[] = [
  'retailer-identifier-only',
  'retailer-identifier-conflicts-with-candidate',
  'manufacturer-identifier-mismatch',
  'package-barcode-missing',
  'package-variant-conflict',
  'retailer-provisional',
  'listing-no-longer-current',
  'marketplace-seller-unverified',
];

function marketObservationValid(
  candidate: CatalogueIntakeCandidate,
  observation: CatalogueMarketObservation,
  asOf: number,
) {
  const evidence = observation.evidence;
  const observedAt = Date.parse(observation.observedAt);
  const retrievedAt = Date.parse(evidence?.retrievedAt ?? '');
  const reviewedAt = Date.parse(evidence?.reviewedAt ?? '');
  const reasons = new Set(observation.exclusionReasons);
  const retailer = nigeriaRetailers.find(item => normalized(item.name) === normalized(observation.retailer));
  let listing: URL;
  let homepage: URL;
  try {
    listing = new URL(observation.listingUrl);
    homepage = new URL(retailer?.homepage ?? '');
  } catch {
    return false;
  }
  const host = (value: URL) => value.hostname.replace(/^www\./, '').toLowerCase();
  if (
    !retailer
    || retailer.reviewStatus !== observation.retailerStatus
    || listing.protocol !== 'https:'
    || host(listing) !== host(homepage)
    || observation.disposition !== 'excluded-from-exact-comparison'
    || !observation.exclusionReasons.length
    || reasons.size !== observation.exclusionReasons.length
    || observation.exclusionReasons.some(reason => !marketObservationExclusionReasons.includes(reason))
    || !Number.isFinite(observedAt)
    || !Number.isFinite(retrievedAt)
    || !Number.isFinite(reviewedAt)
    || observedAt !== retrievedAt
    || reviewedAt < retrievedAt
    || reviewedAt > asOf + 5 * 60_000
    || !Number.isFinite(observation.priceNgn)
    || observation.priceNgn <= 0
    || !['in-stock', 'low-stock', 'out-of-stock'].includes(observation.stock)
    || evidence.schemaVersion !== catalogueMarketObservationSchemaVersion
    || evidence.method !== 'reviewed-retailer-observation'
    || !sameUrl(observation.listingUrl, evidence.responseUrl)
    || evidence.responseDigestScope !== 'decoded-response-body'
    || evidence.responseMimeType !== 'text/html'
    || !hashPattern.test(evidence.responseSha256)
    || !Number.isInteger(evidence.responseByteSize)
    || evidence.responseByteSize <= 0
    || !evidence.reviewer.trim()
    || normalized(evidence.fields.title.value) !== normalized(observation.observedTitle)
    || normalizedSize(evidence.fields.size.value) !== normalizedSize(observation.observedSize)
    || evidence.fields.price.value !== observation.priceNgn
    || evidence.fields.price.currency !== 'NGN'
    || evidence.fields.stock.value !== observation.stock
    || [
      evidence.fields.title,
      evidence.fields.size,
      evidence.fields.price,
      evidence.fields.stock,
    ].some(field => !field.locator.trim() || !field.sourceText.trim())
  ) return false;

  const identifier = evidence.fields.retailerIdentifier;
  if (identifier && (!identifier.value.trim() || !identifier.locator.trim() || !identifier.sourceText.trim())) return false;
  if (reasons.has('retailer-identifier-only') && identifier?.label !== 'SKU') return false;
  if (
    reasons.has('retailer-identifier-conflicts-with-candidate')
    && (
      identifier?.label !== 'SKU'
      || sameGtin(identifier.value, catalogueGtinForIdentity(candidate.identity))
    )
  ) return false;
  if (
    reasons.has('manufacturer-identifier-mismatch')
    && (
      !identifier
      || !['EAN', 'GTIN', 'UPC'].includes(identifier.label)
      || !isValidGtin(identifier.value)
      || sameGtin(identifier.value, catalogueGtinForIdentity(candidate.identity))
    )
  ) return false;
  if (reasons.has('package-variant-conflict') && !evidence.fields.packageVariantConflict?.sourceText.trim()) return false;
  if (reasons.has('retailer-provisional') && observation.retailerStatus !== 'provisional') return false;
  return true;
}

function retainedOfficialManufacturerBrandAliases(candidate: CatalogueIntakeCandidate) {
  const extraction = candidate.identity.officialEvidence?.canonicalExtraction;
  if (
    !extraction
    || extraction.schemaVersion !== catalogueManufacturerSkuIdentityExtractionSchemaVersion
  ) return [] as string[];
  return (extraction.fields.manufacturerBrandAliases ?? []).map(alias => alias.value);
}

function matchingOffer(candidate: CatalogueIntakeCandidate, offer: CatalogueIntakeOffer, asOf: number) {
  const observedAt = Date.parse(offer.observedAt);
  const identityCheckedAt = Date.parse(candidate.identity.checkedAt ?? '');
  const offerReviewedAt = Date.parse(offer.evidence?.reviewedAt ?? '');
  const exactVariantAndSize = offer.observedGtinBasis === 'exact-variant-and-size';
  const canonicalIdentifier = catalogueCanonicalIdentifierFor(candidate.identity);
  if (
    !canonicalIdentifier
    || !offer.retailer.trim()
    || !validHttps(offer.listingUrl)
    || (
      canonicalIdentifier?.kind === 'manufacturer-sku'
        ? (!exactVariantAndSize || offer.observedGtin != null)
        : (
          exactVariantAndSize
            ? offer.observedGtin != null
            : !sameGtin(offer.observedGtin, catalogueGtinForIdentity(candidate.identity))
        )
    )
    || !['explicit-gtin', 'explicit-ean', 'explicit-upc', 'exact-variant-and-size'].includes(
      offer.observedGtinBasis ?? '',
    )
    || (
      candidate.identity.packageVersion != null
      && normalized(offer.observedPackageVersion ?? '') !== normalized(candidate.identity.packageVersion)
    )
    || !Number.isFinite(observedAt)
    || observedAt < asOf - 7 * 86_400_000
    || observedAt > asOf + 5 * 60_000
    || !Number.isFinite(offer.priceNgn)
    || offer.priceNgn <= 0
    || !reviewedExactOfferEvidenceValid(
      offer,
      canonicalIdentifier.kind === 'manufacturer-sku'
        ? {
          ...canonicalIdentifier,
          officialProductUrl: candidate.identity.officialProductUrl ?? '',
          officialIdentitySnapshotPath: candidate.identity.officialEvidence?.snapshotPath ?? '',
          officialIdentitySnapshotSha256: candidate.identity.officialEvidence?.snapshotSha256 ?? '',
          brand: candidate.brand,
          officialBrandAliases: retainedOfficialManufacturerBrandAliases(candidate),
          variant: candidate.variant,
        }
        : canonicalIdentifier,
      asOf,
    )
    || !Number.isFinite(identityCheckedAt)
    || !Number.isFinite(offerReviewedAt)
    || offerReviewedAt < identityCheckedAt
  ) return undefined;

  const canonicalOffer = canonicalRetailerOffer(offer);
  if (!canonicalOffer) return undefined;
  const reviewedTitleAlias = reviewedOfferTitleAlias(candidate, canonicalOffer);
  if (canonicalOffer.reviewedTitleAlias && !reviewedTitleAlias) return undefined;

  try {
    assertRetailerResponseScope({
      requestedUrl: canonicalOffer.listingUrl,
      responseUrl: canonicalOffer.listingUrl,
      expectedTitle: candidate.variant,
      expectedTitleAliases: [
        ...(normalized(candidate.name) === normalized(candidate.variant) ? [] : [candidate.name]),
        ...(reviewedTitleAlias ? [reviewedTitleAlias] : []),
      ],
      expectedSize: candidate.size,
      observedTitle: canonicalOffer.observedTitle,
      observedSize: canonicalOffer.observedSize,
      marketCode: 'NG',
      currencyCode: 'NGN',
    });
    return canonicalOffer;
  } catch {
    return undefined;
  }
}

function identityBlockers(candidate: CatalogueIntakeCandidate, asOf: number): CatalogueIntakeBlocker[] {
  const blockers: CatalogueIntakeBlocker[] = [];
  const canonicalIdentifier = catalogueCanonicalIdentifierFor(candidate.identity);
  if (!canonicalIdentifier) {
    blockers.push(
      candidate.identity.canonicalIdentifier?.kind === 'manufacturer-sku'
        ? 'identity-manufacturer-sku-missing-or-invalid'
        : 'identity-gtin-missing-or-invalid',
    );
  }
  if (candidate.identity.basis !== 'official-brand' || !validHttps(candidate.identity.officialProductUrl)) blockers.push('identity-official-source-missing');
  if (!validPastDate(candidate.identity.checkedAt, asOf)) blockers.push('identity-check-missing-or-future');
  if (!officialIdentityEvidenceValid(candidate, asOf)) blockers.push('identity-official-evidence-invalid');
  if (!measurableSize.test(candidate.size)) blockers.push('identity-size-not-measurable');
  return blockers;
}

function careBlockers(candidate: CatalogueIntakeCandidate, asOf: number): CatalogueIntakeBlocker[] {
  const blockers: CatalogueIntakeBlocker[] = [];
  const manufacturerEvidenceUrl = candidate.care.manufacturerEvidenceUrl;
  const independentClinicalGuidanceUrl = candidate.care.independentClinicalGuidanceUrl;
  const careReviewedAt = Date.parse(candidate.care.reviewedAt ?? '');
  const identityCheckedAt = Date.parse(candidate.identity.checkedAt ?? '');
  if (
    candidate.care.status !== 'reviewed'
    || !candidate.care.formulaArchetype?.trim()
    || !['daily-care', 'targeted-care', 'professional-referral'].includes(candidate.care.careTier ?? '')
    || candidate.care.reviewScope !== 'catalogue-supportive-care'
    || !candidate.care.reviewer?.trim()
    || !validPastDate(candidate.care.reviewedAt, asOf)
    || !Number.isFinite(identityCheckedAt)
    || careReviewedAt < identityCheckedAt
  ) blockers.push('care-review-missing');
  if (!candidate.care.evidenceUrls.length || candidate.care.evidenceUrls.some(url => !validHttps(url))) blockers.push('care-evidence-missing');
  if (!candidate.care.advisoryBoundary?.trim() || candidate.care.advisoryBoundary.trim().length < 24) {
    blockers.push('care-advisory-boundary-missing');
  }
  try {
    const manufacturer = new URL(manufacturerEvidenceUrl ?? '');
    const clinical = new URL(independentClinicalGuidanceUrl ?? '');
    const evidence = new Set(candidate.care.evidenceUrls.map(url => new URL(url).href));
    if (
      manufacturer.protocol !== 'https:'
      || clinical.protocol !== 'https:'
      || !candidateScopedManufacturerCareSource(candidate, manufacturer.href)
      || manufacturer.hostname === clinical.hostname
      || !reviewedIndependentClinicalGuidanceUrls.has(clinical.href)
      || !evidence.has(manufacturer.href)
      || !evidence.has(clinical.href)
    ) blockers.push('care-independent-guidance-missing');
  } catch {
    blockers.push('care-independent-guidance-missing');
  }
  return blockers;
}

function resolveNigeriaMarketRoute(
  candidate: CatalogueIntakeCandidate,
  offers: CatalogueIntakeOffer[],
  asOf: number,
): CatalogueNigeriaMarketRoute | undefined {
  const hasTierAClaim = candidate.nigeria.tierAIdentityEvidenceUrl !== undefined;
  const hasBrandClaim = candidate.nigeria.brandAuthorizationEvidenceUrl !== undefined;
  if (hasTierAClaim === hasBrandClaim) return undefined;
  const independentOffers = offers.filter(offer => offer.retailerStatus === 'directory-listed');
  const retailers = new Set(independentOffers.map(offer => offer.retailer.trim().toLowerCase()));
  const hosts = new Set(independentOffers.map(offer => new URL(offer.listingUrl).hostname.replace(/^www\./, '')));
  const tierARoute = sameUrl(
    candidate.nigeria.tierAIdentityEvidenceUrl,
    candidate.identity.officialProductUrl,
  ) && retailers.size >= 2 && hosts.size >= 2;
  if (hasTierAClaim) return tierARoute ? 'tier-a' : undefined;
  const brandAuthorizedOffers = independentOffers.filter(offer => {
    const retailer = nigeriaRetailers.find(item => normalized(item.name) === normalized(offer.retailer));
    return retailer
      ? reviewedBrandSellerEvidenceValid(retailer, candidate.nigeria.brandAuthorizationEvidenceUrl, asOf)
      : false;
  });
  const brandRoute = catalogueBrandAuthorizationSourceValid(
    candidate,
    candidate.nigeria.brandAuthorizationEvidenceUrl,
  )
    && brandAuthorizedOffers.length >= 1;
  return brandRoute ? 'brand-authorized' : undefined;
}

function nigeriaBlockers(
  candidate: CatalogueIntakeCandidate,
  offers: CatalogueIntakeOffer[],
  asOf: number,
  marketRoute: CatalogueNigeriaMarketRoute | undefined,
) {
  const blockers: CatalogueIntakeBlocker[] = [];
  if (!offers.length) blockers.push('nigeria-exact-offer-missing');
  if (
    (candidate.nigeria.exactOffers.length > 0 || candidate.nigeria.excludedObservations.length > 0)
    && !offers.length
  ) blockers.push('nigeria-offer-identity-unbound');
  if (!marketRoute) blockers.push('nigeria-market-route-insufficient');
  return blockers;
}

function rightsBlockers(candidate: CatalogueIntakeCandidate, asOf: number): CatalogueIntakeBlocker[] {
  const blockers: CatalogueIntakeBlocker[] = [];
  if (candidate.asset.rightsStatus !== 'documented' || !candidate.asset.origin) blockers.push('asset-rights-missing');
  if (
    candidate.asset.origin
    && !packshotEligibleOrigins.includes(candidate.asset.origin as typeof packshotEligibleOrigins[number])
  ) blockers.push('asset-origin-ineligible');
  if (
    candidate.asset.origin !== 'owned-identity-verified-render'
    && !validHttps(candidate.asset.rightsUrl)
  ) blockers.push('asset-rights-source-missing');
  if (
    candidate.asset.origin === 'owned-identity-verified-render'
    && candidate.asset.rightsUrl !== undefined
  ) blockers.push('asset-rights-source-missing');
  if (
    !validHttps(candidate.asset.sourceUrl)
    || !candidate.asset.sourceAssetSha256
    || !hashPattern.test(candidate.asset.sourceAssetSha256)
    || !['image/avif', 'image/jpeg', 'image/png', 'image/webp'].includes(candidate.asset.sourceAssetMimeType ?? '')
    || !Number.isInteger(candidate.asset.sourceAssetByteSize)
    || (candidate.asset.sourceAssetByteSize ?? 0) <= 0
    || !Number.isInteger(candidate.asset.sourceAssetWidth)
    || !Number.isInteger(candidate.asset.sourceAssetHeight)
    || (candidate.asset.sourceAssetWidth ?? 0) <= 0
    || (candidate.asset.sourceAssetHeight ?? 0) <= 0
    || !validPastDate(candidate.asset.sourceAssetRetrievedAt, asOf)
  ) blockers.push('asset-source-snapshot-invalid');
  if (
    candidate.asset.backgroundTreatment === 'source-pixel-isolation'
    && !cataloguePackshotIsolationRecordValid(
      cataloguePackshotIsolationRecordFor(
        cataloguePackshotIsolations as readonly CataloguePackshotIsolationRecord[],
        candidate.id,
      ),
      candidate,
      asOf,
    )
  ) {
    blockers.push('asset-isolation-record-missing');
  }
  if (
    candidate.asset.origin === 'owned-identity-verified-render'
    && !generationRecordValid(candidate, asOf)
  ) blockers.push('asset-generation-record-missing');
  if (
    candidate.asset.origin !== 'owned-identity-verified-render'
    && candidate.asset.generationRecord
  ) blockers.push('asset-generation-record-missing');
  return blockers;
}

function editorialBlockers(candidate: CatalogueIntakeCandidate, asOf: number): CatalogueIntakeBlocker[] {
  const blockers: CatalogueIntakeBlocker[] = [];
  if (candidate.asset.role !== 'packshot') blockers.push('asset-final-image-role-invalid');
  if (!validHttps(candidate.asset.publicImageUrl)) blockers.push('asset-final-image-missing');
  const validMimeType = isCataloguePublicationImageMimeType(candidate.asset.publicImageMimeType);
  if (
    !candidate.asset.publicImageSha256
    || !hashPattern.test(candidate.asset.publicImageSha256)
    || !validMimeType
    || !Number.isInteger(candidate.asset.publicImageByteSize)
    || (candidate.asset.publicImageByteSize ?? 0) <= 0
    || (candidate.asset.publicImageByteSize ?? 0) > cataloguePublicationImageMaxBytes
  ) blockers.push('asset-final-image-invalid');
  if (
    !Number.isInteger(candidate.asset.width)
    || !Number.isInteger(candidate.asset.height)
    || Math.min(candidate.asset.width ?? 0, candidate.asset.height ?? 0) < cataloguePublicationImageMinSide
    || Math.max(candidate.asset.width ?? 0, candidate.asset.height ?? 0) > cataloguePublicationImageMaxSide
  ) blockers.push('asset-final-image-too-small');
  if (validHttps(candidate.asset.publicImageUrl) && validMimeType) {
    try {
      assertCataloguePublicationImageLocation(
        candidate.id,
        candidate.asset.publicImageUrl ?? '',
        candidate.asset.publicImageMimeType as CataloguePublicationImageMimeType,
        candidate.asset.publicImageSha256 ?? '',
      );
    } catch {
      blockers.push('asset-final-image-untrusted-location');
    }
  }
  if (candidate.asset.backgroundTreatment === 'automated-removal') blockers.push('asset-automated-cutout');
  if (!['none', 'source-pixel-isolation', 'identity-verified-render'].includes(candidate.asset.backgroundTreatment ?? '')) {
    blockers.push('asset-background-treatment-unresolved');
  }
  if (candidate.asset.packaging !== 'intact') blockers.push('asset-packaging-not-intact');
  const sourceRetrievedAt = Date.parse(candidate.asset.sourceAssetRetrievedAt ?? '');
  const generatedAt = Date.parse(candidate.asset.generationRecord?.generatedAt ?? '');
  const artReviewedAt = Date.parse(candidate.asset.artReviewedAt ?? '');
  const identityCheckedAt = Date.parse(candidate.identity.checkedAt ?? '');
  if (
    (Number.isFinite(sourceRetrievedAt) && Number.isFinite(artReviewedAt) && artReviewedAt < sourceRetrievedAt)
    || (
      candidate.asset.origin === 'owned-identity-verified-render'
      && Number.isFinite(generatedAt)
      && Number.isFinite(artReviewedAt)
      && artReviewedAt < generatedAt
    )
    || (Number.isFinite(identityCheckedAt) && Number.isFinite(artReviewedAt) && artReviewedAt < identityCheckedAt)
  ) blockers.push('asset-review-chronology-invalid');
  if (
    candidate.asset.labelVariantSizeUnchanged !== true
    || candidate.asset.packagingInvented !== false
    || candidate.asset.manualSourceOutputQa !== true
    || !candidate.asset.artReviewer?.trim()
    || !validPastDate(candidate.asset.artReviewedAt, asOf)
    || (candidate.asset.origin === 'owned-identity-verified-render'
      ? candidate.asset.backgroundTreatment !== 'identity-verified-render'
      : candidate.asset.backgroundTreatment === 'identity-verified-render')
  ) blockers.push('asset-identity-qa-missing');
  if (candidate.asset.presentationQuality !== 'magazine-ready') blockers.push('asset-not-magazine-ready');
  return blockers;
}

const actionForStage: Record<CatalogueIntakeStage, string> = {
  identity: 'Lock the exact manufacturer identifier, variant, size and package to a checked-in reviewed extraction and source digest.',
  care: 'Review the formula role and advisory boundaries from primary evidence.',
  nigeria: 'Verify a fresh exact Nigerian product page and bind its current price.',
  rights: 'Document permission or another valid image-rights basis.',
  editorial: 'Finish and manually compare the exact package in its final editorial image.',
  'approval-ready': 'Draft the identity-bound publication approval.',
};

export function evaluateCatalogueIntakeCandidate(candidate: CatalogueIntakeCandidate, asOf = Date.now()): CatalogueIntakeDecision {
  const freshExactOffers = candidate.nigeria.exactOffers.flatMap(offer => {
    const match = matchingOffer(candidate, offer, asOf);
    return match ? [match] : [];
  });
  const nigeriaMarketRoute = resolveNigeriaMarketRoute(candidate, freshExactOffers, asOf);
  const excludedMarketObservations = candidate.nigeria.excludedObservations.filter(observation => (
    marketObservationValid(candidate, observation, asOf)
  ));
  const unresolvedRegulatorySearches = (candidate.nigeria.regulatorySearches ?? []).filter(observation => (
    regulatorySearchObservationValid(candidate, observation, asOf)
  ));
  const groups: Array<[Exclude<CatalogueIntakeStage, 'approval-ready'>, CatalogueIntakeBlocker[]]> = [
    ['identity', identityBlockers(candidate, asOf)],
    ['care', careBlockers(candidate, asOf)],
    ['nigeria', nigeriaBlockers(candidate, freshExactOffers, asOf, nigeriaMarketRoute)],
    ['rights', rightsBlockers(candidate, asOf)],
    ['editorial', editorialBlockers(candidate, asOf)],
  ];
  const blockers = groups.flatMap(([, values]) => values);
  const stage = groups.find(([, values]) => values.length)?.[0] ?? 'approval-ready';
  return {
    candidate,
    stage,
    blockers,
    nextAction: actionForStage[stage],
    approvalDraftReady: stage === 'approval-ready',
    freshExactOffers,
    excludedMarketObservations,
    unresolvedRegulatorySearches,
    ...(nigeriaMarketRoute ? { nigeriaMarketRoute } : {}),
  };
}

export function auditCatalogueIntakeCandidates(
  candidates: readonly CatalogueIntakeCandidate[],
  asOf = Date.now(),
) {
  const ids = new Set<string>();
  const gtins = new Set<string>();
  const canonicalIdentifiers = new Set<string>();
  const officialProductCrosswalks = new Set<string>();
  const officialProductRoutePackages = new Map<
    string,
    'manufacturer-sku' | 'official-route'
  >();
  const identities = new Set<string>();
  for (const candidate of candidates) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.id)) throw new Error(`Invalid catalogue intake id: ${candidate.id}`);
    if (ids.has(candidate.id)) throw new Error(`Duplicate catalogue intake id: ${candidate.id}`);
    ids.add(candidate.id);
    const candidateGtin = catalogueGtinForIdentity(candidate.identity);
    if (candidateGtin) {
      const gtinKey = isValidGtin(candidateGtin)
        ? canonicalGtin(candidateGtin)
        : candidateGtin;
      if (gtins.has(gtinKey)) throw new Error(`Duplicate catalogue intake GTIN: ${candidateGtin}`);
      gtins.add(gtinKey);
    }
    const canonicalIdentifier = catalogueCanonicalIdentifierFor(candidate.identity);
    if (canonicalIdentifier) {
      const keys = canonicalIdentifier.kind === 'manufacturer-sku'
        ? [candidate.brand, ...(candidate.brandAliases ?? [])]
          .map(brand => catalogueCanonicalIdentifierKey(brand, canonicalIdentifier))
        : [catalogueCanonicalIdentifierKey(candidate.brand, canonicalIdentifier)];
      if (keys.some(key => canonicalIdentifiers.has(key))) {
        throw new Error(
          canonicalIdentifier.kind === 'manufacturer-sku'
            ? `Duplicate catalogue intake manufacturer SKU: ${candidate.brand} ${canonicalIdentifier.value}`
            : `Duplicate catalogue intake GTIN: ${canonicalIdentifier.value}`,
        );
      }
      keys.forEach(key => canonicalIdentifiers.add(key));
    }
    const officialProductCrosswalk = candidate.identity.officialProductCrosswalk;
    if (officialProductCrosswalk) {
      const crosswalkKey = catalogueOfficialProductPackageKey(officialProductCrosswalk);
      if (!crosswalkKey) {
        throw new Error(`Catalogue intake ${candidate.id} has an invalid official product crosswalk.`);
      }
      if (officialProductCrosswalks.has(crosswalkKey)) {
        throw new Error(
          `Duplicate catalogue intake official product/package crosswalk: ${candidate.id}`,
        );
      }
      officialProductCrosswalks.add(crosswalkKey);

      const routePackageKey =
        catalogueOfficialProductRoutePackageKey(officialProductCrosswalk);
      const routeClass =
        catalogueOfficialProductCrosswalkRouteClass(officialProductCrosswalk);
      if (!routePackageKey || !routeClass) {
        throw new Error(`Catalogue intake ${candidate.id} has an invalid official route/package.`);
      }
      const existingRouteClass = officialProductRoutePackages.get(routePackageKey);
      if (
        existingRouteClass
        && (
          existingRouteClass !== 'manufacturer-sku'
          || routeClass !== 'manufacturer-sku'
        )
      ) {
        throw new Error(
          `Duplicate catalogue intake official route/package across identity routes: ${candidate.id}`,
        );
      }
      officialProductRoutePackages.set(routePackageKey, routeClass);
    }
    const identity = normalizedIdentity(candidate);
    if (identities.has(identity)) throw new Error(`Duplicate catalogue intake identity: ${candidate.brand} ${candidate.name} ${candidate.size}`);
    identities.add(identity);
    if (!candidate.brand.trim() || !candidate.name.trim() || !candidate.variant.trim() || !candidate.reason.trim()) {
      throw new Error(`Catalogue intake ${candidate.id} is missing its deliberate research context.`);
    }
    if (!candidate.gapIds.length) throw new Error(`Catalogue intake ${candidate.id} must name at least one coverage gap.`);
    if (!candidate.demandEvidenceUrls.length || candidate.demandEvidenceUrls.some(url => !validHttps(url))) {
      throw new Error(`Catalogue intake ${candidate.id} must cite HTTPS demand evidence.`);
    }
    for (const offer of candidate.nigeria.exactOffers) {
      if (!['directory-listed', 'provisional'].includes(offer.retailerStatus)) {
        throw new Error(`Catalogue intake ${candidate.id} has an invalid retailer status.`);
      }
    }
    for (const observation of candidate.nigeria.excludedObservations) {
      if (!marketObservationValid(candidate, observation, asOf)) {
        throw new Error(`Catalogue intake ${candidate.id} has an invalid excluded market observation.`);
      }
    }
    for (const observation of candidate.nigeria.regulatorySearches ?? []) {
      if (candidate.nigeria.regulatoryStatus !== 'pending') {
        throw new Error(`Catalogue intake ${candidate.id} cannot retain an unresolved registry search after regulatory clearance.`);
      }
      if (!regulatorySearchObservationValid(candidate, observation, asOf)) {
        throw new Error(`Catalogue intake ${candidate.id} has an invalid regulatory search observation.`);
      }
    }
  }
  return candidates.map(candidate => evaluateCatalogueIntakeCandidate(candidate, asOf));
}

export function auditCatalogueIntakeManifest(manifest: CatalogueIntakeManifest, asOf = Date.now()) {
  if (manifest.schemaVersion !== catalogueIntakeSchemaVersion) throw new Error('Unsupported catalogue intake schema.');
  if (!validPastDate(manifest.updatedAt, asOf)) throw new Error('Catalogue intake timestamp is invalid or in the future.');
  const manifestUpdatedAt = Date.parse(manifest.updatedAt);
  for (const candidate of manifest.candidates) {
    const activityTimestamps = [
      candidate.identity.checkedAt,
      candidate.identity.officialEvidence?.retrievedAt,
      candidate.identity.officialEvidence?.canonicalExtraction?.retrievedAt,
      candidate.identity.officialEvidence?.canonicalExtraction?.reviewedAt,
      candidate.care.reviewedAt,
      candidate.nigeria.regulatoryEvidence?.retrievedAt,
      candidate.nigeria.regulatoryEvidence?.observedAt,
      candidate.nigeria.regulatoryEvidence?.reviewedAt,
      ...((candidate.nigeria.regulatorySearches ?? []).flatMap(observation => [
        observation.retrievedAt,
        observation.reviewedAt,
      ])),
      ...candidate.nigeria.exactOffers.map(offer => offer.observedAt),
      ...candidate.nigeria.exactOffers.flatMap(offer => [offer.evidence?.retrievedAt, offer.evidence?.reviewedAt]),
      ...candidate.nigeria.excludedObservations.flatMap(observation => [
        observation.observedAt,
        observation.evidence.retrievedAt,
        observation.evidence.reviewedAt,
      ]),
      candidate.asset.sourceAssetRetrievedAt,
      candidate.asset.generationRecord?.generatedAt,
      candidate.asset.artReviewedAt,
    ];
    if (activityTimestamps.some(timestamp => {
      const parsed = Date.parse(timestamp ?? '');
      return Number.isFinite(parsed) && parsed > manifestUpdatedAt;
    })) {
      throw new Error(`Catalogue intake timestamp predates evidence or review activity for ${candidate.id}.`);
    }
  }
  return auditCatalogueIntakeCandidates(manifest.candidates, asOf);
}

export function rankCatalogueIntake(decisions: readonly CatalogueIntakeDecision[]) {
  return [...decisions].sort((left, right) => (
    priorityOrder[left.candidate.priority] - priorityOrder[right.candidate.priority]
    || stageProgress[right.stage] - stageProgress[left.stage]
    || right.candidate.gapIds.length - left.candidate.gapIds.length
    || left.candidate.id.localeCompare(right.candidate.id)
  ));
}
