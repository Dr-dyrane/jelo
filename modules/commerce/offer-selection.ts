import type { Offer } from '@/data/products';

export type RankedOffer = Offer & {
  score: number;
  reasons: string[];
};

export function rankOffers(offers: Offer[], country: string): RankedOffer[] {
  return offers
    .map(offer => {
      const reasons: string[] = [];
      let score = offer.trust;

      if (offer.location.includes(country)) {
        score += 20;
        reasons.push('Available for your location');
      } else if (offer.location.includes('INTL')) {
        score += 8;
        reasons.push('International delivery');
      } else {
        score -= 12;
      }

      if (offer.available) {
        score += 28;
        reasons.push('Marked available');
      } else {
        score -= 30;
        reasons.push('Stock needs confirmation');
      }

      if (offer.priceNgn) {
        score += Math.max(0, 16 - offer.priceNgn / 10000);
        reasons.push('Price considered');
      }

      return { ...offer, score: Math.round(score), reasons };
    })
    .sort((a, b) => b.score - a.score || b.trust - a.trust);
}
