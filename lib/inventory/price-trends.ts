import 'server-only';

import { hasPostgresConfig, getPostgresClient } from '@/lib/db/postgres';
import {
  calculateOfferPriceTrends,
  calculatePriceTrends,
  selectCurrentPriceObservations,
  type CurrentPriceObservation,
  type PriceTrendOfferSnapshot,
  type ProductPriceTrends,
} from '@/modules/commerce/price-trends';

type ObservationRow = CurrentPriceObservation;
type ProductObservationRow = ObservationRow & {
  productSlug: string;
};

export type ProductPriceTrendRequest = {
  slug: string;
  snapshot: readonly PriceTrendOfferSnapshot[];
};

function calculateProductPriceTrends(
  rows: ObservationRow[],
  snapshot: readonly PriceTrendOfferSnapshot[],
): ProductPriceTrends {
  const observations = selectCurrentPriceObservations(rows, snapshot);

  const result: ProductPriceTrends = {};
  for (const market of ['NG', 'US'] as const) {
    const marketOfferIds = new Set(
      rows.filter(row => row.market === market).map(row => row.offerId),
    );
    const marketObservations = observations.filter(
      observation => marketOfferIds.has(observation.offerId),
    );
    if (!marketObservations.length) continue;

    result[market] = calculatePriceTrends(marketObservations);
    const offerTrends = calculateOfferPriceTrends(marketObservations);
    if (offerTrends.length) {
      result.byOffer ??= {};
      result.byOffer[market] = offerTrends;
    }
  }
  return result;
}

/**
 * Reads price history for many products in one round trip, then intersects each
 * product's rows with only that product's rendered exact-offer snapshot.
 *
 * Duplicate slugs fail closed because two snapshots for one product would make
 * the evidence identity ambiguous.
 */
export async function getProductsPriceTrends(
  requests: readonly ProductPriceTrendRequest[],
): Promise<ReadonlyMap<string, ProductPriceTrends>> {
  const results = new Map<string, ProductPriceTrends>();
  const snapshots = new Map<string, readonly PriceTrendOfferSnapshot[]>();
  const ambiguousSlugs = new Set<string>();
  const seenSlugs = new Set<string>();

  for (const request of requests) {
    const slug = request.slug.trim();
    if (!slug) continue;
    results.set(slug, {});

    if (seenSlugs.has(slug)) {
      snapshots.delete(slug);
      ambiguousSlugs.add(slug);
      continue;
    }
    seenSlugs.add(slug);
    if (!ambiguousSlugs.has(slug) && request.snapshot.length > 0) {
      snapshots.set(slug, request.snapshot);
    }
  }

  if (!hasPostgresConfig() || snapshots.size === 0) return results;

  const slugs = [...snapshots.keys()];
  try {
    const sql = getPostgresClient();
    const rows = await sql<ProductObservationRow[]>`
      select
        p.slug::text as "productSlug",
        h.id::text as "historyId",
        o.id::text as "offerId",
        r.name as retailer,
        o.url,
        o.market_code as market,
        o.available,
        o.inventory_status as "inventoryStatus",
        o.verification_method as "verificationMethod",
        o.last_verified_at::text as "lastVerifiedAt",
        o.verification_expires_at::text as "verificationExpiresAt",
        o.observed_title as "observedTitle",
        o.observed_size as "observedSize",
        o.price_minor::double precision as "currentPriceMinor",
        o.currency_code::text as "currentCurrencyCode",
        h.price_minor::double precision as "priceMinor",
        h.observed_at::text as "observedAt",
        h.created_at::text as "recordedAt"
      from offer_price_history h
      join offers o on o.id = h.offer_id
      join products p on p.id = o.product_id
      join retailers r on r.id = o.retailer_id
      where p.slug = any(${slugs}::text[])
        and o.match_kind = 'exact'
        and o.market_code in ('NG', 'US')
        and h.currency_code = case when o.market_code = 'NG' then 'NGN' else 'USD' end
        and h.observed_at >= now() - interval '46 days'
      order by p.slug asc, h.observed_at asc, h.created_at asc, h.id asc
    `;

    const rowsBySlug = new Map<string, ObservationRow[]>();
    for (const { productSlug, ...row } of rows) {
      if (!snapshots.has(productSlug)) continue;
      const productRows = rowsBySlug.get(productSlug);
      if (productRows) {
        productRows.push(row);
      } else {
        rowsBySlug.set(productSlug, [row]);
      }
    }

    for (const [slug, snapshot] of snapshots) {
      results.set(
        slug,
        calculateProductPriceTrends(rowsBySlug.get(slug) ?? [], snapshot),
      );
    }
    return results;
  } catch (error) {
    console.error(
      `Price history unavailable for ${slugs.length} ${
        slugs.length === 1 ? 'product' : 'products'
      }; hiding movement.`,
      error,
    );
    return results;
  }
}

export async function getProductPriceTrends(
  slug: string,
  snapshot: readonly PriceTrendOfferSnapshot[],
): Promise<ProductPriceTrends> {
  const trends = await getProductsPriceTrends([{ slug, snapshot }]);
  return trends.get(slug.trim()) ?? {};
}
