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
  'the-ordinary-azelaic-acid-suspension-10': {
    productSlug: 'the-ordinary-azelaic-acid-suspension-10',
    careState: 'pharmacist_review',
    approvedUses: [{ id: 'azelaic-acid-review', label: 'Azelaic-acid review', concernIds: ['acne', 'hyperpigmentation', 'dark spots', 'redness'], concernSlugs: ['acne-breakouts', 'dark-spots'] }],
    evidenceSourceUrls: ['https://theordinary.com/en-ca/azelaic-acid-suspension-10-exfoliator-100407.html'], reviewedAt,
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
  'dr-teals-nourish-protect-coconut-oil-body-wash-710ml': {
    productSlug: 'dr-teals-nourish-protect-coconut-oil-body-wash-710ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.drteals.com/product/dr-teals-nourish-protect-coconut-oil-body-wash/',
    ],
    reviewedAt: '2026-08-02',
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
  'la-roche-posay-lipikar-apmax-triple-repair-moisturizing-cream-200ml': {
    productSlug: 'la-roche-posay-lipikar-apmax-triple-repair-moisturizing-cream-200ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.laroche-posay.fr/lipikar-baume-ap-max/3337875930048.html',
      'https://www.nhs.uk/tests-and-treatments/emollients/',
    ],
    reviewedAt: '2026-08-04',
  },
  'la-roche-posay-lipikar-apmax-triple-repair-moisturizing-cream-400ml': {
    productSlug: 'la-roche-posay-lipikar-apmax-triple-repair-moisturizing-cream-400ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.laroche-posay.fr/lipikar-baume-ap-max/3337875930239.html',
      'https://www.nhs.uk/tests-and-treatments/emollients/',
    ],
    reviewedAt: '2026-08-04',
  },
  'naturium-the-perfector-salicylic-acid-body-wash-500ml': {
    productSlug: 'naturium-the-perfector-salicylic-acid-body-wash-500ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/the-perfector-salicylic-acid-body-wash',
      'https://www.nhs.uk/conditions/keratosis-pilaris/',
    ],
    reviewedAt: '2026-08-04',
  },
  'naturium-vitamin-c-complex-serum-1fl-oz': {
    productSlug: 'naturium-vitamin-c-complex-serum-1fl-oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/vitamin-c-complex-serum',
      'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-dew-glow-moisturizer-spf-50-1-7fl-oz': {
    productSlug: 'naturium-dew-glow-moisturizer-spf-50-1-7fl-oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/dew-glow-moisturizer-spf-50-original',
      'https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-apply-sunscreen',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-niacinamide-serum-12-percent-1fl-oz': {
    productSlug: 'naturium-niacinamide-serum-12-percent-1fl-oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/niacinamide-serum-12-plus-zinc-2',
      'https://www.aad.org/public/diseases/acne/diy/types-breakouts',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-multi-peptide-advanced-body-wash-500ml': {
    productSlug: 'naturium-multi-peptide-advanced-body-wash-500ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/the-multi-peptide-advanced-body-wash',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-glow-getter-multi-oil-hydrating-body-wash-500ml': {
    productSlug: 'naturium-glow-getter-multi-oil-hydrating-body-wash-500ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/the-glow-getter-multi-oil-hydrating-body-wash',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-energizer-mandelic-acid-body-wash-500ml': {
    productSlug: 'naturium-energizer-mandelic-acid-body-wash-500ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/the-energizer-mandelic-acid-body-wash',
      'https://www.nhs.uk/conditions/keratosis-pilaris/',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-barrier-bounce-bi-phase-mist-100ml': {
    productSlug: 'naturium-barrier-bounce-bi-phase-mist-100ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/barrier-bounce-bi-phase-mist',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-alpha-arbutin-serum-2-percent-1fl-oz': {
    productSlug: 'naturium-alpha-arbutin-serum-2-percent-1fl-oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/alpha-arbutin-serum-2',
      'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-salicylic-acid-serum-2-percent-1fl-oz': {
    productSlug: 'naturium-salicylic-acid-serum-2-percent-1fl-oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/salicylic-acid-serum-2',
      'https://www.aad.org/public/diseases/acne/diy/types-breakouts',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-uv-reflect-antioxidant-spf-50-1-7fl-oz': {
    productSlug: 'naturium-uv-reflect-antioxidant-spf-50-1-7fl-oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/uv-reflect-antioxidant-spf-50',
      'https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-apply-sunscreen',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-purifier-niacinamide-body-wash-500ml': {
    productSlug: 'naturium-purifier-niacinamide-body-wash-500ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/the-purifier-niacinamide-serum-body-wash',
      'https://www.aad.org/public/diseases/acne/diy/types-breakouts',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-glow-getter-body-oil-100ml': {
    productSlug: 'naturium-glow-getter-body-oil-100ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/the-glow-getter-body-oil',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-marshmallow-root-barrier-balm-1-7oz': {
    productSlug: 'naturium-marshmallow-root-barrier-balm-1-7oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/marshmallow-root-barrier-balm',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-brightener-vitamin-c-body-wash-500ml': {
    productSlug: 'naturium-brightener-vitamin-c-body-wash-500ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/the-brightener-vitamin-c-brightening-body-wash',
      'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-bio-lipid-restoring-body-lotion-14oz': {
    productSlug: 'naturium-bio-lipid-restoring-body-lotion-14oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/bio-lipid-restoring-body-lotion',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-niacinamide-cleansing-gelee-3-7-1oz': {
    productSlug: 'naturium-niacinamide-cleansing-gelee-3-7-1oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/niacinamide-cleansing-gelee-3',
      'https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-bha-liquid-exfoliant-2-4oz': {
    productSlug: 'naturium-bha-liquid-exfoliant-2-4oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/bha-liquid-exfoliant-2',
      'https://www.aad.org/public/diseases/acne/diy/types-breakouts',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-quadruple-hyaluronic-acid-serum-5-1fl-oz': {
    productSlug: 'naturium-quadruple-hyaluronic-acid-serum-5-1fl-oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/quadruple-hyaluronic-acid-serum-5',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-retinol-complex-serum-1fl-oz': {
    productSlug: 'naturium-retinol-complex-serum-1fl-oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/retinol-complex-serum',
      'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-retinol-complex-cream-1-7oz': {
    productSlug: 'naturium-retinol-complex-cream-1-7oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/retinol-complex-cream',
      'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-tranexamic-topical-acid-5-1fl-oz': {
    productSlug: 'naturium-tranexamic-topical-acid-5-1fl-oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/tranexamic-topical-acid-5',
      'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-fermented-rice-enzyme-cleanser-4oz': {
    productSlug: 'naturium-fermented-rice-enzyme-cleanser-4oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/fermented-rice-enzyme-cleanser',
      'https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-intense-overnight-sleeping-cream-1-7oz': {
    productSlug: 'naturium-intense-overnight-sleeping-cream-1-7oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/intense-overnight-sleeping-cream',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-vitamin-bright-illuminating-eye-cream-0-5oz': {
    productSlug: 'naturium-vitamin-bright-illuminating-eye-cream-0-5oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/vitamin-bright-illuminating-eye-cream',
      'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-phyto-glow-lip-balm-clear-0-34oz': {
    productSlug: 'naturium-phyto-glow-lip-balm-clear-0-34oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/phyto-glow-lip-balm-clear',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-fermented-camellia-creamy-cleansing-oil-3-5oz': {
    productSlug: 'naturium-fermented-camellia-creamy-cleansing-oil-3-5oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/fermented-camellia-creamy-cleansing-oil',
      'https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-skin-renewing-retinol-body-lotion-8oz': {
    productSlug: 'naturium-skin-renewing-retinol-body-lotion-8oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/skin-renewing-retinol-body-lotion',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-vitamin-c-super-serum-plus-1fl-oz': {
    productSlug: 'naturium-vitamin-c-super-serum-plus-1fl-oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/vitamin-c-super-serum-plus',
      'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-azelaic-acid-derivative-complex-10-1fl-oz': {
    productSlug: 'naturium-azelaic-acid-derivative-complex-10-1fl-oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/azelaic-acid-derivative-complex-10',
      'https://www.aad.org/public/diseases/acne/diy/types-breakouts',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-vitamin-c-complex-serum-jumbo-2fl-oz': {
    productSlug: 'naturium-vitamin-c-complex-serum-jumbo-2fl-oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/vitamin-c-complex-serum-jumbo',
      'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-glow-getter-multi-oil-body-butter-7-7oz': {
    productSlug: 'naturium-glow-getter-multi-oil-body-butter-7-7oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/the-glow-getter-multi-oil-body-butter',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-the-smoother-glycolic-acid-exfoliating-body-wash-500ml': {
    productSlug: 'naturium-the-smoother-glycolic-acid-exfoliating-body-wash-500ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/the-smoother-glycolic-acid-exfoliating-body-wash',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
    ],
    reviewedAt: '2026-08-07',
  },
  'medik8-advanced-night-restore-50ml': {
    productSlug: 'medik8-advanced-night-restore-50ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.medik8.com/products/advanced-night-restore',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/pick-moisturizer',
    ],
    reviewedAt: '2026-08-04',
  },
  'loccitane-almond-softening-shower-oil-250ml': {
    productSlug: 'loccitane-almond-softening-shower-oil-250ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://no.loccitane.com/products/almond-amande-shower-oil-250ml',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
    ],
    reviewedAt: '2026-08-04',
  },
  'fenty-skin-butta-drop-fenty-fresh-standard-200ml': {
    productSlug: 'fenty-skin-butta-drop-fenty-fresh-standard-200ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://fentybeauty.com/products/butta-drop-whipped-oil-body-cream-with-tropical-oils-shea-butter-fenty-fresh',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/pick-moisturizer',
    ],
    reviewedAt: '2026-08-04',
  },
  'medik8-crystal-retinal-3-30ml': {
    productSlug: 'medik8-crystal-retinal-3-30ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.medik8.com/products/crystal-retinal?variant=36622939783320',
      'https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-apply-sunscreen',
    ],
    reviewedAt: '2026-08-04',
  },
  'medik8-crystal-retinal-6-30ml': {
    productSlug: 'medik8-crystal-retinal-6-30ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.medik8.com/products/crystal-retinal?variant=36622939816088',
      'https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-apply-sunscreen',
    ],
    reviewedAt: '2026-08-04',
  },
  'amika-the-kure-conditioner-275ml': {
    productSlug: 'amika-the-kure-conditioner-275ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [],
    reviewedAt: '2026-08-05',
  },
  'anua-zero-cast-moisturizing-finish-sunscreen-50ml': {
    productSlug: 'anua-zero-cast-moisturizing-finish-sunscreen-50ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://anua.com/products/zero-cast-moisturizing-finish-sunscreen',
      'https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-apply-sunscreen',
    ],
    reviewedAt: '2026-08-07',
  },
  'facefacts-enhance-gel-cream-cleanser-150ml': {
    productSlug: 'facefacts-enhance-gel-cream-cleanser-150ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [],
    reviewedAt: '2026-08-05',
  },
  'replenix-bp-10-acne-wash-aloe-vera-7oz': {
    productSlug: 'replenix-bp-10-acne-wash-aloe-vera-7oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://replenix.com/products/bp-10-acne-wash-aloe-vera',
      'https://www.aad.org/public/diseases/acne/diy/types-breakouts',
    ],
    reviewedAt: '2026-08-07',
  },
  'estelin-vitamin-c-turmeric-face-oil-30ml': {
    productSlug: 'estelin-vitamin-c-turmeric-face-oil-30ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://estelin.co.in/products/vitamin-c-turmeric-face-oil',
      'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
    ],
    reviewedAt: '2026-08-05',
  },
  'advanced-clinicals-vitamin-c-face-serum-52ml': {
    productSlug: 'advanced-clinicals-vitamin-c-face-serum-52ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://advancedclinicals.com/products/vitamin-c-anti-aging-serum-1-75oz',
      'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
    ],
    reviewedAt: '2026-08-06',
  },
  'la-roche-posay-effaclar-purifying-foaming-gel-400ml': {
    productSlug: 'la-roche-posay-effaclar-purifying-foaming-gel-400ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.laroche-posay.co.uk/en_GB/effaclar-purifying-cleansing-gel/LRP_050.html',
      'https://www.aad.org/public/everyday-care/skin-care-basics/cleansing/dry-skin',
    ],
    reviewedAt: '2026-08-06',
  },
  'nineless-a-control-azelaic-acid-cream-50ml': {
    productSlug: 'nineless-a-control-azelaic-acid-cream-50ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://ninelessshop.com/products/a-control-azelaic-acid-cream',
      'https://www.aad.org/public/everyday-care/skin-care-basics/cleansing/dry-skin',
    ],
    reviewedAt: '2026-08-07',
  },
  'elf-suntouchable-invisible-sunscreen-spf-35-50ml': {
    productSlug: 'elf-suntouchable-invisible-sunscreen-spf-35-50ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.elfcosmetics.com/products/suntouchable-invisible-sunscreen-spf-35',
      'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots',
    ],
    reviewedAt: '2026-08-07',
  },
  'panoxyl-acne-creamy-wash-4-170g': {
    productSlug: 'panoxyl-acne-creamy-wash-4-170g',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://panoxyl.com/acne-products/acne-creamy-wash/',
      'https://www.nhs.uk/medicines/benzoyl-peroxide/about-benzoyl-peroxide/',
    ],
    reviewedAt: '2026-08-07',
  },
  'abib-heartleaf-foam-cleanser-150ml': {
    productSlug: 'abib-heartleaf-foam-cleanser-150ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://en.abib.com/products/heartleaf-foam',
      'https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101',
    ],
    reviewedAt: '2026-08-07',
  },
  'abib-clear-spot-serum-7-325-30ml': {
    productSlug: 'abib-clear-spot-serum-7-325-30ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://en.abib.com/products/clear-spot-serum-7-325-pump-option',
      'https://www.aad.org/public/diseases/acne/diy/types-breakouts',
    ],
    reviewedAt: '2026-08-07',
  },
  'neutrogena-light-sesame-body-oil-8-5oz': {
    productSlug: 'neutrogena-light-sesame-body-oil-8-5oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.neutrogena.com/products/skincare/neutrogena-body-oil-light-sesame-formula-for-dry-skin/6811101',
      'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-kp-body-scrub-mask-8oz': {
    productSlug: 'naturium-kp-body-scrub-mask-8oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/kp-body-scrub-mask',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-plant-ceramide-rich-moisture-cream-1-7oz': {
    productSlug: 'naturium-plant-ceramide-rich-moisture-cream-1-7oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/plant-ceramide-rich-moisture-cream',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-retinaldehyde-cream-serum-0-05-1-7oz': {
    productSlug: 'naturium-retinaldehyde-cream-serum-0-05-1-7oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/retinaldehyde-cream-serum-0-05',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-azelaic-acid-emulsion-10-1fl-oz': {
    productSlug: 'naturium-azelaic-acid-emulsion-10-1fl-oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/azelaic-acid-emulsion-10',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-dew-glow-mineral-spf-50-1-7fl-oz': {
    productSlug: 'naturium-dew-glow-mineral-spf-50-1-7fl-oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/dew-glow-moisturizer-mineral-spf-50',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-glow-getter-multi-oil-body-scrub-8oz': {
    productSlug: 'naturium-glow-getter-multi-oil-body-scrub-8oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/the-glow-getter-multi-oil-body-scrub',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-multi-active-exosome-serum-1fl-oz': {
    productSlug: 'naturium-multi-active-exosome-serum-1fl-oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/multi-active-exosome-serum',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-multi-peptide-advanced-serum-1fl-oz': {
    productSlug: 'naturium-multi-peptide-advanced-serum-1fl-oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/multi-peptide-advanced-serum',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-multi-peptide-eye-cream-0-5oz': {
    productSlug: 'naturium-multi-peptide-eye-cream-0-5oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/multi-peptide-eye-cream',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-multi-peptide-moisturizer-1-7oz': {
    productSlug: 'naturium-multi-peptide-moisturizer-1-7oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/multi-peptide-moisturizer',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-niacinamide-gel-cream-5-1-7oz': {
    productSlug: 'naturium-niacinamide-gel-cream-5-1-7oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/niacinamide-gel-cream-5',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-purple-ginseng-cleansing-balm-3oz': {
    productSlug: 'naturium-purple-ginseng-cleansing-balm-3oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/purple-ginseng-cleansing-balm',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-retinaldehyde-cream-serum-0-10-1-7oz': {
    productSlug: 'naturium-retinaldehyde-cream-serum-0-10-1-7oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/retinaldehyde-cream-serum-0-10',
    ],
    reviewedAt: '2026-08-07',
  },
  'naturium-smoother-glycolic-acid-body-lotion-8oz': {
    productSlug: 'naturium-smoother-glycolic-acid-body-lotion-8oz',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://naturium.com/products/the-smoother-glycolic-acid-body-lotion',
    ],
    reviewedAt: '2026-08-07',
  },
  'aqua-rich-niacinamide-alpha-arbutin-body-wash-1000ml': {
    productSlug: 'aqua-rich-niacinamide-alpha-arbutin-body-wash-1000ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.aquarich.net/product/aqua-rich-niacinamide-and-alpha-arbutin-body-wash-1000ml/',
    ],
    reviewedAt: '2026-08-07',
  },
  'aqua-rich-turmeric-vitamin-c-body-wash-1000ml': {
    productSlug: 'aqua-rich-turmeric-vitamin-c-body-wash-1000ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.aquarich.net/product/aqua-rich-turmeric-and-vitamin-c-body-wash-1000ml/',
    ],
    reviewedAt: '2026-08-07',
  },
  'aqua-rich-licorice-mulberry-body-lotion-500ml': {
    productSlug: 'aqua-rich-licorice-mulberry-body-lotion-500ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.aquarich.net/product/aqua-rich-licorice-and-mulbery-root-extract-body-lotion-500ml/',
    ],
    reviewedAt: '2026-08-07',
  },
  'aqua-rich-licorice-mulberry-body-wash-1000ml': {
    productSlug: 'aqua-rich-licorice-mulberry-body-wash-1000ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.aquarich.net/product/aqua-rich-licorice-and-mulbery-root-extract-body-wash-1000ml/',
    ],
    reviewedAt: '2026-08-07',
  },
  'garnier-pure-active-tea-tree-salicylic-acid-tissue-mask': {
    productSlug: 'garnier-pure-active-tea-tree-salicylic-acid-tissue-mask',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://www.garnier.com.au/about-our-brands/skin-active/pure-active/anti-imperfection-sheet-mask',
    ],
    reviewedAt: '2026-08-07',
  },
  'nineless-mela-pro-tranexamic-acid-sunscreen-100ml': {
    productSlug: 'nineless-mela-pro-tranexamic-acid-sunscreen-100ml',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://ninelessshop.com/products/mela-pro-tranexamic-acid-sun-screen-100ml',
    ],
    reviewedAt: '2026-08-07',
  },
  'estelin-ultra-light-hydrating-invisible-sunscreen-spf-50-50g': {
    productSlug: 'estelin-ultra-light-hydrating-invisible-sunscreen-spf-50-50g',
    careState: 'insufficient_data',
    approvedUses: [],
    evidenceSourceUrls: [
      'https://estelin.co.in/products/ultra-light-hydrating-invisible-sunscreen-spf-50-pa-1',
    ],
    reviewedAt: '2026-08-07',
  },
  'cerave-blemish-control-cleanser': {
    productSlug: 'cerave-blemish-control-cleanser',
    careState: 'pharmacist_review',
    approvedUses: [{ id: 'blemish-cleansing-review', label: 'Blemish-cleansing review', concernIds: ['acne', 'blackheads', 'whiteheads'], concernSlugs: ['acne-breakouts'] }],
    evidenceSourceUrls: ['https://africa.cerave.com/en/our-products/cleansers/blemish-control-cleanser'],
    reviewedAt: '2026-08-07',
  },
  'cerave-foaming-facial-cleanser': {
    productSlug: 'cerave-foaming-facial-cleanser',
    careState: 'supportive_eligible',
    approvedUses: [{
      id: 'normal-oily-cleansing', label: 'Cleansing for normal or oily skin', concernIds: ['oiliness'], concernSlugs: ['oily-congested-skin'], skinTypes: ['normal', 'oily'],
    }],
    evidenceSourceUrls: ['https://africa.cerave.com/en/our-products/cleansers/foaming-cleanser'],
    reviewedAt: '2026-08-07',
  },
  'la-roche-posay-anthelios-uvmune-400-oil-control-fluid': {
    productSlug: 'la-roche-posay-anthelios-uvmune-400-oil-control-fluid',
    careState: 'insufficient_data', approvedUses: [], evidenceSourceUrls: [],
    reviewedAt: '2026-08-07',
  },
  'la-roche-posay-toleriane-double-repair-matte': {
    productSlug: 'la-roche-posay-toleriane-double-repair-matte',
    careState: 'insufficient_data', approvedUses: [], evidenceSourceUrls: [],
    reviewedAt: '2026-08-07',
  },
  'la-roche-posay-toleriane-double-repair-spf30': {
    productSlug: 'la-roche-posay-toleriane-double-repair-spf30',
    careState: 'insufficient_data', approvedUses: [], evidenceSourceUrls: [],
    reviewedAt: '2026-08-07',
  },
  'cosrx-advanced-snail-96-mucin-power-essence': {
    productSlug: 'cosrx-advanced-snail-96-mucin-power-essence',
    careState: 'supportive_eligible',
    approvedUses: [{ id: 'hydration-conditioning', label: 'Hydration and skin conditioning', concernIds: ['dryness', 'dehydration'], concernSlugs: ['dry-dehydrated-skin'] }],
    evidenceSourceUrls: ['https://www.cosrx.com/products/advanced-snail-96-mucin-power-essence'],
    reviewedAt: '2026-08-07',
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
