import { isValidGtin } from './gtin';
import { assertRetailerResponseScope } from '@/modules/retail-intelligence/response-scope';

export const catalogueIntakeSchemaVersion = 1 as const;

export type CatalogueIntakePriority = 'essential' | 'important' | 'exploratory';
export type CatalogueIntakeStage = 'identity' | 'care' | 'nigeria' | 'rights' | 'editorial' | 'approval-ready';

export type CatalogueIntakeOffer = {
  retailer: string;
  retailerStatus: 'directory-listed' | 'provisional';
  listingUrl: string;
  observedAt: string;
  observedTitle: string;
  observedSize: string;
  priceNgn: number;
  stock: 'in-stock' | 'low-stock' | 'out-of-stock';
};

export type CatalogueIntakeCandidate = {
  id: string;
  brand: string;
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
  };
  care: {
    status: 'pending' | 'reviewed';
    formulaArchetype?: string;
    evidenceUrls: string[];
    reviewedAt?: string;
    reviewer?: string;
  };
  nigeria: {
    regulatoryStatus: 'pending' | 'matched' | 'not-required';
    regulatoryEvidenceUrl?: string;
    tierAIdentityEvidenceUrl?: string;
    brandAuthorizationEvidenceUrl?: string;
    exactOffers: CatalogueIntakeOffer[];
  };
  asset: {
    rightsStatus: 'unresolved' | 'documented';
    origin?: 'licensed-original-photograph' | 'official-brand-media' | 'owned-editorial-photograph' | 'identity-verified-styled-composite';
    rightsUrl?: string;
    sourceUrl?: string;
    publicImageUrl?: string;
    publicImageSha256?: string;
    width?: number;
    height?: number;
    packaging?: 'intact' | 'clipped' | 'unknown';
    backgroundTreatment?: 'none' | 'styled-composite' | 'source-pixel-isolation' | 'automated-removal' | 'unknown';
    labelVariantSizeUnchanged?: boolean;
    packagingInvented?: boolean;
    manualSourceOutputQa?: boolean;
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
  | 'identity-check-missing-or-future'
  | 'identity-size-not-measurable'
  | 'care-review-missing'
  | 'care-evidence-missing'
  | 'nigeria-regulatory-pending'
  | 'nigeria-regulatory-evidence-missing'
  | 'nigeria-exact-offer-missing'
  | 'nigeria-market-route-insufficient'
  | 'asset-rights-missing'
  | 'asset-rights-source-missing'
  | 'asset-final-image-missing'
  | 'asset-final-image-invalid'
  | 'asset-final-image-too-small'
  | 'asset-automated-cutout'
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
};

const hashPattern = /^[0-9a-f]{64}$/;
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

function offerMatches(candidate: CatalogueIntakeCandidate, offer: CatalogueIntakeOffer, asOf: number) {
  const observedAt = Date.parse(offer.observedAt);
  if (
    !offer.retailer.trim()
    || !validHttps(offer.listingUrl)
    || !Number.isFinite(observedAt)
    || observedAt < asOf - 7 * 86_400_000
    || observedAt > asOf + 5 * 60_000
    || !Number.isFinite(offer.priceNgn)
    || offer.priceNgn <= 0
  ) return false;

  try {
    assertRetailerResponseScope({
      requestedUrl: offer.listingUrl,
      responseUrl: offer.listingUrl,
      expectedTitle: candidate.variant,
      expectedSize: candidate.size,
      observedTitle: offer.observedTitle,
      observedSize: offer.observedSize,
      marketCode: 'NG',
      currencyCode: 'NGN',
    });
    return true;
  } catch {
    return false;
  }
}

function identityBlockers(candidate: CatalogueIntakeCandidate, asOf: number): CatalogueIntakeBlocker[] {
  const blockers: CatalogueIntakeBlocker[] = [];
  if (!candidate.identity.gtin || !isValidGtin(candidate.identity.gtin)) blockers.push('identity-gtin-missing-or-invalid');
  if (candidate.identity.basis !== 'official-brand' || !validHttps(candidate.identity.officialProductUrl)) blockers.push('identity-official-source-missing');
  if (!validPastDate(candidate.identity.checkedAt, asOf)) blockers.push('identity-check-missing-or-future');
  if (!measurableSize.test(candidate.size)) blockers.push('identity-size-not-measurable');
  return blockers;
}

function careBlockers(candidate: CatalogueIntakeCandidate, asOf: number): CatalogueIntakeBlocker[] {
  const blockers: CatalogueIntakeBlocker[] = [];
  if (
    candidate.care.status !== 'reviewed'
    || !candidate.care.formulaArchetype?.trim()
    || !candidate.care.reviewer?.trim()
    || !validPastDate(candidate.care.reviewedAt, asOf)
  ) blockers.push('care-review-missing');
  if (!candidate.care.evidenceUrls.length || candidate.care.evidenceUrls.some(url => !validHttps(url))) blockers.push('care-evidence-missing');
  return blockers;
}

function nigeriaBlockers(candidate: CatalogueIntakeCandidate, offers: CatalogueIntakeOffer[]) {
  const blockers: CatalogueIntakeBlocker[] = [];
  if (candidate.nigeria.regulatoryStatus === 'pending') blockers.push('nigeria-regulatory-pending');
  if (
    !['matched', 'not-required'].includes(candidate.nigeria.regulatoryStatus)
    || !validHttps(candidate.nigeria.regulatoryEvidenceUrl)
  ) blockers.push('nigeria-regulatory-evidence-missing');
  if (!offers.length) blockers.push('nigeria-exact-offer-missing');

  const independentOffers = offers.filter(offer => offer.retailerStatus === 'directory-listed');
  const retailers = new Set(independentOffers.map(offer => offer.retailer.trim().toLowerCase()));
  const hosts = new Set(independentOffers.map(offer => new URL(offer.listingUrl).hostname.replace(/^www\./, '')));
  const tierARoute = validHttps(candidate.nigeria.tierAIdentityEvidenceUrl) && retailers.size >= 2 && hosts.size >= 2;
  const brandRoute = validHttps(candidate.nigeria.brandAuthorizationEvidenceUrl) && offers.length >= 1;
  if (!tierARoute && !brandRoute) blockers.push('nigeria-market-route-insufficient');
  return blockers;
}

function rightsBlockers(candidate: CatalogueIntakeCandidate): CatalogueIntakeBlocker[] {
  const blockers: CatalogueIntakeBlocker[] = [];
  if (candidate.asset.rightsStatus !== 'documented' || !candidate.asset.origin) blockers.push('asset-rights-missing');
  if (!validHttps(candidate.asset.rightsUrl) || !validHttps(candidate.asset.sourceUrl)) blockers.push('asset-rights-source-missing');
  return blockers;
}

function editorialBlockers(candidate: CatalogueIntakeCandidate): CatalogueIntakeBlocker[] {
  const blockers: CatalogueIntakeBlocker[] = [];
  if (!validHttps(candidate.asset.publicImageUrl)) blockers.push('asset-final-image-missing');
  if (!candidate.asset.publicImageSha256 || !hashPattern.test(candidate.asset.publicImageSha256)) blockers.push('asset-final-image-invalid');
  if (!Number.isInteger(candidate.asset.width) || !Number.isInteger(candidate.asset.height) || (candidate.asset.width ?? 0) < 1_600 || (candidate.asset.height ?? 0) < 1_600) blockers.push('asset-final-image-too-small');
  if (candidate.asset.backgroundTreatment === 'automated-removal') blockers.push('asset-automated-cutout');
  if (candidate.asset.packaging !== 'intact') blockers.push('asset-packaging-not-intact');
  if (
    candidate.asset.labelVariantSizeUnchanged !== true
    || candidate.asset.packagingInvented !== false
    || candidate.asset.manualSourceOutputQa !== true
  ) blockers.push('asset-identity-qa-missing');
  if (candidate.asset.presentationQuality !== 'magazine-ready') blockers.push('asset-not-magazine-ready');
  return blockers;
}

const actionForStage: Record<CatalogueIntakeStage, string> = {
  identity: 'Lock the exact GTIN, size and official product source.',
  care: 'Review the formula role and advisory boundaries from primary evidence.',
  nigeria: 'Verify regulation and fresh exact Nigerian product pages.',
  rights: 'Document permission or another valid image-rights basis.',
  editorial: 'Finish and manually compare the exact package in its final editorial image.',
  'approval-ready': 'Draft the identity-bound publication approval.',
};

export function evaluateCatalogueIntakeCandidate(candidate: CatalogueIntakeCandidate, asOf = Date.now()): CatalogueIntakeDecision {
  const freshExactOffers = candidate.nigeria.exactOffers.filter(offer => offerMatches(candidate, offer, asOf));
  const groups: Array<[Exclude<CatalogueIntakeStage, 'approval-ready'>, CatalogueIntakeBlocker[]]> = [
    ['identity', identityBlockers(candidate, asOf)],
    ['care', careBlockers(candidate, asOf)],
    ['nigeria', nigeriaBlockers(candidate, freshExactOffers)],
    ['rights', rightsBlockers(candidate)],
    ['editorial', editorialBlockers(candidate)],
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
  };
}

export function auditCatalogueIntakeManifest(manifest: CatalogueIntakeManifest, asOf = Date.now()) {
  if (manifest.schemaVersion !== catalogueIntakeSchemaVersion) throw new Error('Unsupported catalogue intake schema.');
  if (!validPastDate(manifest.updatedAt, asOf)) throw new Error('Catalogue intake timestamp is invalid or in the future.');
  const ids = new Set<string>();
  const gtins = new Set<string>();
  for (const candidate of manifest.candidates) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.id)) throw new Error(`Invalid catalogue intake id: ${candidate.id}`);
    if (ids.has(candidate.id)) throw new Error(`Duplicate catalogue intake id: ${candidate.id}`);
    ids.add(candidate.id);
    if (candidate.identity.gtin) {
      if (gtins.has(candidate.identity.gtin)) throw new Error(`Duplicate catalogue intake GTIN: ${candidate.identity.gtin}`);
      gtins.add(candidate.identity.gtin);
    }
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
  }
  return manifest.candidates.map(candidate => evaluateCatalogueIntakeCandidate(candidate, asOf));
}

export function rankCatalogueIntake(decisions: readonly CatalogueIntakeDecision[]) {
  return [...decisions].sort((left, right) => (
    priorityOrder[left.candidate.priority] - priorityOrder[right.candidate.priority]
    || stageProgress[right.stage] - stageProgress[left.stage]
    || right.candidate.gapIds.length - left.candidate.gapIds.length
    || left.candidate.id.localeCompare(right.candidate.id)
  ));
}
