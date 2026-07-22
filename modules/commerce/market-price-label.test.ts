import assert from 'node:assert/strict';
import test from 'node:test';
import type { Offer } from '@/data/products';
import { marketPriceLabel } from './market-price-label';

const now = new Date('2026-07-22T12:00:00Z');

function exact(retailer: string, priceNgn: number, checkedAt = '2026-07-22'): Offer {
  const url = `https://${retailer.toLowerCase()}.example/product`;
  return {
    retailer,
    url,
    trust: 90,
    available: true,
    priceNgn,
    checkedAt,
    match: 'exact',
    location: ['NG'],
    listingEvidence: { observedAt: checkedAt, sourceUrl: url, basis: 'retailer-page' },
    priceObservation: {
      observedAt: checkedAt,
      variant: 'Exact product',
      size: '30 ml',
      stock: 'in-stock',
      landedCost: 'unknown',
    },
  };
}

test('formats one current exact price without implying a comparison', () => {
  assert.equal(marketPriceLabel([exact('One', 12_500)], 'NG', now), '₦12,500 · 1 store');
});

test('shows a from-price and comparable store count for multiple exact offers', () => {
  assert.equal(
    marketPriceLabel([exact('One', 12_500), exact('Two', 15_000)], 'NG', now),
    'From ₦12,500 · 2 stores',
  );
});

test('omits stale and excluded marketplace observations', () => {
  assert.equal(marketPriceLabel([exact('Old', 8_000, '2026-07-10')], 'NG', now), null);
  assert.equal(marketPriceLabel([{ ...exact('Marketplace', 7_000), priceComparison: 'exclude' }], 'NG', now), null);
});
