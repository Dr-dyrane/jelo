import 'server-only';

import { listCatalogueProducts } from '@/lib/catalogue/repository';
import { getProductsPriceTrends } from '@/lib/inventory/price-trends';
import { hasShareableNgOffer, isShareableNgOffer } from '@/modules/commerce/shareable-offer';
import { priceTrendOfferSnapshot } from '@/modules/commerce/price-trends';
import {
  buildMarketTrendsReadModel,
  type MarketTrendsReadModel,
} from '@/modules/commerce/market-trends';

export type MarketTrendsOptions = {
  now?: number | Date;
};

export async function getMarketTrendsReadModel(
  options: MarketTrendsOptions = {},
): Promise<MarketTrendsReadModel> {
  const now = options.now ?? Date.now();
  const products = await listCatalogueProducts();

  const shareableProducts = products.filter(product => hasShareableNgOffer(product, now));

  const trendsPromise = getProductsPriceTrends(
    shareableProducts.map(product => ({
      slug: product.slug,
      snapshot: product.offers
        .filter(offer => isShareableNgOffer(offer, now))
        .flatMap(offer => {
          const snapshot = priceTrendOfferSnapshot(offer, 'NG', now);
          return snapshot ? [snapshot] : [];
        }),
    })),
  );

  return buildMarketTrendsReadModel(
    Promise.resolve(shareableProducts),
    trendsPromise,
    { now, totalProductCount: products.length },
  );
}
