import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import type { Offer, Product } from '@/data/products';
import type { PriceMovement, ProductPriceTrends } from './price-trends';
import {
  buildShareSignalReadModel,
  selectRecentDrops,
  selectShareGaps,
  selectShareRecommendations,
} from './share-insights';

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

function ngOffer(retailer: string, priceNgn: number, checkedAt = '2026-07-21'): Offer {
  return observed({
    retailer, url: `https://example.com/${retailer}`, trust: 100, available: true,
    match: 'exact', priceNgn, checkedAt, location: ['NG'],
  } as Offer);
}

function product(slug: string, offers: Offer[], category: Product['category'] = 'Face'): Product {
  return {
    slug, brand: 'Brand', name: 'Name', size: '30 ml', category, step: 'Treat',
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

test('selectRecentDrops falls through weak 30-day evidence to a valid seven-day drop', () => {
  const thirtyDay: PriceMovement = {
    days: 30,
    direction: 'down',
    amountMinor: -2_000,
    percent: -12,
    comparableOfferCount: 1,
    comparableRetailerCount: 1,
    fromAt: '2026-06-20',
    toAt: '2026-07-21',
  };
  const sevenDay: PriceMovement = {
    days: 7,
    direction: 'down',
    amountMinor: -1_000,
    percent: -7,
    comparableOfferCount: 2,
    comparableRetailerCount: 2,
    fromAt: '2026-07-14',
    toAt: '2026-07-21',
  };
  const drops = selectRecentDrops([{
    product: product('valid-seven-day', [ngOffer('one', 14_500), ngOffer('two', 17_500)]),
    trends: { NG: { thirtyDay, sevenDay } },
  }], now);

  assert.equal(drops.length, 1);
  assert.equal(drops[0].days, 7);
  assert.equal(drops[0].trendLabel, '↓ 7% · 7d');
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

test('the canonical read model preserves strict lanes and dedupes a product that qualifies for both', () => {
  const both = product('drop-and-gap', [ngOffer('one', 10_000), ngOffer('two', 13_000)]);
  const gapOnly = product('gap-only', [ngOffer('three', 10_000), ngOffer('four', 12_000)]);
  const freshOnly = product('fresh-only', [ngOffer('five', 9_000)]);
  const model = buildShareSignalReadModel([
    { product: both, trends: movement({ percent: -9, amountMinor: -1_500 }) },
    { product: gapOnly, trends: {} },
    { product: freshOnly, trends: {} },
  ], now);

  assert.deepEqual(model.recentDrops.map(signal => signal.slug), ['drop-and-gap']);
  assert.deepEqual(model.priceGaps.map(signal => signal.slug), ['gap-only']);
  assert.deepEqual(model.freshComparisons.map(signal => signal.slug), ['fresh-only']);
  assert.equal(new Set(model.rankedPool.map(signal => signal.slug)).size, model.rankedPool.length);
});

test('deduping a drop does not consume one of the eight strict gap slots', () => {
  const items = Array.from({ length: 10 }, (_, index) => {
    const spread = 5_000 - index * 200;
    const item = product(`gap-${index}`, [ngOffer(`low-${index}`, 10_000), ngOffer(`high-${index}`, 10_000 + spread)]);
    return {
      product: item,
      trends: index === 0 ? movement({ percent: -10, amountMinor: -1_500 }) : {},
    };
  });
  const model = buildShareSignalReadModel(items, now);

  assert.deepEqual(model.recentDrops.map(signal => signal.slug), ['gap-0']);
  assert.equal(model.priceGaps.length, 8);
  assert.ok(model.priceGaps.every(signal => signal.slug !== 'gap-0'));
});

test('fresh comparisons remain useful when strict drop and gap lanes are empty', () => {
  const current = product('current', [ngOffer('one', 14_500)]);
  const model = buildShareSignalReadModel([{ product: current, trends: {} }], now);

  assert.equal(model.recentDrops.length, 0);
  assert.equal(model.priceGaps.length, 0);
  assert.deepEqual(model.freshComparisons.map(signal => signal.slug), ['current']);
  assert.equal(model.freshComparisons[0].lowestNaira, 14_500);
  assert.equal(model.freshComparisons[0].storeCount, 1);
});

test('fallback ranking uses freshness, retailer breadth, then actionable price context', () => {
  const newest = product('newest', [ngOffer('new', 12_000, '2026-07-22T10:00:00Z')]);
  const wide = product('wide', [
    ngOffer('wide-a', 10_000),
    ngOffer('wide-b', 10_200),
    ngOffer('wide-c', 10_400),
  ]);
  const twoStores = product('two-stores', [ngOffer('two-a', 11_000), ngOffer('two-b', 11_000)]);
  const oneStore = product('one-store', [ngOffer('one-a', 8_000)]);
  const stale = product('stale', [ngOffer('stale-a', 7_000, '2026-06-01')]);
  const search = product('search', [{ ...ngOffer('search-a', 6_000), match: 'search' }]);
  const outsideNg = product('outside-ng', [{ ...ngOffer('us-a', 5_000), location: ['US'] }]);
  const model = buildShareSignalReadModel([
    newest, wide, twoStores, oneStore, stale, search, outsideNg,
  ].map(item => ({ product: item, trends: {} })), now);

  assert.deepEqual(
    model.freshComparisons.map(signal => signal.slug),
    ['newest', 'wide', 'two-stores', 'one-store'],
  );
});

test('aggregate interest is optional, neutral when absent, and only breaks an evidence tie', () => {
  const alpha = product('alpha', [ngOffer('a', 10_000)]);
  const beta = product('beta', [ngOffer('b', 10_000)]);
  const items = [alpha, beta].map(item => ({ product: item, trends: {} }));
  const neutral = buildShareSignalReadModel(items, now);
  const empty = buildShareSignalReadModel(items, now, new Map());
  const withInterest = buildShareSignalReadModel(items, now, new Map([['beta', 4]]));

  assert.deepEqual(neutral.rankedPool.map(signal => signal.slug), ['alpha', 'beta']);
  assert.deepEqual(empty.rankedPool.map(signal => signal.slug), ['alpha', 'beta']);
  assert.deepEqual(withInterest.rankedPool.map(signal => signal.slug), ['beta', 'alpha']);
  assert.equal(neutral.aggregateInterest, 'unavailable');
  assert.equal(withInterest.aggregateInterest, 'available');

  const newer = product('newer', [ngOffer('newer-store', 10_000, '2026-07-22T10:00:00Z')]);
  const older = product('older', [ngOffer('older-store', 10_000)]);
  const evidenceBeforeInterest = buildShareSignalReadModel(
    [newer, older].map(item => ({ product: item, trends: {} })),
    now,
    new Map([['older', 1_000_000]]),
  );
  assert.deepEqual(evidenceBeforeInterest.rankedPool.map(signal => signal.slug), ['newer', 'older']);
});

test('detail recommendations share the global pool and category only breaks an evidence tie', () => {
  const current = product('current', [ngOffer('current-a', 10_000)], 'Body');
  const strongerFace = product('stronger-face', [ngOffer('strong-a', 10_000, '2026-07-22T10:00:00Z')], 'Face');
  const tiedFace = product('tied-face', [ngOffer('face-a', 10_000)], 'Face');
  const tiedBody = product('tied-body', [ngOffer('body-a', 10_000)], 'Body');
  const model = buildShareSignalReadModel([
    current, strongerFace, tiedFace, tiedBody,
  ].map(item => ({ product: item, trends: {} })), now);
  const duplicatedPool = [...model.rankedPool, model.rankedPool.find(signal => signal.slug === 'tied-body')!];
  const recommendations = selectShareRecommendations(duplicatedPool, 'current');

  assert.deepEqual(
    recommendations.map(signal => signal.slug),
    ['stronger-face', 'tied-body', 'tied-face'],
  );
  assert.equal(new Set(recommendations.map(signal => signal.slug)).size, recommendations.length);
  assert.ok(recommendations.every(signal => signal.slug !== 'current'));
});

test('the server read has no live or private interest dependency and both routes consume it', async () => {
  const root = process.cwd();
  const [serverRead, indexRoute, detailRoute] = await Promise.all([
    readFile(path.join(root, 'lib/share/worth-sharing.ts'), 'utf8'),
    readFile(path.join(root, 'app/(site)/share/page.tsx'), 'utf8'),
    readFile(path.join(root, 'app/(site)/share/[slug]/page.tsx'), 'utf8'),
  ]);
  const imports = serverRead.match(/^import[^;]+;/gm)?.join('\n') ?? '';

  assert.doesNotMatch(imports, /analytics|commerce-events|customer|shelf/i);
  assert.match(serverRead, /No live aggregate-interest provider is wired today/);
  assert.match(serverRead, /product_view[\s\S]*share_click[\s\S]*store_click/);
  assert.match(serverRead, /if \(!source\) return undefined/);
  assert.match(indexRoute, /getWorthSharingReadModel\(\)/);
  assert.match(detailRoute, /getWorthSharingReadModel\(\)/);
  assert.match(detailRoute, /selectShareRecommendations\(signals\.rankedPool, slug\)/);
  assert.match(indexRoute, /Price drops[\s\S]*Lower than before\./);
  assert.match(indexRoute, /Out of stock[\s\S]*Gone for now\./);
  assert.doesNotMatch(indexRoute, /trending|popular|most viewed/i);
});

test('share index and detail cards keep deterministic mobile reflow contracts', async () => {
  const root = process.cwd();
  const [indexRoute, indexCss, detailCard, detailCss] = await Promise.all([
    readFile(path.join(root, 'app/(site)/share/page.tsx'), 'utf8'),
    readFile(path.join(root, 'app/(site)/share/share-index.module.css'), 'utf8'),
    readFile(path.join(root, 'app/(site)/share/[slug]/share-card.tsx'), 'utf8'),
    readFile(path.join(root, 'app/(site)/share/[slug]/share-card.module.css'), 'utf8'),
  ]);
  const compactIndexCss = indexCss.replace(/\s+/g, '');
  const compactDetailCss = detailCss.replace(/\s+/g, '');

  assert.match(indexRoute, /className=\{styles\.grid\}[\s\S]*priceDrops\.map[\s\S]*className=\{styles\.card\}/);
  assert.match(compactIndexCss, /\.card\{[^}]*grid-template-columns:5\.5remminmax\(0,1fr\)auto/);
  assert.match(compactIndexCss, /@media\(max-width:720px\)\{\.grid,\.topics/);
  assert.match(compactIndexCss, /@media\(max-width:720px\)[\s\S]*\.card\{grid-template-columns:4\.75remminmax\(0,1fr\)auto/);
  assert.match(detailCard, /<ul className=\{styles\.alternativeList\} data-count=\{Math\.min\(items\.length, 3\)\}>/);
  assert.match(compactDetailCss, /\.alternativeList\{[^}]*repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(compactDetailCss, /@media\(max-width:760px\)[\s\S]*\.alternativeList\[data-count\]\{grid-template-columns:1fr;max-width:none/);
  assert.match(compactDetailCss, /@media\(max-width:430px\)[\s\S]*grid-template-columns:4\.75remminmax\(0,1fr\)auto/);
});
