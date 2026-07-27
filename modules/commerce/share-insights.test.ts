import assert from 'node:assert/strict';
import test from 'node:test';
import type { Offer, Product } from '@/data/products';
import type { PriceMovement, ProductPriceTrends } from './price-trends';
import { selectRecentDrops, selectShareGaps } from './share-insights';

const now = new Date('2026-07-22T12:00:00Z');

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

function ngOffer(retailer: string, priceNgn: number): Offer {
  return observed({
    retailer, url: `https://example.com/${retailer}`, trust: 100, available: true,
    match: 'exact', priceNgn, checkedAt: '2026-07-21', location: ['NG'],
  } as Offer);
}

function product(slug: string, offers: Offer[]): Product {
  return {
    slug, brand: 'Brand', name: 'Name', size: '30 ml', category: 'Face', step: 'Treat',
    image: `/${slug}.png`, displayLine: '', bestFor: [], concerns: [], skinTypes: [],
    sensitiveFriendly: false, usage: '', evidence: 'moderate', offers,
  };
}

function movement(over: Partial<PriceMovement>): ProductPriceTrends {
  const thirtyDay: PriceMovement = {
    days: 30, direction: 'down', amountMinor: -1_000, percent: -6,
    comparableOfferCount: 2, comparableRetailerCount: 2,
    fromAt: '2026-06-20', toAt: '2026-07-21', ...over,
  };
  return { NG: { sevenDay: null, thirtyDay } };
}

test('selectShareGaps keeps a real two-store spread with the right figures', () => {
  const gaps = selectShareGaps([product('wide', [ngOffer('one', 14_500), ngOffer('two', 17_500)])], now);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].lowestNaira, 14_500);
  assert.equal(gaps[0].spreadNaira, 3_000);
  assert.equal(gaps[0].storeCount, 2);
});

test('selectShareGaps drops a spread below the naira floor', () => {
  const gaps = selectShareGaps([product('narrow', [ngOffer('one', 14_500), ngOffer('two', 14_900)])], now);
  assert.equal(gaps.length, 0);
});

test('selectShareGaps ignores a single-source product (no spread to claim)', () => {
  const gaps = selectShareGaps([product('single', [ngOffer('one', 14_500)])], now);
  assert.equal(gaps.length, 0);
});

test('selectShareGaps ranks by spread, widest first', () => {
  const gaps = selectShareGaps([
    product('small', [ngOffer('a', 10_000), ngOffer('b', 12_000)]),
    product('big', [ngOffer('c', 10_000), ngOffer('d', 20_000)]),
  ], now);
  assert.deepEqual(gaps.map(g => g.slug), ['big', 'small']);
});

test('selectRecentDrops keeps a notable fall and reports it as positive naira', () => {
  const drops = selectRecentDrops([
    { product: product('p', [ngOffer('one', 14_500), ngOffer('two', 17_500)]), trends: movement({ amountMinor: -1_200, percent: -8 }) },
  ], now);
  assert.equal(drops.length, 1);
  assert.equal(drops[0].amountNaira, 1_200);
  assert.equal(drops[0].days, 30);
  assert.equal(drops[0].trendLabel, '↓ 8% · 30d');
});

test('selectRecentDrops ignores rises, flat moves and sub-threshold falls', () => {
  const rise = { product: product('rise', [ngOffer('one', 14_500)]), trends: movement({ direction: 'up', percent: 6, amountMinor: 1_000 }) };
  const flat = { product: product('flat', [ngOffer('one', 14_500)]), trends: movement({ direction: 'flat', percent: 0.2, amountMinor: 30 }) };
  const tiny = { product: product('tiny', [ngOffer('one', 14_500)]), trends: movement({ direction: 'down', percent: -2, amountMinor: -300 }) };
  assert.equal(selectRecentDrops([rise, flat, tiny], now).length, 0);
});

test('selectRecentDrops never ranks a market signal backed by one retailer', () => {
  const oneStore = {
    product: product('one-store', [ngOffer('one', 14_500)]),
    trends: movement({ comparableRetailerCount: 1 }),
  };

  assert.equal(selectRecentDrops([oneStore], now).length, 0);
});

test('selectRecentDrops ignores a product with no shareable offer', () => {
  const searchOnly = product('search', [observed({ retailer: 's', url: 'https://x', trust: 100, available: true, match: 'search', priceNgn: 9_000, checkedAt: '2026-07-21', location: ['NG'] } as Offer)]);
  assert.equal(selectRecentDrops([{ product: searchOnly, trends: movement({}) }], now).length, 0);
});

test('selectRecentDrops ranks by percentage movement before absolute naira change', () => {
  const drops = selectRecentDrops([
    {
      product: product('larger-naira', [ngOffer('one', 80_000), ngOffer('two', 90_000)]),
      trends: movement({ amountMinor: -8_000, percent: -8 }),
    },
    {
      product: product('stronger-movement', [ngOffer('three', 10_000), ngOffer('four', 12_000)]),
      trends: movement({ amountMinor: -2_000, percent: -20 }),
    },
  ], now);

  assert.deepEqual(drops.map(drop => drop.slug), ['stronger-movement', 'larger-naira']);
});

test('selectRecentDrops uses wider retailer evidence to break equal trend ties', () => {
  const drops = selectRecentDrops([
    {
      product: product('narrow-evidence', [ngOffer('one', 10_000), ngOffer('two', 12_000)]),
      trends: movement({ percent: -8, comparableRetailerCount: 2 }),
    },
    {
      product: product('wide-evidence', [ngOffer('three', 10_000), ngOffer('four', 12_000)]),
      trends: movement({ percent: -8, comparableRetailerCount: 3 }),
    },
  ], now);

  assert.deepEqual(drops.map(drop => drop.slug), ['wide-evidence', 'narrow-evidence']);
});
