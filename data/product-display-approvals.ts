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
    sourceUrl: 'https://assets.unileversolutions.com/v1/130069295.png',
    contentHash: 'eb019e9f826aa1fc6a5d5a7252ce7e2269b2f97f1127bcc337a0698465926325',
    reviewedAt: '2026-07-22T12:34:11.000Z',
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
    sourceUrl: 'https://media.ulta.com/i/ulta/2551154?fmt=auto&qlt=90&wid=1200',
    contentHash: '6218f671f9c468ef603234b5edf21cabdd3a35ddded5b145d750f4dce7e84ec2',
    reviewedAt: '2026-07-22T12:34:11.000Z',
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
