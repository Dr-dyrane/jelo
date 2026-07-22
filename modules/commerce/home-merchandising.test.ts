import assert from 'node:assert/strict';
import test from 'node:test';
import { hasVerifiedNigeriaOffer, hasVerifiedNigeriaOfferAt, orderByCuratedSlugs } from './home-merchandising';

test('keeps live catalogue records in the curated homepage order', () => {
  const live = [
    { slug: 'third', price: 3 },
    { slug: 'first', price: 1 },
    { slug: 'second', price: 2 },
  ];

  assert.deepEqual(
    orderByCuratedSlugs(live, ['first', 'second', 'third']).map(item => item.slug),
    ['first', 'second', 'third'],
  );
  assert.equal(live[0].slug, 'third');
});

test('appends new live products without dropping them', () => {
  const ordered = orderByCuratedSlugs(
    [{ slug: 'new-z' }, { slug: 'known' }, { slug: 'new-a' }],
    ['known'],
  );

  assert.deepEqual(ordered.map(item => item.slug), ['known', 'new-a', 'new-z']);
});

test('Nigeria-ready requires an available exact priced offer', () => {
  const now = new Date('2026-07-22T12:00:00Z');
  const offer = { retailer: 'Store', url: 'https://store.example/product', trust: 90, available: true, priceNgn: 10_000, checkedAt: '2026-07-22', match: 'exact' as const, location: ['NG'] };

  assert.equal(hasVerifiedNigeriaOfferAt({ offers: [offer] }, now), true);
  assert.equal(hasVerifiedNigeriaOfferAt({ offers: [{ ...offer, match: 'search' }] }, now), false);
  assert.equal(hasVerifiedNigeriaOfferAt({ offers: [{ ...offer, available: false }] }, now), false);
  assert.equal(hasVerifiedNigeriaOfferAt({ offers: [{ ...offer, priceNgn: undefined }] }, now), false);
  assert.equal(hasVerifiedNigeriaOfferAt({ offers: [{ ...offer, location: ['US'] }] }, now), false);
  assert.equal(hasVerifiedNigeriaOfferAt({ offers: [{ ...offer, checkedAt: '2026-07-14' }] }, now), false);
});

test('works safely as an Array.filter callback', () => {
  const checkedAt = new Date().toISOString().slice(0, 10);
  const product = {
    offers: [{ retailer: 'Store', url: 'https://store.example/product', trust: 90, available: true, priceNgn: 10_000, checkedAt, match: 'exact' as const, location: ['NG'] }],
  };

  assert.deepEqual([product].filter(hasVerifiedNigeriaOffer), [product]);
});
