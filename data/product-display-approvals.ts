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
  'cosrx-salicylic-acid-daily-gentle-cleanser': approval({
    brand: 'COSRX',
    name: 'Salicylic Acid Daily Gentle Cleanser',
    size: '150 ml',
    sourceUrl: 'https://www.cosrx.co.kr/shopimages/cosrx/019000000580.jpg?1688373373',
    contentHash: '0944847bfbcf0a8d57fed34a05c6f76a2fe79e1876e2833e326e49d75cf0519b',
    reviewedAt: '2026-07-22T12:34:11.000Z',
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
    brand: 'DOVE',
    name: 'Dry Oil Beauty Bar with Moroccan Argan Oil',
    size: '6 pack',
    sourceUrl: 'https://assets.unileversolutions.com/v1/946691.png',
    contentHash: '4a1f7378a4a7a89fd685da21df393906ea9a3315dbef29ae82c0af829aec0856',
    reviewedAt: '2026-07-22T12:34:11.000Z',
  }),
  'dove-go-fresh-cucumber-green-tea-spray': approval({
    brand: 'DOVE',
    name: 'Aluminum Free Deodorant Spray Cucumber & Green Tea',
    size: '4 oz / 113 g',
    sourceUrl: 'https://assets.unileversolutions.com/v1/130217801.png?im=Resize,width=1600',
    contentHash: '7a9122c005144cd9af9c4bed6d5d385e903463e5c4ffb944cffddc4ecbf5f204',
    reviewedAt: '2026-07-23T00:04:01.000Z',
  }),
  'cerave-foaming-facial-cleanser': approval({
    brand: 'CeraVe',
    name: 'Foaming Facial Cleanser',
    size: '355 ml',
    sourceUrl: 'https://media.ulta.com/i/ulta/2254420?fmt=auto&qlt=90&wid=1200',
    contentHash: '5b2afb052acf0fd9b11e93e065b64763fcde0ebd1912e51dd0e300321818320c',
    reviewedAt: '2026-07-22T12:34:11.000Z',
  }),
  'the-ordinary-azelaic-acid-suspension-10': approval({
    brand: 'The Ordinary',
    name: 'Azelaic Acid Suspension 10%',
    size: '30 ml',
    sourceUrl: 'https://theordinary.com/dw/image/v2/BFKJ_PRD/on/demandware.static/-/Sites-deciem-master/default/dw711cec9a/Images/products/The%20Ordinary/rdn-azelaic-acid-suspension-10pct-30ml.png?sw=1200&sh=1200&sm=fit',
    contentHash: 'c5403d6e8e094b8a8c4cffd681c31edefad65fa3350854bf623f726048739e79',
    reviewedAt: '2026-07-22T20:09:49Z',
  }),
  'la-roche-posay-toleriane-double-repair-spf30': approval({
    brand: 'La Roche-Posay',
    name: 'Toleriane Double Repair Face Moisturizer UV SPF 30',
    size: '100 ml',
    sourceUrl: 'https://media.ulta.com/i/ulta/2503390?fmt=auto&qlt=90&wid=1200',
    contentHash: '95e3135c3509632122187ac3cdf162da986a65d782cb9a1c92b17a24f3a63c67',
    reviewedAt: '2026-07-22T12:34:11.000Z',
  }),
  'la-roche-posay-toleriane-double-repair-matte': approval({
    brand: 'La Roche-Posay',
    name: 'Toleriane Double Repair Matte Moisturizer',
    size: '75 ml',
    sourceUrl: 'https://media.ulta.com/i/ulta/2591830?fmt=auto&qlt=90&wid=1200',
    contentHash: '186689f9a63c9a0872454e3b18f82b688dffa6f06337f23e689ef6577645126e',
    reviewedAt: '2026-07-22T12:34:11.000Z',
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
  'ogx-renewing-argan-oil-of-morocco': approval({
    brand: 'OGX',
    name: 'Renewing + Argan Oil of Morocco Extra Penetrating Oil',
    size: '100 ml',
    sourceUrl: 'https://images.ctfassets.net/ya8mvjlg9l8b/3B76Sdr4luhOPdIh1Ltkb8/9d9fbd18444f0c5cf23a68a1baff9077/AOM_extra_strength_oil_FOP.webp',
    contentHash: '4d07e383b70138a47c301874ad8a6159e58be2387fd590926f53d79d8794299d',
    reviewedAt: '2026-07-22T19:25:36Z',
  }),
  'cerave-blemish-control-cleanser': approval({
    brand: 'CeraVe',
    name: 'Blemish Control Cleanser',
    size: '236 ml',
    sourceUrl: 'https://africa.cerave.com/en/-/media/Project/Loreal/BrandSites/CeraVe/Master/AfricaHub/English/Product/Blemish-control-cleanser/Blemish-Control-Cleanser.png',
    contentHash: 'dc995193903dc26f5392849422721049be7313f1f89680341744015f2f84646e',
    reviewedAt: '2026-07-22T19:56:31Z',
  }),
  'la-roche-posay-anthelios-uvmune-400-oil-control-fluid': approval({
    brand: 'La Roche-Posay',
    name: 'Anthelios UVMune 400 Oil Control Fluid SPF50+',
    size: '50 ml',
    sourceUrl: 'https://www.laroche-posay.co.uk/dw/image/v2/AAQP_PRD/on/demandware.static/-/Sites-lrp-ng-master-catalog/default/dw8210e9ef/LRP_Product/Anthelios/3337875847292_Anthelios-UVMune-400-Oil-Control-Invisible-Fluid_50ml_01_La_Roche_Posay.jpg?sw=1356&sh=1356&sm=cut&sfrm=jpg&q=95',
    contentHash: '561fc98be60cacbb6217af9dd0251e11a688164246088c477a19e9b11a05dced',
    reviewedAt: '2026-07-22T19:57:02Z',
  }),
  'cosrx-advanced-snail-96-mucin-power-essence': approval({
    brand: 'COSRX',
    name: 'Advanced Snail 96 Mucin Power Essence',
    size: '100 ml',
    sourceUrl: 'https://www.cosrx.com/cdn/shop/files/james_800x1067_1_1_4e9750cc-2cd6-4817-ace5-be2305a85806.jpg?v=1763111577',
    contentHash: '4101d7087e1912d3d5b47cb2b49f48f75d4b1e6f8de9d4389d487cad73984b84',
    reviewedAt: '2026-07-22T19:56:32Z',
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
