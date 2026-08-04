import type { Product } from '@/data/products';
import { summarizeMarket } from './market-summary';
import { compactPriceMovementLabel, type ProductPriceTrends } from './price-trends';
import { hasShareableNgOffer, isShareableNgOffer } from './shareable-offer';

// Honesty thresholds. Tunable, but deliberately conservative: a suggestion only
// appears when the evidence is strong enough that telling someone is genuinely
// useful. None of these rank by popularity or clicks, only by observed facts.
const GAP_MIN_NAIRA = 800; // absolute spread floor, so a trivial gap never surfaces
const GAP_MIN_FRACTION = 0.08; // spread must also be >= 8% of the lowest price
const GAP_LIMIT = 8;
const DROP_MIN_PERCENT = 4; // a notable drop sits well above the 0.5% flat band
const DROP_LIMIT = 6;
const FRESH_COMPARISON_LIMIT = 8;

export type ShareGap = {
  slug: string;
  brand: string;
  name: string;
  image: string;
  microtag: string; // "size · category"
  lowestNaira: number;
  spreadNaira: number;
  storeCount: number;
  observedAt: string | null;
};

export type ShareDrop = {
  slug: string;
  brand: string;
  name: string;
  image: string;
  microtag: string;
  amountNaira: number; // positive magnitude of the fall
  percent: number; // negative
  days: 7 | 30;
  lowestNaira: number | null;
  trendLabel: string;
  comparableStoreCount: number;
  observedAt: string;
};

export type AggregateProductInterest = ReadonlyMap<string, number>;

type ShareSignalRank = {
  tier: 1 | 2 | 3;
  evidence: readonly [number, number, number, number];
  aggregateInterest: number;
};

type ShareSignalBase = {
  slug: string;
  brand: string;
  name: string;
  image: string;
  microtag: string;
  category: Product['category'];
  lowestNaira: number;
  highestNaira: number;
  storeCount: number;
  observedAt: string | null;
  rank: ShareSignalRank;
};

export type ShareDropSignal = ShareSignalBase & {
  kind: 'drop';
  drop: ShareDrop;
  gap: null;
};

export type ShareGapSignal = ShareSignalBase & {
  kind: 'gap';
  drop: null;
  gap: ShareGap;
};

export type ShareFreshSignal = ShareSignalBase & {
  kind: 'fresh';
  drop: null;
  gap: null;
};

export type ShareSignal = ShareDropSignal | ShareGapSignal | ShareFreshSignal;

export type ShareSignalReadModel = {
  recentDrops: ShareDropSignal[];
  priceGaps: ShareGapSignal[];
  freshComparisons: ShareFreshSignal[];
  rankedPool: ShareSignal[];
  aggregateInterest: 'available' | 'unavailable';
};

const microtag = (product: Product) => `${product.size} · ${product.category}`;

/**
 * Pick products whose lowest and highest fresh, evidence-bound NG offers are far
 * enough apart to be worth telling someone about. A spread only exists when two
 * or more stores are compared (the spec's "Lowest observed" / "Median" case);
 * single-source offers never claim one. Ranks by spread, then store count.
 */
export function selectShareGaps(
  products: Product[],
  now: number | Date = Date.now(),
  limit = GAP_LIMIT,
): ShareGap[] {
  const gaps: ShareGap[] = [];

  for (const product of products) {
    if (!hasShareableNgOffer(product, now)) continue;
    const summary = summarizeMarket(product.offers, 'NG', now);
    if (summary.priceBasis !== 'multi-source' || summary.lowestPrice == null || summary.highestPrice == null) continue;
    const spread = summary.highestPrice - summary.lowestPrice;
    if (spread < GAP_MIN_NAIRA || spread < summary.lowestPrice * GAP_MIN_FRACTION) continue;

    gaps.push({
      slug: product.slug,
      brand: product.brand,
      name: product.name,
      image: product.image,
      microtag: microtag(product),
      lowestNaira: summary.lowestPrice,
      spreadNaira: spread,
      storeCount: summary.pricedRetailerCount,
      observedAt: summary.lastCheckedAt,
    });
  }

  return gaps
    .sort((a, b) => b.spreadNaira - a.spreadNaira || b.storeCount - a.storeCount)
    .slice(0, Math.max(0, limit));
}

/**
 * From products paired with their already-fetched price trends, keep the ones
 * whose observed NG price notably fell, ranked by the size of the fall. The
 * movement itself is produced by calculatePriceTrends, which already enforces the
 * "same offers at both ends, fresh current, dated anchor" rule. Percentage
 * movement leads the rank because it is comparable across price points; breadth
 * of retailer evidence, freshness, then naira impact break ties.
 */
export function selectRecentDrops(
  items: Array<{ product: Product; trends: ProductPriceTrends }>,
  now: number | Date = Date.now(),
): ShareDrop[] {
  const drops: ShareDrop[] = [];

  for (const { product, trends } of items) {
    if (!hasShareableNgOffer(product, now)) continue;
    const movement = [
      trends.NG?.thirtyDay,
      trends.NG?.sevenDay,
    ].find(candidate => (
      candidate?.direction === 'down'
      && Math.abs(candidate.percent) >= DROP_MIN_PERCENT
      && (candidate.comparableRetailerCount ?? 0) >= 2
    ));
    if (!movement) continue;
    const comparableStoreCount = movement.comparableRetailerCount ?? 0;
    const trendLabel = compactPriceMovementLabel(movement);
    if (!trendLabel) continue;
    const summary = summarizeMarket(product.offers, 'NG', now);
    drops.push({
      slug: product.slug,
      brand: product.brand,
      name: product.name,
      image: product.image,
      microtag: microtag(product),
      // NG prices are stored in whole naira, so amountMinor is already naira.
      amountNaira: Math.abs(movement.amountMinor),
      percent: movement.percent,
      // Share cards deliberately use only the fixed seven- and 30-day windows
      // selected above; the shorter in-page "last check" fallback is not public
      // campaign evidence.
      days: movement.days === 30 ? 30 : 7,
      lowestNaira: summary.lowestPrice,
      trendLabel,
      comparableStoreCount,
      observedAt: movement.toAt,
    });
  }

  return drops.sort((a, b) => (
    Math.abs(b.percent) - Math.abs(a.percent)
    || b.comparableStoreCount - a.comparableStoreCount
    || Date.parse(b.observedAt) - Date.parse(a.observedAt)
    || b.amountNaira - a.amountNaira
  )).slice(0, DROP_LIMIT);
}

function timestamp(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function aggregateInterestFor(source: AggregateProductInterest | undefined, slug: string) {
  const value = source?.get(slug);
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER)
    : 0;
}

function compareEvidence(a: ShareSignal, b: ShareSignal) {
  if (a.rank.tier !== b.rank.tier) return b.rank.tier - a.rank.tier;
  for (let index = 0; index < a.rank.evidence.length; index += 1) {
    const difference = b.rank.evidence[index] - a.rank.evidence[index];
    if (difference !== 0) return difference;
  }
  return b.rank.aggregateInterest - a.rank.aggregateInterest;
}

function compareStable(a: ShareSignal, b: ShareSignal) {
  return a.brand.localeCompare(b.brand)
    || a.name.localeCompare(b.name)
    || a.slug.localeCompare(b.slug);
}

function buildCurrentSignal(
  product: Product,
  now: number | Date,
  drop: ShareDrop | undefined,
  gap: ShareGap | undefined,
  aggregateInterest: AggregateProductInterest | undefined,
): ShareSignal | null {
  const offers = product.offers.filter(offer => isShareableNgOffer(offer, now));
  if (offers.length === 0) return null;

  const prices = offers.map(offer => offer.priceNgn as number);
  const lowestNaira = Math.min(...prices);
  const highestNaira = Math.max(...prices);
  const storeCount = new Set(offers.map(offer => offer.retailer)).size;
  const observations = offers.map(offer => {
    const observedAt = offer.checkedAt ?? offer.priceObservation?.observedAt ?? offer.listingEvidence?.observedAt ?? null;
    return { observedAt, observedAtMs: timestamp(observedAt) };
  }).sort((a, b) => b.observedAtMs - a.observedAtMs);
  const observedAt = observations[0]?.observedAt ?? null;
  const observedAtMs = observations[0]?.observedAtMs ?? 0;
  const relativeSpread = storeCount >= 2 && lowestNaira > 0
    ? (highestNaira - lowestNaira) / lowestNaira
    : 0;
  const base = {
    slug: product.slug,
    brand: product.brand,
    name: product.name,
    image: product.image,
    microtag: microtag(product),
    category: product.category,
    lowestNaira,
    highestNaira,
    storeCount,
    observedAt,
  };
  const interest = aggregateInterestFor(aggregateInterest, product.slug);

  if (drop) {
    return {
      ...base,
      kind: 'drop',
      drop,
      gap: null,
      rank: {
        tier: 3,
        evidence: [
          Math.abs(drop.percent),
          drop.comparableStoreCount,
          timestamp(drop.observedAt),
          drop.amountNaira,
        ],
        aggregateInterest: interest,
      },
    };
  }

  if (gap) {
    return {
      ...base,
      kind: 'gap',
      drop: null,
      gap,
      rank: {
        tier: 2,
        evidence: [gap.spreadNaira, gap.storeCount, observedAtMs, relativeSpread],
        aggregateInterest: interest,
      },
    };
  }

  return {
    ...base,
    kind: 'fresh',
    drop: null,
    gap: null,
    rank: {
      tier: 1,
      // Current exact evidence only: freshness, retailer breadth, then the
      // relative price range when more than one store can be compared.
      evidence: [observedAtMs, storeCount, relativeSpread, 0],
      aggregateInterest: interest,
    },
  };
}

/**
 * One canonical read model for every public Worth sharing product card. Strict
 * drop and gap selectors retain their existing thresholds; all remaining fresh,
 * exact, evidence-bound Nigerian prices form the honest fallback lane. A
 * supplied aggregate-interest count can break an exact evidence tie only.
 */
export function buildShareSignalReadModel(
  items: Array<{ product: Product; trends: ProductPriceTrends }>,
  now: number | Date = Date.now(),
  aggregateInterest?: AggregateProductInterest,
): ShareSignalReadModel {
  const uniqueItems = [...new Map(items.map(item => [item.product.slug, item])).values()];
  const products = uniqueItems.map(item => item.product);
  const drops = new Map(selectRecentDrops(uniqueItems, now).map(drop => [drop.slug, drop]));
  const gaps = new Map(selectShareGaps(products, now, Number.MAX_SAFE_INTEGER)
    .filter(gap => !drops.has(gap.slug))
    .slice(0, GAP_LIMIT)
    .map(gap => [gap.slug, gap]));
  const rankedPool = uniqueItems.flatMap(({ product }) => {
    const signal = buildCurrentSignal(product, now, drops.get(product.slug), gaps.get(product.slug), aggregateInterest);
    return signal ? [signal] : [];
  }).sort((a, b) => compareEvidence(a, b) || compareStable(a, b));

  return {
    recentDrops: rankedPool.filter((signal): signal is ShareDropSignal => signal.kind === 'drop'),
    priceGaps: rankedPool.filter((signal): signal is ShareGapSignal => signal.kind === 'gap'),
    freshComparisons: rankedPool
      .filter((signal): signal is ShareFreshSignal => signal.kind === 'fresh')
      .slice(0, FRESH_COMPARISON_LIMIT),
    rankedPool,
    aggregateInterest: aggregateInterest ? 'available' : 'unavailable',
  };
}

/** Uses the same global pool; category can only decide an exact evidence tie. */
export function selectShareRecommendations(
  rankedPool: ShareSignal[],
  currentSlug: string,
  limit = 3,
): ShareSignal[] {
  if (limit <= 0) return [];
  const currentCategory = rankedPool.find(signal => signal.slug === currentSlug)?.category;
  const unique = new Map<string, ShareSignal>();

  for (const signal of rankedPool) {
    if (signal.slug !== currentSlug && !unique.has(signal.slug)) unique.set(signal.slug, signal);
  }

  return [...unique.values()].sort((a, b) => {
    const evidence = compareEvidence(a, b);
    if (evidence !== 0) return evidence;
    if (currentCategory != null) {
      const category = Number(b.category === currentCategory) - Number(a.category === currentCategory);
      if (category !== 0) return category;
    }
    return compareStable(a, b);
  }).slice(0, limit);
}
