import "server-only";

import { listCatalogueProducts } from "@/lib/catalogue/repository";
import { getProductsPriceTrends } from "@/lib/inventory/price-trends";
import {
  hasShareableNgOffer,
  isShareableNgOffer,
  isTrendEligibleNgOffer,
  hasTrendEligibleNgOffer,
} from "@/modules/commerce/shareable-offer";
import { priceTrendOfferSnapshot } from "@/modules/commerce/price-trends";
import {
  buildMarketTrendsReadModel,
  type MarketTrendsReadModel,
} from "@/modules/commerce/market-trends";

export type MarketTrendsOptions = {
  now?: number | Date;
};

export async function getMarketTrendsReadModel(
  options: MarketTrendsOptions = {},
): Promise<MarketTrendsReadModel> {
  const now = options.now ?? Date.now();
  const products = await listCatalogueProducts();

  // Use trend-eligible (not freshness-gated) offers for trend computation so
  // stale offers don't suppress price drops/increases. The summary stats and
  // OOS alerts below still use freshness-gated shareable offers.
  const trendEligibleProducts = products.filter((product) =>
    hasTrendEligibleNgOffer(product),
  );

  const trendsPromise = getProductsPriceTrends(
    trendEligibleProducts.map((product) => ({
      slug: product.slug,
      snapshot: product.offers
        .filter((offer) => isTrendEligibleNgOffer(offer))
        .flatMap((offer) => {
          const snapshot = priceTrendOfferSnapshot(offer, "NG", now, false);
          return snapshot ? [snapshot] : [];
        }),
    })),
  );

  return buildMarketTrendsReadModel(
    Promise.resolve(trendEligibleProducts),
    trendsPromise,
    { now, totalProductCount: products.length },
  );
}
