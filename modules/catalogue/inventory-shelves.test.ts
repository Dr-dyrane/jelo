import assert from 'node:assert/strict';
import test from 'node:test';
import type { Offer } from '@/data/products';
import {
  selectProductsBelowPrice,
  selectRecentlyCheckedProducts,
} from '@/lib/catalogue/inventory-shelves';

const now = new Date('2026-07-26T12:00:00Z');

function offer(
  priceNgn: number,
  observedAt: string,
  overrides: Partial<Offer> = {},
): Offer {
  return {
    retailer: 'Example',
    url: 'https://store.example/product',
    location: ['NG'],
    priceNgn,
    available: true,
    match: 'exact',
    checkedAt: observedAt,
    listingEvidence: {
      observedAt,
      sourceUrl: 'https://store.example/product',
      basis: 'retailer-page',
    },
    priceObservation: {
      observedAt,
      variant: 'Exact product',
      size: '100 ml',
      stock: 'in-stock',
      landedCost: 'unknown',
    },
    ...overrides,
    trust: overrides.trust ?? 0.8,
  };
}

function product(slug: string, offers: Offer[]) {
  return { slug, offers };
}

test('recently checked shelf follows exact observation time, not input order or price', () => {
  const items = selectRecentlyCheckedProducts([
    product('cheaper-older', [offer(5_000, '2026-07-22T10:00:00Z')]),
    product('newest', [offer(18_000, '2026-07-26T09:00:00Z')]),
    product('middle', [offer(7_000, '2026-07-24T10:00:00Z')]),
  ], 'NG', 12, now);

  assert.deepEqual(items.map(item => item.slug), ['newest', 'middle', 'cheaper-older']);
});

test('price shelf uses the lowest fresh exact market observation', () => {
  const items = selectProductsBelowPrice([
    product('two-stores', [
      offer(12_000, '2026-07-25T10:00:00Z'),
      offer(8_500, '2026-07-24T10:00:00Z', {
        retailer: 'Second',
        url: 'https://second.example/product',
        listingEvidence: {
          observedAt: '2026-07-24T10:00:00Z',
          sourceUrl: 'https://second.example/product',
          basis: 'retailer-page',
        },
      }),
    ]),
    product('lowest', [offer(6_000, '2026-07-23T10:00:00Z')]),
    product('at-ceiling', [offer(10_000, '2026-07-26T10:00:00Z')]),
  ], 'NG', 10_000, 12, now);

  assert.deepEqual(items.map(item => item.slug), ['lowest', 'two-stores']);
});

test('inventory shelves reject stale, search-match, excluded, unavailable, and wrong-market offers', () => {
  const items = selectRecentlyCheckedProducts([
    product('stale', [offer(5_000, '2026-07-10T10:00:00Z')]),
    product('search', [offer(5_000, '2026-07-26T10:00:00Z', { match: 'search' })]),
    product('excluded', [offer(5_000, '2026-07-26T10:00:00Z', { priceComparison: 'exclude' })]),
    product('unavailable', [offer(5_000, '2026-07-26T10:00:00Z', { available: false })]),
    product('us', [offer(5_000, '2026-07-26T10:00:00Z', { location: ['US'] })]),
    product('international-only', [offer(5_000, '2026-07-26T10:00:00Z', { location: ['INTL'] })]),
    product('eligible', [offer(7_000, '2026-07-26T10:00:00Z')]),
  ], 'NG', 12, now);

  assert.deepEqual(items.map(item => item.slug), ['eligible']);
});

test('inventory shelf inputs are bounded and fail closed', () => {
  assert.throws(
    () => selectRecentlyCheckedProducts([], 'NG', 0, now),
    /between 1 and 24/,
  );
  assert.throws(
    () => selectProductsBelowPrice([], 'NG', Number.NaN, 12, now),
    /positive number/,
  );
});
