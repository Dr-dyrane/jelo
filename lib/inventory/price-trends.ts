import 'server-only';

import { hasPostgresConfig, getPostgresClient } from '@/lib/db/postgres';
import { calculatePriceTrends, type PriceObservation, type ProductPriceTrends } from '@/modules/commerce/price-trends';

type ObservationRow = PriceObservation & { market: 'NG' | 'US' };

export async function getProductPriceTrends(slug: string): Promise<ProductPriceTrends> {
  if (!hasPostgresConfig()) return {};

  try {
    const sql = getPostgresClient();
    const rows = await sql<ObservationRow[]>`
      select
        o.id::text as "offerId",
        r.name as retailer,
        h.price_minor::double precision as "priceMinor",
        h.observed_at::text as "observedAt",
        o.market_code as market
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

    const result: ProductPriceTrends = {};
    for (const market of ['NG', 'US'] as const) {
      const observations = rows.filter(row => row.market === market);
      if (observations.length) result[market] = calculatePriceTrends(observations);
    }
    return result;
  } catch (error) {
    console.error(`Price history unavailable for ${slug}; hiding movement.`, error);
    return {};
  }
}
