import type { Market } from "@/data/prices";
import type { Offer } from "@/data/products";
import { isOfferFresh } from "./offer-freshness";
import { comparableMarketPrice, hasListingEvidence } from "./offer-evidence";

/**
 * Discriminated union market reading for one product.
 *
 * Every field derives from the same eligible offer set so price, store count,
 * freshness, and basis never disagree.
 */
export type MarketReading =
  | {
      state: "priced";
      /** "₦9,850" for single-source, "From ₦9,850" for multi-source. */
      priceLabel: string;
      /** Lowest comparable market price as a raw number. */
      lowestPrice: number;
      /** Unique observed-store count from the eligible priced set. */
      storeCount: number;
      /** Single-source or multi-source. */
      basis: "single-source" | "multi-source";
      /** ISO timestamp of the most recent priced observation. */
      observedAt: string;
      /** Human-readable freshness label, e.g. "Checked today", "Checked yesterday". */
      freshnessLabel: string;
    }
  | {
      state: "listing-only";
      /** Unique observed-listing count (stores with listings but no comparable price). */
      listingCount: number;
      /** ISO timestamp of the most recent listing observation. */
      observedAt: string;
      /** Human-readable freshness label for the listing observation. */
      freshnessLabel: string;
    }
  | {
      state: "unavailable";
    };

/** Type guard for priced state. */
export function isPriced(
  reading: MarketReading,
): reading is Extract<MarketReading, { state: "priced" }> {
  return reading.state === "priced";
}

/** Type guard for listing-only state. */
export function isListingOnly(
  reading: MarketReading,
): reading is Extract<MarketReading, { state: "listing-only" }> {
  return reading.state === "listing-only";
}

/** Type guard for unavailable state. */
export function isUnavailable(
  reading: MarketReading,
): reading is Extract<MarketReading, { state: "unavailable" }> {
  return reading.state === "unavailable";
}

const nairaFormatters: Record<Market, Intl.NumberFormat> = {
  NG: new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }),
  US: new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }),
};

/** Market-aware price formatter. */
export function formatMarketPrice(price: number, market: Market): string {
  return nairaFormatters[market].format(price);
}

function servesMarket(offer: Offer, market: Market) {
  return offer.location.includes(market) || offer.location.includes("INTL");
}

/**
 * The single eligible set: exact match, serving the market, fresh,
 * with listing evidence present. This is the foundation for every
 * market-reading field — priced and listing-only both derive from it.
 */
function eligibleListingOffers(
  offers: readonly Offer[],
  market: Market,
  now: number | Date,
): readonly Offer[] {
  return offers.filter(
    (offer) =>
      offer.match !== "search" &&
      servesMarket(offer, market) &&
      hasListingEvidence(offer) &&
      isOfferFresh(offer, now),
  );
}

/**
 * The priced subset: eligible listing offers that are in stock
 * and have a comparable current price for the market.
 */
function eligiblePricedOffers(
  offers: readonly Offer[],
  market: Market,
  now: number | Date,
): readonly Offer[] {
  return eligibleListingOffers(offers, market, now)
    .filter((offer) => offer.available)
    .filter((offer) => comparableMarketPrice(offer, market, now) != null);
}

/**
 * Deduplicate offers by canonical retailer identity.
 * Ignores case and surrounding whitespace so "Store A" and "store a "
 * count as one retailer.
 */
function uniqueRetailers(offers: readonly Offer[]): string[] {
  const seen = new Set<string>();
  for (const offer of offers) {
    const key = offer.retailer.trim().toLowerCase();
    seen.add(key);
  }
  return [...seen];
}

/** Most recent observation timestamp from the eligible set. */
function latestObservation(offers: readonly Offer[]): string | null {
  let latest: string | null = null;
  let latestTime = -Infinity;
  for (const offer of offers) {
    const ts =
      offer.priceObservation?.observedAt ?? offer.listingEvidence?.observedAt;
    if (!ts) continue;
    const parsed = Date.parse(ts);
    if (Number.isNaN(parsed)) continue;
    if (parsed > latestTime) {
      latestTime = parsed;
      latest = ts;
    }
  }
  return latest;
}

/**
 * Deterministic freshness label from a known observation time and `now`.
 * Uses UTC day boundaries so tests are reproducible.
 * Future timestamps fail safely by returning null.
 */
export function freshnessLabelFor(
  observedAt: string | null,
  now: number | Date,
): string | null {
  if (!observedAt) return null;
  const checked = new Date(observedAt);
  if (Number.isNaN(checked.getTime())) return null;
  const current = typeof now === "number" ? new Date(now) : now;
  if (Number.isNaN(current.getTime())) return null;
  const dayMs = 24 * 60 * 60 * 1000;
  const ageDays = Math.floor(
    (Date.UTC(
      current.getUTCFullYear(),
      current.getUTCMonth(),
      current.getUTCDate(),
    ) -
      Date.UTC(
        checked.getUTCFullYear(),
        checked.getUTCMonth(),
        checked.getUTCDate(),
      )) /
      dayMs,
  );
  // Future timestamps fail safely
  if (ageDays < 0) return null;
  if (ageDays === 0) return "Checked today";
  if (ageDays === 1) return "Checked yesterday";
  if (ageDays <= 7) return `Checked ${ageDays} days ago`;
  return `Checked ${checked.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;
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
      .map((offer) => comparableMarketPrice(offer, market, now))
      .filter((price): price is number => price != null)
      .sort((a, b) => a - b);
    const lowestPrice = prices[0] ?? null;
    const observedAt = latestObservation(pricedOffers);
    const basis = retailers.length === 1 ? "single-source" : "multi-source";
    if (lowestPrice == null || !observedAt) {
      // Should not happen given the filters above, but fail safely
      return { state: "unavailable" };
    }
    const price = formatMarketPrice(lowestPrice, market);
    const prefix = retailers.length > 1 ? "From " : "";
    return {
      state: "priced",
      priceLabel: `${prefix}${price}`,
      lowestPrice,
      storeCount: retailers.length,
      basis,
      observedAt,
      freshnessLabel: freshnessLabelFor(observedAt, now) ?? "Checked recently",
    };
  }

  if (listingOffers.length > 0) {
    const retailers = uniqueRetailers(listingOffers);
    const observedAt = latestObservation(listingOffers);
    if (!observedAt) return { state: "unavailable" };
    return {
      state: "listing-only",
      listingCount: retailers.length,
      observedAt,
      freshnessLabel: freshnessLabelFor(observedAt, now) ?? "Checked recently",
    };
  }

  return { state: "unavailable" };
}
