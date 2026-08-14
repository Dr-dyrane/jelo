import { getProductTrendData } from "@/lib/share/product-trends";
import { findCatalogueProduct } from "@/lib/catalogue/repository";
import { isShareableNgOffer } from "@/modules/commerce/shareable-offer";
import { priceTrendOfferSnapshot } from "@/modules/commerce/price-trends";
import { getProductPriceHistory } from "@/lib/inventory/price-trends";
import { hasPostgresConfig, getPostgresClient } from "@/lib/db/postgres";

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

  // Also query DB directly to see what rows exist
  let dbRows: unknown[] = [];
  let dbError: string | undefined;
  if (hasPostgresConfig()) {
    try {
      const sql = getPostgresClient();
      const referenceNow = Math.max(
        ...snapshot.map((s) => Date.parse(s.observedAt)),
      );
      const historyCutoff = new Date(referenceNow - 90 * 86_400_000);
      dbRows = await sql`
        select
          h.id::text as history_id,
          o.id::text as offer_id,
          r.name as retailer,
          o.url,
          o.market_code as market,
          h.price_minor,
          h.observed_at::text as observed_at,
          o.verification_expires_at::text as verification_expires_at
        from offer_price_history h
        join offers o on o.id = h.offer_id
        join products p on p.id = o.product_id
        join retailers r on r.id = o.retailer_id
        where p.slug = ${slug}
          and o.match_kind = 'exact'
          and o.market_code = 'NG'
          and h.currency_code = 'NGN'
          and h.observed_at >= ${historyCutoff}
        order by h.observed_at asc
      `;
    } catch (e) {
      dbError = String(e);
    }
  }

  return Response.json({
    slug,
    hasPostgresConfig: hasPostgresConfig(),
    offerCount: product.offers.length,
    shareableOfferCount: offers.length,
    snapshotCount: snapshot.length,
    snapshotUrls: snapshot.map((s) => ({
      retailer: s.retailer,
      url: s.url,
      observedAt: s.observedAt,
    })),
    snapshotObservedAts: [...new Set(snapshot.map((s) => s.observedAt))],
    historyCount: history.length,
    historyRows: history.map((h) => ({
      retailer: h.retailer,
      priceMinor: h.priceMinor,
      observedAt: h.observedAt,
      offerId: h.offerId?.slice(0, 30),
    })),
    dbRowCount: dbRows.length,
    dbRows,
    dbError,
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
