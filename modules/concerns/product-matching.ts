import type { Concern } from '@/data/knowledge';
import type { Product } from '@/data/products';

export type ConcernProduct = Pick<Product, 'slug' | 'category' | 'concerns'>;

function areaMatches(product: ConcernProduct, concern: Concern) {
  if (concern.area === 'Face') return product.category === 'Face';
  if (concern.area === 'Body') return product.category === 'Body';
  return product.category === 'Hair';
}

export function productMatchesConcern(product: ConcernProduct, concern: Concern) {
  return areaMatches(product, concern)
    && concern.productTerms.some(term => product.concerns.includes(term));
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
