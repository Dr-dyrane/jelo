import type { Market } from '@/data/prices';
import type { Offer } from '@/data/products';
import { buildMarketReading } from './market-reading';

/**
 * Concise price label for product cards and collection surfaces.
 *
 * Derives from the same `buildMarketReading` foundation as the inline Member
 * Product market reading, so the two never disagree on price, store count,
 * or freshness.
 */
export function marketPriceLabel(offers: Offer[], market: Market, now: number | Date = Date.now()) {
  const reading = buildMarketReading(offers, market, now);
  if (reading.state !== 'priced') return null;
  const stores = `${reading.storeCount} ${reading.storeCount === 1 ? 'store' : 'stores'}`;
  return `${reading.priceLabel} · ${stores}`;
}
