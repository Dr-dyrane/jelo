import type { Offer } from '@/data/products';

export function rankOffers(offers: Offer[], country: string) {
  return [...offers].sort((a, b) => score(b, country) - score(a, country));
}

function score(offer: Offer, country: string) {
  const locationFit = offer.location.includes(country) ? 18 : offer.location.includes('INTL') ? 8 : 0;
  const stock = offer.available ? 25 : -20;
  const price = offer.priceNgn ? Math.max(0, 15 - offer.priceNgn / 10000) : 5;
  return offer.trust + locationFit + stock + price;
}
