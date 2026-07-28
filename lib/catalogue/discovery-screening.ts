import { createHash } from 'node:crypto';
import { canonicalGtin, isValidGtin } from './gtin';
import type { CatalogueDiscoverySource } from '@/data/catalogue-discovery-sources';

export const catalogueDiscoverySnapshotSchemaVersion = 1 as const;

export type WooStoreProduct = {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  sku?: string;
  prices?: {
    price?: string;
    currency_code?: string;
    currency_minor_unit?: number;
  };
  stock_availability?: { text?: string; class?: string };
  is_in_stock?: boolean;
  low_stock_remaining?: number | null;
  images?: Array<{ src?: string; thumbnail?: string; name?: string; alt?: string }>;
  brands?: Array<{ name?: string; slug?: string }>;
  categories?: Array<{ name?: string; slug?: string }>;
};

export type DiscoveryResponseEvidence = {
  id: string;
  retailer: string;
  requestedUrl: string;
  responseUrl: string;
  retrievedAt: string;
  responseSha256: string;
  responseByteSize: number;
  responseMimeType: 'application/json';
  page: number;
  recordCount: number;
};

export type DiscoveryProductInput = {
  source: CatalogueDiscoverySource;
  product: WooStoreProduct;
  observedAt: string;
  responseEvidenceId: string;
};

export type DiscoveryRetailerObservation = {
  retailer: string;
  retailerStatus: CatalogueDiscoverySource['reviewStatus'];
  listingUrl: string;
  /**
   * Retailer-owned Woo record identity. This is a retrieval locator only and
   * can never satisfy manufacturer product identity.
   */
  sourceProductId?: number;
  sourceProductApiUrl?: string;
  observedAt: string;
  observedTitle: string;
  observedSize: string;
  priceNgn: number;
  stock: 'in-stock' | 'low-stock' | 'out-of-stock' | 'unknown';
  retailerSku?: string;
  retailerSkuShape: 'valid-gtin-shaped' | 'other' | 'missing';
  imageUrl?: string;
  responseEvidenceId: string;
};

export type ScreenedDiscoveryCandidate = {
  discoveryId: string;
  title: string;
  brandHint: string;
  brandHintBasis: 'retailer-brand' | 'retailer-category' | 'title-prefix';
  size: string;
  categoryHint: 'Face care' | 'Hair & scalp' | 'Body care' | 'Makeup' | 'Fragrance' | 'Personal care';
  identityStatus: 'unverified-retailer-lead';
  retailerGtinHint?: string;
  retailerGtinHintWarning?: 'retailer-sku-is-not-manufacturer-identity';
  careStatus: 'not-reviewed';
  regulatoryStatus: 'not-researched';
  imageStatus: 'source-url-unreviewed' | 'missing';
  publicationStatus: 'private-discovery-only';
  score: number;
  nextAction: 'confirm-official-identity' | 'find-manufacturer-gtin';
  retailerObservations: DiscoveryRetailerObservation[];
};

export type CatalogueDiscoverySnapshot = {
  schemaVersion: typeof catalogueDiscoverySnapshotSchemaVersion;
  generatedAt: string;
  policy: 'private-discovery-only';
  targetCount: number;
  selectionPolicy: 'quality-first-category-balanced';
  categoryTargets: Record<ScreenedDiscoveryCandidate['categoryHint'], number>;
  categoryCounts: Record<ScreenedDiscoveryCandidate['categoryHint'], number>;
  sourceProductCount: number;
  eligibleCandidateCount: number;
  selectedCount: number;
  targetDeficit: number;
  rejected: Record<string, number>;
  sourceResponses: DiscoveryResponseEvidence[];
  candidates: ScreenedDiscoveryCandidate[];
};

type CandidateSeed = ScreenedDiscoveryCandidate & { groupingKey: string };

const genericCategories = new Set([
  'all products', 'bath and body', 'body', 'face', 'hair care', 'make up', 'makeup', 'personal care',
  'serum', 'skincare', 'skin care', 'uncategorized',
]);

const categoryRules: Array<[ScreenedDiscoveryCandidate['categoryHint'], RegExp]> = [
  ['Hair & scalp', /\b(hair|scalp|shampoo|conditioner|edge control|wig|braid|locs?|curl|relaxer)\b/i],
  ['Makeup', /\b(make[ -]?up|foundation|concealer|lipstick|lip gloss|eyeliner|mascara|blush|powder|eyeshadow)\b/i],
  ['Fragrance', /\b(fragrance|perfume|parfum|cologne|eau de|body mist)\b/i],
  ['Personal care', /\b(deodorant|antiperspirant|toothpaste|mouthwash|intimate|sanitary|baby|hand sanitizer)\b/i],
  ['Face care', /\b(face|facial|serum|toner|essence|cleanser|sunscreen|sun screen|spf|acne|moisturi[sz]er|eye cream)\b/i],
  ['Body care', /\b(body|lotion|body wash|shower|soap|scrub|body oil|hand cream|foot cream)\b/i],
];

const categoryWeights: Record<ScreenedDiscoveryCandidate['categoryHint'], number> = {
  'Face care': 0.35,
  'Hair & scalp': 0.2,
  'Body care': 0.2,
  'Personal care': 0.1,
  Makeup: 0.1,
  Fragrance: 0.05,
};
const categoryNames = Object.keys(categoryWeights) as ScreenedDiscoveryCandidate['categoryHint'][];
const hashPattern = /^[0-9a-f]{64}$/;
const discoveryIdPattern = /^[0-9a-f]{24}$/;

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8217;|&rsquo;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalized(value: string) {
  return decodeHtml(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function hostKey(value: string) {
  return value.toLowerCase().replace(/^www\./, '');
}

function exactProductUrl(value: unknown, source: CatalogueDiscoverySource) {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || hostKey(url.hostname) !== hostKey(source.host) || !url.pathname.includes('/product/')) return undefined;
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

function exactProductApiUrl(source: CatalogueDiscoverySource, productId: number) {
  if (!Number.isSafeInteger(productId) || productId <= 0) return undefined;
  const url = new URL(source.endpoint);
  url.search = '';
  url.hash = '';
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/${productId}`;
  return url.toString();
}

function measuredSize(value: string) {
  const matches = Array.from(decodeHtml(value).matchAll(
    /\b\d+(?:[.,]\d+)?\s*(?:fl\.?\s*oz|ml|cl|l|mg|kg|g|oz|count|pcs?|pieces?|pack)\b/gi,
  )).map(match => match[0].replace(/\s+/g, ' ').trim());
  return Array.from(new Set(matches.map(match => match.toLowerCase()))).join(' / ');
}

function priceNgn(product: WooStoreProduct) {
  if (product.prices?.currency_code !== 'NGN' || typeof product.prices.price !== 'string') return undefined;
  const raw = Number(product.prices.price);
  const minorUnit = product.prices.currency_minor_unit ?? 0;
  if (!Number.isSafeInteger(raw) || raw <= 0 || !Number.isInteger(minorUnit) || minorUnit < 0 || minorUnit > 2) return undefined;
  const price = raw / 10 ** minorUnit;
  return Number.isSafeInteger(price) && price > 0 ? price : undefined;
}

function stockState(product: WooStoreProduct): DiscoveryRetailerObservation['stock'] {
  const value = `${product.stock_availability?.class ?? ''} ${product.stock_availability?.text ?? ''}`.toLowerCase();
  if (/out[ -]?of[ -]?stock|sold out|unavailable/.test(value) || product.is_in_stock === false) return 'out-of-stock';
  if (/low[ -]?stock|only\s+\d+\s+left/.test(value) || (product.low_stock_remaining ?? 0) > 0) return 'low-stock';
  if (/in[ -]?stock|available/.test(value) || product.is_in_stock === true) return 'in-stock';
  return 'unknown';
}

function validImageUrl(product: WooStoreProduct) {
  const value = product.images?.find(image => image.src)?.src;
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function categoryHint(product: WooStoreProduct, title: string) {
  if (/\b(hair removal|depilatory)\b/i.test(title)) return 'Body care' as const;
  if (/\b(body wash|body lotion|body gel|body oil|body cream|hand cream|foot cream|shower gel|bar soap|body scrub)\b/i.test(title)) {
    return 'Body care' as const;
  }
  const titleMatch = categoryRules.find(([, rule]) => rule.test(title))?.[0];
  if (titleMatch) return titleMatch;
  const categoryContext = (product.categories ?? []).map(category => decodeHtml(category.name ?? '')).join(' ');
  return categoryRules.find(([, rule]) => rule.test(categoryContext))?.[0];
}

function titleBrandPrefix(title: string) {
  const words = decodeHtml(title).split(/\s+/).filter(Boolean);
  if (!words.length) return undefined;
  const first = words[0].replace(/[^\p{L}\p{N}&.'-]/gu, '');
  if (!first || /^the$/i.test(first) && words.length < 2) return undefined;
  return /^the$/i.test(first) ? `The ${words[1]}` : first;
}

function brandHint(product: WooStoreProduct, title: string) {
  const explicit = product.brands?.map(brand => decodeHtml(brand.name ?? '')).find(Boolean);
  if (explicit) return { value: explicit, basis: 'retailer-brand' as const };

  const category = product.categories
    ?.map(item => decodeHtml(item.name ?? ''))
    .find(item => item && !genericCategories.has(normalized(item)) && normalized(title).startsWith(normalized(item)));
  if (category) return { value: category, basis: 'retailer-category' as const };

  const prefix = titleBrandPrefix(title);
  return prefix ? { value: prefix, basis: 'title-prefix' as const } : undefined;
}

function skuShape(value: string | undefined) {
  if (!value?.trim()) return { shape: 'missing' as const };
  const digits = value.replace(/\s/g, '');
  if (isValidGtin(digits)) return { shape: 'valid-gtin-shaped' as const, gtin: canonicalGtin(digits) };
  return { shape: 'other' as const };
}

function candidateId(groupingKey: string) {
  return createHash('sha256').update(`jelocare-private-discovery-v1\n${groupingKey}\n`).digest('hex').slice(0, 24);
}

function scoreCandidate(seed: Omit<CandidateSeed, 'score'>) {
  const observations = seed.retailerObservations;
  const directoryCount = observations.filter(item => item.retailerStatus === 'directory-listed').length;
  const retailerCount = new Set(observations.map(item => item.retailer)).size;
  let score = 35;
  if (seed.retailerGtinHint) score += 25;
  if (seed.brandHintBasis === 'retailer-brand') score += 12;
  else if (seed.brandHintBasis === 'retailer-category') score += 8;
  else score += 3;
  score += Math.min(directoryCount * 10, 20);
  score += Math.min(Math.max(retailerCount - 1, 0) * 12, 24);
  if (observations.some(item => item.stock === 'in-stock' || item.stock === 'low-stock')) score += 10;
  if (observations.some(item => item.imageUrl)) score += 8;
  return score;
}

export function screenDiscoveryProduct(input: DiscoveryProductInput): { seed?: CandidateSeed; rejection?: string } {
  const title = decodeHtml(input.product.name ?? '');
  if (title.length < 3) return { rejection: 'title-missing' };
  const listingUrl = exactProductUrl(input.product.permalink, input.source);
  if (!listingUrl) return { rejection: 'product-route-invalid' };
  const sourceProductApiUrl = exactProductApiUrl(input.source, input.product.id);
  if (!sourceProductApiUrl) return { rejection: 'source-product-id-invalid' };
  const size = measuredSize(title);
  if (!size) return { rejection: 'size-missing' };
  const price = priceNgn(input.product);
  if (price == null) return { rejection: 'ngn-price-missing' };
  const category = categoryHint(input.product, title);
  if (!category) return { rejection: 'category-unclassified' };
  const brand = brandHint(input.product, title);
  if (!brand) return { rejection: 'brand-hint-missing' };

  const sku = input.product.sku?.trim() || undefined;
  const shaped = skuShape(sku);
  const imageUrl = validImageUrl(input.product);
  const observation: DiscoveryRetailerObservation = {
    retailer: input.source.retailer,
    retailerStatus: input.source.reviewStatus,
    listingUrl,
    sourceProductId: input.product.id,
    sourceProductApiUrl,
    observedAt: input.observedAt,
    observedTitle: title,
    observedSize: size,
    priceNgn: price,
    stock: stockState(input.product),
    ...(sku ? { retailerSku: sku } : {}),
    retailerSkuShape: shaped.shape,
    ...(imageUrl ? { imageUrl } : {}),
    responseEvidenceId: input.responseEvidenceId,
  };
  const groupingKey = shaped.gtin
    ? `retailer-gtin-shape:${shaped.gtin}`
    : `title-size:${normalized(title)}|${normalized(size)}`;
  const withoutScore: Omit<CandidateSeed, 'score'> = {
    groupingKey,
    discoveryId: candidateId(groupingKey),
    title,
    brandHint: brand.value,
    brandHintBasis: brand.basis,
    size,
    categoryHint: category,
    identityStatus: 'unverified-retailer-lead',
    ...(shaped.gtin ? {
      retailerGtinHint: shaped.gtin,
      retailerGtinHintWarning: 'retailer-sku-is-not-manufacturer-identity' as const,
    } : {}),
    careStatus: 'not-reviewed',
    regulatoryStatus: 'not-researched',
    imageStatus: imageUrl ? 'source-url-unreviewed' : 'missing',
    publicationStatus: 'private-discovery-only',
    nextAction: shaped.gtin ? 'confirm-official-identity' : 'find-manufacturer-gtin',
    retailerObservations: [observation],
  };
  return { seed: { ...withoutScore, score: scoreCandidate(withoutScore) } };
}

function mergeSeed(existing: CandidateSeed, incoming: CandidateSeed) {
  const observations = new Map(existing.retailerObservations.map(item => [`${item.retailer}|${item.listingUrl}`, item]));
  for (const item of incoming.retailerObservations) observations.set(`${item.retailer}|${item.listingUrl}`, item);
  const retailerObservations = Array.from(observations.values()).sort((left, right) =>
    left.retailer.localeCompare(right.retailer) || left.listingUrl.localeCompare(right.listingUrl));
  const imageStatus = retailerObservations.some(item => item.imageUrl) ? 'source-url-unreviewed' as const : 'missing' as const;
  const withoutScore = { ...existing, retailerObservations, imageStatus };
  return { ...withoutScore, score: scoreCandidate(withoutScore) };
}

export function buildCatalogueDiscoverySnapshot(input: {
  products: DiscoveryProductInput[];
  sourceResponses: DiscoveryResponseEvidence[];
  generatedAt: string;
  targetCount: number;
}): CatalogueDiscoverySnapshot {
  if (!Number.isSafeInteger(input.targetCount) || input.targetCount <= 0) throw new Error('Discovery target must be a positive integer.');
  if (!Number.isFinite(Date.parse(input.generatedAt))) throw new Error('Discovery generation time is invalid.');

  const rejected: Record<string, number> = {};
  const grouped = new Map<string, CandidateSeed>();
  for (const product of input.products) {
    const result = screenDiscoveryProduct(product);
    if (!result.seed) {
      const reason = result.rejection ?? 'unknown';
      rejected[reason] = (rejected[reason] ?? 0) + 1;
      continue;
    }
    const current = grouped.get(result.seed.groupingKey);
    grouped.set(result.seed.groupingKey, current ? mergeSeed(current, result.seed) : result.seed);
  }

  const eligible = Array.from(grouped.values()).sort((left, right) =>
    right.score - left.score
    || right.retailerObservations.length - left.retailerObservations.length
    || left.title.localeCompare(right.title)
    || left.discoveryId.localeCompare(right.discoveryId));
  const categoryTargets = Object.fromEntries(Object.entries(categoryWeights).map(([category, weight]) => [
    category,
    Math.floor(input.targetCount * weight),
  ])) as Record<ScreenedDiscoveryCandidate['categoryHint'], number>;
  const selectedIds = new Set<string>();
  const balanced: CandidateSeed[] = [];
  for (const [category, target] of Object.entries(categoryTargets) as Array<[
    ScreenedDiscoveryCandidate['categoryHint'],
    number,
  ]>) {
    for (const candidate of eligible) {
      if (candidate.categoryHint !== category || selectedIds.has(candidate.discoveryId)) continue;
      selectedIds.add(candidate.discoveryId);
      balanced.push(candidate);
      if (balanced.filter(item => item.categoryHint === category).length >= target) break;
    }
  }
  for (const candidate of eligible) {
    if (balanced.length >= input.targetCount) break;
    if (selectedIds.has(candidate.discoveryId)) continue;
    selectedIds.add(candidate.discoveryId);
    balanced.push(candidate);
  }
  balanced.sort((left, right) =>
    right.score - left.score
    || right.retailerObservations.length - left.retailerObservations.length
    || left.title.localeCompare(right.title)
    || left.discoveryId.localeCompare(right.discoveryId));
  const candidates = balanced.slice(0, input.targetCount).map(({ groupingKey, ...candidate }) => {
    if (!groupingKey) throw new Error('Discovery grouping key is missing.');
    return candidate;
  });
  const categoryCounts = Object.fromEntries(Object.keys(categoryWeights).map(category => [
    category,
    candidates.filter(candidate => candidate.categoryHint === category).length,
  ])) as Record<ScreenedDiscoveryCandidate['categoryHint'], number>;
  const sourceResponses = [...input.sourceResponses].sort((left, right) =>
    left.retailer.localeCompare(right.retailer) || left.page - right.page);

  return {
    schemaVersion: catalogueDiscoverySnapshotSchemaVersion,
    generatedAt: input.generatedAt,
    policy: 'private-discovery-only',
    targetCount: input.targetCount,
    selectionPolicy: 'quality-first-category-balanced',
    categoryTargets,
    categoryCounts,
    sourceProductCount: input.products.length,
    eligibleCandidateCount: eligible.length,
    selectedCount: candidates.length,
    targetDeficit: Math.max(input.targetCount - candidates.length, 0),
    rejected: Object.fromEntries(Object.entries(rejected).sort(([left], [right]) => left.localeCompare(right))),
    sourceResponses,
    candidates,
  };
}

function objectRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function validPastDate(value: unknown, asOf: number) {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= asOf + 5 * 60_000;
}

function sameUrl(left: string, right: string) {
  try {
    return new URL(left).href === new URL(right).href;
  } catch {
    return false;
  }
}

export function auditCatalogueDiscoverySnapshot(value: unknown) {
  if (!objectRecord(value)) throw new Error('Discovery snapshot must be an object.');
  const snapshot = value as unknown as CatalogueDiscoverySnapshot;
  const generatedAt = Date.parse(snapshot.generatedAt);
  if (
    snapshot.schemaVersion !== catalogueDiscoverySnapshotSchemaVersion
    || snapshot.policy !== 'private-discovery-only'
    || snapshot.selectionPolicy !== 'quality-first-category-balanced'
    || !Number.isFinite(generatedAt)
    || !Number.isSafeInteger(snapshot.targetCount)
    || snapshot.targetCount <= 0
    || !Number.isSafeInteger(snapshot.sourceProductCount)
    || snapshot.sourceProductCount < 0
    || !Number.isSafeInteger(snapshot.eligibleCandidateCount)
    || snapshot.eligibleCandidateCount < 0
    || !Number.isSafeInteger(snapshot.selectedCount)
    || snapshot.selectedCount < 0
    || !Number.isSafeInteger(snapshot.targetDeficit)
    || snapshot.targetDeficit !== Math.max(snapshot.targetCount - snapshot.selectedCount, 0)
    || !Array.isArray(snapshot.sourceResponses)
    || !Array.isArray(snapshot.candidates)
    || snapshot.selectedCount !== snapshot.candidates.length
    || snapshot.selectedCount > snapshot.targetCount
    || snapshot.eligibleCandidateCount < snapshot.selectedCount
    || snapshot.sourceProductCount < snapshot.eligibleCandidateCount
    || !objectRecord(snapshot.rejected)
    || !objectRecord(snapshot.categoryTargets)
    || !objectRecord(snapshot.categoryCounts)
  ) throw new Error('Discovery snapshot summary is invalid.');

  for (const [reason, count] of Object.entries(snapshot.rejected)) {
    if (!reason.trim() || !Number.isSafeInteger(count) || count < 0) throw new Error('Discovery rejection summary is invalid.');
  }
  const responseById = new Map<string, DiscoveryResponseEvidence>();
  for (const response of snapshot.sourceResponses) {
    if (
      !response
      || typeof response.id !== 'string'
      || !discoveryIdPattern.test(response.id)
      || responseById.has(response.id)
      || typeof response.retailer !== 'string'
      || response.retailer.trim().length < 2
      || typeof response.requestedUrl !== 'string'
      || typeof response.responseUrl !== 'string'
      || !sameUrl(response.requestedUrl, response.responseUrl)
      || new URL(response.requestedUrl).protocol !== 'https:'
      || !validPastDate(response.retrievedAt, generatedAt)
      || !hashPattern.test(response.responseSha256)
      || !Number.isSafeInteger(response.responseByteSize)
      || response.responseByteSize <= 0
      || response.responseMimeType !== 'application/json'
      || !Number.isSafeInteger(response.page)
      || response.page <= 0
      || !Number.isSafeInteger(response.recordCount)
      || response.recordCount < 0
      || response.recordCount > pageSizeForAudit
    ) throw new Error('Discovery response evidence is invalid.');
    responseById.set(response.id, response);
  }
  if (!responseById.size && snapshot.sourceProductCount > 0) throw new Error('Discovery response evidence is missing.');

  const ids = new Set<string>();
  for (const candidate of snapshot.candidates) {
    if (
      !candidate
      || !discoveryIdPattern.test(candidate.discoveryId)
      || ids.has(candidate.discoveryId)
      || typeof candidate.title !== 'string'
      || candidate.title.trim().length < 3
      || typeof candidate.brandHint !== 'string'
      || candidate.brandHint.trim().length < 1
      || !['retailer-brand', 'retailer-category', 'title-prefix'].includes(candidate.brandHintBasis)
      || typeof candidate.size !== 'string'
      || !measuredSize(candidate.size)
      || !categoryNames.includes(candidate.categoryHint)
      || candidate.identityStatus !== 'unverified-retailer-lead'
      || candidate.careStatus !== 'not-reviewed'
      || candidate.regulatoryStatus !== 'not-researched'
      || !['source-url-unreviewed', 'missing'].includes(candidate.imageStatus)
      || candidate.publicationStatus !== 'private-discovery-only'
      || !Number.isSafeInteger(candidate.score)
      || candidate.score <= 0
      || !Array.isArray(candidate.retailerObservations)
      || !candidate.retailerObservations.length
    ) throw new Error('Discovery candidate is invalid.');
    ids.add(candidate.discoveryId);

    const observationKeys = new Set<string>();
    let hasGtinShapedObservation = false;
    let hasImage = false;
    for (const observation of candidate.retailerObservations) {
      const response = responseById.get(observation.responseEvidenceId);
      let listing: URL;
      let source: URL;
      try {
        listing = new URL(observation.listingUrl);
        source = new URL(response?.requestedUrl ?? '');
      } catch {
        throw new Error('Discovery observation URL is invalid.');
      }
      const key = `${observation.retailer}\n${listing.href}`;
      const hasSourceProductId = observation.sourceProductId != null;
      const hasSourceProductApiUrl = observation.sourceProductApiUrl != null;
      let sourceProductApi: URL | undefined;
      if (hasSourceProductApiUrl) {
        try {
          sourceProductApi = new URL(observation.sourceProductApiUrl!);
        } catch {
          throw new Error('Discovery source product API URL is invalid.');
        }
      }
      if (
        !response
        || response.retailer !== observation.retailer
        || observationKeys.has(key)
        || !['directory-listed', 'provisional'].includes(observation.retailerStatus)
        || listing.protocol !== 'https:'
        || hostKey(listing.hostname) !== hostKey(source.hostname)
        || !listing.pathname.includes('/product/')
        || observation.observedAt !== response.retrievedAt
        || typeof observation.observedTitle !== 'string'
        || observation.observedTitle.trim().length < 3
        || typeof observation.observedSize !== 'string'
        || !measuredSize(observation.observedSize)
        || !Number.isSafeInteger(observation.priceNgn)
        || observation.priceNgn <= 0
        || !['in-stock', 'low-stock', 'out-of-stock', 'unknown'].includes(observation.stock)
        || !['valid-gtin-shaped', 'other', 'missing'].includes(observation.retailerSkuShape)
        || hasSourceProductId !== hasSourceProductApiUrl
        || (
          hasSourceProductId
          && (
            !Number.isSafeInteger(observation.sourceProductId)
            || observation.sourceProductId! <= 0
            || sourceProductApi?.protocol !== 'https:'
            || hostKey(sourceProductApi.hostname) !== hostKey(source.hostname)
            || sourceProductApi.search !== ''
            || sourceProductApi.hash !== ''
            || sourceProductApi.pathname
              !== `${source.pathname.replace(/\/+$/, '')}/${observation.sourceProductId}`
          )
        )
      ) throw new Error('Discovery retailer observation is invalid.');
      observationKeys.add(key);
      if (observation.imageUrl) {
        if (new URL(observation.imageUrl).protocol !== 'https:') throw new Error('Discovery image lead is not HTTPS.');
        hasImage = true;
      }
      if (observation.retailerSkuShape === 'valid-gtin-shaped') {
        if (!observation.retailerSku || !isValidGtin(observation.retailerSku.replace(/\s/g, ''))) {
          throw new Error('Discovery GTIN-shaped retailer field is invalid.');
        }
        hasGtinShapedObservation = true;
      }
    }
    if ((candidate.imageStatus === 'source-url-unreviewed') !== hasImage) throw new Error('Discovery image status is inconsistent.');
    if (candidate.retailerGtinHint) {
      if (
        !isValidGtin(candidate.retailerGtinHint)
        || candidate.retailerGtinHint !== canonicalGtin(candidate.retailerGtinHint)
        || candidate.retailerGtinHintWarning !== 'retailer-sku-is-not-manufacturer-identity'
        || candidate.nextAction !== 'confirm-official-identity'
        || !hasGtinShapedObservation
      ) throw new Error('Discovery retailer GTIN hint is overclaimed or invalid.');
    } else if (
      candidate.retailerGtinHintWarning !== undefined
      || candidate.nextAction !== 'find-manufacturer-gtin'
      || hasGtinShapedObservation
    ) throw new Error('Discovery identity next action is inconsistent.');
  }

  let counted = 0;
  for (const category of categoryNames) {
    const target = snapshot.categoryTargets[category];
    const count = snapshot.categoryCounts[category];
    const actual = snapshot.candidates.filter(candidate => candidate.categoryHint === category).length;
    if (!Number.isSafeInteger(target) || target < 0 || !Number.isSafeInteger(count) || count !== actual) {
      throw new Error('Discovery category accounting is invalid.');
    }
    counted += count;
  }
  if (counted !== snapshot.selectedCount) throw new Error('Discovery category totals do not match selection.');
  return {
    selectedCount: snapshot.selectedCount,
    sourceProductCount: snapshot.sourceProductCount,
    responseCount: snapshot.sourceResponses.length,
    categoryCounts: snapshot.categoryCounts,
  };
}

const pageSizeForAudit = 100;
