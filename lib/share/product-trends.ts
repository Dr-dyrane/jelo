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

  // A verified product can carry 20-30+ Nigerian offers. The trend chart
  // compares the same small, representative set the share card renders —
  // lowest, typical (median floor), and highest — instead of drawing one
  // line per store.
  const representative = selectRepresentativeOffers(
    offers,
    (offer) => offer.priceNgn as number,
  );
  const representativeOffers = representative?.unique ?? [];

  const snapshots = representativeOffers.flatMap((offer) => {
    const snap = priceTrendOfferSnapshot(offer, "NG", now);
    return snap ? [snap] : [];
  });

  const rawObservations = await fetchRawObservations(product.slug, snapshots);

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
  // exact offer per retailer. A retailer with multiple offer IDs is ambiguous
  // on the retailer-level chart and therefore fails closed.
  const snapshotRetailers = new Set(
    snapshots.map((snapshot) =>
      snapshot.retailer.trim().toLocaleLowerCase("en-NG"),
    ),
  );
  const offerIdsByRetailer = new Map<string, Set<string>>();
  for (const observation of rawObservations) {
    const key = observation.retailer.trim().toLocaleLowerCase("en-NG");
    const offerIds = offerIdsByRetailer.get(key) ?? new Set<string>();
    offerIds.add(observation.offerId);
    offerIdsByRetailer.set(key, offerIds);
  }
  const points: TrendPricePoint[] = rawObservations
    .filter(
      (observation) =>
        snapshotRetailers.has(
          observation.retailer.trim().toLocaleLowerCase("en-NG"),
        ) &&
        offerIdsByRetailer.get(
          observation.retailer.trim().toLocaleLowerCase("en-NG"),
        )?.size === 1,
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
