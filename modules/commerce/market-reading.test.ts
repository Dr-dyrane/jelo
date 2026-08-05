import assert from 'node:assert/strict';
import test from 'node:test';
import type { Offer } from '@/data/products';
import { buildMarketReading, freshnessLabelFor } from './market-reading';

const NOW = new Date('2026-07-22T12:00:00Z');

function makeOffer(overrides: Partial<Offer> & { retailer: string }): Offer {
  return {
    url: `https://example.com/${overrides.retailer.toLowerCase()}`,
    trust: 100,
    available: true,
    match: 'exact',
    priceNgn: 10_000,
    checkedAt: '2026-07-21',
    location: ['NG'],
    listingEvidence: { observedAt: overrides.checkedAt ?? '2026-07-21', sourceUrl: `https://example.com/${overrides.retailer.toLowerCase()}`, basis: 'retailer-page' },
    priceObservation: {
      observedAt: overrides.checkedAt ?? '2026-07-21',
      variant: 'Product',
      size: '30 ml',
      stock: overrides.available === false ? 'out-of-stock' : 'in-stock',
      landedCost: 'unknown',
    },
    ...overrides,
  };
}

test('priced state with one exact store returns single-source reading', () => {
  const reading = buildMarketReading([
    makeOffer({ retailer: 'Store A', priceNgn: 9_850 }),
  ], 'NG', NOW);
  assert.equal(reading.state, 'priced');
  assert.equal(reading.priceLabel, '₦9,850');
  assert.equal(reading.storeCount, 1);
  assert.equal(reading.basis, 'single-source');
  assert.equal(reading.freshnessLabel, 'Checked yesterday');
  assert.equal(reading.unavailable, false);
});

test('priced state with multiple exact stores returns multi-source reading with From prefix', () => {
  const reading = buildMarketReading([
    makeOffer({ retailer: 'Store A', priceNgn: 24_000 }),
    makeOffer({ retailer: 'Store B', priceNgn: 27_500 }),
    makeOffer({ retailer: 'Store C', priceNgn: 30_000 }),
  ], 'NG', NOW);
  assert.equal(reading.state, 'priced');
  assert.equal(reading.priceLabel, 'From ₦24,000');
  assert.equal(reading.storeCount, 3);
  assert.equal(reading.basis, 'multi-source');
  assert.equal(reading.unavailable, false);
});

test('duplicate offers from one retailer count as one observed store', () => {
  const reading = buildMarketReading([
    makeOffer({ retailer: 'Store A', priceNgn: 9_850 }),
    makeOffer({ retailer: 'Store A', priceNgn: 10_500 }),
    makeOffer({ retailer: 'Store A', priceNgn: 11_000 }),
  ], 'NG', NOW);
  assert.equal(reading.state, 'priced');
  assert.equal(reading.storeCount, 1);
  assert.equal(reading.basis, 'single-source');
  assert.equal(reading.priceLabel, '₦9,850');
});

test('stale offers produce unavailable state', () => {
  const reading = buildMarketReading([
    makeOffer({ retailer: 'Store A', priceNgn: 9_850, checkedAt: '2026-07-01' }),
  ], 'NG', NOW);
  assert.equal(reading.state, 'unavailable');
  assert.equal(reading.priceLabel, null);
  assert.equal(reading.storeCount, 0);
  assert.equal(reading.unavailable, true);
  assert.equal(reading.freshnessLabel, null);
});

test('search offers are excluded from the eligible set', () => {
  const reading = buildMarketReading([
    makeOffer({ retailer: 'Search Store', priceNgn: 5_000, match: 'search' }),
  ], 'NG', NOW);
  assert.equal(reading.state, 'unavailable');
  assert.equal(reading.storeCount, 0);
});

test('out-of-stock offers are excluded from the priced set but counted in listing set', () => {
  const reading = buildMarketReading([
    makeOffer({ retailer: 'Store A', priceNgn: 9_850, available: false }),
  ], 'NG', NOW);
  assert.equal(reading.state, 'listing-only');
  assert.equal(reading.priceLabel, null);
  assert.equal(reading.storeCount, 0);
  assert.equal(reading.listingStoreCount, 1);
  assert.equal(reading.freshnessLabel, 'Checked yesterday');
});

test('listing-only state when offers have no comparable price', () => {
  const reading = buildMarketReading([
    makeOffer({ retailer: 'Store A', priceNgn: undefined, priceObservation: undefined }),
  ], 'NG', NOW);
  assert.equal(reading.state, 'listing-only');
  assert.equal(reading.priceLabel, null);
  assert.equal(reading.storeCount, 0);
  assert.equal(reading.listingStoreCount, 1);
  assert.equal(reading.freshnessLabel, 'Checked yesterday');
});

test('unavailable state when no offers serve the market', () => {
  const reading = buildMarketReading([
    makeOffer({ retailer: 'US Store', priceNgn: undefined, priceUsd: 13.49, location: ['US'] }),
  ], 'NG', NOW);
  assert.equal(reading.state, 'unavailable');
  assert.equal(reading.priceLabel, null);
  assert.equal(reading.storeCount, 0);
  assert.equal(reading.listingStoreCount, 0);
  assert.equal(reading.freshnessLabel, null);
  assert.equal(reading.unavailable, true);
});

test('priced-observation freshness provenance comes from the priced set, not broader listings', () => {
  const reading = buildMarketReading([
    makeOffer({ retailer: 'Priced Store', priceNgn: 9_850, checkedAt: '2026-07-21' }),
    makeOffer({ retailer: 'Listing Store', priceNgn: undefined, priceObservation: undefined, checkedAt: '2026-07-20' }),
  ], 'NG', NOW);
  assert.equal(reading.state, 'priced');
  assert.equal(reading.observedAt, '2026-07-21');
  assert.equal(reading.freshnessLabel, 'Checked yesterday');
});

test('listing-only freshness comes from the listing set', () => {
  const reading = buildMarketReading([
    makeOffer({ retailer: 'Store A', priceNgn: undefined, priceObservation: undefined, checkedAt: '2026-07-20' }),
  ], 'NG', NOW);
  assert.equal(reading.state, 'listing-only');
  assert.equal(reading.observedAt, '2026-07-20');
  assert.equal(reading.freshnessLabel, 'Checked 2 days ago');
});

test('deterministic today label', () => {
  assert.equal(freshnessLabelFor('2026-07-22T08:00:00Z', NOW), 'Checked today');
});

test('deterministic yesterday label', () => {
  assert.equal(freshnessLabelFor('2026-07-21T08:00:00Z', NOW), 'Checked yesterday');
});

test('deterministic days-ago label', () => {
  assert.equal(freshnessLabelFor('2026-07-19T08:00:00Z', NOW), 'Checked 3 days ago');
});

test('deterministic date label beyond 7 days', () => {
  assert.equal(freshnessLabelFor('2026-07-10T08:00:00Z', NOW), 'Checked 10 Jul');
});

test('malformed timestamp returns null freshness', () => {
  assert.equal(freshnessLabelFor('not-a-date', NOW), null);
  assert.equal(freshnessLabelFor(null, NOW), null);
});

test('empty offers produce unavailable state', () => {
  const reading = buildMarketReading([], 'NG', NOW);
  assert.equal(reading.state, 'unavailable');
  assert.equal(reading.unavailable, true);
  assert.equal(reading.observedAt, null);
});

test('priceComparison exclude removes offer from priced set but keeps listing', () => {
  const reading = buildMarketReading([
    makeOffer({ retailer: 'Store A', priceNgn: 9_850, priceComparison: 'exclude' }),
  ], 'NG', NOW);
  assert.equal(reading.state, 'listing-only');
  assert.equal(reading.storeCount, 0);
  assert.equal(reading.listingStoreCount, 1);
});
