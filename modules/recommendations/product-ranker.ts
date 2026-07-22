import type { Product } from '@/data/products';
import { getReviewedProductCare, matchingApprovedProductUses } from '@/data/product-care-review';

type MatchInput = {
  concerns: string[];
  skinType?: string;
  sensitive?: boolean;
  location?: string;
};

export function rankProducts(products: Product[], input: MatchInput) {
  return products
    .map(product => {
      const review = getReviewedProductCare(product.slug);
      const approvedUses = review
        ? matchingApprovedProductUses(review, { concerns: input.concerns, skinType: input.skinType })
        : [];
      const score = review?.careState === 'supportive_eligible' ? approvedUses.length * 24 : 0;

      return {
        slug: product.slug,
        brand: product.brand,
        name: product.name,
        image: product.image,
        reason: approvedUses[0]?.label ?? '',
        score,
      };
    })
    .filter(product => product.score > 0)
    .sort((a, b) => b.score - a.score);
}
