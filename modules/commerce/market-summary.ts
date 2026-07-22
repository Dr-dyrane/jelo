import type { Market } from '@/data/prices';
import type { Offer } from '@/data/products';
import { isOfferFresh } from './offer-freshness';

export type MarketSummary = {
  market: Market;
  lowestPrice: number | null;
  typicalPrice: number | null;
  highestPrice: number | null;
  retailerCount: number;
  inStockCount: number;
  pricedRetailerCount: number;
  savingsVsTypical: number | null;
  lastCheckedAt: string | null;
  confidence: number;
};

function servesMarket(offer: Offer, market: Market) {
  return offer.location.includes(market) || offer.location.includes('INTL');
}

function marketPrice(offer: Offer, market: Market) {
  return market === 'NG' ? offer.priceNgn : offer.priceUsd;
}

function median(values: number[], market: Market) {
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  const value = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  return market === 'NG' ? Math.round(value) : Number(value.toFixed(2));
}

export function summarizeMarket(offers: Offer[], market: Market, now: number | Date = Date.now()): MarketSummary {
  const exact = offers.filter(offer => offer.match !== 'search' && servesMarket(offer, market) && isOfferFresh(offer, now));
  const inStock = exact.filter(offer => offer.available);
  const priced = inStock
    .map(offer => ({ offer, price: marketPrice(offer, market) }))
    .filter((entry): entry is { offer: Offer; price: number } => entry.price != null && entry.price > 0)
    .sort((a, b) => a.price - b.price);
  const values = priced.map(entry => entry.price);
  const lowestPrice = values[0] ?? null;
  const typicalPrice = median(values, market);
  const highestPrice = values.at(-1) ?? null;
  const checked = exact
    .map(offer => offer.checkedAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  const averageTrust = exact.length
    ? exact.reduce((total, offer) => total + offer.trust, 0) / exact.length
    : 0;
  const priceCoverage = exact.length ? priced.length / exact.length : 0;
  const checkCoverage = exact.length ? checked.length / exact.length : 0;
  const confidence = Math.round(priceCoverage * 50 + checkCoverage * 25 + (averageTrust / 100) * 25);

  return {
    market,
    lowestPrice,
    typicalPrice,
    highestPrice,
    retailerCount: exact.length,
    inStockCount: inStock.length,
    pricedRetailerCount: priced.length,
    savingsVsTypical: lowestPrice != null && typicalPrice != null && typicalPrice > lowestPrice
      ? market === 'NG'
        ? Math.round(typicalPrice - lowestPrice)
        : Number((typicalPrice - lowestPrice).toFixed(2))
      : null,
    lastCheckedAt: checked[0] ?? null,
    confidence: Math.min(confidence, 100),
  };
}
