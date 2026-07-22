import type { Market } from '@/data/prices';
import type { Offer, Product } from '@/data/products';
import { rankOffers } from './offer-selection';
import { isOfferFresh } from './offer-freshness';

export type MarketProductPrice = {
  amount: number;
  currency: 'NGN' | 'USD';
  retailer: string;
  market: Market;
  checkedAt?: string;
};

function servesMarket(offer: Offer, market: Market) {
  return offer.location.includes(market) || offer.location.includes('INTL');
}

export function exactAvailableOffers(offers: Offer[], market: Market, now: number | Date = Date.now()) {
  return rankOffers(offers, market, now).filter(offer =>
    offer.match !== 'search'
    && offer.available
    && servesMarket(offer, market)
    && isOfferFresh(offer, now)
  );
}

export function marketProductPrice(product: Product, market: Market, now: number | Date = Date.now()): MarketProductPrice | null {
  const pricedOffer = exactAvailableOffers(product.offers, market, now).find(offer =>
    market === 'NG' ? offer.priceNgn != null : offer.priceUsd != null,
  );

  if (pricedOffer) {
    return {
      amount: market === 'NG' ? pricedOffer.priceNgn! : pricedOffer.priceUsd!,
      currency: market === 'NG' ? 'NGN' : 'USD',
      retailer: pricedOffer.retailer,
      market,
      checkedAt: pricedOffer.checkedAt,
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
