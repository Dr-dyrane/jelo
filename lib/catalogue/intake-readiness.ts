import { createHash } from 'node:crypto';
import { canonicalGtin, isValidGtin } from './gtin';
import { nigeriaRetailers } from '@/data/retailers';
import { assertRetailerResponseScope } from '@/modules/retail-intelligence/response-scope';
import { reviewedBrandSellerEvidenceValid } from './brand-seller-evidence';
import {
  reviewedExactOfferEvidenceValid,
  type ReviewedExactOfferEvidence,
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
export const catalogueMarketObservationSchemaVersion = 1 as const;
export const catalogueRegulatorySearchObservationSchemaVersion = 1 as const;

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
    surface: 'Codex in-app browser';
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
    surface: 'Codex in-app browser';
    documentReadyState: 'complete';
    pageTitle: string;
  };
  reviewer: string;
  reviewedAt: string;
};

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
    surface: 'Codex in-app browser';
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
    surface: 'Codex in-app browser';
    documentReadyState: 'complete';
    pageTitle: string;
  };
  identifierCorroborations: CatalogueAccessibleCorroboratedIdentifierExtraction[];
  reviewer: string;
  reviewedAt: string;
};

export type CatalogueOfficialIdentityExtraction = CatalogueOfficialIdentityExtractionBase & (
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
      surface: 'Codex in-app browser';
      documentReadyState: 'complete';
      pageTitle: string;
    };
  }
) | CatalogueCorroboratedIdentityExtraction | CatalogueAccessibleCorroboratedIdentityExtraction;

export type CatalogueOfficialIdentityEvidence = {
  url: string;
  observedGtin: string;
  observedVariant: string;
  observedSize: string;
  observedPackageVersion?: string;
  snapshotKind: 'canonical-extraction';
  snapshotPath: string;
  canonicalExtraction: CatalogueOfficialIdentityExtraction;
  snapshotSha256: string;
  snapshotMimeType: 'application/json';
  snapshotByteSize: number;
  retrievedAt: string;
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
  observedSize: string;
  observedGtin?: string;
  observedGtinBasis?: 'explicit-gtin' | 'explicit-ean' | 'explicit-upc' | 'exact-variant-and-size';
  observedPackageVersion?: string;
  retailerSku?: string;
  priceNgn: number;
  stock: 'in-stock' | 'low-stock' | 'out-of-stock';
  evidence?: ReviewedExactOfferEvidence;
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
  identity: {
    gtin?: string;
    officialProductUrl?: string;
    checkedAt?: string;
    basis?: 'official-brand';
    packageVersion?: string;
    officialEvidence?: CatalogueOfficialIdentityEvidence;
  };
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
  aquarich: ['www.aquarich.net'],
  balanceactiveformula: ['www.balanceactiveformula.com'],
  cerave: ['africa.cerave.com', 'www.cerave.com', 'www.cerave.co.uk'],
  delacruz: ['dlclabs.com'],
  dove: ['www.dove.com'],
  eucerin: ['www.eucerin-cewa.com'],
  facefacts: ['facefacts.me'],
  garnier: ['www.garnier.co.uk'],
  keracare: ['keracare.com'],
  nineless: ['ninelessshop.com'],
  olay: ['www.olay.com'],
  sheamoisture: ['www.sheamoisture.com'],
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
};
const reviewedOfficialIdentityHosts: Readonly<Record<string, readonly string[]>> = {
  aquarich: ['www.aquarich.net'],
  balanceactiveformula: ['www.balanceactiveformula.com'],
  cerave: [
    'africa.cerave.com',
    'www.cerave.com',
    'www.cerave.co.uk',
    'uk.lorealdermatologicalbeautypartnershop.com',
  ],
  delacruz: ['dlclabs.com'],
  dove: ['www.dove.com', 'assets.unileversolutions.com'],
  eucerin: ['www.eucerin-cewa.com'],
  facefacts: ['facefacts.me'],
  garnier: ['www.garnier.co.uk'],
  keracare: ['keracare.com'],
  nineless: ['ninelessshop.com'],
  olay: ['www.olay.com'],
  sheamoisture: ['www.sheamoisture.com', 'assets.unileversolutions.com'],
};
const reviewedCandidateIdentifierCorroborationUrls: Readonly<Record<string, readonly string[]>> = {
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
  evidence: CatalogueOfficialIdentityEvidence,
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
    || extraction.browserCapture.surface !== 'Codex in-app browser'
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
    || !/["']?barcode["']?\s*:\s*null/i.test(identifierStatus.sourceText)
    || !/["']?sku["']?\s*:\s*["']{2}/i.test(identifierStatus.sourceText)
    || !packageVersion?.trim()
    || normalized(packageVersionField.value) !== normalized(packageVersion)
    || normalized(evidence.observedPackageVersion ?? '') !== normalized(packageVersion)
    || !validHttps(packageVersionField.evidenceUrl)
    || !sameGtin(evidence.observedGtin, candidate.identity.gtin)
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
      || corroboration.browserCapture.surface !== 'Codex in-app browser'
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
  evidence: CatalogueOfficialIdentityEvidence,
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
    || extraction.browserCapture.surface !== 'Codex in-app browser'
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
    || !sameGtin(evidence.observedGtin, candidate.identity.gtin)
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
      || corroboration.browserCapture.surface !== 'Codex in-app browser'
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

function officialIdentityEvidenceValid(candidate: CatalogueIntakeCandidate, asOf: number) {
  const evidence = candidate.identity.officialEvidence;
  const extraction = evidence?.canonicalExtraction;
  if (
    evidence
    && extraction?.schemaVersion === catalogueCorroboratedIdentityExtractionSchemaVersion
  ) return corroboratedIdentityEvidenceValid(candidate, evidence, extraction, asOf);
  if (
    evidence
    && extraction?.schemaVersion === catalogueAccessibleCorroboratedIdentityExtractionSchemaVersion
  ) return accessibleCorroboratedIdentityEvidenceValid(candidate, evidence, extraction, asOf);

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
      && extraction.browserCapture.surface === 'Codex in-app browser'
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
    && sameGtin(evidence.observedGtin, candidate.identity.gtin)
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
    && (identifier?.label !== 'SKU' || sameGtin(identifier.value, candidate.identity.gtin))
  ) return false;
  if (
    reasons.has('manufacturer-identifier-mismatch')
    && (
      !identifier
      || !['EAN', 'GTIN', 'UPC'].includes(identifier.label)
      || !isValidGtin(identifier.value)
      || sameGtin(identifier.value, candidate.identity.gtin)
    )
  ) return false;
  if (reasons.has('package-variant-conflict') && !evidence.fields.packageVariantConflict?.sourceText.trim()) return false;
  if (reasons.has('retailer-provisional') && observation.retailerStatus !== 'provisional') return false;
  return true;
}

function matchingOffer(candidate: CatalogueIntakeCandidate, offer: CatalogueIntakeOffer, asOf: number) {
  const observedAt = Date.parse(offer.observedAt);
  const identityCheckedAt = Date.parse(candidate.identity.checkedAt ?? '');
  const offerReviewedAt = Date.parse(offer.evidence?.reviewedAt ?? '');
  const exactVariantAndSize = offer.observedGtinBasis === 'exact-variant-and-size';
  if (
    !offer.retailer.trim()
    || !validHttps(offer.listingUrl)
    || (
      exactVariantAndSize
        ? offer.observedGtin != null
        : !sameGtin(offer.observedGtin, candidate.identity.gtin)
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
    || !reviewedExactOfferEvidenceValid(offer, candidate.identity.gtin, asOf)
    || !Number.isFinite(identityCheckedAt)
    || !Number.isFinite(offerReviewedAt)
    || offerReviewedAt < identityCheckedAt
  ) return undefined;

  const canonicalOffer = canonicalRetailerOffer(offer);
  if (!canonicalOffer) return undefined;

  try {
    assertRetailerResponseScope({
      requestedUrl: canonicalOffer.listingUrl,
      responseUrl: canonicalOffer.listingUrl,
      expectedTitle: candidate.variant,
      expectedTitleAliases: normalized(candidate.name) === normalized(candidate.variant)
        ? []
        : [candidate.name],
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
  if (!candidate.identity.gtin || !isValidGtin(candidate.identity.gtin)) blockers.push('identity-gtin-missing-or-invalid');
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
  if (candidate.asset.backgroundTreatment === 'source-pixel-isolation') {
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
  identity: 'Lock the exact manufacturer GTIN, variant and size to a checked-in reviewed extraction and raw-response digest.',
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
  const identities = new Set<string>();
  for (const candidate of candidates) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.id)) throw new Error(`Invalid catalogue intake id: ${candidate.id}`);
    if (ids.has(candidate.id)) throw new Error(`Duplicate catalogue intake id: ${candidate.id}`);
    ids.add(candidate.id);
    if (candidate.identity.gtin) {
      const gtinKey = isValidGtin(candidate.identity.gtin)
        ? canonicalGtin(candidate.identity.gtin)
        : candidate.identity.gtin;
      if (gtins.has(gtinKey)) throw new Error(`Duplicate catalogue intake GTIN: ${candidate.identity.gtin}`);
      gtins.add(gtinKey);
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
