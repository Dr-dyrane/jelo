import type { Offer } from '@/data/products';
import { isOfferFresh } from './offer-freshness';
import {
  comparableMarketPrice,
  hasBrandAuthorizationEvidence,
  hasListingEvidence,
  hasSellerIdentityEvidence,
} from './offer-evidence';

export type RankedOffer = Offer & {
  score: number;
  reasons: string[];
};

export function rankOffers(offers: Offer[], country: string, now: number | Date = Date.now()): RankedOffer[] {
  return offers
    .map(offer => {
      const reasons: string[] = [];
      let score = offer.trust;
      const fresh = isOfferFresh(offer, now);

      if (offer.retailerEvidence?.reviewStatus === 'provisional') {
        score -= 20;
        reasons.push('Provisional source');
      }

      if (offer.match === 'search') {
        score -= 50;
        reasons.push('Search route only');
      } else if (hasListingEvidence(offer)) {
        score += 12;
        reasons.push('Exact listing checked');
      } else {
        score -= 10;
        reasons.push('Listing not checked');
      }

      if (hasSellerIdentityEvidence(offer)) reasons.push('Seller identity checked');
      if (hasBrandAuthorizationEvidence(offer)) reasons.push('Brand authorization evidenced');

      if (offer.location.includes(country)) {
        score += 20;
        reasons.push('Available for your location');
      } else if (offer.location.includes('INTL')) {
        score += 8;
        reasons.push('International delivery');
      } else {
        score -= 12;
      }

      if (offer.available && fresh) {
        score += 28;
        reasons.push('Marked available');
      } else if (!fresh) {
        score -= 15;
        reasons.push('Stock check expired');
      } else {
        score -= 30;
        reasons.push('Stock needs confirmation');
      }

      const marketPrice = country === 'US'
        ? comparableMarketPrice(offer, 'US', now)
        : comparableMarketPrice(offer, 'NG', now);
      if (marketPrice != null && fresh) {
        const priceWeight = country === 'US' ? marketPrice / 10 : marketPrice / 10000;
        score += Math.max(0, 16 - priceWeight);
        reasons.push('Price considered');
      }

      return { ...offer, score: Math.round(score), reasons };
    })
    .sort((a, b) => b.score - a.score || b.trust - a.trust);
}
