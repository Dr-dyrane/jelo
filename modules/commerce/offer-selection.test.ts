import assert from 'node:assert/strict';
import test from 'node:test';
import { products } from '@/data/catalogue';
import type { Offer } from '@/data/products';
import { rankOffers } from '@/modules/commerce/offer-selection';

test('Nigeria ranks an available exact offer above search and unavailable routes', () => {
  const offers: Offer[] = [
    { retailer: 'Search only', url: 'https://example.com/search', trust: 100, available: true, match: 'search', location: ['NG'] },
    { retailer: 'Unavailable', url: 'https://example.com/out', trust: 100, available: false, match: 'exact', priceNgn: 9000, location: ['NG'] },
    { retailer: 'Exact', url: 'https://example.com/exact', trust: 90, available: true, match: 'exact', priceNgn: 12000, location: ['NG'] },
  ];

  assert.equal(rankOffers(offers, 'NG')[0].retailer, 'Exact');
});

test('verified Nigerian product matches carry price and check date', () => {
  const product = products.find(item => item.slug === 'panoxyl-acne-foaming-wash-10-benzoyl-peroxide');
  assert.ok(product);
  const teeka = product.offers.find(offer => offer.retailer === 'Teeka4');
  assert.deepEqual(
    { priceNgn: teeka?.priceNgn, checkedAt: teeka?.checkedAt, match: teeka?.match, available: teeka?.available },
    { priceNgn: 14500, checkedAt: '2026-07-21', match: 'exact', available: true },
  );
});

test('known size mismatch is removed from the exact comparison', () => {
  const product = products.find(item => item.slug === 'cerave-foaming-facial-cleanser');
  assert.ok(product);
  assert.equal(product.offers.some(offer => offer.retailer === 'Care to Beauty'), false);
  assert.equal(product.offers.some(offer => offer.retailer === 'CSi Grocery' && offer.priceNgn === 27500), true);
});
