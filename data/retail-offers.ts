import type { Offer, Product } from '@/data/products';
import { materializeOfferEvidence } from '@/modules/commerce/offer-evidence';

const checkedAt = '2026-07-22';

type ExactNgOptions = Pick<Offer, 'available' | 'inventoryQuantity' | 'sellerName' | 'sellerScore' | 'priceComparison'> & {
  stock?: NonNullable<Offer['priceObservation']>['stock'];
};

const exactNg = (
  retailer: string,
  url: string,
  trust: number,
  priceNgn: number,
  observedVariant: string,
  observedSize: string,
  options: Partial<ExactNgOptions> = {},
): Offer => ({
  retailer,
  url,
  trust,
  available: options.available ?? true,
  priceNgn,
  checkedAt,
  match: 'exact',
  inventoryQuantity: options.inventoryQuantity,
  sellerName: options.sellerName,
  sellerScore: options.sellerScore,
  priceComparison: options.priceComparison,
  listingEvidence: {
    observedAt: checkedAt,
    sourceUrl: url,
    basis: 'retailer-page',
  },
  priceObservation: {
    observedAt: checkedAt,
    variant: observedVariant,
    size: observedSize,
    stock: options.stock ?? (options.available === false ? 'out-of-stock' : 'in-stock'),
    landedCost: 'unknown',
  },
  location: ['NG'],
});

export const verifiedRetailOffers: Record<string, Offer[]> = {
  'cosrx-salicylic-acid-daily-gentle-cleanser': [
    exactNg('Beauty by Daz', 'https://beautybydaz.com/shop/face/cosrx-salicylic-acid-cleanser/', 100, 8500, 'COSRX Salicylic Acid Daily Gentle Cleanser', '150 ml'),
    exactNg('Lux Beauty', 'https://www.luxbeautyng.com/product/cosrx-salicylic-acid-daily-gentle-cleanser/', 96, 9600, 'COSRX Salicylic Acid Daily Gentle Cleanser', '150 ml'),
  ],
  'some-by-mi-aha-bha-pha-miracle-toner': [
    exactNg('Teeka4', 'https://teeka4.com/shop/somebymi-aha-bha-pha-30days-miracle-toner-150ml-5oz/', 98, 13495, 'SOME BY MI AHA BHA PHA 30 Days Miracle Toner', '150 ml', { available: false }),
  ],
  'anua-niacinamide-10-txa-4-serum': [
    exactNg('Teeka4', 'https://teeka4.com/shop/anua-niacinamide-10-txa-4-serum-30ml/', 98, 18000, 'ANUA Niacinamide 10% + TXA 4% Serum', '30 ml'),
    exactNg('Jumia', 'https://www.jumia.com.ng/anua-niacinamide-10-txa-4-serum-30ml-new-version-419517907.html', 62, 7999, 'ANUA Niacinamide 10% + TXA 4% Serum New Version', '30 ml', { sellerName: 'Smile Time', sellerScore: 92, priceComparison: 'exclude' }),
  ],
  'face-facts-wonder-cream-fragrance-free': [
    exactNg('Teeka4', 'https://teeka4.com/shop/face-facts-wonder-cream-fragrance-free-50ml-copy/', 98, 7700, 'Face Facts Wonder Cream Fragrance Free', '50 ml'),
  ],
  'face-facts-bright-clear-face-cream': [
    exactNg('Beauty by Daz', 'https://beautybydaz.com/shop/face/treatment/face-facts-bright-clear-face-cream-75ml/', 100, 7500, 'Face Facts Bright + Clear Face Cream', '75 ml'),
    exactNg('Perona Beauty', 'https://peronabeauty.com/product/face-facts-bright-clear-face-cream-75ml/', 86, 7750, 'Face Facts Bright + Clear Face Cream', '75 ml'),
  ],
  'miracle-natural-hair-anti-dandruff-shampoo': [
    exactNg('AGT Plaza', 'https://www.agtplaza.com/products/miracle-shampoo-natural-hair-anti-dandruff-anti-itch-with-castor-oil-400ml-ugm41a', 78, 1695, 'Miracle Shampoo Natural Hair Anti-Dandruff Anti-Itch with Castor Oil', '400 ml'),
  ],
  'lush-hair-mentholated-conditioner': [
    exactNg('Lush Hair Nigeria', 'https://nigeria.lushhairafrica.com/products/mentholated-conditioner-370ml', 98, 1687, 'Mentholated Conditioner', '370 ml'),
  ],
  'mediana-leave-in-conditioning-milk': [
    exactNg('Jumia', 'https://www.jumia.com.ng/mediana-leave-in-conditioning-milk-250ml-215118251.html', 62, 2084, 'Mediana Leave-In Conditioning Milk', '250 ml', { inventoryQuantity: 4, sellerName: 'Jeto', sellerScore: 88, stock: 'low-stock' }),
    {
      retailer: 'Slique Beauty',
      url: 'https://sliquebeautylimited.com/product/mediana-leave-in-conditioning-milk-250ml/',
      trust: 78,
      available: true,
      priceNgn: 1500,
      checkedAt: '2026-07-22T09:42:32Z',
      match: 'exact',
      listingEvidence: {
        observedAt: '2026-07-22T09:42:32Z',
        sourceUrl: 'https://sliquebeautylimited.com/wp-json/wc/store/v1/products?slug=mediana-leave-in-conditioning-milk-250ml',
        basis: 'retailer-api',
      },
      priceObservation: {
        observedAt: '2026-07-22T09:42:32Z',
        variant: 'Leave-In Conditioning Milk',
        size: '250 ml',
        stock: 'in-stock',
        landedCost: 'unknown',
      },
      location: ['NG'],
    },
  ],
  'disaar-argan-oil-body-oil-gel': [
    exactNg('Jumia', 'https://www.jumia.com.ng/disaar-argan-oil-body-oil-gel-deep-moisturizing-skin-care-200ml-419220900.html', 62, 4500, 'Disaar Argan Oil Body Oil Gel Deep Moisturizing Skin Care', '200 ml', { sellerName: 'Christodel Global Services', sellerScore: 88, stock: 'low-stock' }),
  ],
  'cerave-foaming-facial-cleanser': [
    exactNg('CSi Grocery', 'https://www.csigrocery.com/shop/skincare/face/facial-cleansers/cerave-foaming-facial/', 90, 27500, 'CeraVe Foaming Facial Cleanser', '355 ml'),
  ],
  'cerave-blemish-control-cleanser': [
    exactNg('Teeka4', 'https://teeka4.com/shop/cerave-acne-control-face-cleanser-facial-cleanser-8-fl-oz/', 98, 14800, 'CeraVe Blemish Control Cleanser', '236 ml'),
  ],
  'the-ordinary-azelaic-acid-suspension-10': [
    exactNg('Beauty by Daz', 'https://beautybydaz.com/shop/face/oils-serum/the-ordinary-azelaic-acid/', 100, 10500, 'The Ordinary Azelaic Acid Suspension 10%', '30 ml', { available: false }),
  ],
  'la-roche-posay-anthelios-uvmune-400-oil-control-fluid': [
    exactNg('Teeka4', 'https://teeka4.com/shop/la-roche-posay-anthelios-uvmune-400-oil-control-fluid-spf50for-oily-blemish-prone-skin-50ml-1-7oz/', 98, 23500, 'La Roche-Posay Anthelios UVMune 400 Oil Control Fluid SPF50+', '50 ml', { available: false }),
  ],
  'cosrx-advanced-snail-96-mucin-power-essence': [
    exactNg('Beauty by Daz', 'https://beautybydaz.com/shop/face/oils-serum/cosrx-advanced-snail-96-mucin-power-essence/', 100, 12500, 'COSRX Advanced Snail 96 Mucin Power Essence', '100 ml', { available: false }),
    exactNg('Lux Beauty', 'https://www.luxbeautyng.com/product/cosrx-snail-mucin-96-power-repairing-essence/', 96, 12400, 'COSRX Advanced Snail 96 Mucin Power Essence', '100 ml'),
  ],
  'panoxyl-acne-foaming-wash-10-benzoyl-peroxide': [
    {
      retailer: 'Slique Beauty',
      url: 'https://sliquebeautylimited.com/product/panoxyl-acne-foaming-wash-benzoyl-peroxide-10-maximum-strength-156g/',
      trust: 78,
      available: true,
      priceNgn: 19300,
      checkedAt: '2026-07-22T14:44:09Z',
      match: 'exact',
      listingEvidence: {
        observedAt: '2026-07-22T14:44:09Z',
        sourceUrl: 'https://sliquebeautylimited.com/wp-json/wc/store/v1/products?slug=panoxyl-acne-foaming-wash-benzoyl-peroxide-10-maximum-strength-156g',
        basis: 'retailer-api',
      },
      priceObservation: {
        observedAt: '2026-07-22T14:44:09Z',
        variant: 'PANOXYL ACNE FOAMING WASH BENZOYL PEROXIDE 10% MAXIMUM STRENGTH -156G',
        size: '156 g',
        stock: 'in-stock',
        landedCost: 'unknown',
      },
      location: ['NG'],
    },
  ],
};

const excludedRetailers: Partial<Record<string, string[]>> = {
  // The old route is the 236 ml product, not this catalogue's 355 ml size.
  'cerave-foaming-facial-cleanser': ['Care to Beauty'],
  // These listings lack a manufacturer-GTIN match for the exact 156 g pack.
  'panoxyl-acne-foaming-wash-10-benzoyl-peroxide': ['Teeka4', 'Lux Beauty'],
};

function isSearchRoute(url: string) {
  const normalized = url.toLowerCase();
  return normalized.includes('?s=')
    || normalized.includes('&s=')
    || normalized.includes('/search?')
    || normalized.includes('/catalog/?q=')
    || normalized.includes('/catalogsearch/')
    || normalized.includes('amazon.com/s?')
    || normalized.includes('walmart.com/search?');
}

export function mergeRetailOffers(product: Pick<Product, 'slug' | 'name' | 'size'>, offers: Offer[]) {
  const excluded = new Set(excludedRetailers[product.slug] ?? []);
  const merged = new Map<string, Offer>();

  for (const offer of offers) {
    if (excluded.has(offer.retailer)) continue;
    merged.set(offer.retailer, {
      ...offer,
      match: offer.match ?? (isSearchRoute(offer.url) ? 'search' : 'exact'),
    });
  }

  for (const offer of verifiedRetailOffers[product.slug] ?? []) merged.set(offer.retailer, offer);
  return [...merged.values()].map(offer => materializeOfferEvidence(product, offer));
}
