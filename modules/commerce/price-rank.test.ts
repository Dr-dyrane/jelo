import assert from 'node:assert/strict';
import test from 'node:test';
import type { Offer } from '@/data/products';
import { summarizeMarket } from './market-summary';
import { offerFreshnessDays, offerPriceRank } from './price-rank';

const now = new Date('2026-07-22T12:00:00Z');

const priced = (retailer: string, priceNgn: number, overrides: Partial<Offer> = {}): Offer => ({
  retailer,
  url: `https://example.com/${retailer}`,
  trust: 90,
  available: true,
  priceNgn,
  match: 'exact',
  listingEvidence: { observedAt: '2026-07-22', sourceUrl: `https://example.com/${retailer}`, basis: 'retailer-page' },
  priceObservation: { observedAt: '2026-07-22', variant: 'V', size: '30 ml', stock: 'in-stock', landedCost: 'unknown' },
  location: ['NG'],
  ...overrides,
});

test('price rank places a clicked offer against the compared set', () => {
  const offers = [priced('Low', 10_000), priced('Mid', 12_000), priced('High', 15_000)];
  const summary = summarizeMarket(offers, 'NG', now);

  assert.equal(offerPriceRank(offers[0], summary, 'NG', now), 'lowest');
  assert.equal(offerPriceRank(offers[1], summary, 'NG', now), 'median');
  assert.equal(offerPriceRank(offers[2], summary, 'NG', now), 'higher');
});

test('a lone priced store ranks as "only", a comparison-excluded listing as "marketplace"', () => {
  const solo = [priced('Solo', 10_000)];
  assert.equal(offerPriceRank(solo[0], summarizeMarket(solo, 'NG', now), 'NG', now), 'only');

  const excluded = priced('Marketplace', 7_999, { priceComparison: 'exclude' });
  const summary = summarizeMarket([priced('Low', 10_000), priced('Mid', 12_000), excluded], 'NG', now);
  assert.equal(offerPriceRank(excluded, summary, 'NG', now), 'marketplace');
});

test('freshness days count from the most specific observation', () => {
  assert.equal(offerFreshnessDays(priced('Fresh', 10_000), now), 0);
  assert.equal(offerFreshnessDays(priced('Week', 10_000), new Date('2026-07-29T12:00:00Z')), 7);
  assert.equal(offerFreshnessDays({ ...priced('Undated', 10_000), priceObservation: undefined, listingEvidence: undefined, checkedAt: undefined }, now), null);
});
