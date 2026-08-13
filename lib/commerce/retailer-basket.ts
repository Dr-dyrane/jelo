import type { Product } from "@/data/products";
import { findBundleStores, type BundleOffer } from "./bundle-finder";

export type RetailerBasketOption = BundleOffer & { quantityTotal: number };

export function chooseRetailerBasketOption(
  options: readonly RetailerBasketOption[],
  preferredRetailer: string | null | undefined,
) {
  return (
    options.find((option) => option.retailer === preferredRetailer) ??
    options[0]
  );
}

export function findRetailerBasketOptions(
  products: Pick<Product, "slug" | "name" | "brand" | "size" | "offers">[],
  quantities: ReadonlyMap<string, number>,
  now: number | Date = Date.now(),
): RetailerBasketOption[] {
  if (products.length === 0) return [];
  const bundles =
    products.length === 1
      ? findSingleProductRetailers(products[0], now)
      : findBundleStores(products, now).bundles;
  return bundles
    .map((bundle) => ({
      ...bundle,
      combinedTotal: bundle.offers.reduce(
        (total, offer) =>
          total + offer.priceNgn * (quantities.get(offer.productSlug) ?? 1),
        0,
      ),
      quantityTotal: bundle.offers.reduce(
        (total, offer) => total + (quantities.get(offer.productSlug) ?? 1),
        0,
      ),
    }))
    .sort((a, b) => a.combinedTotal - b.combinedTotal || b.trust - a.trust);
}

function findSingleProductRetailers(
  product: Pick<Product, "slug" | "name" | "brand" | "size" | "offers">,
  now: number | Date,
): BundleOffer[] {
  const companion: typeof product = {
    ...product,
    slug: `${product.slug}--single-order-companion`,
  };
  return findBundleStores([product, companion], now).bundles.map((bundle) => ({
    ...bundle,
    offers: bundle.offers.filter((offer) => offer.productSlug === product.slug),
    combinedTotal: bundle.offers[0]?.priceNgn ?? 0,
  }));
}
