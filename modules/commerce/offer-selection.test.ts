import assert from 'node:assert/strict';
import test from 'node:test';
import { products } from '@/data/catalogue';
import type { Offer } from '@/data/products';
import { rankOffers } from '@/modules/commerce/offer-selection';

test('Nigeria ranks an available exact offer above search and unavailable routes', () => {
  const now = new Date('2026-07-22T12:00:00Z');
  const offers: Offer[] = [
    { retailer: 'Search only', url: 'https://example.com/search', trust: 100, available: true, match: 'search', checkedAt: '2026-07-22', location: ['NG'] },
    { retailer: 'Unavailable', url: 'https://example.com/out', trust: 100, available: false, match: 'exact', priceNgn: 9000, checkedAt: '2026-07-22', location: ['NG'] },
    { retailer: 'Exact', url: 'https://example.com/exact', trust: 90, available: true, match: 'exact', priceNgn: 12000, checkedAt: '2026-07-22', location: ['NG'] },
  ];

  assert.equal(rankOffers(offers, 'NG', now)[0].retailer, 'Exact');
});

test('verified Nigerian product matches carry price and check date', () => {
  const product = products.find(item => item.slug === 'panoxyl-acne-foaming-wash-10-benzoyl-peroxide');
  assert.ok(product);
  const slique = product.offers.find(offer => offer.retailer === 'Slique Beauty');
  assert.deepEqual(
    { priceNgn: slique?.priceNgn, checkedAt: slique?.checkedAt, match: slique?.match, available: slique?.available },
    { priceNgn: 19300, checkedAt: '2026-07-22T14:44:09Z', match: 'exact', available: true },
  );
});

test('known size mismatch is removed from the exact comparison', () => {
  const product = products.find(item => item.slug === 'cerave-foaming-facial-cleanser');
  assert.ok(product);
  assert.equal(product.offers.some(offer => offer.retailer === 'Care to Beauty'), false);
  assert.equal(product.offers.some(offer => offer.retailer === 'CSi Grocery' && offer.priceNgn === 27500), true);
});
