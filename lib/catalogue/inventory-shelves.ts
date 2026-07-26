import type { Market } from '@/data/prices';
import type { Product } from '@/data/products';
import { comparableMarketPrice } from '@/modules/commerce/offer-evidence';

type ShelfProduct = Pick<Product, 'slug' | 'offers'>;

type MarketSnapshot<T extends ShelfProduct> = {
  product: T;
  lowestPrice: number;
  lastCheckedAt: number;
};

function belongsToMarket(location: string[], market: Market) {
  return location.includes(market);
}

function marketSnapshot<T extends ShelfProduct>(
  product: T,
  market: Market,
  now: number | Date,
): MarketSnapshot<T> | null {
  const observations = product.offers.flatMap(offer => {
    if (offer.match === 'search' || !belongsToMarket(offer.location, market)) return [];
    const price = comparableMarketPrice(offer, market, now);
    if (price == null) return [];
    const checked = new Date(offer.priceObservation?.observedAt ?? offer.checkedAt ?? '');
    if (!Number.isFinite(checked.valueOf())) return [];
    return [{ price, checkedAt: checked.valueOf() }];
  });
  if (!observations.length) return null;

  return {
    product,
    lowestPrice: Math.min(...observations.map(observation => observation.price)),
    lastCheckedAt: Math.max(...observations.map(observation => observation.checkedAt)),
  };
}

function boundedLimit(limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 24) {
    throw new Error('Inventory shelf limit must be between 1 and 24.');
  }
  return limit;
}

/**
 * A factual freshness shelf. It is ordered by the newest eligible exact-market
 * observation, never by conversion, affiliate value, popularity, or stock.
 */
export function selectRecentlyCheckedProducts<T extends ShelfProduct>(
  products: readonly T[],
  market: Market,
  limit = 12,
  now: number | Date = Date.now(),
) {
  const safeLimit = boundedLimit(limit);
  return products
    .flatMap(product => {
      const snapshot = marketSnapshot(product, market, now);
      return snapshot ? [snapshot] : [];
    })
    .sort((left, right) =>
      right.lastCheckedAt - left.lastCheckedAt
      || left.lowestPrice - right.lowestPrice
      || left.product.slug.localeCompare(right.product.slug))
    .slice(0, safeLimit)
    .map(snapshot => snapshot.product);
}

/**
 * A price-bound discovery shelf. Every included price is a fresh, exact,
 * comparable market observation. The ceiling is a browse rule, not a sale or
 * product-quality claim.
 */
export function selectProductsBelowPrice<T extends ShelfProduct>(
  products: readonly T[],
  market: Market,
  ceiling: number,
  limit = 12,
  now: number | Date = Date.now(),
) {
  if (!Number.isFinite(ceiling) || ceiling <= 0) {
    throw new Error('Inventory shelf ceiling must be a positive number.');
  }
  const safeLimit = boundedLimit(limit);
  return products
    .flatMap(product => {
      const snapshot = marketSnapshot(product, market, now);
      return snapshot && snapshot.lowestPrice < ceiling ? [snapshot] : [];
    })
    .sort((left, right) =>
      left.lowestPrice - right.lowestPrice
      || right.lastCheckedAt - left.lastCheckedAt
      || left.product.slug.localeCompare(right.product.slug))
    .slice(0, safeLimit)
    .map(snapshot => snapshot.product);
}
