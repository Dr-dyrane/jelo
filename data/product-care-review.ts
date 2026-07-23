export type ProductCareState = 'supportive_eligible' | 'pharmacist_review' | 'insufficient_data';

export type ApprovedProductCareUse = {
  id: string;
  label: string;
  concernIds: readonly string[];
  concernSlugs?: readonly string[];
  skinTypes?: readonly string[];
};

export type ReviewedProductCare = {
  productSlug: string;
  careState: ProductCareState;
  approvedUses: readonly ApprovedProductCareUse[];
  evidenceSourceUrls: readonly string[];
  reviewedAt: string;
};

const reviewedAt = '2026-07-22';

/**
 * The explicit clinical-care decision for every product in the 23-item reviewed
 * catalogue. Catalogue prose, retailer listings and product names must never
 * substitute for a record here.
 */
export const reviewedProductCareManifest = {
  'cosrx-salicylic-acid-daily-gentle-cleanser': {
    productSlug: 'cosrx-salicylic-acid-daily-gentle-cleanser',
    careState: 'insufficient_data', approvedUses: [], evidenceSourceUrls: [], reviewedAt,
  },
  'some-by-mi-aha-bha-pha-miracle-toner': {
    productSlug: 'some-by-mi-aha-bha-pha-miracle-toner',
    careState: 'insufficient_data', approvedUses: [], evidenceSourceUrls: [], reviewedAt,
  },
  'anua-niacinamide-10-txa-4-serum': {
    productSlug: 'anua-niacinamide-10-txa-4-serum',
    careState: 'pharmacist_review',
    approvedUses: [{ id: 'tone-support-review', label: 'Tone-support review', concernIds: ['hyperpigmentation', 'dark spots'], concernSlugs: ['dark-spots'] }],
    evidenceSourceUrls: ['https://anua.com/products/niacinamide-10-txa-4-serum-2'], reviewedAt,
  },
  'face-facts-wonder-cream-fragrance-free': {
    productSlug: 'face-facts-wonder-cream-fragrance-free',
    careState: 'insufficient_data', approvedUses: [], evidenceSourceUrls: [], reviewedAt,
  },
  'face-facts-bright-clear-face-cream': {
    productSlug: 'face-facts-bright-clear-face-cream',
    careState: 'insufficient_data', approvedUses: [], evidenceSourceUrls: [], reviewedAt,
  },
  'b-lab-matcha-hydrating-real-sunscreen': {
    productSlug: 'b-lab-matcha-hydrating-real-sunscreen',
    careState: 'insufficient_data', approvedUses: [], evidenceSourceUrls: [], reviewedAt,
  },
  'dove-moroccan-argan-oil-beauty-bar': {
    productSlug: 'dove-moroccan-argan-oil-beauty-bar',
    careState: 'insufficient_data', approvedUses: [], evidenceSourceUrls: [], reviewedAt,
  },
  'dove-go-fresh-cucumber-green-tea-spray': {
    productSlug: 'dove-go-fresh-cucumber-green-tea-spray',
    careState: 'insufficient_data', approvedUses: [], evidenceSourceUrls: [], reviewedAt,
  },
  'miracle-natural-hair-anti-dandruff-shampoo': {
    productSlug: 'miracle-natural-hair-anti-dandruff-shampoo',
    careState: 'insufficient_data', approvedUses: [], evidenceSourceUrls: [], reviewedAt,
  },
  'lush-hair-mentholated-conditioner': {
    productSlug: 'lush-hair-mentholated-conditioner',
    careState: 'insufficient_data', approvedUses: [], evidenceSourceUrls: [], reviewedAt,
  },
  'mediana-leave-in-conditioning-milk': {
    productSlug: 'mediana-leave-in-conditioning-milk',
    careState: 'insufficient_data', approvedUses: [], evidenceSourceUrls: [], reviewedAt,
  },
  'kuza-indian-hemp-hair-scalp-treatment': {
    productSlug: 'kuza-indian-hemp-hair-scalp-treatment',
    careState: 'insufficient_data', approvedUses: [], evidenceSourceUrls: [], reviewedAt,
  },
  'ogx-renewing-argan-oil-of-morocco': {
    productSlug: 'ogx-renewing-argan-oil-of-morocco',
    careState: 'insufficient_data', approvedUses: [], evidenceSourceUrls: [], reviewedAt,
  },
  'disaar-argan-oil-body-oil-gel': {
    productSlug: 'disaar-argan-oil-body-oil-gel',
    careState: 'insufficient_data', approvedUses: [], evidenceSourceUrls: [], reviewedAt,
  },
  'cerave-foaming-facial-cleanser': {
    productSlug: 'cerave-foaming-facial-cleanser',
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'normal-oily-cleansing', label: 'Cleansing for normal or oily skin', concernIds: ['oiliness'], concernSlugs: ['oily-congested-skin'], skinTypes: ['normal', 'oily'],
    }],
    evidenceSourceUrls: ['https://www.cerave.com/skincare/cleansers/foaming-facial-cleanser'], reviewedAt,
  },
  'cerave-blemish-control-cleanser': {
    productSlug: 'cerave-blemish-control-cleanser',
    careState: 'pharmacist_review',
    approvedUses: [{ id: 'blemish-cleansing-review', label: 'Blemish-cleansing review', concernIds: ['acne', 'blackheads', 'whiteheads'], concernSlugs: ['acne-breakouts'] }],
    evidenceSourceUrls: ['https://africa.cerave.com/our-products/cleansers/blemish-control-cleanser'], reviewedAt,
  },
  'the-ordinary-azelaic-acid-suspension-10': {
    productSlug: 'the-ordinary-azelaic-acid-suspension-10',
    careState: 'pharmacist_review',
    approvedUses: [{ id: 'azelaic-acid-review', label: 'Azelaic-acid review', concernIds: ['acne', 'hyperpigmentation', 'dark spots', 'redness'], concernSlugs: ['acne-breakouts', 'dark-spots'] }],
    evidenceSourceUrls: ['https://theordinary.com/en-ca/azelaic-acid-suspension-10-exfoliator-100407.html'], reviewedAt,
  },
  'la-roche-posay-anthelios-uvmune-400-oil-control-fluid': {
    productSlug: 'la-roche-posay-anthelios-uvmune-400-oil-control-fluid',
    careState: 'insufficient_data', approvedUses: [], evidenceSourceUrls: [], reviewedAt,
  },
  'la-roche-posay-toleriane-double-repair-spf30': {
    productSlug: 'la-roche-posay-toleriane-double-repair-spf30',
    careState: 'insufficient_data', approvedUses: [], evidenceSourceUrls: [], reviewedAt,
  },
  'la-roche-posay-toleriane-double-repair-matte': {
    productSlug: 'la-roche-posay-toleriane-double-repair-matte',
    careState: 'insufficient_data', approvedUses: [], evidenceSourceUrls: [], reviewedAt,
  },
  'cosrx-advanced-snail-96-mucin-power-essence': {
    productSlug: 'cosrx-advanced-snail-96-mucin-power-essence',
    careState: 'supportive_eligible',
    approvedUses: [{ id: 'hydration-conditioning', label: 'Hydration and skin conditioning', concernIds: ['dryness', 'dehydration'], concernSlugs: ['dry-dehydrated-skin'] }],
    evidenceSourceUrls: ['https://www.cosrx.com/collections/award-winning/products/advanced-snail-96-mucin-power-essence'], reviewedAt,
  },
  'panoxyl-acne-foaming-wash-10-benzoyl-peroxide': {
    productSlug: 'panoxyl-acne-foaming-wash-10-benzoyl-peroxide',
    careState: 'pharmacist_review',
    approvedUses: [{ id: 'benzoyl-peroxide-wash-review', label: 'Benzoyl-peroxide wash review', concernIds: ['acne', 'body acne', 'breakouts'], concernSlugs: ['acne-breakouts'] }],
    evidenceSourceUrls: ['https://panoxyl.com/acne-products/acne-foaming-wash-benzoyl-peroxide/'], reviewedAt,
  },
  'nizoral-ad-ketoconazole-shampoo': {
    productSlug: 'nizoral-ad-ketoconazole-shampoo',
    careState: 'pharmacist_review',
    approvedUses: [{ id: 'antidandruff-shampoo-review', label: 'Medicated dandruff-shampoo review', concernIds: ['dandruff', 'itch', 'flaking', 'seborrheic dermatitis'], concernSlugs: ['dandruff-itchy-scalp'] }],
    evidenceSourceUrls: ['https://nizoral.com/'], reviewedAt,
  },
} as const satisfies Record<string, ReviewedProductCare>;

const careBySlug = reviewedProductCareManifest as Record<string, ReviewedProductCare>;

export function getReviewedProductCare(productSlug: string) {
  return careBySlug[productSlug];
}

export function matchingApprovedProductUses(
  review: ReviewedProductCare,
  input: { concerns: readonly string[]; skinType?: string },
) {
  const concerns = new Set(input.concerns.map(value => value.trim().toLowerCase()));
  const skinType = input.skinType?.trim().toLowerCase();

  return review.approvedUses.filter(use => (
    use.concernIds.some(concern => concerns.has(concern.toLowerCase()))
    || Boolean(skinType && use.skinTypes?.some(type => type.toLowerCase() === skinType))
  ));
}
