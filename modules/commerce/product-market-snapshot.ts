import type { Market } from '@/data/prices';
import type { Offer } from '@/data/products';
import { buildMarketReading, type MarketReading } from './market-reading';
import { isOfferFresh } from './offer-freshness';
import { comparableMarketPrice, hasListingEvidence } from './offer-evidence';

/**
 * Panel-level market extras that do not contradict the inline reading.
 * These are additional facts (median, savings, coverage) derived from the
 * same eligible set — not independent interpretations.
 */
export type MarketPanelExtras = {
  /** Median price across the priced set, or null when not multi-source. */
  typicalPrice: number | null;
  /** Highest price in the priced set, or null. */
  highestPrice: number | null;
  /** Savings between lowest and highest, or null. */
  savings: number | null;
  /** Total exact listing count (priced + unpriced). */
  listingCount: number;
  /** Priced store count (same as reading.storeCount when priced). */
  pricedStoreCount: number;
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
  const priced = exact
    .filter(offer => offer.available)
    .map(offer => comparableMarketPrice(offer, market, now))
    .filter((price): price is number => price != null)
    .sort((a, b) => a - b);

  const lowestPrice = priced[0] ?? null;
  const highestPrice = priced.length > 1 ? priced[priced.length - 1] ?? null : null;
  const typicalPrice = priced.length > 1 ? median(priced, market) : null;
  const savings = lowestPrice != null && highestPrice != null && highestPrice > lowestPrice
    ? market === 'NG'
      ? Math.round(highestPrice - lowestPrice)
      : Number((highestPrice - lowestPrice).toFixed(2))
    : null;

  const averageTrust = exact.length
    ? exact.reduce((total, offer) => total + offer.trust, 0) / exact.length
    : 0;
  const priceCoverage = exact.length ? priced.length / exact.length : 0;
  const checkedCount = exact.filter(o => o.priceObservation?.observedAt ?? o.listingEvidence?.observedAt).length;
  const checkCoverage = exact.length ? checkedCount / exact.length : 0;
  const confidence = Math.min(Math.round(priceCoverage * 50 + checkCoverage * 25 + (averageTrust / 100) * 25), 100);

  return {
    typicalPrice,
    highestPrice,
    savings,
    listingCount: exact.length,
    pricedStoreCount: priced.length,
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
