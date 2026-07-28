import 'server-only';

import { listCatalogueProducts } from '@/lib/catalogue/repository';
import { getProductsPriceTrends } from '@/lib/inventory/price-trends';
import { hasShareableNgOffer, isShareableNgOffer } from '@/modules/commerce/shareable-offer';
import { selectRecentDrops, selectShareGaps } from '@/modules/commerce/share-insights';
import { priceTrendOfferSnapshot } from '@/modules/commerce/price-trends';

export type { ShareGap, ShareDrop } from '@/modules/commerce/share-insights';

/** Products with a share-worthy price gap. In-memory over the catalogue, no DB. */
export async function listShareGaps(now: number | Date = Date.now()) {
  return selectShareGaps(await listCatalogueProducts(), now);
}

/**
 * Products whose observed NG price has notably fallen. All eligible products'
 * history is read in one batch, with each result still bound to that product's
 * exact rendered offer snapshot. The batch returns empty trends when Postgres
 * is not configured, so this lane stays silently empty on the static catalogue
 * and lights up on its own once Neon is switched on.
 */
export async function listRecentDrops(now: number | Date = Date.now()) {
  const products = (await listCatalogueProducts()).filter(product => hasShareableNgOffer(product, now));
  const trends = await getProductsPriceTrends(products.map(product => ({
    slug: product.slug,
    snapshot: product.offers.filter(offer => isShareableNgOffer(offer, now)).flatMap(offer => {
      const snapshot = priceTrendOfferSnapshot(offer, 'NG', now);
      return snapshot ? [snapshot] : [];
    }),
  })));
  const items = products.map(product => ({
    product,
    trends: trends.get(product.slug) ?? {},
  }));
  return selectRecentDrops(items, now);
}
