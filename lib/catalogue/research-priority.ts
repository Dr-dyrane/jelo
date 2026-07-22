import { createHash } from 'node:crypto';
import {
  auditCatalogueDiscoverySnapshot,
  type CatalogueDiscoverySnapshot,
  type ScreenedDiscoveryCandidate,
} from './discovery-screening';

export const catalogueResearchQueueSchemaVersion = 1 as const;
export const catalogueResearchQueuePolicy = 'private-research-only' as const;
export const catalogueResearchSelectionPolicy = 'clinical-utility-traceability-v1' as const;

export type CatalogueResearchLane =
  | 'sun-protection'
  | 'gentle-cleansing'
  | 'moisture-barrier'
  | 'acne-care'
  | 'pigment-support'
  | 'hair-scalp'
  | 'body-care';

export type CatalogueResearchCaution =
  | 'retailer-code-unverified'
  | 'single-retailer-observation'
  | 'claim-language-review'
  | 'abrasive-or-peel-review'
  | 'all-observations-out-of-stock';

export type CatalogueResearchReason =
  | 'directory-retailer-observed'
  | 'multi-retailer-observed'
  | 'gtin-shaped-identity-lead'
  | 'current-stock-observed'
  | 'high-consumer-utility'
  | 'formula-or-active-visible';

export type CatalogueResearchQueueItem = {
  rank: number;
  discoveryId: string;
  title: string;
  brandHint: string;
  size: string;
  categoryHint: ScreenedDiscoveryCandidate['categoryHint'];
  lane: CatalogueResearchLane;
  priorityScore: number;
  retailerObservationCount: number;
  directoryRetailerCount: number;
  identityLead?: string;
  identityLeadStatus: 'unverified-retailer-code' | 'missing';
  reasons: CatalogueResearchReason[];
  cautions: CatalogueResearchCaution[];
  nextAction: 'confirm-official-manufacturer-identity' | 'find-official-manufacturer-identity';
  publicationStatus: 'private-research-only';
};

export type CatalogueResearchQueue = {
  schemaVersion: typeof catalogueResearchQueueSchemaVersion;
  generatedAt: string;
  policy: typeof catalogueResearchQueuePolicy;
  selectionPolicy: typeof catalogueResearchSelectionPolicy;
  sourceSnapshot: {
    schemaVersion: number;
    generatedAt: string;
    sha256: string;
    selectedCount: number;
  };
  targetCount: number;
  selectedCount: number;
  laneTargets: Record<CatalogueResearchLane, number>;
  laneCounts: Record<CatalogueResearchLane, number>;
  items: CatalogueResearchQueueItem[];
};

export type KnownCatalogueIdentity = { brand: string; name: string; size: string };

const laneTargets: Record<CatalogueResearchLane, number> = {
  'sun-protection': 6,
  'gentle-cleansing': 8,
  'moisture-barrier': 10,
  'acne-care': 8,
  'pigment-support': 6,
  'hair-scalp': 6,
  'body-care': 4,
};

const laneWeight: Record<CatalogueResearchLane, number> = {
  'sun-protection': 32,
  'acne-care': 30,
  'gentle-cleansing': 26,
  'moisture-barrier': 24,
  'pigment-support': 20,
  'hair-scalp': 18,
  'body-care': 12,
};

const activePattern = /\b(adapalene|azelaic|benzoyl peroxide|ceramide|glycolic|lactic acid|niacinamide|retinol|salicylic|sulfur|sulphur|tranexamic|txa|urea|vitamin c)\b/i;
const claimReviewPattern = /\b(bleach|bleaching|intimate|lighten(?:ing)?|platinum white|tone white|white(?:n|ning)?|whitening)\b/i;
const abrasivePattern = /\b(peel|scrub)\b/i;

function laneFor(candidate: ScreenedDiscoveryCandidate): CatalogueResearchLane | undefined {
  const title = candidate.title;
  if (!['Face care', 'Hair & scalp', 'Body care'].includes(candidate.categoryHint)) return undefined;
  if (candidate.categoryHint === 'Hair & scalp') {
    return /\b(conditioner|hair (?:cream|mask|oil|serum|treatment)|scalp|shampoo)\b/i.test(title)
      ? 'hair-scalp'
      : undefined;
  }
  if (/\b(sun ?screen|sunblock|sun protection|spf\s*\d|sun gel|uv protection)\b/i.test(title)) return 'sun-protection';
  if (/\b(acne|adapalene|azelaic|benzoyl peroxide|blemish|salicylic)\b/i.test(title)) return 'acne-care';
  if (candidate.categoryHint === 'Face care' && /\b(cleanser|cleansing|face wash|facial wash)\b/i.test(title)) return 'gentle-cleansing';
  if (/\b(balm|body butter|cream|gel cream|lotion|moisturi[sz](?:er|ing)?)\b/i.test(title)) return 'moisture-barrier';
  if (/\b(alpha arbutin|dark spot|hyperpigment|niacinamide|tranexamic|txa|vitamin c)\b/i.test(title)) return 'pigment-support';
  return candidate.categoryHint === 'Body care' ? 'body-care' : undefined;
}

function normalized(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function alreadyKnown(candidate: ScreenedDiscoveryCandidate, identities: readonly KnownCatalogueIdentity[]) {
  const brand = normalized(candidate.brandHint);
  const title = normalized(candidate.title);
  const titleTokens = new Set(title.split(' '));
  const size = normalized(candidate.size).replace(/(\d)\s+(?=[a-z])/g, '$1');
  return identities.some(identity => (
    normalized(identity.brand) === brand
    && normalized(identity.name).split(' ').every(token => titleTokens.has(token))
    && size.includes(normalized(identity.size).replace(/(\d)\s+(?=[a-z])/g, '$1'))
  ));
}

function researchPriority(candidate: ScreenedDiscoveryCandidate) {
  const lane = laneFor(candidate);
  if (!lane) return undefined;
  const directoryRetailerCount = candidate.retailerObservations.filter(
    observation => observation.retailerStatus === 'directory-listed',
  ).length;
  if (!directoryRetailerCount) return undefined;
  const reasons: CatalogueResearchReason[] = ['directory-retailer-observed', 'high-consumer-utility'];
  const cautions: CatalogueResearchCaution[] = [];
  const retailerCount = new Set(candidate.retailerObservations.map(observation => observation.retailer)).size;
  const hasCurrentStock = candidate.retailerObservations.some(
    observation => observation.stock === 'in-stock' || observation.stock === 'low-stock',
  );
  let priorityScore = candidate.score + laneWeight[lane];

  if (retailerCount > 1) {
    priorityScore += 18;
    reasons.push('multi-retailer-observed');
  } else cautions.push('single-retailer-observation');
  if (candidate.retailerGtinHint) {
    priorityScore += 12;
    reasons.push('gtin-shaped-identity-lead');
    cautions.push('retailer-code-unverified');
  }
  if (hasCurrentStock) {
    priorityScore += 8;
    reasons.push('current-stock-observed');
  } else cautions.push('all-observations-out-of-stock');
  if (activePattern.test(candidate.title)) {
    priorityScore += 10;
    reasons.push('formula-or-active-visible');
  }
  if (claimReviewPattern.test(candidate.title)) {
    priorityScore -= 60;
    cautions.push('claim-language-review');
  }
  if (abrasivePattern.test(candidate.title)) {
    priorityScore -= 8;
    cautions.push('abrasive-or-peel-review');
  }

  return { candidate, lane, priorityScore, directoryRetailerCount, retailerCount, reasons, cautions };
}

type RankedCandidate = NonNullable<ReturnType<typeof researchPriority>>;

function compareRanked(left: RankedCandidate, right: RankedCandidate) {
  return right.priorityScore - left.priorityScore
    || right.directoryRetailerCount - left.directoryRetailerCount
    || right.retailerCount - left.retailerCount
    || left.candidate.brandHint.localeCompare(right.candidate.brandHint)
    || left.candidate.title.localeCompare(right.candidate.title)
    || left.candidate.discoveryId.localeCompare(right.candidate.discoveryId);
}

function selectedResearchCandidates(
  snapshot: CatalogueDiscoverySnapshot,
  targetCount: number,
  knownIdentities: readonly KnownCatalogueIdentity[],
) {
  const ranked = snapshot.candidates.filter(candidate => !alreadyKnown(candidate, knownIdentities)).flatMap(candidate => {
    const priority = researchPriority(candidate);
    return priority ? [priority] : [];
  }).sort(compareRanked);
  const selectedIds = new Set<string>();
  const selected: RankedCandidate[] = [];
  const brandCounts = new Map<string, number>();

  function take(candidate: RankedCandidate) {
    if (selectedIds.has(candidate.candidate.discoveryId)) return false;
    const brandKey = candidate.candidate.brandHint.trim().toLowerCase();
    if ((brandCounts.get(brandKey) ?? 0) >= 3) return false;
    selectedIds.add(candidate.candidate.discoveryId);
    brandCounts.set(brandKey, (brandCounts.get(brandKey) ?? 0) + 1);
    selected.push(candidate);
    return true;
  }

  for (const [lane, target] of Object.entries(laneTargets) as Array<[CatalogueResearchLane, number]>) {
    let laneCount = 0;
    for (const candidate of ranked) {
      if (candidate.lane !== lane) continue;
      if (take(candidate)) laneCount += 1;
      if (laneCount >= target) break;
    }
  }
  for (const candidate of ranked) {
    if (selected.length >= targetCount) break;
    take(candidate);
  }
  return selected.slice(0, targetCount).sort(compareRanked);
}

export function buildCatalogueResearchQueue(
  snapshot: CatalogueDiscoverySnapshot,
  sourceSnapshotSha256: string,
  targetCount = 48,
  knownIdentities: readonly KnownCatalogueIdentity[] = [],
): CatalogueResearchQueue {
  auditCatalogueDiscoverySnapshot(snapshot);
  if (!/^[0-9a-f]{64}$/.test(sourceSnapshotSha256)) throw new Error('Research queue source digest is invalid.');
  if (!Number.isSafeInteger(targetCount) || targetCount <= 0) throw new Error('Research queue target must be positive.');
  const selected = selectedResearchCandidates(snapshot, targetCount, knownIdentities);
  const items = selected.map((entry, index): CatalogueResearchQueueItem => ({
    rank: index + 1,
    discoveryId: entry.candidate.discoveryId,
    title: entry.candidate.title,
    brandHint: entry.candidate.brandHint,
    size: entry.candidate.size,
    categoryHint: entry.candidate.categoryHint,
    lane: entry.lane,
    priorityScore: entry.priorityScore,
    retailerObservationCount: entry.candidate.retailerObservations.length,
    directoryRetailerCount: entry.directoryRetailerCount,
    ...(entry.candidate.retailerGtinHint ? { identityLead: entry.candidate.retailerGtinHint } : {}),
    identityLeadStatus: entry.candidate.retailerGtinHint ? 'unverified-retailer-code' : 'missing',
    reasons: entry.reasons,
    cautions: entry.cautions,
    nextAction: entry.candidate.retailerGtinHint
      ? 'confirm-official-manufacturer-identity'
      : 'find-official-manufacturer-identity',
    publicationStatus: 'private-research-only',
  }));
  const laneCounts = Object.fromEntries(Object.keys(laneTargets).map(lane => [
    lane,
    items.filter(item => item.lane === lane).length,
  ])) as Record<CatalogueResearchLane, number>;
  return {
    schemaVersion: catalogueResearchQueueSchemaVersion,
    generatedAt: snapshot.generatedAt,
    policy: catalogueResearchQueuePolicy,
    selectionPolicy: catalogueResearchSelectionPolicy,
    sourceSnapshot: {
      schemaVersion: snapshot.schemaVersion,
      generatedAt: snapshot.generatedAt,
      sha256: sourceSnapshotSha256,
      selectedCount: snapshot.selectedCount,
    },
    targetCount,
    selectedCount: items.length,
    laneTargets,
    laneCounts,
    items,
  };
}

export function catalogueResearchQueueDigest(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}
