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

export async function getProductPriceTrends(
  slug: string,
  snapshot: readonly PriceTrendOfferSnapshot[],
): Promise<ProductPriceTrends> {
  if (!hasPostgresConfig()) return {};
  if (snapshot.length === 0) return {};

  try {
    const sql = getPostgresClient();
    const rows = await sql<ObservationRow[]>`
      select
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
        h.observed_at::text as "observedAt"
      from offer_price_history h
      join offers o on o.id = h.offer_id
      join products p on p.id = o.product_id
      join retailers r on r.id = o.retailer_id
      where p.slug = ${slug}
        and o.match_kind = 'exact'
        and o.market_code in ('NG', 'US')
        and h.currency_code = case when o.market_code = 'NG' then 'NGN' else 'USD' end
        and h.observed_at >= now() - interval '46 days'
      order by h.observed_at asc
    `;
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
  } catch (error) {
    console.error(`Price history unavailable for ${slug}; hiding movement.`, error);
    return {};
  }
}
