import type { Concern } from "@/data/knowledge";
import type { Product } from "@/data/products";
import { getReviewedProductCare } from "@/data/product-care-review";

export type ConcernProduct = Pick<Product, "slug" | "category">;

export function isProductMatchConcern(concern: Concern) {
  return concern.kind === "concern";
}

function areaMatches(product: ConcernProduct, concern: Concern) {
  if (concern.area === "Face") return product.category === "Face";
  if (concern.area === "Body") return product.category === "Body";
  return product.category === "Hair";
}

export function productMatchesConcern(
  product: ConcernProduct,
  concern: Concern,
) {
  const review = getReviewedProductCare(product.slug);
  return (
    review?.careState === "supportive_eligible" &&
    productReferencesConcern(product, concern)
  );
}

export function productReferencesConcern(
  product: ConcernProduct,
  concern: Concern,
) {
  if (!isProductMatchConcern(concern)) return false;
  const review = getReviewedProductCare(product.slug);
  if (!review || review.careState === "insufficient_data") return false;
  const approvedConcernSlugs = new Set(
    review.approvedUses.flatMap((use) => use.concernSlugs ?? []),
  );
  return (
    areaMatches(product, concern) && approvedConcernSlugs.has(concern.slug)
  );
}

export function productsLinkedToConcern<T extends ConcernProduct>(
  products: readonly T[],
  concern: Concern,
) {
  const supportive: T[] = [];
  const reviewedContext: T[] = [];

  for (const product of products) {
    if (productMatchesConcern(product, concern)) {
      supportive.push(product);
    } else if (productReferencesConcern(product, concern)) {
      reviewedContext.push(product);
    }
  }

  return { supportive, reviewedContext };
}

export function productsWithReviewedConcernLinks<T extends ConcernProduct>(
  products: readonly T[],
  allConcerns: Concern[],
) {
  const ordinaryConcerns = allConcerns.filter(isProductMatchConcern);
  return products.filter((product) =>
    ordinaryConcerns.some((concern) =>
      productReferencesConcern(product, concern),
    ),
  );
}

function rankProductsByConcern<T extends ConcernProduct>(
  products: readonly T[],
  allConcerns: Concern[],
  selectedSlugs: string[],
  matches: (product: T, concern: Concern) => boolean,
) {
  const selected = allConcerns.filter(
    (concern) =>
      selectedSlugs.includes(concern.slug) && isProductMatchConcern(concern),
  );
  return products
    .map((product, index) => ({
      product,
      index,
      matchedConcernSlugs: selected
        .filter((concern) => matches(product, concern))
        .map((concern) => concern.slug),
    }))
    .filter((result) => result.matchedConcernSlugs.length > 0)
    .sort(
      (left, right) =>
        right.matchedConcernSlugs.length - left.matchedConcernSlugs.length ||
        left.index - right.index,
    );
}

export function rankProductsForConcerns<T extends ConcernProduct>(
  products: readonly T[],
  allConcerns: Concern[],
  selectedSlugs: string[],
) {
  return rankProductsByConcern(
    products,
    allConcerns,
    selectedSlugs,
    productMatchesConcern,
  );
}

export function rankReviewedContextForConcerns<T extends ConcernProduct>(
  products: readonly T[],
  allConcerns: Concern[],
  selectedSlugs: string[],
) {
  return rankProductsByConcern(
    products,
    allConcerns,
    selectedSlugs,
    (product, concern) =>
      !productMatchesConcern(product, concern) &&
      productReferencesConcern(product, concern),
  );
}
