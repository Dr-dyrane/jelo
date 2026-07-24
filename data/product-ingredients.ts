export type IngredientSeed = {
  slug: string;
  inciName: string;
  commonName: string;
  summary: string;
  evidenceGrade: 'high' | 'moderate' | 'emerging' | 'insufficient';
  sensitiveSkinStatus: 'generally_safe' | 'use_with_caution' | 'avoid' | 'unknown';
};

export type ProductIngredientSeed = {
  ingredientSlug: string;
  position: number;
  concentrationPercent?: number;
  isActive: boolean;
  sourceUrl: string;
  verifiedAt: string;
};

export const ingredientSeeds: IngredientSeed[] = [
  { slug: 'benzoyl-peroxide', inciName: 'Benzoyl Peroxide', commonName: 'Benzoyl peroxide', summary: 'An acne treatment active used in rinse-off and leave-on products.', evidenceGrade: 'high', sensitiveSkinStatus: 'use_with_caution' },
  { slug: 'azelaic-acid', inciName: 'Azelaic Acid', commonName: 'Azelaic acid', summary: 'A treatment active used for blemish-prone skin and uneven-looking tone.', evidenceGrade: 'high', sensitiveSkinStatus: 'use_with_caution' },
  { slug: 'niacinamide', inciName: 'Niacinamide', commonName: 'Niacinamide', summary: 'A vitamin B3 ingredient used in barrier, tone and oil-balance formulas.', evidenceGrade: 'moderate', sensitiveSkinStatus: 'generally_safe' },
  { slug: 'tranexamic-acid', inciName: 'Tranexamic Acid', commonName: 'Tranexamic acid', summary: 'A topical tone-support ingredient used in discoloration formulas.', evidenceGrade: 'moderate', sensitiveSkinStatus: 'use_with_caution' },
  { slug: 'arbutin', inciName: 'Arbutin', commonName: 'Arbutin', summary: 'A tone-support ingredient used in brightening formulas.', evidenceGrade: 'moderate', sensitiveSkinStatus: 'use_with_caution' },
  { slug: 'salicylic-acid', inciName: 'Salicylic Acid', commonName: 'Salicylic acid', summary: 'A beta-hydroxy acid used in acne and exfoliating products.', evidenceGrade: 'high', sensitiveSkinStatus: 'use_with_caution' },
  { slug: 'ceramide-np', inciName: 'Ceramide NP', commonName: 'Ceramide NP', summary: 'A skin-identical lipid used in barrier-support formulas.', evidenceGrade: 'moderate', sensitiveSkinStatus: 'generally_safe' },
  { slug: 'ceramide-ap', inciName: 'Ceramide AP', commonName: 'Ceramide AP', summary: 'A skin-identical lipid used in barrier-support formulas.', evidenceGrade: 'moderate', sensitiveSkinStatus: 'generally_safe' },
  { slug: 'ceramide-eop', inciName: 'Ceramide EOP', commonName: 'Ceramide EOP', summary: 'A skin-identical lipid used in barrier-support formulas.', evidenceGrade: 'moderate', sensitiveSkinStatus: 'generally_safe' },
  { slug: 'hydrolyzed-hyaluronic-acid', inciName: 'Hydrolyzed Hyaluronic Acid', commonName: 'Hyaluronic acid', summary: 'A humectant used to support surface hydration.', evidenceGrade: 'moderate', sensitiveSkinStatus: 'generally_safe' },
  { slug: 'snail-secretion-filtrate', inciName: 'Snail Secretion Filtrate', commonName: 'Snail mucin', summary: 'A conditioning ingredient used in hydration-focused formulas.', evidenceGrade: 'emerging', sensitiveSkinStatus: 'use_with_caution' },
  { slug: 'ketoconazole', inciName: 'Ketoconazole', commonName: 'Ketoconazole', summary: 'An antifungal active used in medicated dandruff shampoos.', evidenceGrade: 'high', sensitiveSkinStatus: 'use_with_caution' },
];

export const ingredientSeedBySlug = (slug: string): IngredientSeed | null =>
  ingredientSeeds.find(seed => seed.slug === slug) ?? null;

const checkedAt = '2026-07-22';

export const verifiedProductIngredients: Record<string, ProductIngredientSeed[]> = {
  'anua-niacinamide-10-txa-4-serum': [
    { ingredientSlug: 'niacinamide', position: 3, concentrationPercent: 10, isActive: true, sourceUrl: 'https://anua.com/products/niacinamide-10-txa-4-serum-2', verifiedAt: checkedAt },
    { ingredientSlug: 'tranexamic-acid', position: 4, concentrationPercent: 4, isActive: true, sourceUrl: 'https://anua.com/products/niacinamide-10-txa-4-serum-2', verifiedAt: checkedAt },
    { ingredientSlug: 'arbutin', position: 7, concentrationPercent: 2, isActive: true, sourceUrl: 'https://anua.com/products/niacinamide-10-txa-4-serum-2', verifiedAt: checkedAt },
  ],
  'cerave-blemish-control-cleanser': [
    { ingredientSlug: 'niacinamide', position: 5, isActive: false, sourceUrl: 'https://africa.cerave.com/our-products/cleansers/blemish-control-cleanser', verifiedAt: checkedAt },
    { ingredientSlug: 'salicylic-acid', position: 6, concentrationPercent: 2, isActive: true, sourceUrl: 'https://africa.cerave.com/our-products/cleansers/blemish-control-cleanser', verifiedAt: checkedAt },
    { ingredientSlug: 'ceramide-np', position: 13, isActive: false, sourceUrl: 'https://africa.cerave.com/our-products/cleansers/blemish-control-cleanser', verifiedAt: checkedAt },
    { ingredientSlug: 'ceramide-ap', position: 14, isActive: false, sourceUrl: 'https://africa.cerave.com/our-products/cleansers/blemish-control-cleanser', verifiedAt: checkedAt },
    { ingredientSlug: 'ceramide-eop', position: 15, isActive: false, sourceUrl: 'https://africa.cerave.com/our-products/cleansers/blemish-control-cleanser', verifiedAt: checkedAt },
  ],
  'cerave-foaming-facial-cleanser': [
    { ingredientSlug: 'niacinamide', position: 6, isActive: false, sourceUrl: 'https://www.cerave.com/skincare/cleansers/foaming-facial-cleanser', verifiedAt: checkedAt },
    { ingredientSlug: 'ceramide-np', position: 10, isActive: false, sourceUrl: 'https://www.cerave.com/skincare/cleansers/foaming-facial-cleanser', verifiedAt: checkedAt },
    { ingredientSlug: 'ceramide-ap', position: 11, isActive: false, sourceUrl: 'https://www.cerave.com/skincare/cleansers/foaming-facial-cleanser', verifiedAt: checkedAt },
    { ingredientSlug: 'ceramide-eop', position: 12, isActive: false, sourceUrl: 'https://www.cerave.com/skincare/cleansers/foaming-facial-cleanser', verifiedAt: checkedAt },
    { ingredientSlug: 'hydrolyzed-hyaluronic-acid', position: 21, isActive: false, sourceUrl: 'https://www.cerave.com/skincare/cleansers/foaming-facial-cleanser', verifiedAt: checkedAt },
  ],
  'cosrx-advanced-snail-96-mucin-power-essence': [
    { ingredientSlug: 'snail-secretion-filtrate', position: 1, concentrationPercent: 96.3, isActive: false, sourceUrl: 'https://www.cosrx.com/collections/award-winning/products/advanced-snail-96-mucin-power-essence', verifiedAt: checkedAt },
  ],
  'nizoral-ad-ketoconazole-shampoo': [
    { ingredientSlug: 'ketoconazole', position: 1, concentrationPercent: 1, isActive: true, sourceUrl: 'https://nizoral.com/', verifiedAt: checkedAt },
  ],
  'panoxyl-acne-foaming-wash-10-benzoyl-peroxide': [
    { ingredientSlug: 'benzoyl-peroxide', position: 1, concentrationPercent: 10, isActive: true, sourceUrl: 'https://panoxyl.com/acne-products/acne-foaming-wash-benzoyl-peroxide/', verifiedAt: checkedAt },
  ],
  'the-ordinary-azelaic-acid-suspension-10': [
    { ingredientSlug: 'azelaic-acid', position: 4, concentrationPercent: 10, isActive: true, sourceUrl: 'https://theordinary.com/en-ca/azelaic-acid-suspension-10-exfoliator-100407.html', verifiedAt: checkedAt },
  ],
};

export function verifiedActiveIngredientIds(productSlug: string) {
  return (verifiedProductIngredients[productSlug] ?? [])
    .filter(ingredient => ingredient.isActive)
    .map(ingredient => ingredient.ingredientSlug);
}
