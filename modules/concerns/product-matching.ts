import type { Concern } from '@/data/knowledge';
import type { Product } from '@/data/products';
import { getReviewedProductCare } from '@/data/product-care-review';

export type ConcernProduct = Pick<Product, 'slug' | 'category'>;

function areaMatches(product: ConcernProduct, concern: Concern) {
  if (concern.area === 'Face') return product.category === 'Face';
  if (concern.area === 'Body') return product.category === 'Body';
  return product.category === 'Hair';
}

export function productMatchesConcern(product: ConcernProduct, concern: Concern) {
  if (concern.kind === 'condition-pattern') return false;
  const review = getReviewedProductCare(product.slug);
  if (!review || review.careState !== 'supportive_eligible') return false;
  const approvedConcernSlugs = new Set(review.approvedUses.flatMap(use => use.concernSlugs ?? []));
  return areaMatches(product, concern) && approvedConcernSlugs.has(concern.slug);
}

export function rankProductsForConcerns<T extends ConcernProduct>(products: T[], allConcerns: Concern[], selectedSlugs: string[]) {
  const selected = allConcerns.filter(concern => selectedSlugs.includes(concern.slug));
  return products
    .map((product, index) => ({
      product,
      index,
      matchedConcernSlugs: selected.filter(concern => productMatchesConcern(product, concern)).map(concern => concern.slug),
    }))
    .filter(result => result.matchedConcernSlugs.length > 0)
    .sort((left, right) => right.matchedConcernSlugs.length - left.matchedConcernSlugs.length || left.index - right.index);
}
