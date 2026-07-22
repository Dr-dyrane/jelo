import { createHash } from 'node:crypto';
import { nigeriaRetailers } from '@/data/retailers';
import { canonicalGtin, isValidGtin } from './gtin';
import { reviewedBrandSellerEvidenceValid } from './brand-seller-evidence';
import {
  reviewedExactOfferEvidenceValid,
  reviewedRegulatoryEvidenceValid,
  type ReviewedExactOfferEvidence,
  type ReviewedRegulatoryEvidence,
} from './market-evidence';

export const catalogueApprovalScope = 'identity-source-rights-packaging-and-catalogue-fit' as const;
export const minimumCatalogueQualityScore = 55;
export const externalCatalogueApprovalSchemaVersion = 3 as const;

const hashPattern = /^[0-9a-f]{64}$/;
const allowedAssetOrigins = new Set([
  'licensed-original-photograph',
  'official-brand-media',
  'owned-editorial-photograph',
  'identity-verified-styled-composite',
]);
const reviewedBrandEvidenceHosts: Record<string, readonly string[]> = {
  cerave: ['africa.cerave.com', 'www.cerave.com', 'uk.lorealdermatologicalbeautypartnershop.com'],
  eucerin: ['www.eucerin-cewa.com'],
};

export type FormulaEvidence = 'complete' | 'partial' | 'missing' | 'unknown';
export type ProductEvidence = 'high' | 'moderate' | 'emerging' | 'not-reviewed';
export type ImageRights = 'documented' | 'missing' | 'prohibited';
export type PublicAssetOrigin =
  | 'licensed-original-photograph'
  | 'official-brand-media'
  | 'owned-editorial-photograph'
  | 'identity-verified-styled-composite'
  | 'automated-cutout'
  | 'unknown';

export type CatalogueQualitySignals = {
  id: string;
  source: 'reviewed' | 'community';
  identityTraceable: boolean;
  formulaEvidence: FormulaEvidence;
  productEvidence: ProductEvidence;
  exactNigeriaOffer: boolean;
  imageRights: ImageRights;
  assetOrigin: PublicAssetOrigin;
  packaging: 'intact' | 'clipped' | 'unknown';
  sourceFaithful: boolean;
  backgroundTreatment: 'none' | 'styled-composite' | 'automated-removal' | 'unknown';
  labelVariantSizeUnchanged: boolean;
  packagingInvented: boolean | 'unknown';
  manualSourceOutputQa: boolean;
  presentationQuality: 'magazine-ready' | 'ordinary' | 'unknown';
};

export type CatalogueQualityAssessment = {
  score: number;
  dimensions: {
    identity: number;
    formula: number;
    evidence: number;
    nigeria: number;
    rights: number;
    presentation: number;
  };
  concerns: string[];
};

export type ExternalCatalogueGateCandidate = {
  source: 'open-beauty-facts';
  sourceProductId: string;
  barcode: string;
  brand: string;
  name: string;
  quantity: string;
  category: string;
  sourceUrl: string;
  sourceUpdatedAt: string;
  sourceSnapshotSha256: string;
  rawPayloadSha256: string;
  sourceImageUrl: string;
  canonicalImageUrl: string;
  imageSha256: string;
  imageWidth: number;
  imageHeight: number;
  imageLicense: string;
  sourcePhotoValidated: boolean;
  sourceIngredientsComplete: boolean;
  imageTreatment?: string;
};

export type ExternalCatalogueApproval = {
  barcode: string;
  candidateFingerprint: string;
  sourceSnapshotSha256: string;
  imageSha256: string;
  approvedAt: string;
  reviewer: string;
  scope: typeof catalogueApprovalScope;
  catalogueFit: string;
  sku: {
    status: 'exact';
    barcode: string;
    variant: string;
    size: string;
    evidenceUrl: string;
  };
  careReview: {
    formulaArchetype: string;
    careTier: 'daily-care' | 'targeted-care' | 'professional-referral';
    evidenceUrl: string;
    reviewedAt: string;
    reviewer: string;
  };
  nigeria: {
    regulatoryStatus: 'matched' | 'not-required' | 'pending';
    regulatoryEvidence?: ReviewedRegulatoryEvidence;
    tierAIdentityEvidenceUrl?: string;
    brandAuthorizationEvidenceUrl?: string;
    exactOffers: Array<{
      retailer: string;
      listingUrl: string;
      observedAt: string;
      variant: string;
      size: string;
      observedGtin: string;
      observedGtinBasis: 'explicit-gtin' | 'explicit-ean' | 'explicit-upc';
      priceNgn: number;
      stock: 'in-stock' | 'low-stock' | 'out-of-stock';
      evidence?: ReviewedExactOfferEvidence;
    }>;
  };
  asset: {
    origin: Exclude<PublicAssetOrigin, 'automated-cutout' | 'unknown'>;
    rightsBasis: 'cc-by-sa-3.0' | 'official-brand-permission' | 'owned-editorial';
    rightsUrl: string;
    publicImageUrl: string;
    publicImageSha256: string;
    publicImageWidth: number;
    publicImageHeight: number;
    packaging: 'intact';
    sourceFaithful: true;
    backgroundTreatment: 'none' | 'styled-composite';
    labelVariantSizeUnchanged: true;
    packagingInvented: false;
    manualSourceOutputQa: true;
    presentationQuality: 'magazine-ready';
  };
};

export type ExternalCatalogueApprovalManifest = {
  schemaVersion: typeof externalCatalogueApprovalSchemaVersion;
  approvals: ExternalCatalogueApproval[];
};

export type ExternalCatalogueGateReason =
  | 'approved'
  | 'missing-approval'
  | 'invalid-approval'
  | 'approval-binding-mismatch'
  | 'exact-sku-not-approved'
  | 'care-review-missing'
  | 'nigeria-regulatory-pending'
  | 'nigeria-regulatory-evidence-missing'
  | 'nigeria-market-evidence-insufficient'
  | 'quality-below-minimum'
  | 'automated-background-removal'
  | 'asset-not-publication-ready';

export type ExternalCatalogueGateDecision<T extends ExternalCatalogueGateCandidate> = {
  candidate: T;
  status: 'approved' | 'private-candidate';
  reason: ExternalCatalogueGateReason;
  quality: CatalogueQualityAssessment;
  approval?: ExternalCatalogueApproval;
};

export type ApprovedExternalCatalogueProduct<T extends ExternalCatalogueGateCandidate> = T & {
  canonicalImageUrl: string;
  imageSha256: string;
  imageWidth: number;
  imageHeight: number;
  imageTreatment: 'untouched-publication-asset' | 'identity-verified-styled-composite';
  productionInputImageTreatment?: string;
  catalogueApproval: ExternalCatalogueApproval;
  catalogueQuality: CatalogueQualityAssessment;
};

function httpsUrl(value: string, hostname?: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (!hostname || url.hostname === hostname);
  } catch {
    return false;
  }
}

function sameUrl(left: string | undefined, right: string | undefined) {
  if (!left || !right || !httpsUrl(left) || !httpsUrl(right)) return false;
  return new URL(left).href === new URL(right).href;
}

function normalized(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizedHost(value: string) {
  return new URL(value).hostname.replace(/^www\./, '').toLowerCase();
}

function reviewedBrandEvidenceHost(brand: string, value: string | undefined) {
  if (!value || !httpsUrl(value)) return false;
  const brandKey = normalized(brand).replace(/\s/g, '');
  return reviewedBrandEvidenceHosts[brandKey]?.includes(new URL(value).hostname.toLowerCase()) ?? false;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

export function externalCandidateFingerprint(candidate: ExternalCatalogueGateCandidate) {
  return createHash('sha256').update(stableJson({
    source: candidate.source,
    sourceProductId: candidate.sourceProductId,
    barcode: candidate.barcode,
    brand: candidate.brand,
    name: candidate.name,
    quantity: candidate.quantity,
    category: candidate.category,
    sourceUrl: candidate.sourceUrl,
    sourceUpdatedAt: candidate.sourceUpdatedAt,
    sourceSnapshotSha256: candidate.sourceSnapshotSha256,
    rawPayloadSha256: candidate.rawPayloadSha256,
    sourceImageUrl: candidate.sourceImageUrl,
    canonicalImageUrl: candidate.canonicalImageUrl,
    imageSha256: candidate.imageSha256,
  })).digest('hex');
}

export function assessCatalogueQuality(signals: CatalogueQualitySignals): CatalogueQualityAssessment {
  const identity = signals.identityTraceable ? 20 : 0;
  const formula = signals.formulaEvidence === 'complete' ? 15 : signals.formulaEvidence === 'partial' ? 8 : 0;
  const evidence = signals.productEvidence === 'high'
    ? 15
    : signals.productEvidence === 'moderate'
      ? 10
      : signals.productEvidence === 'emerging'
        ? 5
        : 0;
  const nigeria = signals.exactNigeriaOffer ? 15 : 0;
  const rights = signals.imageRights === 'documented' ? 15 : 0;
  const allowedBackground = signals.backgroundTreatment === 'none' || signals.backgroundTreatment === 'styled-composite';
  const presentation = (allowedAssetOrigins.has(signals.assetOrigin) ? 4 : 0)
    + (signals.packaging === 'intact' ? 4 : 0)
    + (signals.sourceFaithful ? 3 : 0)
    + (allowedBackground ? 3 : 0)
    + (signals.labelVariantSizeUnchanged ? 2 : 0)
    + (signals.packagingInvented === false ? 2 : 0)
    + (signals.manualSourceOutputQa ? 1 : 0)
    + (signals.presentationQuality === 'magazine-ready' ? 1 : 0);
  const concerns = [
    !signals.identityTraceable ? 'identity-not-traceable' : null,
    signals.formulaEvidence === 'missing' || signals.formulaEvidence === 'unknown' ? 'formula-evidence-incomplete' : null,
    signals.productEvidence === 'not-reviewed' ? 'product-evidence-not-reviewed' : null,
    !signals.exactNigeriaOffer ? 'no-exact-nigeria-offer' : null,
    signals.imageRights !== 'documented' ? `image-rights-${signals.imageRights}` : null,
    !allowedAssetOrigins.has(signals.assetOrigin) ? 'asset-origin-not-approved' : null,
    signals.packaging !== 'intact' ? 'packaging-not-confirmed-intact' : null,
    !signals.sourceFaithful ? 'image-not-confirmed-source-faithful' : null,
    !allowedBackground ? 'background-treatment-not-allowed' : null,
    !signals.labelVariantSizeUnchanged ? 'label-variant-or-size-not-confirmed' : null,
    signals.packagingInvented === true ? 'packaging-invented' : null,
    signals.packagingInvented === 'unknown' ? 'packaging-originality-not-confirmed' : null,
    !signals.manualSourceOutputQa ? 'manual-source-output-qa-missing' : null,
    signals.presentationQuality !== 'magazine-ready' ? 'final-image-not-magazine-ready' : null,
  ].filter((value): value is string => Boolean(value));

  return {
    score: identity + formula + evidence + nigeria + rights + presentation,
    dimensions: { identity, formula, evidence, nigeria, rights, presentation },
    concerns,
  };
}

function validDateAtOrBefore(value: string, asOf: number) {
  const observedAt = Date.parse(value);
  return Number.isFinite(observedAt) && observedAt <= asOf + 5 * 60_000;
}

function freshNigeriaOffers(candidate: ExternalCatalogueGateCandidate, approval: ExternalCatalogueApproval, asOf: number) {
  const cutoff = asOf - 7 * 86_400_000;
  return approval.nigeria.exactOffers.filter(offer => {
    const observedAt = Date.parse(offer.observedAt);
    return offer.retailer.trim().length >= 2
      && httpsUrl(offer.listingUrl)
      && offer.variant.trim().localeCompare(candidate.name.trim(), undefined, { sensitivity: 'base' }) === 0
      && offer.size.trim().localeCompare(candidate.quantity.trim(), undefined, { sensitivity: 'base' }) === 0
      && isValidGtin(offer.observedGtin)
      && canonicalGtin(offer.observedGtin) === canonicalGtin(candidate.barcode)
      && ['explicit-gtin', 'explicit-ean', 'explicit-upc'].includes(offer.observedGtinBasis)
      && Number.isFinite(offer.priceNgn)
      && offer.priceNgn > 0
      && ['in-stock', 'low-stock', 'out-of-stock'].includes(offer.stock)
      && Number.isFinite(observedAt)
      && observedAt >= cutoff
      && observedAt <= asOf + 5 * 60_000
      && reviewedExactOfferEvidenceValid({
        ...offer,
        observedTitle: offer.variant,
        observedSize: offer.size,
      }, candidate.barcode, asOf);
  });
}

function directoryRetailerForOffer(
  offer: ExternalCatalogueApproval['nigeria']['exactOffers'][number],
) {
  const retailer = nigeriaRetailers.find(item => normalized(item.name) === normalized(offer.retailer));
  if (
    !retailer
    || retailer.reviewStatus !== 'directory-listed'
    || normalizedHost(retailer.homepage) !== normalizedHost(offer.listingUrl)
  ) return undefined;
  return retailer;
}

function validApproval(approval: ExternalCatalogueApproval, asOf: number) {
  const approvedAt = Date.parse(approval.approvedAt);
  return approval.scope === catalogueApprovalScope
    && approval.reviewer.trim().length >= 2
    && approval.catalogueFit.trim().length >= 8
    && Number.isFinite(approvedAt)
    && approvedAt <= asOf + 5 * 60_000
    && hashPattern.test(approval.candidateFingerprint)
    && hashPattern.test(approval.sourceSnapshotSha256)
    && hashPattern.test(approval.imageSha256)
    && allowedAssetOrigins.has(approval.asset.origin)
    && approval.asset.packaging === 'intact'
    && approval.asset.sourceFaithful === true
    && ['none', 'styled-composite'].includes(approval.asset.backgroundTreatment)
    && approval.asset.labelVariantSizeUnchanged === true
    && approval.asset.packagingInvented === false
    && approval.asset.manualSourceOutputQa === true
    && approval.asset.presentationQuality === 'magazine-ready'
    && httpsUrl(approval.asset.rightsUrl)
    && httpsUrl(approval.asset.publicImageUrl)
    && hashPattern.test(approval.asset.publicImageSha256)
    && Number.isInteger(approval.asset.publicImageWidth)
    && Number.isInteger(approval.asset.publicImageHeight)
    && approval.asset.publicImageWidth >= 1_600
    && approval.asset.publicImageHeight >= 1_600;
}

function hardGateReason(
  candidate: ExternalCatalogueGateCandidate,
  approval: ExternalCatalogueApproval,
  asOf: number,
): ExternalCatalogueGateReason | undefined {
  if (
    approval.sku.status !== 'exact'
    || approval.sku.barcode !== candidate.barcode
    || approval.sku.variant.trim().localeCompare(candidate.name.trim(), undefined, { sensitivity: 'base' }) !== 0
    || approval.sku.size.trim().localeCompare(candidate.quantity.trim(), undefined, { sensitivity: 'base' }) !== 0
    || !httpsUrl(approval.sku.evidenceUrl)
    || !reviewedBrandEvidenceHost(candidate.brand, approval.sku.evidenceUrl)
  ) return 'exact-sku-not-approved';

  if (
    approval.careReview.formulaArchetype.trim().length < 3
    || !['daily-care', 'targeted-care', 'professional-referral'].includes(approval.careReview.careTier)
    || !httpsUrl(approval.careReview.evidenceUrl)
    || approval.careReview.reviewer.trim().length < 2
    || !validDateAtOrBefore(approval.careReview.reviewedAt, asOf)
  ) return 'care-review-missing';

  if (approval.nigeria.regulatoryStatus === 'pending') return 'nigeria-regulatory-pending';
  if (
    !['matched', 'not-required'].includes(approval.nigeria.regulatoryStatus)
    || !reviewedRegulatoryEvidenceValid(
      approval.nigeria.regulatoryEvidence,
      approval.nigeria.regulatoryStatus === 'not-required' ? 'not-required' : 'matched',
      candidate.barcode,
      asOf,
    )
  ) return 'nigeria-regulatory-evidence-missing';

  const regulatoryEvidence = approval.nigeria.regulatoryEvidence!;
  const approvedAt = Date.parse(approval.approvedAt);
  const freshOffers = freshNigeriaOffers(candidate, approval, asOf);
  const causalEvidenceTimes = [
    Date.parse(approval.careReview.reviewedAt),
    Date.parse(regulatoryEvidence.retrievedAt),
    Date.parse(regulatoryEvidence.observedAt),
    Date.parse(regulatoryEvidence.reviewedAt),
    ...freshOffers.flatMap(offer => [
      Date.parse(offer.observedAt),
      Date.parse(offer.evidence?.retrievedAt ?? ''),
      Date.parse(offer.evidence?.reviewedAt ?? ''),
    ]),
  ];
  if (
    !Number.isFinite(approvedAt)
    || causalEvidenceTimes.some(timestamp => !Number.isFinite(timestamp) || timestamp > approvedAt)
  ) return 'invalid-approval';
  const directoryOffers = freshOffers.flatMap(offer => {
    const retailer = directoryRetailerForOffer(offer);
    return retailer ? [{ offer, retailer }] : [];
  });
  const independentRetailers = new Set(directoryOffers.map(({ retailer }) => normalized(retailer.name)));
  const independentHosts = new Set(directoryOffers.map(({ offer }) => normalizedHost(offer.listingUrl)));
  const tierARoute = sameUrl(approval.nigeria.tierAIdentityEvidenceUrl, approval.sku.evidenceUrl)
    && independentRetailers.size >= 2
    && independentHosts.size >= 2;
  const brandAuthorizationEvidenceUrl = approval.nigeria.brandAuthorizationEvidenceUrl;
  const brandAuthorizedOffers = directoryOffers.filter(({ retailer }) => (
    reviewedBrandSellerEvidenceValid(retailer, brandAuthorizationEvidenceUrl, asOf)
  ));
  const brandRoute = reviewedBrandEvidenceHost(candidate.brand, brandAuthorizationEvidenceUrl)
    && reviewedBrandEvidenceHost(candidate.brand, approval.sku.evidenceUrl);
  const sellerBoundBrandRoute = brandRoute && brandAuthorizedOffers.length >= 1;
  if (
    sellerBoundBrandRoute
    && brandAuthorizedOffers.some(({ retailer }) => {
      const evidence = retailer.identityEvidence;
      return evidence?.basis === 'brand-source' && [
        evidence.observedAt,
        evidence.retrievedAt,
        evidence.reviewedAt,
      ].some(value => Date.parse(value) > approvedAt);
    })
  ) return 'invalid-approval';
  if (!tierARoute && !sellerBoundBrandRoute) return 'nigeria-market-evidence-insufficient';
  return undefined;
}

function externalSignals(candidate: ExternalCatalogueGateCandidate, approval: ExternalCatalogueApproval | undefined, asOf: number): CatalogueQualitySignals {
  const identityTraceable = isValidGtin(candidate.barcode)
    && candidate.sourceProductId === candidate.barcode
    && candidate.brand.trim().length >= 2
    && candidate.name.trim().length >= 3
    && candidate.quantity.trim().length > 0
    && httpsUrl(candidate.sourceUrl, 'world.openbeautyfacts.org')
    && httpsUrl(candidate.sourceImageUrl, 'images.openbeautyfacts.org');
  const rightsDocumented = candidate.imageLicense === 'CC BY-SA 3.0'
    && approval?.asset.rightsBasis === 'cc-by-sa-3.0'
    && httpsUrl(approval.asset.rightsUrl);

  return {
    id: candidate.barcode,
    source: 'community',
    identityTraceable,
    formulaEvidence: approval?.careReview.formulaArchetype.trim() ? 'complete' : 'unknown',
    productEvidence: 'not-reviewed',
    exactNigeriaOffer: approval ? freshNigeriaOffers(candidate, approval, asOf).length > 0 : false,
    imageRights: rightsDocumented || approval?.asset.rightsBasis === 'official-brand-permission' || approval?.asset.rightsBasis === 'owned-editorial'
      ? 'documented'
      : 'missing',
    assetOrigin: approval?.asset.origin ?? 'unknown',
    packaging: approval?.asset.packaging ?? 'unknown',
    sourceFaithful: approval?.asset.sourceFaithful ?? false,
    backgroundTreatment: approval?.asset.backgroundTreatment ?? 'unknown',
    labelVariantSizeUnchanged: approval?.asset.labelVariantSizeUnchanged ?? false,
    packagingInvented: approval?.asset.packagingInvented ?? 'unknown',
    manualSourceOutputQa: approval?.asset.manualSourceOutputQa ?? false,
    presentationQuality: approval?.asset.presentationQuality ?? 'unknown',
  };
}

export function evaluateExternalCatalogueCandidate<T extends ExternalCatalogueGateCandidate>(
  candidate: T,
  approval: ExternalCatalogueApproval | undefined,
  asOf = Date.now(),
): ExternalCatalogueGateDecision<T> {
  const quality = assessCatalogueQuality(externalSignals(candidate, approval, asOf));
  if (!approval) return { candidate, status: 'private-candidate', reason: 'missing-approval', quality };
  if (!validApproval(approval, asOf)) return { candidate, status: 'private-candidate', reason: 'invalid-approval', quality, approval };
  if (
    approval.barcode !== candidate.barcode
    || approval.candidateFingerprint !== externalCandidateFingerprint(candidate)
    || approval.sourceSnapshotSha256 !== candidate.sourceSnapshotSha256
    || approval.imageSha256 !== candidate.imageSha256
    || (
      approval.asset.publicImageSha256 === candidate.imageSha256
      && (
        approval.asset.publicImageWidth !== candidate.imageWidth
        || approval.asset.publicImageHeight !== candidate.imageHeight
      )
    )
    || (
      approval.asset.publicImageUrl === candidate.canonicalImageUrl
      && approval.asset.publicImageSha256 !== candidate.imageSha256
    )
  ) return { candidate, status: 'private-candidate', reason: 'approval-binding-mismatch', quality, approval };
  const hardFailure = hardGateReason(candidate, approval, asOf);
  if (hardFailure) return { candidate, status: 'private-candidate', reason: hardFailure, quality, approval };
  const candidateIsCutout = candidate.imageTreatment === 'source-faithful-background-extraction'
    || candidate.imageTreatment === 'automated-background-removal';
  if (
    candidateIsCutout
    && (
      approval.asset.publicImageSha256 === candidate.imageSha256
      || approval.asset.publicImageUrl === candidate.canonicalImageUrl
      || approval.asset.origin !== 'identity-verified-styled-composite'
      || approval.asset.backgroundTreatment !== 'styled-composite'
    )
  ) return { candidate, status: 'private-candidate', reason: 'automated-background-removal', quality, approval };
  if (quality.score < minimumCatalogueQualityScore) {
    return { candidate, status: 'private-candidate', reason: 'quality-below-minimum', quality, approval };
  }
  if (
    !allowedAssetOrigins.has(quality.dimensions.presentation === 20 ? approval.asset.origin : 'unknown')
    || quality.dimensions.rights !== 15
    || quality.dimensions.identity !== 20
    || quality.dimensions.presentation !== 20
  ) return { candidate, status: 'private-candidate', reason: 'asset-not-publication-ready', quality, approval };
  return { candidate, status: 'approved', reason: 'approved', quality, approval };
}

export function gateExternalCatalogue<T extends ExternalCatalogueGateCandidate>(
  candidates: readonly T[],
  manifest: ExternalCatalogueApprovalManifest,
  asOf = Date.now(),
) {
  if (manifest.schemaVersion !== externalCatalogueApprovalSchemaVersion) {
    throw new Error('Unsupported external catalogue approval schema.');
  }
  if (manifest.approvals.length > 0) {
    throw new Error('External catalogue publication is disabled; move exact-SKU research through the private intake dossier gate.');
  }
  const approvals = new Map<string, ExternalCatalogueApproval>();
  for (const approval of manifest.approvals) {
    if (approvals.has(approval.barcode)) throw new Error(`Duplicate catalogue approval for ${approval.barcode}.`);
    approvals.set(approval.barcode, approval);
  }
  const candidateIds = new Set(candidates.map(candidate => candidate.barcode));
  for (const barcode of approvals.keys()) {
    if (!candidateIds.has(barcode)) throw new Error(`Catalogue approval ${barcode} has no current candidate.`);
  }

  const decisions = candidates.map(candidate => evaluateExternalCatalogueCandidate(candidate, approvals.get(candidate.barcode), asOf));
  const approved = decisions.flatMap(decision => decision.status === 'approved' && decision.approval ? [{
    ...decision.candidate,
    canonicalImageUrl: decision.approval.asset.publicImageUrl,
    imageSha256: decision.approval.asset.publicImageSha256,
    imageWidth: decision.approval.asset.publicImageWidth,
    imageHeight: decision.approval.asset.publicImageHeight,
    imageTreatment: decision.approval.asset.backgroundTreatment === 'styled-composite'
      ? 'identity-verified-styled-composite'
      : 'untouched-publication-asset',
    productionInputImageTreatment: decision.candidate.imageTreatment,
    catalogueApproval: decision.approval,
    catalogueQuality: decision.quality,
  } as ApprovedExternalCatalogueProduct<T>] : []);
  return {
    approved,
    decisions,
    approvedCount: approved.length,
    privateCandidateCount: decisions.length - approved.length,
  };
}
