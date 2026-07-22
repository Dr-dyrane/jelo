import type { Market } from '@/data/prices';
import type { Offer, Product } from '@/data/products';
import { isOfferFresh } from './offer-freshness';
import { rankOffers } from './offer-selection';
import { comparableMarketPrice, hasListingEvidence } from './offer-evidence';

function servesMarket(offer: Offer, market: Market) {
  return offer.location.includes(market) || offer.location.includes('INTL');
}

export function searchResultOffers(
  product: Pick<Product, 'offers'>,
  market: Market,
  now: number | Date = Date.now(),
  limit = 3,
) {
  const safeLimit = Math.min(Math.max(limit, 1), 6);
  return rankOffers(product.offers, market, now)
    .filter(offer => offer.match !== 'search'
      && servesMarket(offer, market)
      && hasListingEvidence(offer)
      && isOfferFresh(offer, now))
    .slice(0, safeLimit);
}

export function currentPricedOfferCount(
  offers: Offer[],
  market: Market,
  now: number | Date = Date.now(),
) {
  return offers.filter(offer => comparableMarketPrice(offer, market, now) != null).length;
}
