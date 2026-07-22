'use client';

import type { Offer } from '@/data/products';
import type { Market } from '@/data/prices';
import { marketPriceLabel } from '@/modules/commerce/market-price-label';

export function MarketPrice({ offers = [], market = 'NG' }: { offers?: Offer[]; market?: Market }) {
  return marketPriceLabel(offers, market);
}
