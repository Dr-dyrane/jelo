import type { Product } from '@/data/products';
import { summarizeMarket } from './market-summary';
import type { ProductPriceTrends } from './price-trends';
import { hasShareableNgOffer } from './shareable-offer';

// Honesty thresholds. Tunable, but deliberately conservative: a suggestion only
// appears when the evidence is strong enough that telling someone is genuinely
// useful. None of these rank by popularity or clicks, only by observed facts.
const GAP_MIN_NAIRA = 800; // absolute spread floor, so a trivial gap never surfaces
const GAP_MIN_FRACTION = 0.08; // spread must also be >= 8% of the lowest price
const GAP_LIMIT = 8;
const DROP_MIN_PERCENT = 4; // a notable drop sits well above the 0.5% flat band
const DROP_LIMIT = 6;

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
};

const microtag = (product: Product) => `${product.size} · ${product.category}`;

/**
 * Pick products whose lowest and highest fresh, evidence-bound NG offers are far
 * enough apart to be worth telling someone about. A spread only exists when two
 * or more stores are compared (the spec's "Lowest observed" / "Median" case);
 * single-source offers never claim one. Ranks by spread, then store count.
 */
export function selectShareGaps(products: Product[], now: number | Date = Date.now()): ShareGap[] {
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
    .slice(0, GAP_LIMIT);
}

/**
 * From products paired with their already-fetched price trends, keep the ones
 * whose observed NG price notably fell, ranked by the size of the fall. The
 * movement itself is produced by calculatePriceTrends, which already enforces the
 * "same offers at both ends, fresh current, dated anchor" rule.
 */
export function selectRecentDrops(
  items: Array<{ product: Product; trends: ProductPriceTrends }>,
  now: number | Date = Date.now(),
): ShareDrop[] {
  const drops: ShareDrop[] = [];

  for (const { product, trends } of items) {
    if (!hasShareableNgOffer(product, now)) continue;
    const movement = trends.NG?.thirtyDay ?? trends.NG?.sevenDay ?? null;
    if (!movement || movement.direction !== 'down' || Math.abs(movement.percent) < DROP_MIN_PERCENT) continue;
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
      days: movement.days,
      lowestNaira: summary.lowestPrice,
    });
  }

  return drops.sort((a, b) => b.amountNaira - a.amountNaira).slice(0, DROP_LIMIT);
}
