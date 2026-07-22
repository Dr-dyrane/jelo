import type { Market } from '@/data/prices';
import type { Offer, Product } from '@/data/products';
import { rankOffers } from './offer-selection';
import { isOfferFresh } from './offer-freshness';
import { comparableMarketPrice, hasListingEvidence, landedCostCaveat } from './offer-evidence';

export type MarketProductPrice = {
  amount: number;
  currency: 'NGN' | 'USD';
  retailer: string;
  market: Market;
  checkedAt?: string;
  observedSize?: string;
  observedVariant?: string;
  landedCostCaveat?: string;
};

function servesMarket(offer: Offer, market: Market) {
  return offer.location.includes(market) || offer.location.includes('INTL');
}

export function exactAvailableOffers(offers: Offer[], market: Market, now: number | Date = Date.now()) {
  return rankOffers(offers, market, now).filter(offer =>
    offer.match !== 'search'
    && offer.available
    && servesMarket(offer, market)
    && hasListingEvidence(offer)
    && isOfferFresh(offer, now)
  );
}

export function marketProductPrice(product: Product, market: Market, now: number | Date = Date.now()): MarketProductPrice | null {
  const pricedOffer = exactAvailableOffers(product.offers, market, now)
    .map(offer => ({ offer, amount: comparableMarketPrice(offer, market, now) }))
    .find(entry => entry.amount != null);

  if (pricedOffer) {
    return {
      amount: pricedOffer.amount!,
      currency: market === 'NG' ? 'NGN' : 'USD',
      retailer: pricedOffer.offer.retailer,
      market,
      checkedAt: pricedOffer.offer.priceObservation?.observedAt,
      observedSize: pricedOffer.offer.priceObservation?.size,
      observedVariant: pricedOffer.offer.priceObservation?.variant,
      landedCostCaveat: landedCostCaveat(pricedOffer.offer),
    };
  }

  return null;
}

export function marketRetailerLinks(product: Product, market: Market, limit = 2, now: number | Date = Date.now()) {
  return exactAvailableOffers(product.offers, market, now).slice(0, limit).map(offer => ({
    retailer: offer.retailer,
    href: `/go?product=${encodeURIComponent(product.slug)}&retailer=${encodeURIComponent(offer.retailer)}`,
  }));
}
