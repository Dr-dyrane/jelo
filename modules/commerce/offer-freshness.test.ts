import assert from 'node:assert/strict';
import test from 'node:test';
import { isOfferFresh, OFFER_FRESH_DAYS } from './offer-freshness';

const now = new Date('2026-07-22T12:00:00Z');

test('accepts today and the seven-day boundary', () => {
  assert.equal(isOfferFresh({ checkedAt: '2026-07-22' }, now), true);
  assert.equal(isOfferFresh({ checkedAt: '2026-07-15' }, now), true);
  assert.equal(OFFER_FRESH_DAYS, 7);
});

test('rejects stale, missing, invalid and future checks', () => {
  assert.equal(isOfferFresh({ checkedAt: '2026-07-14' }, now), false);
  assert.equal(isOfferFresh({ checkedAt: undefined }, now), false);
  assert.equal(isOfferFresh({ checkedAt: 'not-a-date' }, now), false);
  assert.equal(isOfferFresh({ checkedAt: '2026-07-23' }, now), false);
});
