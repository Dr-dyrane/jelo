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
 * The explicit clinical-care decision for every product in the
 * 24-item reviewed catalogue. Catalogue prose, retailer listings and product
 * names must never substitute for a record here.
 */
export const reviewedProductCareManifest = {
  'skin-by-zaron-vitamin-c-body-lotion-500ml': {
    productSlug: 'skin-by-zaron-vitamin-c-body-lotion-500ml',
    careState: 'insufficient_data', approvedUses: [], evidenceSourceUrls: [], reviewedAt,
  },
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
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'everyday-underarm-odour-control',
      label: 'Everyday underarm odour control',
      concernIds: ['body odour', 'underarm odour'],
      concernSlugs: ['sweat-body-odour'],
    }],
    evidenceSourceUrls: [
      'https://www.dove.com/us/en/p/dove-0-aluminum-deodorant-spray-cucumber-green-tea.html/00079400482280',
      'https://www.nhs.uk/symptoms/body-odour-bo/',
    ],
    reviewedAt: '2026-07-27',
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

/**
 * Publication is not care approval. These records are a separate, explicit
 * handoff from immutable catalogue dossiers into concern browsing. A targeted
 * product can be discoverable as reviewed context while remaining excluded
 * from direct recommendations through `pharmacist_review`.
 */
export const publishedProductCareManifest = {
  'cerave-hydrating-cleanser-473ml': {
    productSlug: 'cerave-hydrating-cleanser-473ml',
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'normal-dry-gentle-cleansing',
      label: 'Gentle cleansing for normal-to-dry skin',
      concernIds: ['dryness', 'dehydration', 'tightness'],
      concernSlugs: ['dry-dehydrated-skin'],
      skinTypes: ['normal', 'dry'],
    }],
    evidenceSourceUrls: [
      'https://africa.cerave.com/en/our-products/cleansers/hydrating-cleanser',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
    ],
    reviewedAt: '2026-07-23',
  },
  'cerave-moisturising-cream-454g': {
    productSlug: 'cerave-moisturising-cream-454g',
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'dry-body-moisturising',
      label: 'Moisturising dry-to-very-dry body skin',
      concernIds: ['body dryness', 'rough skin', 'very dry skin'],
      concernSlugs: ['dry-rough-body-skin'],
      skinTypes: ['dry', 'very dry'],
    }],
    evidenceSourceUrls: [
      'https://africa.cerave.com/en/our-products/moisturizers/moisturising-cream',
      'https://www.nhs.uk/tests-and-treatments/emollients/',
    ],
    reviewedAt: '2026-07-23',
  },
  'cerave-pm-facial-moisturising-lotion-52ml': {
    productSlug: 'cerave-pm-facial-moisturising-lotion-52ml',
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'sensitive-dry-evening-moisturising',
      label: 'Evening moisturising for dry or sensitive-feeling skin',
      concernIds: ['dryness', 'dehydration', 'sensitivity', 'tightness'],
      concernSlugs: ['dry-dehydrated-skin', 'sensitive-barrier'],
      skinTypes: ['normal', 'dry', 'sensitive'],
    }],
    evidenceSourceUrls: [
      'https://www.cerave.co.uk/skincare/moisturisers/pm-facial-moisturising-lotion',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/pick-moisturizer',
    ],
    reviewedAt: '2026-07-23',
  },
  'eucerin-oil-control-sun-gel-cream-spf50-50ml': {
    productSlug: 'eucerin-oil-control-sun-gel-cream-spf50-50ml',
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'oily-skin-sun-protection',
      label: 'Daily sun protection for oily skin',
      concernIds: ['sun protection', 'sunscreen', 'oiliness', 'shine'],
      concernSlugs: ['daily-sun-protection', 'oily-congested-skin'],
      skinTypes: ['oily', 'acne-prone'],
    }],
    evidenceSourceUrls: [
      'https://www.eucerin-cewa.com/products/sun-protection/sun-gel-creme-dry-touch-spf-50plus',
      'https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-apply-sunscreen',
    ],
    reviewedAt: '2026-07-23',
  },
  'eucerin-urearepair-plus-10-urea-body-lotion-250ml': {
    productSlug: 'eucerin-urearepair-plus-10-urea-body-lotion-250ml',
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'very-dry-rough-body-moisturising',
      label: 'Moisturising very dry, rough adult body skin',
      concernIds: ['body dryness', 'rough skin', 'very dry skin'],
      concernSlugs: ['dry-rough-body-skin'],
      skinTypes: ['dry', 'very dry'],
    }],
    evidenceSourceUrls: [
      'https://www.eucerin-cewa.com/products/urea-repair-plus/urearepair-plus-10--urea-body-lotion',
      'https://pubmed.ncbi.nlm.nih.gov/34596890/',
    ],
    reviewedAt: '2026-07-23',
  },
  'dove-melanin-even-tone-body-wash-18-5oz': {
    productSlug: 'dove-melanin-even-tone-body-wash-18-5oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.dove.com/us/en/p/melanin-even-tone-body-wash.html/00011111040090-pdp-buynow',
    ],
    reviewedAt: '2026-07-23',
  },
  'keracare-dry-itchy-scalp-conditioner-950ml': {
    productSlug: 'keracare-dry-itchy-scalp-conditioner-950ml',
    careState: 'pharmacist_review',
    approvedUses: [{
      id: 'medicated-dandruff-conditioner-review',
      label: 'Medicated dandruff-conditioner review',
      concernIds: ['dandruff', 'itch', 'flaking', 'seborrheic dermatitis'],
      concernSlugs: ['dandruff-itchy-scalp'],
    }],
    evidenceSourceUrls: [
      'https://keracare.com/products/dry-itchy-scalp-anti-dandruff-moisturizing-conditioner',
      'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=5d501ba0-a6f9-4f0d-86d5-0e8d9302737f',
    ],
    reviewedAt: '2026-07-23',
  },
  'balance-salicylic-acid-zinc-clarifying-toner-200ml': {
    productSlug: 'balance-salicylic-acid-zinc-clarifying-toner-200ml',
    careState: 'pharmacist_review',
    approvedUses: [{
      id: 'salicylic-acid-toner-review',
      label: 'Salicylic-acid toner review',
      concernIds: ['acne', 'blackheads', 'oiliness', 'clogged pores'],
      concernSlugs: ['acne-breakouts', 'oily-congested-skin'],
    }],
    evidenceSourceUrls: [
      'https://www.balanceactiveformula.com/products/balance-active-formula-salicylic-acid-zinc-clarifying-toner-200ml',
      'https://www.aad.org/public/diseases/acne/diy/types-breakouts',
    ],
    reviewedAt: '2026-07-23',
  },
  'cerave-acne-foaming-cream-wash-10-150ml': {
    productSlug: 'cerave-acne-foaming-cream-wash-10-150ml',
    careState: 'pharmacist_review',
    approvedUses: [{
      id: 'benzoyl-peroxide-wash-review',
      label: 'Benzoyl-peroxide wash review',
      concernIds: ['acne', 'inflamed spots', 'breakouts'],
      concernSlugs: ['acne-breakouts'],
    }],
    evidenceSourceUrls: [
      'https://www.cerave.com/skincare/cleansers/facial-cleansers/benzoyl-peroxide-face-wash',
      'https://www.nhs.uk/medicines/benzoyl-peroxide/about-benzoyl-peroxide/',
    ],
    reviewedAt: '2026-07-23',
  },
  'cerave-sa-smoothing-cleanser-473ml': {
    productSlug: 'cerave-sa-smoothing-cleanser-473ml',
    careState: 'pharmacist_review',
    approvedUses: [{
      id: 'salicylic-acid-rough-skin-review',
      label: 'Salicylic-acid rough-skin review',
      concernIds: ['rough skin', 'bumpy skin'],
    }],
    evidenceSourceUrls: [
      'https://www.cerave.co.uk/skincare/cleansers/sa-smoothing-cleanser',
      'https://www.nhs.uk/conditions/keratosis-pilaris/',
    ],
    reviewedAt: '2026-07-23',
  },
  'garnier-vitamin-c-brightening-day-cream-50ml': {
    productSlug: 'garnier-vitamin-c-brightening-day-cream-50ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.garnier.co.uk/our-brands/skin-care/vitamin-c/vitamin-c-day-cream',
    ],
    reviewedAt: '2026-07-23',
  },
  'aqua-rich-ceramide-body-lotion-500ml': {
    productSlug: 'aqua-rich-ceramide-body-lotion-500ml',
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'dry-body-daily-moisturising',
      label: 'Daily moisturising for dry body skin',
      concernIds: ['body dryness', 'rough skin'],
      concernSlugs: ['dry-rough-body-skin'],
      skinTypes: ['dry'],
    }],
    evidenceSourceUrls: [
      'https://www.aquarich.net/product/aqua-rich-ceramide-body-lotion-500ml/',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
    ],
    reviewedAt: '2026-07-23',
  },
  'aqua-rich-turmeric-vitamin-c-body-lotion-500ml': {
    productSlug: 'aqua-rich-turmeric-vitamin-c-body-lotion-500ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.aquarich.net/product/aqua-rich-turmeric-and-vitamin-c-body-lotion-500ml/',
    ],
    reviewedAt: '2026-07-23',
  },
  'balance-niacinamide-blemish-recovery-serum-30ml': {
    productSlug: 'balance-niacinamide-blemish-recovery-serum-30ml',
    careState: 'pharmacist_review',
    approvedUses: [{
      id: 'high-strength-niacinamide-review',
      label: 'High-strength niacinamide review',
      concernIds: ['acne', 'blemishes', 'oiliness'],
      concernSlugs: ['acne-breakouts', 'oily-congested-skin'],
    }],
    evidenceSourceUrls: [
      'https://www.balanceactiveformula.com/products/balance-active-formula-15-niacinamide-high-strength-blemish-recovery-serum',
      'https://pubmed.ncbi.nlm.nih.gov/38722460/',
    ],
    reviewedAt: '2026-07-23',
  },
  'nineless-a-control-10-azelaic-acid-serum-30ml': {
    productSlug: 'nineless-a-control-10-azelaic-acid-serum-30ml',
    careState: 'pharmacist_review',
    approvedUses: [{
      id: 'azelaic-acid-serum-review',
      label: 'Azelaic-acid serum review',
      concernIds: ['acne', 'breakouts'],
      concernSlugs: ['acne-breakouts'],
    }],
    evidenceSourceUrls: [
      'https://ninelessshop.com/products/a-control-10-azelaic-acid-serum',
      'https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment',
    ],
    reviewedAt: '2026-07-23',
  },
  'nineless-mela-pro-rice-txa-toner-200ml': {
    productSlug: 'nineless-mela-pro-rice-txa-toner-200ml',
    careState: 'pharmacist_review',
    approvedUses: [{
      id: 'tone-support-toner-review',
      label: 'Tone-support toner review',
      concernIds: ['hyperpigmentation', 'dark spots', 'post-acne marks'],
      concernSlugs: ['dark-spots'],
    }],
    evidenceSourceUrls: [
      'https://ninelessshop.com/products/nineless-mela-pro-rice-txa-toner-200ml',
      'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
    ],
    reviewedAt: '2026-07-23',
  },
  'facefacts-ceramide-oil-control-foaming-cleanser-400ml': {
    productSlug: 'facefacts-ceramide-oil-control-foaming-cleanser-400ml',
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'oily-skin-cleansing',
      label: 'Daily cleansing for oily skin',
      concernIds: ['oiliness', 'shine'],
      concernSlugs: ['oily-congested-skin'],
      skinTypes: ['oily'],
    }],
    evidenceSourceUrls: [
      'https://facefacts.me/en-la/collections/ceramide/products/face-facts-ceramide-oil-control-foaming-cleanser-400ml',
      'https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment',
    ],
    reviewedAt: '2026-07-23',
  },
  'facefacts-ceramide-hydrating-gentle-cleanser-400ml': {
    productSlug: 'facefacts-ceramide-hydrating-gentle-cleanser-400ml',
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'dry-skin-gentle-cleansing',
      label: 'Gentle cleansing for dry skin',
      concernIds: ['dryness', 'tightness'],
      concernSlugs: ['dry-dehydrated-skin'],
      skinTypes: ['dry'],
    }],
    evidenceSourceUrls: [
      'https://facefacts.me/en-la/products/ceramide-hydrating-gentle-cleanser',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
    ],
    reviewedAt: '2026-07-23',
  },
  'facefacts-ceramide-foaming-cleanser-400ml': {
    productSlug: 'facefacts-ceramide-foaming-cleanser-400ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://facefacts.me/en-la/collections/calm-comfort/products/ceramide-foaming-cleanser-400ml',
    ],
    reviewedAt: '2026-07-23',
  },
  'de-la-cruz-acne-treatment-10-sulfur-73-7g': {
    productSlug: 'de-la-cruz-acne-treatment-10-sulfur-73-7g',
    careState: 'pharmacist_review',
    approvedUses: [{
      id: 'sulfur-acne-treatment-review',
      label: 'Sulfur acne-treatment review',
      concernIds: ['acne', 'breakouts'],
      concernSlugs: ['acne-breakouts'],
    }],
    evidenceSourceUrls: [
      'https://dlclabs.com/products/de-la-cruz-acne-treatment-maximum-strength-with-10-sulfur-2-6-oz-73-7-g',
      'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?audience=consumer&setid=4a1591e8-6135-4b22-b54c-5553c2dc0540',
    ],
    reviewedAt: '2026-07-23',
  },
  'olay-super-serum-body-wash-normal-skin-547ml': {
    productSlug: 'olay-super-serum-body-wash-normal-skin-547ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.olay.com/products/olay-super-serum-body-wash-normal-skin?pswtb=true',
    ],
    reviewedAt: '2026-07-23',
  },
  'dove-calming-moisture-body-wash-547ml': {
    productSlug: 'dove-calming-moisture-body-wash-547ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.dove.com/us/en/p/calming-moisture-body-wash.html/00011111049437',
    ],
    reviewedAt: '2026-07-23',
  },
  'sheamoisture-jamaican-black-castor-oil-shampoo-384ml': {
    productSlug: 'sheamoisture-jamaican-black-castor-oil-shampoo-384ml',
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'dry-textured-hair-cleansing',
      label: 'Routine cleansing for dry, textured or damaged hair',
      concernIds: ['dry hair', 'frizz', 'damage', 'breakage'],
      concernSlugs: ['dry-frizzy-hair'],
    }],
    evidenceSourceUrls: [
      'https://www.sheamoisture.com/us/en/p/jamaican-black-castor-oil-strengthen-%26-restore-shampoo.html/00764302215837',
      'https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips',
    ],
    reviewedAt: '2026-07-23',
  },
  'cerave-acne-foaming-cream-cleanser-4-150ml': {
    productSlug: 'cerave-acne-foaming-cream-cleanser-4-150ml',
    careState: 'pharmacist_review',
    approvedUses: [{
      id: 'benzoyl-peroxide-4-cleanser-review',
      label: '4% benzoyl-peroxide cleanser review',
      concernIds: ['acne', 'blackheads', 'breakouts'],
      concernSlugs: ['acne-breakouts'],
    }],
    evidenceSourceUrls: [
      'https://www.cerave.com/skincare/cleansers/acne-benzoyl-peroxide-cleanser',
      'https://www.nhs.uk/medicines/benzoyl-peroxide/about-benzoyl-peroxide/',
    ],
    reviewedAt: '2026-07-23',
  },
  'facefacts-vitamin-c-body-lotion-400ml': {
    productSlug: 'facefacts-vitamin-c-body-lotion-400ml',
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'dry-body-daily-moisturising',
      label: 'Daily moisturising for dry body skin',
      concernIds: ['body dryness', 'rough skin'],
      concernSlugs: ['dry-rough-body-skin'],
      skinTypes: ['dry'],
    }],
    evidenceSourceUrls: [
      'https://facefacts.me/en-la/collections/vitamin-c/products/vitamin-c-body-lotion',
      'https://www.nhs.uk/tests-and-treatments/emollients/',
    ],
    reviewedAt: '2026-07-23',
  },
  'cecred-moisturizing-deep-conditioner-300ml': {
    productSlug: 'cecred-moisturizing-deep-conditioner-300ml',
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'dry-textured-hair-deep-conditioning',
      label: 'Deep conditioning for dry or textured hair',
      concernIds: ['dry hair', 'frizz', 'damage', 'breakage'],
      concernSlugs: ['dry-frizzy-hair'],
    }],
    evidenceSourceUrls: [
      'https://cecred.com/products/moisturizing-deep-conditioner?variant=48950659318058',
      'https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips',
    ],
    reviewedAt: '2026-07-23',
  },
  'sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml': {
    productSlug: 'sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml',
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'dry-textured-hair-rinse-out-conditioning',
      label: 'Rinse-out conditioning for dry or textured hair',
      concernIds: ['dry hair', 'frizz', 'damage', 'breakage'],
      concernSlugs: ['dry-frizzy-hair'],
    }],
    evidenceSourceUrls: [
      'https://www.sheamoisture.com/us/en/p/raw-shea-butter-deep-moisturizing-conditioner.html/00764302280217',
      'https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips',
    ],
    reviewedAt: '2026-07-23',
  },
  'tresemme-keratin-smooth-weightless-conditioner-828ml': {
    productSlug: 'tresemme-keratin-smooth-weightless-conditioner-828ml',
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'frizz-prone-hair-rinse-out-conditioning',
      label: 'Rinse-out conditioning for frizz-prone hair',
      concernIds: ['dry hair', 'frizz', 'damage', 'breakage'],
      concernSlugs: ['dry-frizzy-hair'],
    }],
    evidenceSourceUrls: [
      'https://www.tresemme.com/ca/en/p/tresemm%C3%A9-keratin-smooth-weightless-conditioner.html/00022400011738',
      'https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips',
    ],
    reviewedAt: '2026-07-23',
  },
  'dove-skin-replenish-serum-body-wash-547ml': {
    productSlug: 'dove-skin-replenish-serum-body-wash-547ml',
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'rough-body-skin-cleansing',
      label: 'Routine cleansing for rough-feeling body skin',
      concernIds: ['rough skin', 'body dryness', 'texture'],
      concernSlugs: ['dry-rough-body-skin'],
    }],
    evidenceSourceUrls: [
      'https://www.dove.com/us/en/p/skin-replenish-body-wash.html/00011111055230',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
    ],
    reviewedAt: '2026-07-23',
  },
  'laroche-posay-mela-b3-serum-30ml': {
    productSlug: 'laroche-posay-mela-b3-serum-30ml',
    careState: 'pharmacist_review',
    approvedUses: [{
      id: 'dark-spot-serum-review',
      label: 'Dark-spot serum review',
      concernIds: ['hyperpigmentation', 'dark spots', 'post-acne marks'],
      concernSlugs: ['dark-spots'],
    }],
    evidenceSourceUrls: [
      'https://www.laroche-posay.co.uk/en_GB/mela-b3-intense-anti-dark-spot-serum/3337875890021.html',
      'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
    ],
    reviewedAt: '2026-07-26',
  },
  'beauty-formulas-glowing-serum-2-vitamin-c-30ml': {
    productSlug: 'beauty-formulas-glowing-serum-2-vitamin-c-30ml',
    careState: 'pharmacist_review',
    approvedUses: [{
      id: 'vitamin-c-serum-review',
      label: 'Vitamin C serum review',
      concernIds: ['hyperpigmentation', 'dark spots', 'uneven tone'],
      concernSlugs: ['dark-spots'],
    }],
    evidenceSourceUrls: [
      'https://www.beautyformulas.co.uk/_files/ugd/5daf87_d22610a867884559b34ef623b614f492.pdf',
      'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
    ],
    reviewedAt: '2026-07-27',
  },
  'dang-azelaic-acid-serum-30ml': {
    productSlug: 'dang-azelaic-acid-serum-30ml',
    careState: 'pharmacist_review',
    approvedUses: [{
      id: 'dang-azelaic-acid-serum-review',
      label: 'Azelaic-acid serum review',
      concernIds: ['acne', 'breakouts', 'hyperpigmentation', 'dark spots', 'post-acne marks'],
      concernSlugs: ['acne-breakouts', 'dark-spots'],
    }],
    evidenceSourceUrls: [
      'https://danglifestyle.co/products/azelaic-acid-pigmentation-acne-control',
      'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
    ],
    reviewedAt: '2026-07-26',
  },
  'nivea-perfect-radiant-body-lotion-400ml': {
    productSlug: 'nivea-perfect-radiant-body-lotion-400ml',
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'dry-body-daily-moisturising',
      label: 'Daily moisturising for dry body skin',
      concernIds: ['body dryness', 'rough skin'],
      concernSlugs: ['dry-rough-body-skin'],
      skinTypes: ['dry'],
    }],
    evidenceSourceUrls: [
      'https://www.nivea.com.ng/products/nivea-perfect-and-radiant-body-lotion-40059003786060272.html',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
    ],
    reviewedAt: '2026-07-26',
  },
  'benton-honest-cleansing-foam-150g': {
    productSlug: 'benton-honest-cleansing-foam-150g',
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'daily-face-cleansing',
      label: 'Daily facial cleansing',
      concernIds: ['daily cleansing'],
    }],
    evidenceSourceUrls: [
      'https://bentoncosmetics.com/product/benton-honest-cleansing-foam-150g/697',
      'https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101',
    ],
    reviewedAt: '2026-08-02',
  },
  'simple-kind-to-skin-refreshing-facial-gel-wash-150ml': {
    productSlug: 'simple-kind-to-skin-refreshing-facial-gel-wash-150ml',
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'gentle-daily-face-cleansing',
      label: 'Gentle daily facial cleansing',
      concernIds: ['sensitivity', 'daily cleansing'],
      concernSlugs: ['sensitive-barrier'],
      skinTypes: ['normal', 'sensitive'],
    }],
    evidenceSourceUrls: [
      'https://www.simpleskincare.com/sg/p/kind-to-skin-refreshing-facial-gel-wash.html/05011451103863',
      'https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101',
    ],
    reviewedAt: '2026-07-26',
  },
  'anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml': {
    productSlug: 'anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml',
    careState: 'pharmacist_review',
    approvedUses: [{
      id: 'anua-azelaic-acid-serum-review',
      label: 'Azelaic-acid serum review',
      concernIds: ['acne', 'breakouts', 'redness', 'post-acne marks'],
      concernSlugs: ['acne-breakouts'],
    }],
    evidenceSourceUrls: [
      'https://anua.com/products/azelaic-acid-10-hyaluron-redness-soothing-serum',
      'https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment',
    ],
    reviewedAt: '2026-07-26',
  },
  'facefacts-ceramide-blemish-gel-moisturiser-50ml': {
    productSlug: 'facefacts-ceramide-blemish-gel-moisturiser-50ml',
    careState: 'pharmacist_review',
    approvedUses: [{
      id: 'salicylic-acid-moisturiser-review',
      label: 'Salicylic-acid moisturiser review',
      concernIds: ['acne', 'breakouts', 'blemishes'],
      concernSlugs: ['acne-breakouts'],
    }],
    evidenceSourceUrls: [
      'https://facefacts.me/collections/ceramide/products/ceramide-blemish-gel-moisturiser',
      'https://www.aad.org/public/diseases/acne/diy/types-breakouts',
    ],
    reviewedAt: '2026-07-26',
  },
  'prequel-gleanser-glycolic-acid-cleanser-400ml': {
    productSlug: 'prequel-gleanser-glycolic-acid-cleanser-400ml',
    careState: 'pharmacist_review',
    approvedUses: [{
      id: 'glycolic-acid-cleanser-review',
      label: 'Glycolic-acid cleanser review',
      concernIds: ['rough texture', 'uneven tone', 'cosmetic exfoliation'],
    }],
    evidenceSourceUrls: [
      'https://prequelskin.com/products/gleanser-glycerin-and-glycolic-acid-cleanser',
      'https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101',
    ],
    reviewedAt: '2026-07-28',
  },
  'skin-by-zaron-vitamin-c-body-wash-650ml': {
    productSlug: 'skin-by-zaron-vitamin-c-body-wash-650ml',
    careState: 'pharmacist_review',
    approvedUses: [{
      id: 'glycolic-acid-body-wash-review',
      label: 'Glycolic-acid body-wash review',
      concernIds: ['rough texture', 'body cleansing', 'cosmetic exfoliation'],
    }],
    evidenceSourceUrls: [
      'https://www.zaroncosmetics.com/product/vitamin-c-body-wash',
      'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
    ],
    reviewedAt: '2026-07-28',
  },
  'facefacts-ceramide-moisturising-gel-cream-50ml': {
    productSlug: 'facefacts-ceramide-moisturising-gel-cream-50ml',
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'dry-sensitive-feeling-moisturising',
      label: 'Daily moisture for dry or sensitive-feeling skin',
      concernIds: ['dryness', 'dehydration', 'sensitivity', 'tightness'],
      concernSlugs: ['dry-dehydrated-skin', 'sensitive-barrier'],
      skinTypes: ['dry', 'sensitive'],
    }],
    evidenceSourceUrls: [
      'https://facefacts.me/en-la/products/ceramide-moisturising-gel-cream',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/pick-moisturizer',
    ],
    reviewedAt: '2026-07-28',
  },
  'dang-hydra-glow-sun-protection-gel-60ml': {
    productSlug: 'dang-hydra-glow-sun-protection-gel-60ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://danglifestyle.co/products/hydra-glow-sun-protection-gel-60ml',
      'https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-apply-sunscreen',
    ],
    reviewedAt: '2026-07-28',
  },
  'dang-niacinamide-n-acetyl-glucosamine-serum-30ml': {
    productSlug: 'dang-niacinamide-n-acetyl-glucosamine-serum-30ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://international.danglifestyle.co/products/10-niacinamide-serum',
      'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
    ],
    reviewedAt: '2026-07-29',
  },
  'facefacts-soothe-glow-niacinamide-serum-30ml': {
    productSlug: 'facefacts-soothe-glow-niacinamide-serum-30ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://facefacts.me/products/soothe-glow-niacinamide-serum',
      'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
    ],
    reviewedAt: '2026-07-28',
  },
  'facefacts-vitamin-c-brightening-jelly-cleanser-150ml': {
    productSlug: 'facefacts-vitamin-c-brightening-jelly-cleanser-150ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://facefacts.me/products/vitamin-c-brightening-jelly-cleanser',
      'https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101',
    ],
    reviewedAt: '2026-07-29',
  },
  'c28f590dd2739ea73f1b5ea3': {
    productSlug: 'c28f590dd2739ea73f1b5ea3',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.simple.co.uk/p/kind-to-skin-replenishing-rich-moisturiser.html/05011451103948',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/pick-moisturizer',
    ],
    reviewedAt: '2026-08-02',
  },
  '11d3a6116ccfc1cbce191430': {
    productSlug: '11d3a6116ccfc1cbce191430',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.laroche-posay.fr/vitamin-c-gel-moussant-200ml/LRP_947.html',
      'https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101',
    ],
    reviewedAt: '2026-08-02',
  },
} as const satisfies Record<string, ReviewedProductCare>;

const careBySlug = {
  ...reviewedProductCareManifest,
  ...publishedProductCareManifest,
} as Record<string, ReviewedProductCare>;

export function getReviewedProductCare(productSlug: string) {
  return careBySlug[productSlug];
}

export function matchingApprovedProductUses(
  review: ReviewedProductCare,
  input: { concernSlugs: readonly string[] },
) {
  const concernSlugs = new Set(input.concernSlugs.map(value => value.trim().toLowerCase()));

  return review.approvedUses.filter(use => (
    Boolean(use.concernSlugs?.some(slug => concernSlugs.has(slug.toLowerCase())))
  ));
}
