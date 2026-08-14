import "server-only";

import { listCatalogueProducts } from "@/lib/catalogue/repository";
import { getProductsPriceTrends } from "@/lib/inventory/price-trends";
import {
  hasTrendEligibleNgOffer,
  isTrendEligibleNgOffer,
} from "@/modules/commerce/shareable-offer";
import {
  buildShareSignalReadModel,
  type AggregateProductInterest,
} from "@/modules/commerce/share-insights";
import { priceTrendOfferSnapshot } from "@/modules/commerce/price-trends";

export type AggregateProductInterestSource = {
  readProductInterest(
    productSlugs: readonly string[],
  ): Promise<AggregateProductInterest>;
};

export type WorthSharingReadOptions = {
  now?: number | Date;
  aggregateInterestSource?: AggregateProductInterestSource;
};

async function readAggregateInterest(
  source: AggregateProductInterestSource | undefined,
  productSlugs: readonly string[],
) {
  if (!source) return undefined;
  try {
    return await source.readProductInterest(productSlugs);
  } catch {
    return undefined;
  }
}

/**
 * Canonical server read for /share and /share/[slug]. Product history is read in
 * one batch and remains bound to each exact current offer snapshot.
 *
 * No live aggregate-interest provider is wired today: product_view and
 * share_click are not shipped, the customer demand bridge is research-only,
 * and store_click is permanently forbidden as a ranking input. The optional
 * provider is therefore neutral unless a future approved aggregate-only source
 * is passed explicitly; provider absence or failure never changes the page.
 */
export async function getWorthSharingReadModel(
  options: WorthSharingReadOptions = {},
) {
  const now = options.now ?? Date.now();
  const products = (await listCatalogueProducts()).filter((product) =>
    hasTrendEligibleNgOffer(product),
  );
  const [trends, aggregateInterest] = await Promise.all([
    getProductsPriceTrends(
      products.map((product) => ({
        slug: product.slug,
        snapshot: product.offers
          .filter((offer) => isTrendEligibleNgOffer(offer))
          .flatMap((offer) => {
            const snapshot = priceTrendOfferSnapshot(offer, "NG", now, false);
            return snapshot ? [snapshot] : [];
          }),
      })),
    ),
    readAggregateInterest(
      options.aggregateInterestSource,
      products.map((product) => product.slug),
    ),
  ]);
  const items = products.map((product) => ({
    product,
    trends: trends.get(product.slug) ?? {},
  }));
  return buildShareSignalReadModel(items, now, aggregateInterest);
}
