import { NextResponse } from "next/server";
import { products as staticProducts } from "@/data/catalogue";
import { publishedIntakeProducts } from "@/data/published-intake-products";
import { materializeCurrentPersistedOffers } from "@/lib/catalogue/persisted-offers";
import { hasPostgresConfig, getPostgresClient } from "@/lib/db/postgres";
import { isOfferFresh } from "@/modules/commerce/offer-freshness";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug =
    url.searchParams.get("slug") ?? "estelin-vitamin-c-turmeric-face-oil-30ml";
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const inStatic = staticProducts.find((p) => p.slug === slug);
  const inIntake = publishedIntakeProducts.find((p) => p.slug === slug);

  const result: Record<string, unknown> = {
    slug,
    timestamp: new Date().toISOString(),
    env: {
      CATALOGUE_SOURCE: process.env.CATALOGUE_SOURCE,
      NODE_ENV: process.env.NODE_ENV,
      NEXT_RUNTIME: process.env.NEXT_RUNTIME,
      hasPostgresConfig: hasPostgresConfig(),
    },
    inStaticCatalogue: !!inStatic,
    staticOfferCount: inStatic?.offers?.length ?? 0,
    inPublishedIntake: !!inIntake,
    intakeOfferCount: inIntake?.offers?.length ?? 0,
  };

  if (hasPostgresConfig()) {
    try {
      const sql = getPostgresClient();
      const rows = await sql`
        select
          p.slug,
          p.is_published,
          coalesce((
            select jsonb_agg(jsonb_build_object(
              'retailer', r.name,
              'url', grouped.url,
              'trust', r.trust_score,
              'available', grouped.available,
              'priceNgn', case when grouped.market_code = 'NG' and grouped.currency_code = 'NGN' then grouped.price_minor end,
              'checkedAt', grouped.checked_at,
              'expiresAt', grouped.verification_expires_at,
              'verificationMethod', grouped.verification_method,
              'lastVerifiedAt', grouped.last_verified_at,
              'inventoryStatus', grouped.inventory_status,
              'observedTitle', grouped.observed_title,
              'observedSize', grouped.observed_size,
              'canonicalUrl', grouped.canonical_url,
              'match', grouped.match_kind,
              'location', jsonb_build_array(grouped.market_code)
            ) order by r.trust_score desc)
            from (
              select
                o.retailer_id,
                o.market_code,
                min(o.url) as url,
                bool_or(o.available) as available,
                min(o.price_minor) as price_minor,
                min(o.currency_code) as currency_code,
                max(o.checked_at) as checked_at,
                max(o.verification_method::text) as verification_method,
                max(o.last_verified_at) as last_verified_at,
                max(o.inventory_status::text) as inventory_status,
                max(o.observed_title) as observed_title,
                max(o.observed_size) as observed_size,
                max(o.canonical_url) as canonical_url,
                min(o.verification_expires_at) as verification_expires_at,
                case when bool_and(o.match_kind = 'search') then 'search' else 'exact' end as match_kind
              from offers o
              where o.product_id = p.id
              group by o.retailer_id, o.market_code
            ) grouped
            join retailers r on r.id = grouped.retailer_id
          ), '[]'::jsonb) as offers
        from products p
        where p.slug = ${slug} and p.is_published = true
      `;

      const row = rows[0];
      if (row) {
        const rawOffers = row.offers as Record<string, unknown>[];
        const product = { name: "Test", size: "30 ml" };
        const materialized = materializeCurrentPersistedOffers(
          product,
          rawOffers as Parameters<typeof materializeCurrentPersistedOffers>[1],
        );
        result.neonProduct = {
          slug: row.slug,
          isPublished: row.is_published,
          rawOfferCount: rawOffers.length,
          materializedOfferCount: materialized.length,
          offers: rawOffers.map((o) => ({
            retailer: o.retailer,
            priceNgn: o.priceNgn,
            match: o.match,
            available: o.available,
            verificationMethod: o.verificationMethod,
            lastVerifiedAt: o.lastVerifiedAt,
            checkedAt: o.checkedAt,
            expiresAt: o.expiresAt,
            observedTitle: o.observedTitle,
            observedSize: o.observedSize,
          })),
          materialized: materialized.map((o) => ({
            retailer: o.retailer,
            fresh: isOfferFresh(o),
            hasListingEvidence: !!o.listingEvidence,
            hasPriceObservation: !!o.priceObservation,
            priceNgn: o.priceNgn,
            checkedAt: o.checkedAt,
            expiresAt: o.expiresAt,
          })),
        };
      } else {
        result.neonProduct = null;
      }
    } catch (error) {
      result.neonError = error instanceof Error ? error.message : "unknown";
    }
  }

  return NextResponse.json(result, {
    headers: { "cache-control": "no-store" },
  });
}
