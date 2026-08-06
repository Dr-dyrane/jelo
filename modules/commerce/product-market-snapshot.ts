import type { Market } from '@/data/prices';
import type { Offer } from '@/data/products';
import { buildMarketReading, type MarketReading } from './market-reading';
import { isOfferFresh } from './offer-freshness';
import { comparableMarketPrice, hasListingEvidence } from './offer-evidence';

/**
 * Normalized retailer identity key: trim + case-fold.
 * Two offers from "Store A" and "store a " resolve to the same retailer.
 */
function retailerKey(offer: Offer): string {
  return offer.retailer.trim().toLowerCase();
}

/**
 * Panel-level market extras that do not contradict the inline reading.
 * These are additional facts (median, savings, coverage) derived from the
 * same eligible set — not independent interpretations.
 *
 * All counts are unique-retailer counts, not raw offer-entry counts.
 * All prices are numeric — presentation layers format them.
 */
export type MarketPanelExtras = {
  /** Lowest comparable price across unique priced retailers. */
  lowestPrice: number | null;
  /** Median price across unique priced retailers, or null when single-source. */
  typicalPrice: number | null;
  /** Highest price across unique priced retailers, or null. */
  highestPrice: number | null;
  /** Savings between lowest and highest, or null. */
  savings: number | null;
  /** Unique retailer count with any fresh listing evidence (priced + unpriced). */
  uniqueListingStoreCount: number;
  /** Unique retailer count with a comparable current price. */
  uniquePricedStoreCount: number;
  /** Confidence score (0-100). */
  confidence: number;
};

/**
 * One market entry in the product market snapshot.
 */
export type ProductMarketEntry = {
  reading: MarketReading;
  extras: MarketPanelExtras;
};

/**
 * Server-owned market snapshot for one product.
 *
 * Built once with one injected `now`. The inline Member Product reading,
 * the generic price label, and the Product panel all derive their
 * overlapping claims from this single snapshot.
 */
export type ProductMarketSnapshot = {
  NG: ProductMarketEntry;
  US: ProductMarketEntry;
};

function servesMarket(offer: Offer, market: Market) {
  return offer.location.includes(market) || offer.location.includes('INTL');
}

function median(values: number[], market: Market): number | null {
  if (!values.length) return null;
  const mid = Math.floor(values.length / 2);
  const value = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  return market === 'NG' ? Math.round(value) : Number(value.toFixed(2));
}

function buildPanelExtras(offers: readonly Offer[], market: Market, now: number | Date): MarketPanelExtras {
  const exact = offers.filter(offer =>
    offer.match !== 'search'
    && servesMarket(offer, market)
    && hasListingEvidence(offer)
    && isOfferFresh(offer, now),
  );

  // Group by normalized retailer identity. For each retailer, select the
  // relevant current eligible listing and comparable price. This ensures
  // duplicate offers from one retailer count as one store.
  const byRetailer = new Map<string, { offer: Offer; price: number | null }>();
  for (const offer of exact) {
    const key = retailerKey(offer);
    const price = offer.available ? comparableMarketPrice(offer, market, now) : null;
    const existing = byRetailer.get(key);
    if (!existing || (price != null && (existing.price == null || price < existing.price))) {
      byRetailer.set(key, { offer, price });
    }
  }

  const uniquePricedStores = [...byRetailer.values()].filter(entry => entry.price != null);
  const priced = uniquePricedStores
    .map(entry => entry.price as number)
    .sort((a, b) => a - b);

  const lowestPrice = priced[0] ?? null;
  const highestPrice = priced.length > 1 ? priced[priced.length - 1] ?? null : null;
  const typicalPrice = priced.length > 1 ? median(priced, market) : null;
  const savings = lowestPrice != null && highestPrice != null && highestPrice > lowestPrice
    ? market === 'NG'
      ? Math.round(highestPrice - lowestPrice)
      : Number((highestPrice - lowestPrice).toFixed(2))
    : null;

  const uniqueListingStoreCount = byRetailer.size;
  const uniquePricedStoreCount = priced.length;

  const averageTrust = exact.length
    ? exact.reduce((total, offer) => total + offer.trust, 0) / exact.length
    : 0;
  const priceCoverage = uniqueListingStoreCount ? uniquePricedStoreCount / uniqueListingStoreCount : 0;
  const checkedCount = exact.filter(o => o.priceObservation?.observedAt ?? o.listingEvidence?.observedAt).length;
  const checkCoverage = exact.length ? checkedCount / exact.length : 0;
  const confidence = Math.min(Math.round(priceCoverage * 50 + checkCoverage * 25 + (averageTrust / 100) * 25), 100);

  return {
    lowestPrice,
    typicalPrice,
    highestPrice,
    savings,
    uniqueListingStoreCount,
    uniquePricedStoreCount,
    confidence,
  };
}

/**
 * Build one server-owned market snapshot for a product.
 *
 * All overlapping claims (price, store count, basis, checked timestamp,
 * state) derive from the same `buildMarketReading` foundation with one
 * injected `now`. Panel extras (median, savings, coverage) are additional
 * facts that do not contradict the reading.
 */
export function buildProductMarketSnapshot(
  offers: readonly Offer[],
  now: number | Date = Date.now(),
): ProductMarketSnapshot {
  return {
    NG: {
      reading: buildMarketReading(offers, 'NG', now),
      extras: buildPanelExtras(offers, 'NG', now),
    },
    US: {
      reading: buildMarketReading(offers, 'US', now),
      extras: buildPanelExtras(offers, 'US', now),
    },
  };
}
