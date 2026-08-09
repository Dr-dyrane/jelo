import type { Product } from "@/data/products";
import type { RetailerReference } from "@/data/retailers";
import { isShareableNgOffer } from "./shareable-offer";

function observedAt(product: Product, retailerName: string) {
  return product.offers
    .filter((offer) => offer.retailer === retailerName)
    .map(
      (offer) =>
        offer.priceObservation?.observedAt ??
        offer.listingEvidence?.observedAt ??
        offer.checkedAt,
    )
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter((value) => !Number.isNaN(value));
}

/**
 * The public retailer profile is an exact-offer view of the approved catalogue,
 * not a copy of the retailer's own catalogue. Product cards receive only the
 * retailer's current evidence-bound Nigerian offer so their price label cannot
 * accidentally summarize another store.
 */
export function buildRetailerProfile(
  retailer: RetailerReference,
  catalogue: readonly Product[],
  now: number | Date = Date.now(),
) {
  const products = catalogue
    .flatMap((product) => {
      const offers = product.offers.filter(
        (offer) =>
          offer.retailer === retailer.name && isShareableNgOffer(offer, now),
      );
      return offers.length ? [{ ...product, offers }] : [];
    })
    .sort(
      (left, right) =>
        left.category.localeCompare(right.category) ||
        left.brand.localeCompare(right.brand) ||
        left.name.localeCompare(right.name),
    );

  const timestamps = products.flatMap((product) =>
    observedAt(product, retailer.name),
  );
  const latestObservedAt = timestamps.length
    ? new Date(Math.max(...timestamps)).toISOString()
    : null;
  const categories = [...new Set(products.map((product) => product.category))];

  return {
    retailer,
    products,
    productCount: products.length,
    categories,
    latestObservedAt,
  };
}
