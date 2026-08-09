import type { Product } from '@/data/products';

type DisplayApproval = {
  identityReview: {
    brand: string;
    name: string;
    size: string;
    sourceUrl: string;
    reviewer: 'Codex source audit';
    reviewedAt: string;
  };
  artReview: {
    contentHash: string;
    reviewer: 'Codex visual audit';
    reviewedAt: string;
    surfaces: readonly ['peach', 'pink', 'dark'];
  };
  // A display approval is not a reuse licence. Known prohibitions are held in
  // withheld-product-assets; permission provenance for this legacy set is not
  // yet encoded and must not be represented as verified.
  rightsStatus: 'not-verified';
};

type ApprovalInput = Pick<DisplayApproval['identityReview'], 'brand' | 'name' | 'size' | 'sourceUrl'> & {
  contentHash: string;
  reviewedAt: string;
};

function approval(input: ApprovalInput): DisplayApproval {
  return {
    identityReview: {
      brand: input.brand,
      name: input.name,
      size: input.size,
      sourceUrl: input.sourceUrl,
      reviewer: 'Codex source audit',
      reviewedAt: input.reviewedAt,
    },
    artReview: {
      contentHash: input.contentHash,
      reviewer: 'Codex visual audit',
      reviewedAt: input.reviewedAt,
      surfaces: ['peach', 'pink', 'dark'],
    },
    rightsStatus: 'not-verified',
  };
}

// Transparency metadata is not enough: pale photo planes can survive
// extraction. These approvals bind both exact identity/source and the reviewed
// image bytes. Any product, source, or file change fails closed.
export const productDisplayApprovals = {
  'skin-by-zaron-vitamin-c-body-lotion-500ml': approval({
    brand: 'Skin by Zaron',
    name: 'Vitamin C Brightening/Moisturizing Body Lotion',
    size: '500 ml',
    sourceUrl: 'https://i0.wp.com/buybetter.ng/wp-content/uploads/2024/09/vecg0cn6.png?fit=1200%2C1200&quality=80&ssl=1',
    contentHash: 'fe43be4dfea2e70206903a674003a9ebcd4ffc969f3836993433990b1f230567',
    reviewedAt: '2026-07-24T17:47:18.000Z',
  }),
  'cosrx-salicylic-acid-daily-gentle-cleanser': approval({
    brand: 'COSRX',
    name: 'Salicylic Acid Daily Gentle Cleanser',
    size: '150 ml',
    sourceUrl: 'https://www.cosrx.co.kr/shopimages/cosrx/019000000580.jpg?1688373373',
    contentHash: '4d3620eb731dc444e4504fcf0096dbd937cc8c4986d93cb4e1192bcee12de329',
    reviewedAt: '2026-08-09T19:59:00Z',
  }),
  'some-by-mi-aha-bha-pha-miracle-toner': approval({
    brand: 'SOME BY MI',
    name: 'AHA·BHA·PHA 30 Days Miracle Toner',
    size: '150 ml',
    sourceUrl: 'https://somebymicosmetics.com/media/0f/8b/8f/1747123769/somebymi-aha-bha-pha-miracle-toner.png?ts=1747123769',
    contentHash: 'd392e6f06ab8c2718a3ab43cb83cc37237a555b5ced2c6e7dfcf553b4e3bfcaf',
    reviewedAt: '2026-07-22T19:11:30.000Z',
  }),
  'anua-niacinamide-10-txa-4-serum': approval({
    brand: 'ANUA',
    name: 'Niacinamide 10% + TXA 4% Serum',
    size: '30 ml',
    sourceUrl: 'https://anua.com/cdn/shop/files/anua-global-ampoule-serum-niacinamide-10-txa-4-serum-for-brightening-and-dark-spots-1239193722.jpg?v=1779177130&width=2000',
    contentHash: '225e3a52fd9b2f4a092a3c8b970e608d13246e0e2187677fb71b1f2350e4b669',
    reviewedAt: '2026-07-22T12:34:11.000Z',
  }),
  'dove-moroccan-argan-oil-beauty-bar': approval({
    brand: 'Dove',
    name: 'Dry Oil Beauty Bar with Moroccan Argan Oil',
    size: '6 pack',
    sourceUrl: 'https://assets.unileversolutions.com/v1/946691.png',
    contentHash: '09e243e922141f31fedb31283ffd5b72e7ef1dcdcac7d5bcadd350251e1655e7',
    reviewedAt: '2026-08-09T21:26:00.000Z',
  }),
  'lush-hair-mentholated-conditioner': approval({
    brand: 'LUSH HAIR',
    name: 'Rinse Me Out Mentholated Conditioner',
    size: '370 ml',
    sourceUrl: 'https://nigeria.lushhairafrica.com/cdn/shop/files/26451_7ca2d10503cf413b262130540e2df7dd.png?v=1766145282&width=1600',
    contentHash: 'e746810397f9caeb94a5efa9204b564f2175216c4f84419bfb35d4cd757db560',
    reviewedAt: '2026-08-04T14:00:00.000Z',
  }),
  'b-lab-matcha-hydrating-real-sunscreen': approval({
    brand: 'B.LAB',
    name: 'Matcha Hydrating Real Sunscreen SPF50+ PA++++',
    size: '50 ml',
    sourceUrl: 'https://theskincounter.com/cdn/shop/products/blabrealsunscreenmatchatheskincounter.jpg?v=1677506934',
    contentHash: '73122802ca451c6cedb4c5ac3e1d184be9098bc9819abf3307c07fec682d4d8f',
    reviewedAt: '2026-08-09T02:26:00.000Z',
  }),
  'mediana-leave-in-conditioning-milk': approval({
    brand: 'MEDIANA',
    name: 'Leave-In Conditioning Milk',
    size: '250 ml',
    sourceUrl: 'https://www.cocci.com.ng/cdn/shop/files/Mediana_Leave-In_Conditioner_Milk.gif?v=1760002469',
    contentHash: 'b839501c0f871080d4199955912e8a82ce4877100fd8df2f87da9576564ca1ed',
    reviewedAt: '2026-08-09T21:26:00.000Z',
  }),
  'disaar-argan-oil-body-oil-gel': approval({
    brand: 'DISAAR',
    name: 'Argan Oil Body Oil Gel',
    size: '200 ml',
    sourceUrl: 'https://f.nooncdn.com/p/pzsku/Z2C891221F3259F5D3A6AZ/45/1767809439/db903634-894c-4f57-a677-0fe3b5fb3918.jpg',
    contentHash: '62f489d01351dd2ad85d90570aa343e0767fe8b01376c14d09aabba1990b7a8e',
    reviewedAt: '2026-08-08T21:17:00.000Z',
  }),
  'the-ordinary-azelaic-acid-suspension-10': approval({
    brand: 'The Ordinary',
    name: 'Azelaic Acid Suspension 10%',
    size: '30 ml',
    sourceUrl: 'https://theordinary.com/dw/image/v2/BFKJ_PRD/on/demandware.static/-/Sites-deciem-master/default/dw711cec9a/Images/products/The%20Ordinary/rdn-azelaic-acid-suspension-10pct-30ml.png?sw=1200&sh=1200&sm=fit',
    contentHash: '4de3dcc4e8b15336f3e7254f36157f65fcc47b3aa27aed87f384267a39d983df',
    reviewedAt: '2026-08-09T20:10:00Z',
  }),
  'panoxyl-acne-foaming-wash-10-benzoyl-peroxide': approval({
    brand: 'PanOxyl',
    name: 'Acne Foaming Wash 10% Benzoyl Peroxide',
    size: '156 g',
    sourceUrl: 'https://panoxyl.com/wp-content/uploads/2023/06/PanOxyl_Acne-Foaming-Wash_Front_5.5oz-Tube_SILO_wide.webp',
    contentHash: '9754b77a86ad86d492e921c2c9c36842a668600c417e9af98125de57e9980ed1',
    reviewedAt: '2026-07-22T12:34:11.000Z',
  }),
  'face-facts-wonder-cream-fragrance-free': approval({
    brand: 'FACE FACTS',
    name: 'Wonder Cream Fragrance Free',
    size: '50 ml',
    sourceUrl: 'https://facefacts.me/cdn/shop/files/39163_150_fr1.png?v=1759159571',
    contentHash: 'c4feb7aa3ed19996e9be53147a7a550b697ee65ee5b5d8b58fed1936f5a347b9',
    reviewedAt: '2026-07-22T12:34:11.000Z',
  }),
  'face-facts-bright-clear-face-cream': approval({
    brand: 'FACE FACTS',
    name: 'Bright + Clear Face Cream',
    size: '75 ml',
    sourceUrl: 'https://munacosmetics.com/image/cache/catalog/Another%20Effort/Victoria%20Island%20Lagos/shop-face-facts-bright-and-clear-face-cream-1600x1600.jpg',
    contentHash: '5c120eb9d657eca8c46a594f9ef22e7762e8e08109a667d86b703032262752b3',
    reviewedAt: '2026-08-04T15:58:00.000Z',
  }),
  'kuza-indian-hemp-hair-scalp-treatment': approval({
    brand: 'KUZA',
    name: '100% Indian Hemp Hair & Scalp Treatment',
    size: '7.7 oz / 218 g',
    sourceUrl: 'https://kuzaproducts.com/cdn/shop/files/1-K035-08-0600_KUZA_IndianHempHair_ScalpTreatment_7.7ozJar_FRONT_1.jpg?v=1782416888&width=2048',
    contentHash: 'cdc1398f2086e51a3cc4d19877aa1af4bb2ed752655da6e36ec9e6f59581524c',
    reviewedAt: '2026-08-08T21:14:00.000Z',
  }),
} as const satisfies Record<string, DisplayApproval>;

export function isProductDisplayApproved(
  product: Pick<Product, 'slug' | 'brand' | 'name' | 'size'>,
  asset?: { sourceUrl: string; contentHash: string },
) {
  const record = productDisplayApprovals[product.slug as keyof typeof productDisplayApprovals];
  return Boolean(
    record
    && asset
    && record.identityReview.brand === product.brand
    && record.identityReview.name === product.name
    && record.identityReview.size === product.size
    && record.identityReview.sourceUrl === asset.sourceUrl
    && record.artReview.contentHash === asset.contentHash
  );
}
