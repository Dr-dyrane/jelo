import 'server-only';

import { listCatalogueProducts } from '@/lib/catalogue/repository';
import { getProductPriceTrends } from '@/lib/inventory/price-trends';
import { hasShareableNgOffer, isShareableNgOffer } from '@/modules/commerce/shareable-offer';
import { selectRecentDrops, selectShareGaps } from '@/modules/commerce/share-insights';
import { priceTrendOfferSnapshot } from '@/modules/commerce/price-trends';

export type { ShareGap, ShareDrop } from '@/modules/commerce/share-insights';

/** Products with a share-worthy price gap. In-memory over the catalogue, no DB. */
export async function listShareGaps(now: number | Date = Date.now()) {
  return selectShareGaps(await listCatalogueProducts(), now);
}

/**
 * Products whose observed NG price has notably fallen. A per-slug read of
 * offer_price_history via getProductPriceTrends, which returns {} when Postgres
 * is not configured, so this lane is silently empty on the static catalogue and
 * lights up on its own once Neon is switched on.
 */
export async function listRecentDrops(now: number | Date = Date.now()) {
  const products = (await listCatalogueProducts()).filter(product => hasShareableNgOffer(product, now));
  const items = await Promise.all(products.map(async product => ({
    product,
    trends: await getProductPriceTrends(
      product.slug,
      product.offers.filter(offer => isShareableNgOffer(offer, now)).flatMap(offer => {
        const snapshot = priceTrendOfferSnapshot(offer, 'NG', now);
        return snapshot ? [snapshot] : [];
      }),
    ),
  })));
  return selectRecentDrops(items, now);
}
