import type { Market } from "@/data/prices";
import type { Offer } from "@/data/products";
import { isOfferFresh } from "./offer-freshness";
import {
  comparableMarketPrice,
  comparableMarketPriceForTrends,
  hasListingEvidence,
} from "./offer-evidence";

export type MarketSummary = {
  market: Market;
  lowestPrice: number | null;
  typicalPrice: number | null;
  highestPrice: number | null;
  retailerCount: number;
  inStockCount: number;
  pricedRetailerCount: number;
  savings: number | null;
  lastCheckedAt: string | null;
  confidence: number;
  priceBasis: "none" | "single-source" | "multi-source";
};

function servesMarket(offer: Offer, market: Market) {
  return offer.location.includes(market) || offer.location.includes("INTL");
}

// `values` arrive sorted ascending, so the median is the middle element (or the
// mean of the two middle elements). The market-summary contract calls this figure
// the "Median" scoped to the compared set (docs/RETAIL_INTELLIGENCE.md).
function median(values: number[], market: Market) {
  if (!values.length) return null;
  const mid = Math.floor(values.length / 2);
  const value =
    values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  return market === "NG" ? Math.round(value) : Number(value.toFixed(2));
}

export function summarizeMarket(
  offers: Offer[],
  market: Market,
  now: number | Date = Date.now(),
  requireFresh = true,
): MarketSummary {
  const exact = offers.filter(
    (offer) =>
      offer.match !== "search" &&
      servesMarket(offer, market) &&
      hasListingEvidence(offer) &&
      (!requireFresh || isOfferFresh(offer, now)),
  );
  const inStock = exact.filter((offer) => offer.available);
  const priced = inStock
    .map((offer) => ({
      offer,
      price: requireFresh
        ? comparableMarketPrice(offer, market, now)
        : comparableMarketPriceForTrends(offer, market),
    }))
    .filter(
      (entry): entry is { offer: Offer; price: number } => entry.price != null,
    )
    .sort((a, b) => a.price - b.price);
  const values = priced.map((entry) => entry.price);
  const lowestPrice = values[0] ?? null;
  const priceBasis =
    values.length === 0
      ? "none"
      : values.length === 1
        ? "single-source"
        : "multi-source";
  const typicalPrice =
    priceBasis === "multi-source" ? median(values, market) : null;
  const highestPrice =
    priceBasis === "multi-source" ? (values.at(-1) ?? null) : null;
  const checked = exact
    .map(
      (offer) =>
        offer.priceObservation?.observedAt ?? offer.listingEvidence?.observedAt,
    )
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  const averageTrust = exact.length
    ? exact.reduce((total, offer) => total + offer.trust, 0) / exact.length
    : 0;
  const priceCoverage = exact.length ? priced.length / exact.length : 0;
  const checkCoverage = exact.length ? checked.length / exact.length : 0;
  const confidence = Math.round(
    priceCoverage * 50 + checkCoverage * 25 + (averageTrust / 100) * 25,
  );

  return {
    market,
    lowestPrice,
    typicalPrice,
    highestPrice,
    retailerCount: exact.length,
    inStockCount: inStock.length,
    pricedRetailerCount: priced.length,
    savings:
      lowestPrice != null && highestPrice != null && highestPrice > lowestPrice
        ? market === "NG"
          ? Math.round(highestPrice - lowestPrice)
          : Number((highestPrice - lowestPrice).toFixed(2))
        : null,
    lastCheckedAt: checked[0] ?? null,
    confidence: Math.min(confidence, 100),
    priceBasis,
  };
}
