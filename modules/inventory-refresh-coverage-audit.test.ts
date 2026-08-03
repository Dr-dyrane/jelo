import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareCoveragePriority,
  offerCoverageState,
  offerRefreshCapability,
  normalizedRefreshBlocker,
  productCoverage,
  type CoverageOffer,
} from '@/lib/inventory/coverage-audit';

const now = new Date('2026-08-03T02:00:00Z');
const exactOffer: CoverageOffer = {
  retailer: 'Beauty by Daz',
  url: 'https://beautybydaz.com/shop/face/example-cleanser/',
  matchKind: 'exact',
  priceMinor: 8_500,
  currencyCode: 'NGN',
  inventoryStatus: 'in_stock',
  available: true,
  checkedAt: new Date('2026-08-02T12:00:00Z'),
  lastVerifiedAt: new Date('2026-08-02T12:00:00Z'),
  verificationExpiresAt: new Date('2026-08-09T12:00:00Z'),
  verificationMethod: 'manual',
  extractionAdapter: 'manual_browser',
  observedTitle: 'Example Cleanser',
  observedSize: '150 ml',
  activeJobStatus: null,
  latestJobStatus: 'completed',
  latestJobError: null,
};

test('coverage freshness uses governed exact evidence and the inclusive UTC-day boundary', () => {
  assert.equal(offerCoverageState('150 ml', exactOffer, now), 'fresh');
  assert.equal(offerCoverageState('150 ml', {
    ...exactOffer,
    lastVerifiedAt: new Date('2026-07-27T23:59:59Z'),
    verificationExpiresAt: new Date('2026-08-04T00:00:00Z'),
  }, now), 'fresh');
  assert.equal(offerCoverageState('150 ml', {
    ...exactOffer,
    lastVerifiedAt: new Date('2026-07-26T23:59:59Z'),
  }, now), 'stale');
  assert.equal(offerCoverageState('150 ml', { ...exactOffer, verificationMethod: 'import' }, now), 'unverified');
});

test('coverage fails closed on a mass-versus-volume size conflict', () => {
  assert.equal(offerCoverageState('150 ml', { ...exactOffer, observedSize: '150 g' }, now), 'conflict');
});

test('coverage classifies adapters, search blockers, and the smallest next action', () => {
  assert.equal(offerRefreshCapability(exactOffer), 'automation:beauty-by-daz+manual-fallback');
  assert.equal(offerRefreshCapability({ ...exactOffer, url: 'https://example.com/product' }), 'automation:structured-generic+manual-fallback');
  assert.equal(offerRefreshCapability({ ...exactOffer, matchKind: 'search' }), 'blocked-search');

  const report = productCoverage({
    slug: 'example-cleanser',
    size: '150 ml',
    databasePublished: true,
    offers: [exactOffer],
    now,
  });
  assert.deepEqual(report.classification, { exact: 1, search: 0 });
  assert.equal(report.priceStockFreshness.freshPrices, 1);
  assert.equal(report.priceStockFreshness.freshStock, 1);
  assert.deepEqual(report.storeChoice, {
    target: 3,
    approvedExactStores: 1,
    trustworthyFreshExactStores: 1,
    freshPricedStores: 1,
    gapToTarget: 2,
    freshPriceGapToTarget: 2,
  });
  assert.equal(report.nextAction, 'find 2 more trustworthy exact NG stores');
  assert.deepEqual(report.priority, {
    score: 32,
    reasons: {
      exactStoreGap: 2,
      freshPriceGap: 2,
      staleOrUnverifiedOffers: 0,
      blockedExactOffers: 0,
    },
    tieBreakObservation: '2026-08-02T12:00:00.000Z',
  });
  assert.equal(normalizedRefreshBlocker('Retailer canonical URL does not match the verified product route.'), 'redirected-off-exact-route');
});

test('coverage priority applies the accepted score and breaks ties by oldest observation', () => {
  const blocked = {
    ...exactOffer,
    retailer: 'BuyBetter',
    latestJobStatus: 'failed',
    latestJobError: 'Retailer canonical URL redirected off the exact product route.',
  };
  const report = productCoverage({
    slug: 'blocked-example',
    size: '150 ml',
    databasePublished: true,
    offers: [
      { ...blocked, verificationMethod: 'import' },
      { ...exactOffer, retailer: 'Second Store', verificationMethod: 'import' },
    ],
    now,
  });

  assert.deepEqual(report.priority, {
    score: 56,
    reasons: {
      exactStoreGap: 3,
      freshPriceGap: 3,
      staleOrUnverifiedOffers: 2,
      blockedExactOffers: 1,
    },
    tieBreakObservation: '2026-08-02T12:00:00.000Z',
  });

  const queue = [
    { slug: 'newer', priority: { ...report.priority, tieBreakObservation: '2026-08-02T00:00:00.000Z' } },
    { slug: 'never-observed', priority: { ...report.priority, tieBreakObservation: null } },
    { slug: 'older', priority: { ...report.priority, tieBreakObservation: '2026-07-30T00:00:00.000Z' } },
    { slug: 'lower-score', priority: { ...report.priority, score: 55 } },
  ].sort(compareCoveragePriority);

  assert.deepEqual(queue.map(item => item.slug), [
    'never-observed',
    'older',
    'newer',
    'lower-score',
  ]);
});

test('store-choice coverage counts distinct governed retailers toward the target', () => {
  const report = productCoverage({
    slug: 'example-cleanser',
    size: '150 ml',
    databasePublished: true,
    offers: [
      exactOffer,
      { ...exactOffer, retailer: 'Lux Beauty', url: 'https://luxbeautyng.com/product/example-cleanser/' },
      { ...exactOffer, retailer: 'Care to Beauty', url: 'https://caretobeauty.com/ng/example-cleanser/' },
      { ...exactOffer, url: 'https://beautybydaz.com/shop/face/example-cleanser-two/' },
    ],
    now,
  });

  assert.deepEqual(report.storeChoice, {
    target: 3,
    approvedExactStores: 3,
    trustworthyFreshExactStores: 3,
    freshPricedStores: 3,
    gapToTarget: 0,
    freshPriceGapToTarget: 0,
  });
  assert.equal(report.nextAction, 'none—fresh exact NG coverage');
});
