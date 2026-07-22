import type { Market } from '@/data/prices';
import type { Offer } from '@/data/products';
import { summarizeMarket } from './market-summary';

const naira = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});
const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

export function marketPriceLabel(offers: Offer[], market: Market, now: number | Date = Date.now()) {
  const summary = summarizeMarket(offers, market, now);
  if (summary.lowestPrice == null || summary.pricedRetailerCount === 0) return null;

  const price = market === 'NG'
    ? naira.format(summary.lowestPrice)
    : dollars.format(summary.lowestPrice);
  const stores = `${summary.pricedRetailerCount} ${summary.pricedRetailerCount === 1 ? 'store' : 'stores'}`;
  return `${summary.pricedRetailerCount > 1 ? 'From ' : ''}${price} · ${stores}`;
}
