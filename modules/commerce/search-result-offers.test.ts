import assert from 'node:assert/strict';
import test from 'node:test';
import type { Offer } from '@/data/products';
import { currentPricedOfferCount, searchResultOffers } from './search-result-offers';

const now = new Date('2026-07-22T12:00:00Z');

const offers: Offer[] = [
  { retailer: 'Current price', url: 'https://example.com/current', trust: 95, available: true, priceNgn: 12_000, checkedAt: '2026-07-22T10:00:00Z', expiresAt: '2026-07-29T10:00:00Z', match: 'exact', location: ['NG'] },
  { retailer: 'Current stock', url: 'https://example.com/stock', trust: 90, available: true, checkedAt: '2026-07-22T10:00:00Z', expiresAt: '2026-07-23T10:00:00Z', match: 'exact', location: ['NG'] },
  { retailer: 'Out of stock', url: 'https://example.com/out', trust: 98, available: false, priceNgn: 10_000, checkedAt: '2026-07-22T10:00:00Z', expiresAt: '2026-07-29T10:00:00Z', match: 'exact', location: ['NG'] },
  { retailer: 'Expired', url: 'https://example.com/expired', trust: 100, available: true, priceNgn: 8_000, checkedAt: '2026-07-22T09:00:00Z', expiresAt: '2026-07-22T11:00:00Z', match: 'exact', location: ['NG'] },
  { retailer: 'Search route', url: 'https://example.com/search', trust: 100, available: true, checkedAt: '2026-07-22T10:00:00Z', match: 'search', location: ['NG'] },
  { retailer: 'US only', url: 'https://example.com/us', trust: 100, available: true, priceUsd: 15, checkedAt: '2026-07-22T10:00:00Z', match: 'exact', location: ['US'] },
];

test('search comparisons show only fresh exact offers for the selected market', () => {
  const result = searchResultOffers({ offers }, 'NG', now, 6);
  assert.deepEqual(result.map(offer => offer.retailer), ['Current price', 'Current stock', 'Out of stock']);
  assert.equal(currentPricedOfferCount(result, 'NG'), 1);
});

test('search comparisons stay bounded', () => {
  assert.equal(searchResultOffers({ offers }, 'NG', now, 2).length, 2);
});
