import type { Market } from '@/data/prices';
import type { Offer } from '@/data/products';
import { isOfferFresh } from './offer-freshness';
import { comparableMarketPrice, hasListingEvidence } from './offer-evidence';

/**
 * Semantic market state for a single product.
 *
 * - `priced`: at least one fresh, exact, in-stock offer with a comparable NGN price.
 * - `listing-only`: fresh exact listings exist but none have a comparable price.
 * - `unavailable`: no fresh exact Nigerian listings at all.
 */
export type MarketState = 'priced' | 'listing-only' | 'unavailable';

/**
 * Server-owned market reading for one product.
 *
 * Every field derives from the same eligible offer set so price, store count,
 * freshness, and basis never disagree.
 */
export type MarketReading = {
  state: MarketState;
  /** "₦9,850" for single-source, "From ₦9,850" for multi-source. Null when not priced. */
  priceLabel: string | null;
  /** Unique observed-store count from the eligible priced set. */
  storeCount: number;
  /** Unique observed-store count from the eligible listing set (listing-only state). */
  listingStoreCount: number;
  /** Single-source or multi-source, or none when unavailable. */
  basis: 'none' | 'single-source' | 'multi-source';
  /** ISO timestamp of the most recent observation from the eligible set. */
  observedAt: string | null;
  /** Human-readable freshness label, e.g. "Checked today", "Checked yesterday". */
  freshnessLabel: string | null;
  /** True when no fresh exact Nigerian listings exist. */
  unavailable: boolean;
};

const naira = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

function servesMarket(offer: Offer, market: Market) {
  return offer.location.includes(market) || offer.location.includes('INTL');
}

/**
 * The single eligible set: exact match, serving the market, fresh,
 * with listing evidence present. This is the foundation for every
 * market-reading field — priced and listing-only both derive from it.
 */
function eligibleListingOffers(offers: readonly Offer[], market: Market, now: number | Date): readonly Offer[] {
  return offers.filter(offer =>
    offer.match !== 'search'
    && servesMarket(offer, market)
    && hasListingEvidence(offer)
    && isOfferFresh(offer, now),
  );
}

/**
 * The priced subset: eligible listing offers that are in stock
 * and have a comparable current price for the market.
 */
function eligiblePricedOffers(offers: readonly Offer[], market: Market, now: number | Date): readonly Offer[] {
  return eligibleListingOffers(offers, market, now)
    .filter(offer => offer.available)
    .filter(offer => comparableMarketPrice(offer, market, now) != null);
}

/** Deduplicate offers by retailer name to count unique stores. */
function uniqueRetailers(offers: readonly Offer[]): string[] {
  return [...new Set(offers.map(offer => offer.retailer))];
}

/** Most recent observation timestamp from the eligible set. */
function latestObservation(offers: readonly Offer[]): string | null {
  const timestamps = offers
    .map(offer => offer.priceObservation?.observedAt ?? offer.listingEvidence?.observedAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  return timestamps[0] ?? null;
}

/**
 * Deterministic freshness label from a known observation time and `now`.
 * Uses UTC day boundaries so tests are reproducible.
 */
export function freshnessLabelFor(observedAt: string | null, now: number | Date): string | null {
  if (!observedAt) return null;
  const checked = new Date(observedAt);
  if (Number.isNaN(checked.getTime())) return null;
  const current = typeof now === 'number' ? new Date(now) : now;
  if (Number.isNaN(current.getTime())) return null;
  const dayMs = 24 * 60 * 60 * 1000;
  const ageDays = Math.floor(
    (Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate())
      - Date.UTC(checked.getUTCFullYear(), checked.getUTCMonth(), checked.getUTCDate())) / dayMs,
  );
  if (ageDays <= 0) return 'Checked today';
  if (ageDays === 1) return 'Checked yesterday';
  if (ageDays <= 7) return `Checked ${ageDays} days ago`;
  return `Checked ${checked.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`;
}

/**
 * Build a complete market reading from one eligible set.
 *
 * Price, store count, freshness, and basis all derive from the same
 * filtered offers. The caller injects `now` for deterministic tests.
 */
export function buildMarketReading(
  offers: readonly Offer[],
  market: Market,
  now: number | Date = Date.now(),
): MarketReading {
  const listingOffers = eligibleListingOffers(offers, market, now);
  const pricedOffers = eligiblePricedOffers(offers, market, now);

  if (pricedOffers.length > 0) {
    const retailers = uniqueRetailers(pricedOffers);
    const prices = pricedOffers
      .map(offer => comparableMarketPrice(offer, market, now))
      .filter((price): price is number => price != null)
      .sort((a, b) => a - b);
    const lowestPrice = prices[0] ?? null;
    const observedAt = latestObservation(pricedOffers);
    const basis = retailers.length === 1 ? 'single-source' : 'multi-source';
    const price = lowestPrice != null ? naira.format(lowestPrice) : null;
    const prefix = retailers.length > 1 ? 'From ' : '';
    return {
      state: 'priced',
      priceLabel: price != null ? `${prefix}${price}` : null,
      storeCount: retailers.length,
      listingStoreCount: uniqueRetailers(listingOffers).length,
      basis,
      observedAt,
      freshnessLabel: freshnessLabelFor(observedAt, now),
      unavailable: false,
    };
  }

  if (listingOffers.length > 0) {
    const retailers = uniqueRetailers(listingOffers);
    const observedAt = latestObservation(listingOffers);
    return {
      state: 'listing-only',
      priceLabel: null,
      storeCount: 0,
      listingStoreCount: retailers.length,
      basis: 'none',
      observedAt,
      freshnessLabel: freshnessLabelFor(observedAt, now),
      unavailable: false,
    };
  }

  return {
    state: 'unavailable',
    priceLabel: null,
    storeCount: 0,
    listingStoreCount: 0,
    basis: 'none',
    observedAt: null,
    freshnessLabel: null,
    unavailable: true,
  };
}
