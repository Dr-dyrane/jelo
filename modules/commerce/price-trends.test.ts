import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateOfferPriceTrends,
  calculatePriceTrends,
  describePriceMovement,
  selectRetailerPriceMovement,
  type PriceObservation,
} from './price-trends';

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

test('falls back to the last trustworthy check while seven-day history is still growing', () => {
  const result = calculatePriceTrends([
    observation('one', 15_000, '2026-07-19T12:00:00Z'),
    observation('one', 14_000, '2026-07-22T10:00:00Z'),
  ], asOf);

  assert.equal(result.sevenDay, null);
  assert.equal(result.recent?.direction, 'down');
  assert.equal(result.recent?.percent, -6.7);
  assert.equal(result.recent?.days, 3);
});

test('does not treat rapid duplicate refreshes as a meaningful trend window', () => {
  const result = calculatePriceTrends([
    observation('one', 15_000, '2026-07-22T06:00:00Z'),
    observation('one', 14_000, '2026-07-22T10:00:00Z'),
  ], asOf);

  assert.equal(result.recent, null);
});

test('keeps each store movement separate from the market movement', () => {
  const result = calculateOfferPriceTrends([
    observation('store-a', 15_000, '2026-07-14T12:00:00Z'),
    observation('store-a', 14_000, '2026-07-22T10:00:00Z'),
    observation('store-b', 17_000, '2026-07-15T12:00:00Z'),
    observation('store-b', 18_000, '2026-07-22T09:00:00Z'),
  ], asOf);

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map(item => ({
      offerId: item.offerId,
      retailer: item.retailer,
      direction: item.sevenDay?.direction,
      percent: item.sevenDay?.percent,
    })),
    [
      { offerId: 'store-a', retailer: 'store-a', direction: 'down', percent: -6.7 },
      { offerId: 'store-b', retailer: 'store-b', direction: 'up', percent: 5.9 },
    ],
  );
});

test('omits a store direction until that exact offer has a valid comparison window', () => {
  const result = calculateOfferPriceTrends([
    observation('current-only', 14_000, '2026-07-22T10:00:00Z'),
    observation('with-history', 17_000, '2026-07-15T12:00:00Z'),
    observation('with-history', 16_000, '2026-07-22T09:00:00Z'),
  ], asOf);

  assert.deepEqual(result.map(item => item.offerId), ['with-history']);
});

test('hides retailer movement when multiple exact offers share the same store card', () => {
  const byOffer = calculateOfferPriceTrends([
    observation('first-offer', 15_000, '2026-07-14T12:00:00Z'),
    observation('first-offer', 14_000, '2026-07-22T10:00:00Z'),
    observation('second-offer', 17_000, '2026-07-15T12:00:00Z'),
    observation('second-offer', 18_000, '2026-07-22T09:00:00Z'),
  ], asOf).map(item => ({ ...item, retailer: 'Same store' }));

  assert.equal(selectRetailerPriceMovement({ byOffer: { NG: byOffer } }, 'NG', 'Same store'), null);
});

test('selects movement only for one unambiguous exact retailer offer', () => {
  const [offer] = calculateOfferPriceTrends([
    observation('only-offer', 15_000, '2026-07-14T12:00:00Z'),
    observation('only-offer', 14_000, '2026-07-22T10:00:00Z'),
  ], asOf);
  const movement = selectRetailerPriceMovement({
    byOffer: { NG: [{ ...offer, retailer: 'Exact store' }] },
  }, 'NG', ' exact STORE ');

  assert.equal(movement?.direction, 'down');
  assert.equal(movement?.percent, -6.7);
});

test('describes one-day evidence without broken plural copy', () => {
  const result = calculatePriceTrends([
    observation('one', 10_000, '2026-07-21T10:00:00Z'),
    observation('one', 10_000, '2026-07-22T10:00:00Z'),
  ], asOf);
  assert.equal(
    describePriceMovement(result.recent!, 'Store price'),
    'Store price steady over 1 day. Based on 1 matching store.',
  );
});
