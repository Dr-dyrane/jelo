import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePriceTrends, type PriceObservation } from './price-trends';

const asOf = new Date('2026-07-22T12:00:00Z');

function observation(offerId: string, priceMinor: number, observedAt: string): PriceObservation {
  return { offerId, retailer: offerId, priceMinor, observedAt };
}

test('compares the same exact offers across a seven-day window', () => {
  const result = calculatePriceTrends([
    observation('one', 15_000, '2026-07-14T12:00:00Z'),
    observation('one', 14_000, '2026-07-22T10:00:00Z'),
    observation('two', 17_000, '2026-07-15T12:00:00Z'),
    observation('two', 16_000, '2026-07-22T09:00:00Z'),
  ], asOf);

  assert.deepEqual(result.sevenDay, {
    days: 7,
    direction: 'down',
    amountMinor: -1_000,
    percent: -6.3,
    comparableOfferCount: 2,
    fromAt: '2026-07-15T12:00:00Z',
    toAt: '2026-07-22T10:00:00Z',
  });
});

test('does not claim movement without a fresh current and timely anchor', () => {
  const result = calculatePriceTrends([
    observation('current-only', 15_000, '2026-07-22T10:00:00Z'),
    observation('stale-anchor', 18_000, '2026-06-01T10:00:00Z'),
    observation('stale-anchor', 17_000, '2026-07-22T10:00:00Z'),
  ], asOf);

  assert.equal(result.sevenDay, null);
  assert.equal(result.thirtyDay, null);
});

test('treats sub-half-percent movement as steady', () => {
  const result = calculatePriceTrends([
    observation('one', 10_000, '2026-06-21T12:00:00Z'),
    observation('one', 10_040, '2026-07-22T10:00:00Z'),
  ], asOf);

  assert.equal(result.thirtyDay?.direction, 'flat');
  assert.equal(result.thirtyDay?.percent, 0.4);
});
