import type {
  BrandAuthorizationEvidence,
  EvidenceReference,
  PriceObservation,
  RetailerEvidence,
  SellerIdentityEvidence,
} from '@/data/retail-evidence';

export type OrderChannel = 'website' | 'whatsapp' | 'instagram' | 'facebook' | 'physical' | 'marketplace';
export type FulfilmentMethod = 'delivery' | 'pickup' | 'walk-in';

export type Offer = {
  retailer: string;
  url: string;
  trust: number;
  available: boolean;
  priceNgn?: number;
  priceUsd?: number;
  /** Observed numeric delivery fee for the market, when a listing states one. Lets ranking
   *  compare landed totals; absent means delivery is only known qualitatively (see landedCost). */
  deliveryNgn?: number;
  deliveryUsd?: number;
  checkedAt?: string;
  expiresAt?: string;
  match?: 'exact' | 'search';
  inventoryQuantity?: number;
  sellerName?: string;
  sellerScore?: number;
  /** @deprecated A label is not authorization evidence. Use brandAuthorizationEvidence. */
  officialStore?: boolean;
  listingEvidence?: EvidenceReference;
  sellerIdentityEvidence?: SellerIdentityEvidence;
  brandAuthorizationEvidence?: BrandAuthorizationEvidence;
  priceObservation?: PriceObservation;
  /** Excludes an observed price from lowest-price and comparison claims without hiding the listing. */
  priceComparison?: 'include' | 'exclude';
  retailerEvidence?: RetailerEvidence;
  location: string[];
  orderChannels?: OrderChannel[];
  fulfilment?: FulfilmentMethod[];
  locationLabel?: string;
};

export type Product = {
  slug: string;
  /** Immutable catalogue identity for releases whose canonical route is not the legacy GTIN path. */
  catalogueIdentity?: {
    kind: 'manufacturer-sku';
    value: string;
    label: 'SKU' | 'Manufacturer SKU' | 'Product code';
  };
  brand: string;
  name: string;
  size: string;
  category: 'Face' | 'Hair' | 'Body';
  step: string;
  image: string;
  displayLine: string;
  bestFor: string[];
  concerns: string[];
  skinTypes: string[];
  sensitiveFriendly: boolean;
  usage: string;
  evidence: 'high' | 'moderate' | 'emerging';
  verifiedIngredientIds?: string[];
  offers: Offer[];
};

/** Products whose suitability fields were explicitly reviewed by JeloCare. */
export type ReviewedProduct = Product;

const beautyByDaz = (url: string, available = true): Offer => ({ retailer: 'Beauty by Daz', url, trust: 100, available, location: ['NG'] });
const careToBeauty = (url: string): Offer => ({ retailer: 'Care to Beauty', url, trust: 92, available: true, location: ['NG', 'INTL'] });
const perona = (url: string, available = true): Offer => ({ retailer: 'Perona Beauty', url, trust: 86, available, location: ['NG'] });

export const products: Product[] = [
  {
    slug: 'cosrx-salicylic-acid-daily-gentle-cleanser', brand: 'COSRX', name: 'Salicylic Acid Daily Gentle Cleanser', size: '150 ml', category: 'Face', step: 'Cleanse',
    image: 'https://www.cosrx.co.kr/shopimages/cosrx/019000000580.jpg?1688373373', displayLine: 'Cleanse · clarify',
    bestFor: ['oily skin', 'blackheads', 'congestion'], concerns: ['acne', 'blackheads', 'whiteheads', 'pores'], skinTypes: ['oily', 'combination'], sensitiveFriendly: true,
    usage: 'Morning or evening. Reduce frequency if skin feels tight.', evidence: 'moderate',
    offers: [beautyByDaz('https://beautybydaz.com/shop/face/cosrx-salicylic-acid-cleanser/'), careToBeauty('https://www.caretobeauty.com/ng/cosrx-salicylic-acid-daily-gentle-cleanser-150ml/')]
  },
  {
    slug: 'some-by-mi-aha-bha-pha-miracle-toner', brand: 'SOME BY MI', name: 'AHA·BHA·PHA 30 Days Miracle Toner', size: '150 ml', category: 'Face', step: 'Exfoliate',
    image: 'https://somebymicosmetics.com/media/0f/8b/8f/1747123769/somebymi-aha-bha-pha-miracle-toner.png?ts=1747123769', displayLine: 'Exfoliate · refine',
    bestFor: ['blackheads', 'texture', 'congestion'], concerns: ['blackheads', 'whiteheads', 'pores', 'texture'], skinTypes: ['oily', 'combination'], sensitiveFriendly: false,
    usage: 'Evening. Begin twice weekly.', evidence: 'moderate',
    offers: [beautyByDaz('https://beautybydaz.com/shop/face/some-by-mi-aha-bha-pha-30-days-miracle-toner/'), careToBeauty('https://www.caretobeauty.com/ng/some-by-mi-30-days-miracle-toner-150ml/')]
  },
  {
    slug: 'anua-niacinamide-10-txa-4-serum', brand: 'ANUA', name: 'Niacinamide 10% + TXA 4% Serum', size: '30 ml', category: 'Face', step: 'Treat',
    image: 'https://i0.wp.com/buybetter.ng/wp-content/uploads/2024/06/skdbvd-1-optimized.jpg?fit=425%2C425&quality=89&ssl=1', displayLine: 'Correct · brighten',
    bestFor: ['post-acne marks', 'uneven tone', 'visible pores'], concerns: ['hyperpigmentation', 'dark spots', 'pores', 'oiliness'], skinTypes: ['oily', 'combination', 'normal'], sensitiveFriendly: true,
    usage: 'Morning and most evenings. Introduce gradually.', evidence: 'moderate',
    offers: [beautyByDaz('https://beautybydaz.com/shop/face/anua-niacinamide-10-tranexamin-acid-4-serum/'), careToBeauty('https://www.caretobeauty.com/ng/anua-niacinamide-10-txa-4-serum-30ml/')]
  },
  {
    slug: 'face-facts-wonder-cream-fragrance-free', brand: 'FACE FACTS', name: 'Wonder Cream Fragrance Free', size: '50 ml', category: 'Face', step: 'Moisturize',
    image: 'https://peronabeauty.com/wp-content/uploads/2024/12/Screenshot-at--600x605.png', displayLine: 'Hydrate · comfort',
    bestFor: ['barrier support', 'light hydration'], concerns: ['sensitivity', 'dryness', 'barrier'], skinTypes: ['oily', 'combination', 'normal', 'dry'], sensitiveFriendly: true,
    usage: 'Morning or barrier-focused evenings.', evidence: 'moderate',
    offers: [beautyByDaz('https://beautybydaz.com/shop/face-facts-wonder-cream-50ml-2/', false), perona('https://peronabeauty.com/product/face-facts-wonder-cream-fragrance-free/')]
  },
  {
    slug: 'face-facts-bright-clear-face-cream', brand: 'FACE FACTS', name: 'Bright + Clear Face Cream', size: '75 ml', category: 'Face', step: 'Moisturize',
    image: 'https://munacosmetics.com/image/cache/catalog/Another%20Effort/Victoria%20Island%20Lagos/shop-face-facts-bright-and-clear-face-cream-1600x1600.jpg', displayLine: 'Even · soften',
    bestFor: ['dark marks', 'uneven tone'], concerns: ['hyperpigmentation', 'dark spots'], skinTypes: ['oily', 'combination', 'normal'], sensitiveFriendly: false,
    usage: 'Evening. Patch test first.', evidence: 'emerging',
    offers: [beautyByDaz('https://beautybydaz.com/shop/face/face-facts-bright-clear-face-cream-75ml/'), perona('https://peronabeauty.com/product/face-facts-bright-clear-face-cream-75ml/')]
  },
  {
    slug: 'b-lab-matcha-hydrating-real-sunscreen', brand: 'B.LAB', name: 'Matcha Hydrating Real Sunscreen SPF50+ PA++++', size: '50 ml', category: 'Face', step: 'Protect',
    image: 'https://b-labskincare.com/web/product/big/202407/c704a28e6d2187bf046516ba6e853c5d.png', displayLine: 'Shield · preserve',
    bestFor: ['daily UV protection', 'pigmentation prevention'], concerns: ['hyperpigmentation', 'dark spots', 'sensitivity'], skinTypes: ['oily', 'combination', 'normal', 'dry'], sensitiveFriendly: true,
    usage: 'Every morning as the final skincare step.', evidence: 'high',
    offers: [beautyByDaz('https://beautybydaz.com/shop/face/sunscreens/b-lab-matcha-hydrating-real-sun-screen-spf50-pa/'), perona('https://peronabeauty.com/product/b-lab-matcha-hydrating-real-sun-screen-spf50-pa/')]
  },
  {
    slug: 'dove-moroccan-argan-oil-beauty-bar', brand: 'DOVE', name: 'Dry Oil Beauty Bar with Moroccan Argan Oil', size: '6 pack', category: 'Body', step: 'Cleanse',
    image: 'https://assets.unileversolutions.com/v1/946691.png', displayLine: 'Cleanse · soften',
    bestFor: ['daily cleansing', 'comfortable body skin'], concerns: ['body dryness'], skinTypes: ['all'], sensitiveFriendly: true,
    usage: 'Daily bath or shower.', evidence: 'moderate',
    offers: [beautyByDaz('https://beautybydaz.com/?s=dove+moroccan+argan+oil+beauty+bar&post_type=product'), careToBeauty('https://www.caretobeauty.com/ng/catalogsearch/result/?q=dove%20argan%20oil')]
  },
  {
    slug: 'dove-go-fresh-cucumber-green-tea-spray', brand: 'DOVE', name: 'Aluminum Free Deodorant Spray Cucumber & Green Tea', size: '4 oz / 113 g', category: 'Body', step: 'Protect',
    image: 'https://assets.unileversolutions.com/v1/130217801.png?im=Resize,width=1600', displayLine: 'Freshen · protect',
    bestFor: ['daily freshness', 'aluminum-free odor protection'], concerns: ['body odour', 'perspiration'], skinTypes: ['all'], sensitiveFriendly: true,
    usage: 'Use on clean, dry underarms.', evidence: 'moderate',
    offers: [beautyByDaz('https://beautybydaz.com/?s=dove+go+fresh+cucumber+green+tea+spray&post_type=product'), careToBeauty('https://www.caretobeauty.com/ng/catalogsearch/result/?q=dove%20cucumber%20deodorant')]
  },
  {
    slug: 'miracle-natural-hair-anti-dandruff-shampoo', brand: 'BEAUTIFUL YOU · MIRACLE', name: 'Natural Hair Anti-Dandruff & Anti-Itch Shampoo', size: '400 ml', category: 'Hair', step: 'Cleanse',
    image: 'https://www.agtplaza.com/cdn/shop/files/background-editor_output_7b61d159-dd7a-41f8-a083-ec9548d9bdf2.png?v=1735099870', displayLine: 'Cleanse · calm',
    bestFor: ['dandruff', 'itchy scalp'], concerns: ['dandruff', 'itch'], skinTypes: ['scalp'], sensitiveFriendly: true,
    usage: 'Wash days. Massage into the scalp and rinse well.', evidence: 'emerging',
    offers: [beautyByDaz('https://beautybydaz.com/?s=miracle+natural+hair+anti+dandruff+shampoo&post_type=product', false), { retailer: 'AGT Plaza', url: 'https://www.agtplaza.com/products/miracle-shampoo-natural-hair-anti-dandruff-anti-itch-with-castor-oil-400ml-ugm41a', trust: 78, available: true, location: ['NG'] }]
  },
  {
    slug: 'lush-hair-mentholated-conditioner', brand: 'LUSH HAIR', name: 'Rinse Me Out Mentholated Conditioner', size: '370 ml', category: 'Hair', step: 'Condition',
    image: 'https://nigeria.lushhairafrica.com/cdn/shop/files/26451_7ca2d10503cf413b262130540e2df7dd.png?v=1766145282&width=1600', displayLine: 'Condition · detangle',
    bestFor: ['detangling', 'wash-day conditioning'], concerns: ['dry hair', 'tangles'], skinTypes: ['hair'], sensitiveFriendly: true,
    usage: 'Apply after shampoo, detangle, then rinse.', evidence: 'emerging',
    offers: [beautyByDaz('https://beautybydaz.com/?s=lush+hair+mentholated+conditioner&post_type=product', false), { retailer: 'Lush Hair Nigeria', url: 'https://nigeria.lushhairafrica.com/products/mentholated-conditioner-370ml', trust: 98, available: true, location: ['NG'] }]
  },
  {
    slug: 'mediana-leave-in-conditioning-milk', brand: 'MEDIANA', name: 'Leave-In Conditioning Milk', size: '250 ml', category: 'Hair', step: 'Leave in',
    image: 'https://www.cocci.com.ng/cdn/shop/files/Mediana_Leave-In_Conditioner_Milk.gif?v=1760002469', displayLine: 'Detangle · soften',
    bestFor: ['leave-in moisture', 'detangling'], concerns: ['dry hair', 'tangles'], skinTypes: ['hair'], sensitiveFriendly: true,
    usage: 'Apply to damp hair after washing.', evidence: 'emerging',
    offers: [beautyByDaz('https://beautybydaz.com/?s=mediana+leave-in+conditioning+milk&post_type=product', false), { retailer: 'Slique Beauty', url: 'https://sliquebeautylimited.com/product/mediana-leave-in-conditioning-milk-250ml/', trust: 78, available: true, location: ['NG'] }]
  },
  {
    slug: 'kuza-indian-hemp-hair-scalp-treatment', brand: 'KUZA', name: '100% Indian Hemp Hair & Scalp Treatment', size: '7.7 oz / 226 g', category: 'Hair', step: 'Seal',
    image: 'https://kuzaproducts.com/cdn/shop/files/1-K035-08-0600_KUZA_IndianHempHair_ScalpTreatment_7.7ozJar_FRONT_1.jpg?v=1782416888&width=2048', displayLine: 'Treat · seal',
    bestFor: ['hair moisture', 'scalp treatment'], concerns: ['dry hair', 'dry scalp'], skinTypes: ['hair'], sensitiveFriendly: true,
    usage: 'Apply gently to hair and scalp, concentrating on dry areas. Style hair as usual. Use daily for best results.', evidence: 'emerging',
    offers: [beautyByDaz('https://beautybydaz.com/?s=kuza+indian+hemp+hair+scalp+treatment&post_type=product', false), { retailer: 'Perfect Picture Cosmetics', url: 'https://perfectpicturecosmetics.com/products/kuza-100-indian-hemp-hair-scalp-treatment-226g', trust: 76, available: true, location: ['GH'] }]
  },
  {
    slug: 'ogx-renewing-argan-oil-of-morocco', brand: 'OGX', name: 'Renewing + Argan Oil of Morocco Extra Penetrating Oil', size: '100 ml', category: 'Hair', step: 'Finish',
    image: 'https://images.ctfassets.net/ya8mvjlg9l8b/3B76Sdr4luhOPdIh1Ltkb8/9d9fbd18444f0c5cf23a68a1baff9077/AOM_extra_strength_oil_FOP.webp', displayLine: 'Gloss · finish',
    bestFor: ['shine', 'dry lengths and ends'], concerns: ['dry hair', 'frizz'], skinTypes: ['hair'], sensitiveFriendly: true,
    usage: 'Use a few drops through lengths and ends.', evidence: 'moderate',
    offers: [beautyByDaz('https://beautybydaz.com/?s=OGX+Renewing+Argan+Oil+of+Morocco&post_type=product', false), careToBeauty('https://www.caretobeauty.com/ng/ogx-renewing-argan-oil-of-morocco-extra-penetrating-oil-100ml/')]
  },
  {
    slug: 'disaar-argan-oil-body-oil-gel', brand: 'DISAAR', name: 'Argan Oil Body Oil Gel', size: '200 ml', category: 'Body', step: 'Moisturize',
    image: 'https://mahamipharmacyng.com/wp-content/uploads/2026/05/Disaar-ARGAN-OIL-EFFICIENT-MOISTURIZING-Body-Oil-Gel-566.jpeg', displayLine: 'Moisturize · glow',
    bestFor: ['body moisture', 'after-shower glow'], concerns: ['body dryness'], skinTypes: ['body'], sensitiveFriendly: true,
    usage: 'Apply to damp body skin after showering.', evidence: 'emerging',
    offers: [beautyByDaz('https://beautybydaz.com/?s=disaar+argan+oil+body+oil+gel&post_type=product', false), { retailer: 'Choices Beauty', url: 'https://choiceschi.com/product/disaar-argan-oil-body-oil-gel/', trust: 72, available: true, location: ['NG'] }]
  }
];

export const productBySlug = (slug: string) => products.find(product => product.slug === slug);
