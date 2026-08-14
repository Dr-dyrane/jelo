import { getProductTrendData } from "@/lib/share/product-trends";
import { findCatalogueProduct } from "@/lib/catalogue/repository";
import { isShareableNgOffer } from "@/modules/commerce/shareable-offer";
import { priceTrendOfferSnapshot } from "@/modules/commerce/price-trends";
import { getProductPriceHistory } from "@/lib/inventory/price-trends";
import { hasPostgresConfig } from "@/lib/db/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug =
    url.searchParams.get("slug") ??
    "advanced-clinicals-vitamin-c-face-serum-52ml";

  const product = await findCatalogueProduct(slug);
  if (!product) {
    return Response.json({ error: "product not found", slug });
  }

  const now = Date.now();
  const offers = product.offers.filter((o) => isShareableNgOffer(o, now));
  const snapshot = offers.flatMap((o) => {
    const s = priceTrendOfferSnapshot(o, "NG", now);
    return s ? [s] : [];
  });

  const history = await getProductPriceHistory(slug, snapshot);
  const trendData = await getProductTrendData(slug);

  return Response.json({
    slug,
    hasPostgresConfig: hasPostgresConfig(),
    offerCount: product.offers.length,
    shareableOfferCount: offers.length,
    snapshotCount: snapshot.length,
    snapshotObservedAts: [...new Set(snapshot.map((s) => s.observedAt))],
    historyCount: history.length,
    historyRows: history.map((h) => ({
      retailer: h.retailer,
      priceMinor: h.priceMinor,
      observedAt: h.observedAt,
      offerId: h.offerId?.slice(0, 30),
    })),
    trendData: trendData
      ? {
          pointsCount: trendData.points.length,
          points: trendData.points.map((p) => ({
            retailer: p.retailer,
            priceNaira: p.priceNaira,
            observedAt: p.observedAt,
          })),
          summaryObservedAt: trendData.summary.observedAt,
          storeCount: trendData.stores.length,
        }
      : null,
  });
}
