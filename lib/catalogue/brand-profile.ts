import { canonicalBrandName } from "@/data/brand-canonical-names";
import type { Product } from "@/data/products";
import { nigeriaRetailers, retailerSlug } from "@/data/retailers";
import { isShareableNgOffer } from "@/modules/commerce/shareable-offer";

const categoryOrder: Record<Product["category"], number> = {
  Face: 0,
  Body: 1,
  Hair: 2,
};

export function brandSlug(brand: string) {
  return canonicalBrandName(brand)
    .normalize("NFKD")
    .toLocaleLowerCase("en-NG")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function brandProfileHref(brand: string) {
  return `/brands/${brandSlug(brand)}`;
}

export function buildBrandDirectory(
  catalogue: readonly Product[],
  now: number | Date = Date.now(),
) {
  return [...new Set(catalogue.map((product) => brandSlug(product.brand)))]
    .map((slug) => buildBrandProfile(slug, catalogue, now))
    .filter((profile): profile is NonNullable<typeof profile> =>
      Boolean(profile),
    )
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function buildBrandProfile(
  requestedSlug: string,
  catalogue: readonly Product[],
  now: number | Date = Date.now(),
) {
  const products = catalogue
    .filter((product) => brandSlug(product.brand) === requestedSlug)
    .map((product) => ({
      ...product,
      brand: canonicalBrandName(product.brand),
    }))
    .sort(
      (left, right) =>
        categoryOrder[left.category] - categoryOrder[right.category] ||
        left.name.localeCompare(right.name) ||
        left.size.localeCompare(right.size),
    );

  if (!products.length) return null;

  const name = products[0].brand;
  const categoryCounts = (["Face", "Body", "Hair"] as const).flatMap(
    (category) => {
      const count = products.filter(
        (product) => product.category === category,
      ).length;
      return count ? [{ category, count }] : [];
    },
  );
  const retailerProducts = new Map<string, Set<string>>();
  let pricedProductCount = 0;
  let latestObservedAt: string | null = null;

  for (const product of products) {
    const freshOffers = product.offers.filter((offer) =>
      isShareableNgOffer(offer, now),
    );
    if (freshOffers.length) pricedProductCount += 1;
    for (const offer of freshOffers) {
      const slugs = retailerProducts.get(offer.retailer) ?? new Set<string>();
      slugs.add(product.slug);
      retailerProducts.set(offer.retailer, slugs);

      const observedAt =
        offer.priceObservation?.observedAt ??
        offer.listingEvidence?.observedAt ??
        offer.checkedAt;
      if (
        observedAt &&
        (!latestObservedAt ||
          Date.parse(observedAt) > Date.parse(latestObservedAt))
      ) {
        latestObservedAt = observedAt;
      }
    }
  }

  const retailers = [...retailerProducts.entries()]
    .map(([retailerName, productSlugs]) => {
      const retailer = nigeriaRetailers.find(
        (item) => item.name === retailerName,
      );
      return {
        name: retailerName,
        productCount: productSlugs.size,
        href: retailer ? `/retailers/${retailerSlug(retailer.name)}` : null,
      };
    })
    .sort(
      (left, right) =>
        right.productCount - left.productCount ||
        left.name.localeCompare(right.name),
    );

  const ownRetailer = nigeriaRetailers.find(
    (retailer) => retailerSlug(retailer.name) === requestedSlug,
  );

  return {
    slug: requestedSlug,
    name,
    products,
    productCount: products.length,
    categoryCounts,
    categoryCount: categoryCounts.length,
    pricedProductCount,
    retailers,
    latestObservedAt,
    ownRetailer: ownRetailer
      ? {
          name: ownRetailer.name,
          href: `/retailers/${retailerSlug(ownRetailer.name)}`,
        }
      : null,
  };
}
