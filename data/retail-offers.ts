import type { Offer, Product } from '@/data/products';
import { materializeOfferEvidence } from '@/modules/commerce/offer-evidence';
import { isOfferFresh } from '@/modules/commerce/offer-freshness';

const checkedAt = '2026-07-22';

type ExactNgOptions = Pick<Offer, 'available' | 'expiresAt' | 'inventoryQuantity' | 'sellerName' | 'sellerScore' | 'priceComparison'> & {
  observedAt?: string;
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
): Offer => {
  const observationTime = options.observedAt ?? checkedAt;
  return {
    retailer,
    url,
    trust,
    available: options.available ?? true,
    priceNgn,
    checkedAt: observationTime,
    expiresAt: options.expiresAt,
    match: 'exact',
    inventoryQuantity: options.inventoryQuantity,
    sellerName: options.sellerName,
    sellerScore: options.sellerScore,
    priceComparison: options.priceComparison,
    listingEvidence: {
      observedAt: observationTime,
      sourceUrl: url,
      basis: 'retailer-page',
    },
    priceObservation: {
      observedAt: observationTime,
      variant: observedVariant,
      size: observedSize,
      stock: options.stock ?? (options.available === false ? 'out-of-stock' : 'in-stock'),
      landedCost: 'unknown',
    },
    location: ['NG'],
  };
};

export const verifiedRetailOffers: Record<string, Offer[]> = {
  'naturium-the-perfector-salicylic-acid-body-wash-500ml': [
    exactNg(
      'Beauty by Daz',
      'https://beautybydaz.com/shop/bath-body/bath-wash-gels/naturium-the-brightener-vitamin-c-brightening-body-wash/',
      100,
      38000,
      'The Perfector Salicylic Acid Body Wash',
      '500 mL',
      { observedAt: '2026-08-04T14:52:49.503Z', expiresAt: '2026-08-11T14:52:49.503Z', available: false, stock: 'out-of-stock' },
    ),
    exactNg(
      'The Beauty Prism',
      'https://thebeautyprismng.com/shop/the-perfector-salicylic-acid-body-wash/',
      78,
      42500,
      'The Perfector Salicylic Acid Body Wash',
      '500 mL',
      { observedAt: '2026-08-04T14:52:52.135Z', expiresAt: '2026-08-11T14:52:52.135Z', stock: 'low-stock' },
    ),
    exactNg(
      'Rhema Beauty Shop',
      'https://rhemabeautyshop.com/shop/naturium-the-perfector-salicylic-acid-body-wash-500ml/',
      86,
      46225,
      'The Perfector Salicylic Acid Body Wash',
      '500 mL',
      { observedAt: '2026-08-04T14:54:07.717Z', expiresAt: '2026-08-11T14:54:07.717Z' },
    ),
    exactNg(
      'TOS Nigeria',
      'https://tosnigeria.com/shop/naturium-the-perfector-salicylic-acid-skin-smoothing-body-wash-16-9-fl-oz-500ml/',
      78,
      42000,
      'The Perfector Salicylic Acid Body Wash',
      '16.9 fl oz / 500 mL',
      { observedAt: '2026-08-04T14:54:08Z', expiresAt: '2026-08-11T14:54:08Z' },
    ),
    exactNg(
      'Perona Beauty',
      'https://peronabeauty.com/product/naturium-the-perfector-salicylic-acid-body-wash-500ml/',
      86,
      41000,
      'The Perfector Salicylic Acid Body Wash',
      '16.9 fl oz / 500 mL',
      { observedAt: '2026-08-04T14:54:09Z', expiresAt: '2026-08-11T14:54:09Z' },
    ),
  ],
  'la-roche-posay-lipikar-apmax-triple-repair-moisturizing-cream-200ml': [
    exactNg(
      'Teeka4',
      'https://teeka4.com/shop/la-roche-posay-lipikar-apmax-triple-action-balm-200ml/',
      98,
      18999,
      'Lipikar Baume AP+MAX',
      '200 mL',
      { observedAt: '2026-08-04T14:54:12.321Z', expiresAt: '2026-08-11T14:54:12.321Z' },
    ),
  ],
  'la-roche-posay-lipikar-apmax-triple-repair-moisturizing-cream-400ml': [
    exactNg(
      'Perona Beauty',
      'https://peronabeauty.com/product/la-roche-posay-lipikar-baume-ap-m-400ml/',
      86,
      28200,
      'Lipikar Baume AP+MAX',
      '400 mL',
      { observedAt: '2026-08-04T14:54:13.181Z', expiresAt: '2026-08-11T14:54:13.181Z' },
    ),
    exactNg(
      'Medplus',
      'https://medplusnig.com/product/la-roche-posay-lipikar-baume-apm-400ml-V4yTZN',
      97,
      29550,
      'Lipikar Baume AP+MAX',
      '400 mL',
      { observedAt: '2026-08-04T14:54:14Z', expiresAt: '2026-08-11T14:54:14Z', available: false, stock: 'out-of-stock' },
    ),
  ],
  'fenty-skin-butta-drop-fenty-fresh-standard-200ml': [
    exactNg(
      'Essentials Hub',
      'https://essentialshub.com/product/fenty-skin-butta-drop-whipped-oil-body-cream/',
      86,
      79000,
      'Fenty Fresh / Standard',
      '200 mL / 6.7 fl oz',
      { observedAt: '2026-08-04T14:54:13.644Z', expiresAt: '2026-08-11T14:54:13.644Z' },
    ),
  ],
  'medik8-crystal-retinal-3-30ml': [
    exactNg(
      'Teeka4',
      'https://teeka4.com/shop/medik8-crystal-retinal-3/',
      98,
      92389,
      'Crystal Retinal 3',
      '30 ml',
      { observedAt: '2026-08-04T14:54:20.627Z', expiresAt: '2026-08-11T14:54:20.627Z' },
    ),
    exactNg(
      'Skincare Plug NG',
      'https://skincareplug-ng.com/products/medik8-crystal-retinal-3',
      78,
      145000,
      'Crystal Retinal 3',
      '30 ml',
      { observedAt: '2026-08-04T14:54:20.700Z', expiresAt: '2026-08-11T14:54:20.700Z' },
    ),
  ],
  'medik8-crystal-retinal-6-30ml': [
    exactNg(
      'My Skin Hub NG',
      'https://myskinhubng.com/products/medik8-crystal-retinal-6/3176365',
      78,
      178500,
      'Crystal Retinal 6',
      '30 ml',
      { observedAt: '2026-08-04T14:54:20.989Z', expiresAt: '2026-08-11T14:54:20.989Z' },
    ),
    exactNg(
      'Jumia',
      'https://www.jumia.com.ng/medik8-crystal-retinal-6-serum-30ml-419680146.html',
      62,
      178500,
      'Crystal Retinal 6',
      '30 ml',
      { observedAt: '2026-08-04T14:54:21Z', expiresAt: '2026-08-11T14:54:21Z', priceComparison: 'exclude' },
    ),
  ],
  'medik8-advanced-night-restore-50ml': [
    exactNg(
      'Teeka4',
      'https://teeka4.com/shop/medik8-advance-night-restore-50ml/',
      98,
      103867,
      'Advanced Night Restore™',
      '50 ml',
      { observedAt: '2026-08-04T14:54:24.934Z', expiresAt: '2026-08-11T14:54:24.934Z' },
    ),
  ],
  'loccitane-almond-softening-shower-oil-250ml': [
    exactNg(
      'Jumia',
      'https://www.jumia.com.ng/generic-loccitane-almond-shower-oil-250ml-390146429.html',
      62,
      57000,
      'Almond (Amande) Softening Shower Oil',
      '250 ml',
      { observedAt: '2026-08-04T14:54:29.890Z', expiresAt: '2026-08-11T14:54:29.890Z', stock: 'low-stock', sellerName: 'NFB Stores', sellerScore: 98 },
    ),
  ],
  'anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml': [
    exactNg('Beauty by Daz', 'https://beautybydaz.com/shop/face/serums/anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml/', 100, 18850, 'Anua Azelaic Acid 10% + Hyaluron Redness Soothing Serum', '30 ml', { observedAt: '2026-08-03T03:37:23Z' }),
  ],
  'cosrx-salicylic-acid-daily-gentle-cleanser': [
    exactNg('Beauty by Daz', 'https://beautybydaz.com/shop/face/cosrx-salicylic-acid-cleanser/', 100, 8500, 'COSRX Salicylic Acid Daily Gentle Cleanser', '150 ml'),
    exactNg('Lux Beauty', 'https://www.luxbeautyng.com/product/cosrx-salicylic-acid-daily-gentle-cleanser/', 96, 9600, 'COSRX Salicylic Acid Daily Gentle Cleanser', '150 ml'),
  ],
  'some-by-mi-aha-bha-pha-miracle-toner': [
    exactNg('Teeka4', 'https://teeka4.com/shop/somebymi-aha-bha-pha-30days-miracle-toner-150ml-5oz/', 98, 13495, 'SOME BY MI AHA BHA PHA 30 Days Miracle Toner', '150 ml', { available: false }),
  ],
  'anua-niacinamide-10-txa-4-serum': [
    exactNg('Beauty by Daz', 'https://beautybydaz.com/shop/face/anua-niacinamide-10-tranexamin-acid-4-serum/', 100, 18850, 'ANUA Niacinamide 10% + TXA 4% Serum', '30 ml'),
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
  'dove-melanin-even-tone-body-wash-18-5oz': [
    exactNg('Beauty by Daz', 'https://beautybydaz.com/shop/bath-body/bath-wash-gels/dove-melanin-even-tone-body-wash-547ml/', 100, 19500, 'Dove Melanin Even Tone Body Wash with Pro-Ceramide Serum', '547 ml / 18.5 fl oz', { available: false, observedAt: '2026-08-03T03:37:23Z' }),
  ],
  'cerave-foaming-facial-cleanser': [
    exactNg('CSi Grocery', 'https://www.csigrocery.com/shop/skincare/face/facial-cleansers/cerave-foaming-facial/', 90, 27500, 'CeraVe Foaming Facial Cleanser', '355 ml'),
    exactNg(
      'Deoset',
      'https://deoset.com/product/cerave-foaming-facial-cleanser-12-oz-355ml/',
      86,
      24000,
      'Foaming Facial Cleanser',
      '355 ml',
      { observedAt: '2026-08-04T18:49:08.000Z', expiresAt: '2026-08-11T18:49:08.000Z' },
    ),
    exactNg(
      'Perona Beauty',
      'https://ibadan.peronabeauty.com/product/cerave-foaming-facial-cleanser-12oz-2/',
      86,
      26500,
      'Foaming Facial Cleanser',
      '355 ml',
      { observedAt: '2026-08-04T18:49:20.000Z', expiresAt: '2026-08-11T18:49:20.000Z' },
    ),
  ],
  'cerave-blemish-control-cleanser': [
    exactNg('Teeka4', 'https://teeka4.com/shop/cerave-acne-control-face-cleanser-facial-cleanser-8-fl-oz/', 98, 14800, 'CeraVe Blemish Control Cleanser', '236 ml'),
    exactNg(
      'Perona Beauty',
      'https://ibadan.peronabeauty.com/product/cerave-blemish-control-face-cleanser-236ml/',
      86,
      15500,
      'Blemish Control Face Cleanser',
      '236 ml',
      { observedAt: '2026-08-04T18:50:41.000Z', expiresAt: '2026-08-11T18:50:41.000Z' },
    ),
  ],
  'the-ordinary-azelaic-acid-suspension-10': [
    exactNg('Beauty by Daz', 'https://beautybydaz.com/shop/face/oils-serum/the-ordinary-azelaic-acid/', 100, 10500, 'The Ordinary Azelaic Acid Suspension 10%', '30 ml', { available: false }),
    exactNg(
      'Deoset',
      'https://deoset.com/product/the-ordinary-azelaic-acid-suspension-10-30ml/',
      86,
      23000,
      'Azelaic Acid Suspension 10%',
      '30 ml',
      { observedAt: '2026-08-04T18:50:56.000Z', expiresAt: '2026-08-11T18:50:56.000Z' },
    ),
  ],
  'la-roche-posay-anthelios-uvmune-400-oil-control-fluid': [
    exactNg('Teeka4', 'https://teeka4.com/shop/la-roche-posay-anthelios-uvmune-400-oil-control-fluid-spf50for-oily-blemish-prone-skin-50ml-1-7oz/', 98, 23500, 'La Roche-Posay Anthelios UVMune 400 Oil Control Fluid SPF50+', '50 ml', { available: false }),
    exactNg(
      'Deoset',
      'https://deoset.com/product/la-roche-posay-anthelios-uvmune-400-fluid-oil-control-spf50-50ml/',
      86,
      23900,
      'Anthelios UVMune 400 Fluid Oil Control SPF50+',
      '50 ml',
      { observedAt: '2026-08-04T18:51:16.000Z', expiresAt: '2026-08-11T18:51:16.000Z' },
    ),
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

export function mergeRetailOffers(
  product: Pick<Product, 'slug' | 'name' | 'size'>,
  offers: Offer[],
  now: number | Date = Date.now(),
) {
  const excluded = new Set(excludedRetailers[product.slug] ?? []);
  const merged = new Map<string, Offer>();

  for (const offer of offers) {
    if (excluded.has(offer.retailer)) continue;
    if (offer.expiresAt && !isOfferFresh(offer, now)) continue;
    merged.set(offer.retailer, {
      ...offer,
      match: offer.match ?? (isSearchRoute(offer.url) ? 'search' : 'exact'),
    });
  }

  for (const offer of verifiedRetailOffers[product.slug] ?? []) {
    if (offer.expiresAt && !isOfferFresh(offer, now)) continue;
    merged.set(offer.retailer, offer);
  }
  return [...merged.values()].map(offer => materializeOfferEvidence(product, offer));
}
