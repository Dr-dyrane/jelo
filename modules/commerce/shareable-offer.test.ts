import assert from 'node:assert/strict';
import test from 'node:test';
import type { Offer } from '@/data/products';
import { hasShareableNgOffer, isShareableNgOffer } from './shareable-offer';

// Attaches the retailer-page listing evidence and price observation a real
// merged offer carries, mirroring the market-summary test fixture.
function observed(offer: Offer): Offer {
  if (offer.match === 'search' || !offer.checkedAt) return offer;
  const hasPrice = offer.priceNgn != null || offer.priceUsd != null;
  return {
    ...offer,
    listingEvidence: { observedAt: offer.checkedAt, sourceUrl: offer.url, basis: 'retailer-page' },
    priceObservation: hasPrice
      ? { observedAt: offer.checkedAt, variant: 'Product', size: '30 ml', stock: 'in-stock', landedCost: 'unknown' }
      : undefined,
  };
}

const now = new Date('2026-07-22T12:00:00Z');
const base = {
  retailer: 'One', url: 'https://example.com/one', trust: 100, available: true,
  match: 'exact' as const, priceNgn: 14_500, checkedAt: '2026-07-21', location: ['NG'],
};

test('a fresh, exact, evidence-bound NG offer with a price is shareable', () => {
  assert.equal(isShareableNgOffer(observed(base as Offer), now), true);
});

test('a search-match offer is not shareable', () => {
  assert.equal(isShareableNgOffer(observed({ ...base, match: 'search' } as Offer), now), false);
});

test('an offer without a naira price is not shareable', () => {
  assert.equal(isShareableNgOffer(observed({ ...base, priceNgn: undefined } as Offer), now), false);
});

test('a non-NG offer is not shareable', () => {
  assert.equal(isShareableNgOffer(observed({ ...base, location: ['US'] } as Offer), now), false);
});

test('an out-of-stock offer is not shareable', () => {
  assert.equal(isShareableNgOffer(observed({ ...base, available: false } as Offer), now), false);
});

test('a price flagged priceComparison:exclude is not shareable', () => {
  assert.equal(isShareableNgOffer(observed({ ...base, priceComparison: 'exclude' } as Offer), now), false);
});

test('a stale offer is not shareable', () => {
  assert.equal(isShareableNgOffer(observed(base as Offer), new Date('2026-07-30T12:00:00Z')), false);
});

test('an offer without listing evidence is not shareable', () => {
  assert.equal(isShareableNgOffer(base as Offer, now), false);
});

test('hasShareableNgOffer is true when at least one offer qualifies', () => {
  const product = { offers: [observed({ ...base, match: 'search' } as Offer), observed(base as Offer)] };
  assert.equal(hasShareableNgOffer(product, now), true);
});

test('hasShareableNgOffer is false when none qualify', () => {
  const product = { offers: [observed({ ...base, match: 'search' } as Offer)] };
  assert.equal(hasShareableNgOffer(product, now), false);
});
