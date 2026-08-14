import type { Offer } from "@/data/products";
import {
  comparableMarketPrice,
  comparableMarketPriceForTrends,
} from "./offer-evidence";

/**
 * A Nigerian offer that can back an honest share card: an exact (not a search
 * result) NG listing that summarizeMarket would count as a comparable price —
 * in stock, evidence-bound, fresh, with an observed naira price that is eligible
 * for comparison (not flagged priceComparison:'exclude').
 *
 * Gating on comparableMarketPrice means a share card's lowest and spread always
 * agree with the product page, and a marketplace price the catalogue excluded
 * from comparison can never surface as the "lowest". This is the single source of
 * truth for "shareable" across the share index, the product panel's Share
 * affordance, and buildShareData.
 */
export function isShareableNgOffer(
  offer: Offer,
  now: number | Date = Date.now(),
): boolean {
  return (
    offer.match !== "search" &&
    offer.location.includes("NG") &&
    comparableMarketPrice(offer, "NG", now) != null
  );
}

/** True when a product has at least one offer that can back an honest share card. */
export function hasShareableNgOffer(
  product: { offers: Offer[] },
  now: number | Date = Date.now(),
): boolean {
  return product.offers.some((offer) => isShareableNgOffer(offer, now));
}

/**
 * Same as `isShareableNgOffer` but does NOT require freshness.
 *
 * Trend computation and the share price card should still render when offers
 * are stale — the observed price and date are valid historical data points.
 * The freshness gate is a shopper-facing concern ("is this price still
 * actionable today?"), not a data-display concern.
 */
export function isTrendEligibleNgOffer(offer: Offer): boolean {
  return (
    offer.match !== "search" &&
    offer.location.includes("NG") &&
    comparableMarketPriceForTrends(offer, "NG") != null
  );
}

/** True when a product has at least one trend-eligible NG offer. */
export function hasTrendEligibleNgOffer(product: { offers: Offer[] }): boolean {
  return product.offers.some((offer) => isTrendEligibleNgOffer(offer));
}
