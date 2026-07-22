import assert from 'node:assert/strict';
import test from 'node:test';
import type { Offer } from '@/data/products';
import { summarizeMarket } from './market-summary';

const offers: Offer[] = [
  { retailer: 'One', url: 'https://example.com/one', trust: 100, available: true, match: 'exact', priceNgn: 14_500, checkedAt: '2026-07-21', location: ['NG'] },
  { retailer: 'Two', url: 'https://example.com/two', trust: 96, available: true, match: 'exact', priceNgn: 17_500, checkedAt: '2026-07-20', location: ['NG'] },
  { retailer: 'Out', url: 'https://example.com/out', trust: 90, available: false, match: 'exact', priceNgn: 10_000, checkedAt: '2026-07-19', location: ['NG'] },
  { retailer: 'Search', url: 'https://example.com/search', trust: 100, available: true, match: 'search', priceNgn: 8_000, checkedAt: '2026-07-21', location: ['NG'] },
  { retailer: 'US', url: 'https://example.com/us', trust: 100, available: true, match: 'exact', priceUsd: 13.49, checkedAt: '2026-07-21', location: ['US'] },
];

test('summarizes available exact prices in one market', () => {
  const summary = summarizeMarket(offers, 'NG');

  assert.equal(summary.lowestPrice, 14_500);
  assert.equal(summary.typicalPrice, 16_000);
  assert.equal(summary.highestPrice, 17_500);
  assert.equal(summary.savingsVsTypical, 1_500);
  assert.equal(summary.retailerCount, 3);
  assert.equal(summary.inStockCount, 2);
  assert.equal(summary.pricedRetailerCount, 2);
  assert.equal(summary.lastCheckedAt, '2026-07-21');
});

test('does not include search, unavailable or cross-market prices in the comparison', () => {
  const summary = summarizeMarket(offers, 'US');

  assert.equal(summary.lowestPrice, 13.49);
  assert.equal(summary.typicalPrice, 13.49);
  assert.equal(summary.retailerCount, 1);
  assert.equal(summary.inStockCount, 1);
  assert.equal(summary.savingsVsTypical, null);
});

test('returns an explicit empty summary when no exact offer serves the market', () => {
  const summary = summarizeMarket([], 'NG');

  assert.equal(summary.lowestPrice, null);
  assert.equal(summary.retailerCount, 0);
  assert.equal(summary.confidence, 0);
});
