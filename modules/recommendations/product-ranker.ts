import type { Product } from '@/data/products';

type MatchInput = {
  concerns: string[];
  skinType?: string;
  sensitive?: boolean;
  location?: string;
};

export function rankProducts(products: Product[], input: MatchInput) {
  const concerns = input.concerns.map(value => value.toLowerCase());
  const skinType = input.skinType?.toLowerCase();

  return products
    .map(product => ({
      slug: product.slug,
      brand: product.brand,
      name: product.name,
      image: product.image,
      reason: product.displayLine,
      score: scoreProduct(product, concerns, skinType, Boolean(input.sensitive)),
    }))
    .filter(product => product.score > 0)
    .sort((a, b) => b.score - a.score);
}

function scoreProduct(product: Product, concerns: string[], skinType: string | undefined, sensitive: boolean) {
  const concernFit = concerns.reduce((score, concern) => score + (product.concerns.some(item => item.includes(concern) || concern.includes(item)) ? 24 : 0), 0);
  const skinFit = skinType && product.skinTypes.includes(skinType) ? 18 : 0;
  const sensitivity = sensitive ? (product.sensitiveFriendly ? 15 : -25) : 0;
  const evidence = product.evidence === 'high' ? 16 : product.evidence === 'moderate' ? 10 : 4;
  return concernFit + skinFit + sensitivity + evidence;
}
