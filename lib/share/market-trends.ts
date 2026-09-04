import "server-only";

import { listCatalogueProducts } from "@/lib/catalogue/repository";
import { getProductsPriceTrends } from "@/lib/inventory/price-trends";
import {
  hasShareableNgOffer,
  isShareableNgOffer,
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

  // A public movement stays attached to the same current, actionable exact
  // offers used by Products, Share and Daily Desk. Append-only history may be
  // older, but a stale current listing cannot sponsor a shopper-facing trend.
  const trendEligibleProducts = products.filter((product) =>
    hasShareableNgOffer(product, now),
  );

  const trendsPromise = getProductsPriceTrends(
    trendEligibleProducts.map((product) => ({
      slug: product.slug,
      snapshot: product.offers
        .filter((offer) => isShareableNgOffer(offer, now))
        .flatMap((offer) => {
          const snapshot = priceTrendOfferSnapshot(offer, "NG", now);
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
