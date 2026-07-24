import type { Offer } from '@/data/products';
import { hasListingEvidence } from './offer-evidence';
import { isOfferFresh } from './offer-freshness';

/**
 * A Nigerian offer that can back an honest share card: an exact (not a search
 * result), evidence-bound, fresh listing carrying an observed naira price.
 *
 * This is the single source of truth for "shareable". The share index, the
 * product panel's Share affordance, and buildShareData all gate on it, so a
 * share surface can never invent or imply a price it did not observe.
 */
export function isShareableNgOffer(offer: Offer, now: number | Date = Date.now()): boolean {
  return offer.match !== 'search'
    && hasListingEvidence(offer)
    && offer.location.includes('NG')
    && isOfferFresh(offer, now)
    && offer.priceNgn != null;
}

/** True when a product has at least one offer that can back an honest share card. */
export function hasShareableNgOffer(product: { offers: Offer[] }, now: number | Date = Date.now()): boolean {
  return product.offers.some(offer => isShareableNgOffer(offer, now));
}
