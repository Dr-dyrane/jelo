'use client';

import type { Offer } from '@/data/products';
import type { Market } from '@/data/prices';

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function lowestPrice(offers: Offer[], market: Market) {
  const values = offers
    .filter(offer => offer.available && offer.match !== 'search' && offer.location.includes(market))
    .map(offer => market === 'NG' ? offer.priceNgn : offer.priceUsd)
    .filter((value): value is number => typeof value === 'number');
  return values.length ? Math.min(...values) : undefined;
}

export function MarketPrice({ offers = [], market = 'NG' }: { offers?: Offer[]; market?: Market }) {
  const amount = lowestPrice(offers, market);
  if (amount != null) return <>From {market === 'NG' ? naira.format(amount) : dollars.format(amount)}</>;
  return <>Check stores</>;
}
