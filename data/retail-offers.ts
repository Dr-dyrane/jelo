import type { Offer } from '@/data/products';

const checkedAt = '2026-07-21';

const exactNg = (
  retailer: string,
  url: string,
  trust: number,
  priceNgn: number,
  available = true,
): Offer => ({
  retailer,
  url,
  trust,
  available,
  priceNgn,
  checkedAt,
  match: 'exact',
  location: ['NG'],
});

export const verifiedRetailOffers: Record<string, Offer[]> = {
  'cosrx-salicylic-acid-daily-gentle-cleanser': [
    exactNg('Lux Beauty', 'https://www.luxbeautyng.com/product/cosrx-salicylic-acid-daily-gentle-cleanser/', 96, 9850),
  ],
  'anua-niacinamide-10-txa-4-serum': [
    exactNg('Teeka4', 'https://teeka4.com/shop/anua-niacinamide-10-txa-4-serum-30ml/', 98, 18000),
  ],
  'face-facts-wonder-cream-fragrance-free': [
    exactNg('Teeka4', 'https://teeka4.com/shop/face-facts-wonder-cream-fragrance-free-50ml-copy/', 98, 7700),
  ],
  'cerave-foaming-facial-cleanser': [
    exactNg('CSi Grocery', 'https://www.csigrocery.com/shop/skin-care/face/facial-cleansers/cerave-foaming-facial/', 90, 27500),
  ],
  'cerave-blemish-control-cleanser': [
    exactNg('Teeka4', 'https://teeka4.com/shop/cerave-acne-control-face-cleanser-facial-cleanser-8-fl-oz/', 98, 14800),
  ],
  'the-ordinary-azelaic-acid-suspension-10': [
    exactNg('Beauty by Daz', 'https://beautybydaz.com/shop/face/oils-serum/the-ordinary-azelaic-acid/', 100, 10500, false),
  ],
  'la-roche-posay-anthelios-uvmune-400-oil-control-fluid': [
    exactNg('Teeka4', 'https://teeka4.com/shop/la-roche-posay-anthelios-uvmune-400-oil-control-fluid-spf50for-oily-blemish-prone-skin-50ml-1-7oz/', 98, 23500),
  ],
  'cosrx-advanced-snail-96-mucin-power-essence': [
    exactNg('Beauty by Daz', 'https://beautybydaz.com/shop/face/treatment/cosrx-advanced-snail-96-mucin-power-essence/', 100, 13999),
    exactNg('Lux Beauty', 'https://www.luxbeautyng.com/product/cosrx-snail-mucin-96-power-repairing-essence/', 96, 12400, false),
  ],
  'panoxyl-acne-foaming-wash-10-benzoyl-peroxide': [
    exactNg('Teeka4', 'https://teeka4.com/shop/panoxyl-acne-foaming-wash-benzoyl-peroxide-10-maximum-strength-without-pack/', 98, 14500),
    exactNg('Lux Beauty', 'https://www.luxbeautyng.com/product/panoxyl-acne-creamy-wash-benzoyl-peroxide-10/', 96, 17500),
  ],
};

const excludedRetailers: Partial<Record<string, string[]>> = {
  // The old route is the 236 ml product, not this catalogue's 355 ml size.
  'cerave-foaming-facial-cleanser': ['Care to Beauty'],
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

export function mergeRetailOffers(slug: string, offers: Offer[]) {
  const excluded = new Set(excludedRetailers[slug] ?? []);
  const merged = new Map<string, Offer>();

  for (const offer of offers) {
    if (excluded.has(offer.retailer)) continue;
    merged.set(offer.retailer, {
      ...offer,
      match: offer.match ?? (isSearchRoute(offer.url) ? 'search' : 'exact'),
    });
  }

  for (const offer of verifiedRetailOffers[slug] ?? []) merged.set(offer.retailer, offer);
  return [...merged.values()];
}
