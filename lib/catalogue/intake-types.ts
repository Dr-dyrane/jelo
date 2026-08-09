import { type CatalogueManufacturerSkuLabel } from "./canonical-identity";
import { type CatalogueRetainedRecord } from "./retained-record";
import {
  type ReviewedCatalogueExactOfferEvidence,
  type ReviewedRegulatoryEvidence,
} from "./market-evidence";
import { type CataloguePublicationImageMimeType } from "./publication-image-policy";
import {
  type CatalogueCanonicalProductIdentifier,
  type CatalogueOfficialProductIdentityCrosswalk,
} from "./canonical-identity";

export const catalogueIntakeSchemaVersion = 8 as const;
export const catalogueGenerationRecordSchemaVersion = 1 as const;
export const catalogueIdentityExtractionSchemaVersion = 3 as const;
export const catalogueBrowserIdentityExtractionSchemaVersion = 4 as const;
export const catalogueCorroboratedIdentityExtractionSchemaVersion = 5 as const;
export const catalogueAccessibleCorroboratedIdentityExtractionSchemaVersion =
  6 as const;
export const catalogueManufacturerSkuIdentityExtractionSchemaVersion =
  8 as const;
export const catalogueManufacturerSkuBarcodeAliasIdentityExtractionSchemaVersion =
  9 as const;
export const catalogueMarketObservationSchemaVersion = 1 as const;
export const catalogueRegulatorySearchObservationSchemaVersion = 1 as const;

/**
 * Reviewed browser surfaces whose rendered DOM may bind identity evidence. A surface qualifies
 * only when an operator drives it, sees the rendered page and attributes the review. Adding one
 * widens what counts as a reviewed capture, so extend this list deliberately—never to make a
 * specific candidate pass.
 */
export const reviewedBrowserCaptureSurfaces = [
  "Codex in-app browser",
  "Claude Code in-app browser",
  "Playwright MCP browser",
] as const;
export type ReviewedBrowserCaptureSurface =
  (typeof reviewedBrowserCaptureSurfaces)[number];
export function reviewedBrowserSurface(surface: string) {
  return (reviewedBrowserCaptureSurfaces as readonly string[]).includes(
    surface,
  );
}

export type CatalogueIntakePriority = "essential" | "important" | "exploratory";
export type CatalogueIntakeStage =
  "identity" | "care" | "nigeria" | "rights" | "editorial" | "approval-ready";
export type CatalogueNigeriaMarketRoute = "tier-a" | "brand-authorized";
export type CatalogueSourceAssetMimeType =
  "image/avif" | "image/jpeg" | "image/png" | "image/webp";
export type CatalogueIdentityEvidenceMimeType =
  | "application/json"
  | "application/pdf"
  | "image/avif"
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "text/html"
  | "text/javascript";

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
  sourceResponseMimeType: Exclude<
    CatalogueIdentityEvidenceMimeType,
    "application/json"
  >;
  sourceResponseByteSize: number;
  supplementalResponses?: Array<{
    role: "official-pack-image";
    sourceUrl: string;
    responseUrl: string;
    retrievedAt: string;
    responseSha256: string;
    responseMimeType: "image/avif" | "image/jpeg" | "image/png" | "image/webp";
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
  sourceResponseMimeType: "text/html";
  sourceResponseByteSize: number;
  responseDigestScope: "rendered-dom-outerhtml";
  method: "reviewed-browser-dom-independent-ean-corroboration";
  browserCapture: {
    surface: ReviewedBrowserCaptureSurface;
    documentReadyState: "complete";
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
  sourceResponseMimeType: "text/html";
  sourceResponseByteSize: number;
  responseDigestScope: "rendered-accessibility-tree";
  method: "reviewed-browser-accessibility-independent-ean-corroboration";
  browserCapture: {
    surface: ReviewedBrowserCaptureSurface;
    documentReadyState: "complete";
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
export const requiredIdentifierAbsenceTerms = [
  "barcode",
  "ean",
  "gtin",
  "upc",
] as const;
export type CatalogueIdentifierAbsenceProof = {
  searchScope: "complete-rendered-dom-outerhtml";
  searchedTerms: readonly string[];
  matchStrategy: "whole-word" | "structured-key-variants";
  caseInsensitive: true;
  matchCount: 0;
};

export function identifierAbsenceProofValid(
  proof: CatalogueIdentifierAbsenceProof | undefined,
  extraction: { responseDigestScope: string },
) {
  if (!proof) return false;
  const searched = new Set(
    (proof.searchedTerms ?? []).map((term) => term.trim().toLowerCase()),
  );
  return Boolean(
    proof.searchScope === "complete-rendered-dom-outerhtml" &&
    extraction.responseDigestScope === "rendered-dom-outerhtml" &&
    ["whole-word", "structured-key-variants"].includes(proof.matchStrategy) &&
    proof.caseInsensitive === true &&
    proof.matchCount === 0 &&
    Array.isArray(proof.searchedTerms) &&
    requiredIdentifierAbsenceTerms.every((term) => searched.has(term)),
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
      value: "not-published";
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
  sourceResponseMimeType: "text/html";
  sourceResponseByteSize: number;
  supplementalResponses: Array<{
    role: "official-pack-image";
    sourceUrl: string;
    responseUrl: string;
    retrievedAt: string;
    responseSha256: string;
    responseMimeType: "image/avif" | "image/jpeg" | "image/png" | "image/webp";
    responseByteSize: number;
  }>;
  responseDigestScope: "rendered-dom-outerhtml";
  method: "reviewed-browser-dom-identity-with-independent-ean-corroboration";
  browserCapture: {
    surface: ReviewedBrowserCaptureSurface;
    documentReadyState: "complete";
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
  sourceResponseMimeType: "text/html";
  sourceResponseByteSize: number;
  supplementalResponses: Array<{
    role: "official-pack-image";
    sourceUrl: string;
    responseUrl: string;
    retrievedAt: string;
    responseSha256: string;
    responseMimeType: "image/avif" | "image/jpeg" | "image/png" | "image/webp";
    responseByteSize: number;
  }>;
  responseDigestScope: "rendered-accessibility-tree";
  method: "reviewed-browser-accessibility-identity-with-independent-ean-corroboration";
  browserCapture: {
    surface: ReviewedBrowserCaptureSurface;
    documentReadyState: "complete";
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
      value: "not-published";
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
  CatalogueManufacturerSkuIdentityExtractionBase &
    (
      | {
          schemaVersion: typeof catalogueManufacturerSkuIdentityExtractionSchemaVersion;
          sourceResponseMimeType: "text/html";
          responseDigestScope: "rendered-dom-outerhtml";
          method: "reviewed-browser-dom-official-manufacturer-sku-identity";
          browserCapture: {
            surface: ReviewedBrowserCaptureSurface;
            documentReadyState: "complete";
            pageTitle: string;
          };
        }
      | {
          schemaVersion: typeof catalogueManufacturerSkuIdentityExtractionSchemaVersion;
          sourceResponseMimeType: "application/json" | "text/javascript";
          responseDigestScope: "decoded-response-body";
          method: "reviewed-exact-official-manufacturer-sku-response";
          browserCapture?: never;
        }
    );

/**
 * Schema 9 extends the manufacturer-SKU route for brands (e.g. DANG! Lifestyle)
 * that publish the same alphanumeric manufacturer code in both the Shopify `sku`
 * AND `barcode` fields. The `barcodeAlias: true` marker distinguishes this from
 * schema 8, which requires `barcode === null`. The verifier accepts the non-null
 * barcode only when it exactly equals the selected variant's SKU and is not
 * GTIN-shaped (8, 12, 13, or 14 digits).
 */
export type CatalogueManufacturerSkuBarcodeAliasIdentityExtraction = Omit<
  CatalogueManufacturerSkuIdentityExtractionBase,
  "schemaVersion"
> & {
  schemaVersion: typeof catalogueManufacturerSkuBarcodeAliasIdentityExtractionSchemaVersion;
  barcodeAlias: true;
} & (
    | {
        sourceResponseMimeType: "text/html";
        responseDigestScope: "rendered-dom-outerhtml";
        method: "reviewed-browser-dom-official-manufacturer-sku-identity";
        browserCapture: {
          surface: ReviewedBrowserCaptureSurface;
          documentReadyState: "complete";
          pageTitle: string;
        };
      }
    | {
        sourceResponseMimeType: "application/json" | "text/javascript";
        responseDigestScope: "decoded-response-body";
        method: "reviewed-exact-official-manufacturer-sku-response";
        browserCapture?: never;
      }
  );

export type CatalogueOfficialIdentityExtraction =
  | (CatalogueOfficialIdentityExtractionBase &
      (
        | {
            schemaVersion: typeof catalogueIdentityExtractionSchemaVersion;
            responseDigestScope: "decoded-response-body";
            method: "reviewed-exact-identity-field-extraction";
          }
        | {
            schemaVersion: typeof catalogueBrowserIdentityExtractionSchemaVersion;
            responseDigestScope: "rendered-dom-outerhtml";
            method: "reviewed-browser-dom-identity-field-extraction";
            browserCapture: {
              surface: ReviewedBrowserCaptureSurface;
              documentReadyState: "complete";
              pageTitle: string;
            };
          }
      ))
  | CatalogueCorroboratedIdentityExtraction
  | CatalogueAccessibleCorroboratedIdentityExtraction
  | CatalogueManufacturerSkuIdentityExtraction
  | CatalogueManufacturerSkuBarcodeAliasIdentityExtraction;

type CatalogueOfficialIdentityEvidenceBase = {
  url: string;
  observedVariant: string;
  observedSize: string;
  observedPackageVersion?: string;
  snapshotKind: "canonical-extraction";
  snapshotPath: string;
  snapshotSha256: string;
  snapshotMimeType: "application/json";
  snapshotByteSize: number;
  retrievedAt: string;
};

export type CatalogueOfficialGtinIdentityEvidence =
  CatalogueOfficialIdentityEvidenceBase & {
    observedGtin: string;
    canonicalExtraction: Exclude<
      CatalogueOfficialIdentityExtraction,
      | CatalogueManufacturerSkuIdentityExtraction
      | CatalogueManufacturerSkuBarcodeAliasIdentityExtraction
    >;
  };

export type CatalogueOfficialManufacturerSkuIdentityEvidence =
  CatalogueOfficialIdentityEvidenceBase & {
    identityKind: "manufacturer-sku";
    observedGtin?: never;
    observedManufacturerSku: string;
    observedManufacturerSkuLabel: CatalogueManufacturerSkuLabel;
    canonicalExtraction:
      | CatalogueManufacturerSkuIdentityExtraction
      | CatalogueManufacturerSkuBarcodeAliasIdentityExtraction;
  };

/**
 * Preserve the established GTIN evidence name for compiler and fixture
 * compatibility. Candidate-aware callers that can handle either route use
 * the explicitly wider evidence type.
 */
export type CatalogueOfficialIdentityEvidence =
  CatalogueOfficialGtinIdentityEvidence;
/**
 * Intake JSON is decoded before its identity route is trusted. Keep this
 * boundary broad enough for immutable record migrations; the readiness and
 * artifact gates prove the exact GTIN or manufacturer-SKU shape.
 */
export type CatalogueCandidateOfficialIdentityEvidence =
  CatalogueOfficialIdentityEvidenceBase & {
    observedGtin?: string;
    identityKind?: "manufacturer-sku";
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
  retailerStatus: "directory-listed" | "provisional";
  listingUrl: string;
  observedAt: string;
  observedTitle: string;
  reviewedTitleAlias?: string;
  observedSize: string;
  observedGtin?: string;
  observedGtinBasis?:
    | "explicit-gtin"
    | "explicit-ean"
    | "explicit-upc"
    | "exact-variant-and-size";
  observedPackageVersion?: string;
  retailerSku?: string;
  priceNgn: number;
  stock: "in-stock" | "low-stock" | "out-of-stock";
  evidence?: ReviewedCatalogueExactOfferEvidence;
};

export type CatalogueMarketObservationExclusionReason =
  | "retailer-identifier-only"
  | "retailer-identifier-conflicts-with-candidate"
  | "manufacturer-identifier-mismatch"
  | "package-barcode-missing"
  | "package-variant-conflict"
  | "retailer-provisional"
  | "listing-no-longer-current"
  | "marketplace-seller-unverified";

type CatalogueMarketObservationTextField = {
  value: string;
  locator: string;
  sourceText: string;
};

export type CatalogueMarketObservation = {
  retailer: string;
  retailerStatus: "directory-listed" | "provisional";
  listingUrl: string;
  observedAt: string;
  observedTitle: string;
  observedSize: string;
  priceNgn: number;
  stock: "in-stock" | "low-stock" | "out-of-stock";
  disposition: "excluded-from-exact-comparison";
  exclusionReasons: CatalogueMarketObservationExclusionReason[];
  evidence: {
    schemaVersion: typeof catalogueMarketObservationSchemaVersion;
    method: "reviewed-retailer-observation";
    responseUrl: string;
    responseSha256: string;
    responseDigestScope: "decoded-response-body";
    responseMimeType: "text/html";
    responseByteSize: number;
    retrievedAt: string;
    fields: {
      title: CatalogueMarketObservationTextField;
      size: CatalogueMarketObservationTextField;
      price: {
        value: number;
        currency: "NGN";
        locator: string;
        sourceText: string;
      };
      stock: {
        value: CatalogueMarketObservation["stock"];
        locator: string;
        sourceText: string;
      };
      retailerIdentifier?: CatalogueMarketObservationTextField & {
        label: "SKU" | "EAN" | "GTIN" | "UPC";
      };
      packageVariantConflict?: CatalogueMarketObservationTextField;
    };
    reviewer: string;
    reviewedAt: string;
  };
};

export type CatalogueRegulatorySearchObservation = {
  schemaVersion: typeof catalogueRegulatorySearchObservationSchemaVersion;
  authority: "NAFDAC";
  method: "reviewed-public-registry-search";
  sourceUrl: string;
  responseUrl: string;
  responseDigestScope: "decoded-response-body";
  responseSha256: string;
  responseMimeType: "application/json";
  responseByteSize: number;
  retrievedAt: string;
  query: {
    field: "product-name";
    value: string;
  };
  result: {
    recordsTotal: number;
    recordsFiltered: 0;
    dataCount: 0;
  };
  disposition: "no-active-public-match";
  caveat: string;
  reviewer: string;
  reviewedAt: string;
};

type CatalogueCandidateIdentityBase = {
  officialProductUrl?: string;
  checkedAt?: string;
  basis?: "official-brand";
  packageVersion?: string;
};

export type CatalogueGtinCandidateIdentity = CatalogueCandidateIdentityBase & {
  gtin?: string;
  canonicalIdentifier?: Extract<
    CatalogueCanonicalProductIdentifier,
    { kind: "gtin" }
  >;
  officialProductCrosswalk?: CatalogueOfficialProductIdentityCrosswalk;
  officialEvidence?: CatalogueOfficialGtinIdentityEvidence;
};

export type CatalogueManufacturerSkuCandidateIdentity =
  CatalogueCandidateIdentityBase & {
    gtin?: never;
    canonicalIdentifier: Extract<
      CatalogueCanonicalProductIdentifier,
      { kind: "manufacturer-sku" }
    >;
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
  category:
    | "Face care"
    | "Hair & scalp"
    | "Body care"
    | "Makeup"
    | "Fragrance"
    | "Personal care";
  reason: string;
  priority: CatalogueIntakePriority;
  gapIds: string[];
  demandEvidenceUrls: string[];
  identity: CatalogueCandidateIdentity;
  care: {
    status: "pending" | "reviewed";
    formulaArchetype?: string;
    careTier?: "daily-care" | "targeted-care" | "professional-referral";
    reviewScope?: "catalogue-supportive-care";
    advisoryBoundary?: string;
    manufacturerEvidenceUrl?: string;
    independentClinicalGuidanceUrl?: string;
    evidenceUrls: string[];
    reviewedAt?: string;
    reviewer?: string;
  };
  nigeria: {
    regulatoryStatus: "pending" | "matched" | "not-required";
    regulatoryEvidence?: ReviewedRegulatoryEvidence;
    regulatorySearches?: CatalogueRegulatorySearchObservation[];
    tierAIdentityEvidenceUrl?: string;
    brandAuthorizationEvidenceUrl?: string;
    exactOffers: CatalogueIntakeOffer[];
    excludedObservations: CatalogueMarketObservation[];
  };
  asset: {
    rightsStatus: "unresolved" | "documented";
    origin?:
      | "licensed-original-photograph"
      | "official-brand-media"
      | "owned-editorial-photograph"
      | "owned-identity-verified-render";
    role?: "packshot";
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
    packaging?: "intact" | "clipped" | "unknown";
    backgroundTreatment?:
      | "none"
      | "styled-composite"
      | "source-pixel-isolation"
      | "identity-verified-render"
      | "automated-removal"
      | "unknown";
    labelVariantSizeUnchanged?: boolean;
    packagingInvented?: boolean;
    manualSourceOutputQa?: boolean;
    artReviewedAt?: string;
    artReviewer?: string;
    presentationQuality?: "magazine-ready" | "ordinary" | "unknown";
  };
};

export type CatalogueIntakeManifest = {
  schemaVersion: typeof catalogueIntakeSchemaVersion;
  updatedAt: string;
  candidates: CatalogueIntakeCandidate[];
};

export type CatalogueIntakeBlocker =
  | "identity-gtin-missing-or-invalid"
  | "identity-manufacturer-sku-missing-or-invalid"
  | "identity-official-source-missing"
  | "identity-official-evidence-invalid"
  | "identity-check-missing-or-future"
  | "identity-size-not-measurable"
  | "care-review-missing"
  | "care-evidence-missing"
  | "care-independent-guidance-missing"
  | "care-advisory-boundary-missing"
  | "nigeria-exact-offer-missing"
  | "nigeria-offer-identity-unbound"
  | "nigeria-market-route-insufficient"
  | "asset-rights-missing"
  | "asset-origin-ineligible"
  | "asset-rights-source-missing"
  | "asset-source-snapshot-invalid"
  | "asset-isolation-record-missing"
  | "asset-generation-record-missing"
  | "asset-review-chronology-invalid"
  | "asset-final-image-role-invalid"
  | "asset-final-image-missing"
  | "asset-final-image-invalid"
  | "asset-final-image-untrusted-location"
  | "asset-final-image-too-small"
  | "asset-automated-cutout"
  | "asset-background-treatment-unresolved"
  | "asset-packaging-not-intact"
  | "asset-identity-qa-missing"
  | "asset-not-magazine-ready";

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
