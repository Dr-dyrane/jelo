import "server-only";

import { findCatalogueProduct } from "@/lib/catalogue/repository";
import {
  getProductPriceTrends,
  getProductPriceHistory,
} from "@/lib/inventory/price-trends";
import { staticPriceHistory } from "@/data/price-history";
import { summarizeMarket } from "@/modules/commerce/market-summary";
import {
  compactPriceMovementLabel,
  preferredPriceMovement,
  priceTrendOfferSnapshot,
  type PriceObservation,
  type PriceTrendOfferSnapshot,
} from "@/modules/commerce/price-trends";
import { isShareableNgOffer } from "@/modules/commerce/shareable-offer";

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
  isMarketplace: boolean;
  trendLabel: string | null;
  trendDirection: "down" | "up" | "flat" | null;
};

export type TrendSummary = {
  lowestNaira: number;
  medianNaira: number | null;
  highestNaira: number | null;
  spreadNaira: number | null;
  storeCount: number;
  avgTrust: number;
  confidence: number;
  marketTrendLabel: string | null;
  marketTrendDirection: "down" | "up" | "flat" | null;
  observedDate: string;
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
 * Fallback: static price history data (anchor + current price per retailer)
 * when no database is configured or the query returns no rows.
 */
async function fetchRawObservations(
  slug: string,
  snapshot: readonly PriceTrendOfferSnapshot[],
): Promise<PriceObservation[]> {
  // Try the database first — this is where live price history lives
  const dbObservations = await getProductPriceHistory(slug);
  if (dbObservations.length > 0) return dbObservations;

  // Fall back to static price history when no DB or no rows
  const historyEntries = staticPriceHistory.filter(
    (entry) => entry.productSlug === slug,
  );
  const observations: PriceObservation[] = [];

  for (const entry of historyEntries) {
    const snap = snapshot.find(
      (s) =>
        s.market === "NG" &&
        s.retailer.trim().toLocaleLowerCase("en-NG") ===
          entry.retailer.trim().toLocaleLowerCase("en-NG"),
    );
    if (!snap) continue;
    const offerId = `static-${slug}-${entry.retailer}`;
    observations.push({
      historyId: `static-${slug}-${entry.retailer}-anchor`,
      offerId,
      retailer: entry.retailer,
      priceMinor: entry.oldPriceNgn,
      observedAt: entry.oldObservedAt,
      recordedAt: entry.oldObservedAt,
    });
    observations.push({
      historyId: `static-${slug}-${entry.retailer}-current`,
      offerId,
      retailer: snap.retailer,
      priceMinor: snap.priceMinor,
      observedAt: snap.observedAt,
      recordedAt: snap.observedAt,
    });
  }

  return observations;
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

  const snapshots = offers.flatMap((offer) => {
    const snap = priceTrendOfferSnapshot(offer, "NG", now);
    return snap ? [snap] : [];
  });

  const [trends, rawObservations] = await Promise.all([
    getProductPriceTrends(product.slug, snapshots),
    fetchRawObservations(product.slug, snapshots),
  ]);

  const summary = summarizeMarket(product.offers, "NG", now);
  const marketMovement = preferredPriceMovement(
    trends.NG,
    (movement) =>
      movement.direction !== "flat" &&
      (movement.comparableRetailerCount ?? 0) >= 2,
  );
  const marketTrendLabel = compactPriceMovementLabel(marketMovement);

  // Build per-store offer data
  const stores: TrendStoreOffer[] = offers.map((offer, index) => {
    const stock = offer.priceObservation?.stock;
    const stockStatus: TrendStoreOffer["stockStatus"] =
      stock === "in-stock"
        ? "in-stock"
        : stock === "low-stock"
          ? "low-stock"
          : stock === "out-of-stock"
            ? "out-of-stock"
            : "unknown";
    const offerTrend = trends.byOffer?.NG?.find(
      (item) =>
        item.retailer.trim().toLocaleLowerCase("en-NG") ===
        offer.retailer.trim().toLocaleLowerCase("en-NG"),
    );
    const offerMovement = offerTrend
      ? preferredPriceMovement(offerTrend, (m) => m.direction !== "flat")
      : null;
    return {
      retailer: offer.retailer,
      priceNaira: offer.priceNgn as number,
      trustScore: offer.trust,
      stockStatus,
      lastVerifiedAt:
        offer.checkedAt ?? offer.priceObservation?.observedAt ?? null,
      isLowest: index === 0,
      isMarketplace: Boolean(offer.orderChannels?.includes("marketplace")),
      trendLabel: compactPriceMovementLabel(offerMovement),
      trendDirection: offerMovement?.direction ?? null,
    };
  });

  // Build chart points from raw observations + current snapshot prices.
  // The current snapshot ensures every retailer with a live offer has at
  // least one point, even if the DB has no history yet. Combined with
  // historical observations, this gives us 2+ points for the chart line.
  const points: TrendPricePoint[] = rawObservations.map((obs) => ({
    retailer: obs.retailer,
    priceNaira: obs.priceMinor,
    observedAt: obs.observedAt,
  }));

  // Add current snapshot prices as the latest data point for each retailer
  const knownRetailers = new Set(
    points.map((p) => p.retailer.trim().toLocaleLowerCase("en-NG")),
  );
  for (const snap of snapshots) {
    if (snap.market !== "NG") continue;
    const key = snap.retailer.trim().toLocaleLowerCase("en-NG");
    if (knownRetailers.has(key)) continue;
    points.push({
      retailer: snap.retailer,
      priceNaira: snap.priceMinor,
      observedAt: snap.observedAt,
    });
    knownRetailers.add(key);
  }

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
      marketTrendLabel,
      marketTrendDirection: marketMovement?.direction ?? null,
      observedDate,
    },
  };
}
