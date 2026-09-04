import "server-only";

import { findCatalogueProduct } from "@/lib/catalogue/repository";
import { getProductPriceHistory } from "@/lib/inventory/price-trends";
import { summarizeMarket } from "@/modules/commerce/market-summary";
import {
  priceTrendOfferSnapshot,
  type PriceObservation,
  type PriceTrendOfferSnapshot,
} from "@/modules/commerce/price-trends";
import { isShareableNgOffer } from "@/modules/commerce/shareable-offer";
import { selectRepresentativeOffers } from "@/modules/commerce/representative-offers";

export type TrendPricePoint = {
  retailer: string;
  priceNaira: number;
  observedAt: string;
};

export type TrendStoreOffer = {
  retailer: string;
  priceNaira: number;
  trustScore: number;
  stockStatus: "in-stock" | "low-stock" | "out-of-stock" | "unknown";
  lastVerifiedAt: string | null;
  isLowest: boolean;
  /** The typical floor price among the representative comparison set. */
  isTypical: boolean;
  isMarketplace: boolean;
};

export type TrendSummary = {
  lowestNaira: number;
  medianNaira: number | null;
  highestNaira: number | null;
  spreadNaira: number | null;
  storeCount: number;
  avgTrust: number;
  confidence: number;
  observedDate: string;
  observedAt: string | null;
};

export type ProductTrendData = {
  slug: string;
  brand: string;
  name: string;
  image: string;
  category: "Face" | "Hair" | "Body";
  size: string;
  points: TrendPricePoint[];
  stores: TrendStoreOffer[];
  summary: TrendSummary;
};

const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

/**
 * Fetches raw price observations for the chart.
 *
 * Primary source: the `offer_price_history` database table, which is populated
 * by the inventory refresh worker every time a price is observed.
 *
 * The chart fails closed when the database is unavailable or has no matching
 * rows. Current offer snapshots are not reconstructed into historical points.
 */
async function fetchRawObservations(
  slug: string,
  snapshot: readonly PriceTrendOfferSnapshot[],
): Promise<PriceObservation[]> {
  return getProductPriceHistory(slug, snapshot);
}

/**
 * Builds the full trend data for a product share page: raw price points for
 * the chart, per-store offer details, and a market summary. Returns null when
 * a product has no shareable Nigerian offers.
 */
export async function getProductTrendData(
  slug: string,
): Promise<ProductTrendData | null> {
  const product = await findCatalogueProduct(slug);
  if (!product) return null;

  const now = Date.now();
  const offers = product.offers
    .filter((offer) => isShareableNgOffer(offer, now))
    .sort((a, b) => (a.priceNgn as number) - (b.priceNgn as number));
  if (offers.length === 0) return null;

  const priceOf = (offer: (typeof offers)[number]) => offer.priceNgn as number;
  const retailerKey = (retailer: string) =>
    retailer.trim().toLocaleLowerCase("en-NG");

  // History is queried across every shareable offer — not just the
  // representative three — because a store's dated series can stay valid
  // evidence even after it stops being today's lowest, typical, or highest
  // priced listing. Restricting the query itself (rather than just the
  // rendered set) previously made the chart go dark whenever the seeded
  // history belonged to a retailer that had since fallen out of the
  // representative set.
  const fullSnapshots = offers.flatMap((offer) => {
    const snap = priceTrendOfferSnapshot(offer, "NG", now);
    return snap ? [snap] : [];
  });
  const rawObservations = await fetchRawObservations(
    product.slug,
    fullSnapshots,
  );

  // A verified product can carry 20-30+ Nigerian offers. The trend chart
  // compares the same small, representative set the share card renders —
  // lowest, typical (median floor), and highest — instead of drawing one
  // line per store. When none of those three carry a usable dated series,
  // fall back to the same lowest/median/highest selection scoped to the
  // offers that do, so the chart never goes dark while real trend evidence
  // exists for a different store than today's cheapest/typical/priciest.
  const observationCountByRetailer = new Map<string, number>();
  for (const observation of rawObservations) {
    const key = retailerKey(observation.retailer);
    observationCountByRetailer.set(
      key,
      (observationCountByRetailer.get(key) ?? 0) + 1,
    );
  }
  const retailersWithHistory = new Set(
    [...observationCountByRetailer.entries()]
      .filter(([, count]) => count >= 2)
      .map(([key]) => key),
  );

  const priceRepresentative = selectRepresentativeOffers(offers, priceOf);
  const priceRepresentativeHasHistory = Boolean(
    priceRepresentative?.unique.some((offer) =>
      retailersWithHistory.has(retailerKey(offer.retailer)),
    ),
  );
  const offersWithHistory = offers.filter((offer) =>
    retailersWithHistory.has(retailerKey(offer.retailer)),
  );
  const representative =
    priceRepresentativeHasHistory || offersWithHistory.length === 0
      ? priceRepresentative
      : (selectRepresentativeOffers(offersWithHistory, priceOf) ??
        priceRepresentative);
  const representativeOffers = representative?.unique ?? [];

  const summary = summarizeMarket(product.offers, "NG", now);

  // Build per-store offer data
  const stores: TrendStoreOffer[] = representativeOffers.map((offer) => {
    const stock = offer.priceObservation?.stock;
    const stockStatus: TrendStoreOffer["stockStatus"] =
      stock === "in-stock"
        ? "in-stock"
        : stock === "low-stock"
          ? "low-stock"
          : stock === "out-of-stock"
            ? "out-of-stock"
            : "unknown";
    const isLowest = offer === representative?.lowest;
    const isHighest = offer === representative?.highest;
    return {
      retailer: offer.retailer,
      priceNaira: offer.priceNgn as number,
      trustScore: offer.trust,
      stockStatus,
      lastVerifiedAt:
        offer.checkedAt ?? offer.priceObservation?.observedAt ?? null,
      isLowest,
      isTypical: offer === representative?.median && !isLowest && !isHighest,
      isMarketplace: Boolean(offer.orderChannels?.includes("marketplace")),
    };
  });

  // Project only append-only history rows that remain bound to one rendered
  // exact offer per retailer, and only for the representative comparison
  // set rendered above (never all 20-30+ stores). A retailer with multiple
  // offer IDs is ambiguous on the retailer-level chart and therefore fails
  // closed.
  const representativeRetailers = new Set(
    representativeOffers.map((offer) => retailerKey(offer.retailer)),
  );
  const offerIdsByRetailer = new Map<string, Set<string>>();
  for (const observation of rawObservations) {
    const key = retailerKey(observation.retailer);
    const offerIds = offerIdsByRetailer.get(key) ?? new Set<string>();
    offerIds.add(observation.offerId);
    offerIdsByRetailer.set(key, offerIds);
  }
  const points: TrendPricePoint[] = rawObservations
    .filter(
      (observation) =>
        representativeRetailers.has(retailerKey(observation.retailer)) &&
        offerIdsByRetailer.get(retailerKey(observation.retailer))?.size === 1,
    )
    .map((obs) => ({
      retailer: obs.retailer,
      priceNaira: obs.priceMinor,
      observedAt: obs.observedAt,
    }));

  points.sort(
    (left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt),
  );

  const observedIso =
    summary.lastCheckedAt ??
    offers[0].checkedAt ??
    offers[0].priceObservation?.observedAt;
  const observedDate = observedIso
    ? shortDate.format(new Date(observedIso))
    : "recently";

  return {
    slug: product.slug,
    brand: product.brand,
    name: product.name,
    image: product.image,
    category: product.category,
    size: product.size,
    points,
    stores,
    summary: {
      lowestNaira: summary.lowestPrice ?? (offers[0].priceNgn as number),
      medianNaira: summary.typicalPrice,
      highestNaira: summary.highestPrice,
      spreadNaira: summary.savings,
      storeCount: offers.length,
      avgTrust: Math.round(
        offers.reduce((sum, o) => sum + o.trust, 0) / offers.length,
      ),
      confidence: summary.confidence,
      observedDate,
      observedAt: observedIso ?? null,
    },
  };
}
