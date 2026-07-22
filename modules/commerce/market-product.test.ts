import assert from 'node:assert/strict';
import test from 'node:test';
import type { Product } from '@/data/products';
import { marketProductPrice, marketRetailerLinks } from './market-product';

const now = new Date('2026-07-22T12:00:00Z');

function product(overrides: Partial<Product> = {}): Product {
  return {
    slug: 'test-product', brand: 'Test', name: 'Product', size: '30 ml', category: 'Face', step: 'Treat', image: '/test.png', displayLine: 'Treat', bestFor: [], concerns: [], skinTypes: [], sensitiveFriendly: true, usage: 'Use.', evidence: 'moderate', offers: [],
    ...overrides,
  };
}

test('consult pricing uses an available exact offer in the requested market', () => {
  const item = product({ offers: [
    { retailer: 'NG exact', url: 'https://example.com/ng', trust: 90, available: true, match: 'exact', priceNgn: 12_500, checkedAt: '2026-07-22', location: ['NG'] },
    { retailer: 'US exact', url: 'https://example.com/us', trust: 100, available: true, match: 'exact', priceUsd: 10, checkedAt: '2026-07-22', location: ['US'] },
  ] });

  assert.deepEqual(marketProductPrice(item, 'NG', now), { amount: 12_500, currency: 'NGN', retailer: 'NG exact', market: 'NG', checkedAt: '2026-07-22' });
});

test('consult pricing never falls through to another market', () => {
  const item = product({ offers: [
    { retailer: 'US only', url: 'https://example.com/us', trust: 100, available: true, match: 'exact', priceUsd: 10, checkedAt: '2026-07-22', location: ['US'] },
  ] });

  assert.equal(marketProductPrice(item, 'NG', now), null);
});

test('consult pricing never falls back to a dated catalogue baseline', () => {
  const item = product({ slug: 'some-by-mi-aha-bha-pha-miracle-toner' });
  assert.equal(marketProductPrice(item, 'NG', now), null);
});

test('recommendation links exclude search routes and unavailable offers', () => {
  const item = product({ offers: [
    { retailer: 'Search', url: 'https://example.com/search', trust: 100, available: true, match: 'search', checkedAt: '2026-07-22', location: ['NG'] },
    { retailer: 'Unavailable', url: 'https://example.com/out', trust: 100, available: false, match: 'exact', priceNgn: 8_000, checkedAt: '2026-07-22', location: ['NG'] },
    { retailer: 'Exact', url: 'https://example.com/exact', trust: 90, available: true, match: 'exact', priceNgn: 9_000, checkedAt: '2026-07-22', location: ['NG'] },
  ] });

  assert.deepEqual(marketRetailerLinks(item, 'NG', 2, now), [{ retailer: 'Exact', href: '/go?product=test-product&retailer=Exact' }]);
});

test('consult pricing and links expire after seven days', () => {
  const item = product({ offers: [
    { retailer: 'Old', url: 'https://example.com/old', trust: 100, available: true, match: 'exact', priceNgn: 9_000, checkedAt: '2026-07-14', location: ['NG'] },
  ] });

  assert.equal(marketProductPrice(item, 'NG', now), null);
  assert.deepEqual(marketRetailerLinks(item, 'NG', 2, now), []);
});
