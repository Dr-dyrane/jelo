import type { FulfilmentMethod, Offer } from '@/data/products';
import { isOfferFresh } from './offer-freshness';
import {
  hasBrandAuthorizationEvidence,
  hasListingEvidence,
  hasSellerIdentityEvidence,
  landedMarketPrice,
} from './offer-evidence';

export type RankedOffer = Offer & {
  score: number;
  reasons: string[];
};

/** Shopper-chosen, evidence-bound preferences that softly break ties (ADR 0006).
 *  Never commercial: a preference only nudges offers that already declare the trait. */
export type RankingPreferences = {
  fulfilment?: FulfilmentMethod;
};

export function rankOffers(
  offers: Offer[],
  country: string,
  now: number | Date = Date.now(),
  preferences: RankingPreferences = {},
): RankedOffer[] {
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

      // Evidence-bound refinements, deliberately small so they only break ties
      // between offers already equal on safety, freshness, location and price
      // (ADR 0006). Brand authorization is the stronger signal of the two.
      if (hasSellerIdentityEvidence(offer)) {
        score += 6;
        reasons.push('Seller identity checked');
      }
      if (hasBrandAuthorizationEvidence(offer)) {
        score += 8;
        reasons.push('Brand authorization evidenced');
      }

      // A shopper's stated fulfilment preference nudges offers that already declare
      // that method — a small, consumer-chosen tie-breaker, never a hidden filter.
      if (preferences.fulfilment && offer.fulfilment?.includes(preferences.fulfilment)) {
        score += 5;
        reasons.push('Matches your fulfilment choice');
      }

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

      // Landed total (price + any stated delivery) when knowable, so cheaper-to-receive
      // ranks higher — falls back to the bare observed price, never a guessed total.
      const marketPrice = country === 'US'
        ? landedMarketPrice(offer, 'US', now)
        : landedMarketPrice(offer, 'NG', now);
      if (marketPrice != null && fresh) {
        const priceWeight = country === 'US' ? marketPrice / 10 : marketPrice / 10000;
        score += Math.max(0, 16 - priceWeight);
        reasons.push('Price considered');
      }

      return { ...offer, score: Math.round(score), reasons };
    })
    .sort((a, b) => b.score - a.score || b.trust - a.trust);
}
