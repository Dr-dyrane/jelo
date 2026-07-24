import type { Market } from '@/data/prices';
import type { Offer } from '@/data/products';
import type { MarketSummary } from './market-summary';
import { observedMarketPrice } from './offer-evidence';

// Where a clicked offer sat in the compared set, for the store-click measurement
// (docs/ANALYTICS.md). This answers "do people take the cheap price or a pricier
// one" without profiling anyone. It is measurement only and never an input to
// ranking, guidance, or safety (ADR 0006).
export type PriceRank = 'lowest' | 'median' | 'higher' | 'only' | 'marketplace';

export function offerPriceRank(
  offer: Offer,
  summary: MarketSummary,
  market: Market,
  now: number | Date = Date.now(),
): PriceRank {
  // A comparison-excluded listing (e.g. a marketplace price) is its own bucket.
  if (offer.priceComparison === 'exclude') return 'marketplace';
  const price = observedMarketPrice(offer, market, now);
  if (price == null || summary.priceBasis !== 'multi-source' || summary.lowestPrice == null || summary.typicalPrice == null) {
    return 'only';
  }
  if (price <= summary.lowestPrice) return 'lowest';
  if (price <= summary.typicalPrice) return 'median';
  return 'higher';
}

/** Whole days since the offer's most specific observation, or null when undated. */
export function offerFreshnessDays(offer: Offer, now: number | Date = Date.now()): number | null {
  const observedAt = offer.priceObservation?.observedAt ?? offer.listingEvidence?.observedAt ?? offer.checkedAt;
  if (!observedAt) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(observedAt) ? `${observedAt}T00:00:00Z` : observedAt;
  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) return null;
  const elapsed = (typeof now === 'number' ? now : now.getTime()) - parsed;
  return Math.max(0, Math.floor(elapsed / 86_400_000));
}
