import type { Offer } from "@/data/products";
import { comparableMarketPrice } from "./offer-evidence";

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
