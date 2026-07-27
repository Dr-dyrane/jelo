import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  CommerceSignalMonitor,
  ContributionAttributionMonitor,
} from '@/lib/moderation/queues';
import {
  commercePriceChoiceLabel,
  commerceSignalView,
  contributionSignalView,
} from '@/lib/moderation/signals-presentation';

const monitor: CommerceSignalMonitor = {
  asOf: '2026-07-26T12:00:00Z',
  last7DaysCount: 3,
  previous7DaysCount: 2,
  last30DaysCount: 4,
  lastRecordedAt: '2026-07-26T11:00:00Z',
  priceChoices: [
    { choice: 'lowest', count: 3 },
    { choice: 'higher', count: 1 },
  ],
  topProducts: [{
    productSlug: 'glow-wash',
    visitCount: 3,
    storeCount: 2,
    lastVisitedAt: '2026-07-26T11:00:00Z',
  }],
  topRetailers: [{
    retailer: 'Jelo Store',
    visitCount: 3,
    productCount: 1,
    lastVisitedAt: '2026-07-26T11:00:00Z',
  }],
  recentVisits: [{
    id: 'visit-1',
    productSlug: 'glow-wash',
    retailer: 'Jelo Store',
    market: 'NG',
    priceNgn: 12_500,
    priceChoice: 'lowest',
    position: 2,
    freshnessDays: 1,
    createdAt: '2026-07-26T11:00:00Z',
  }],
};

const products = [{
  slug: 'glow-wash',
  brand: 'Jelo',
  name: 'Glow Wash',
  size: '150 ml',
  image: '/glow-wash.png',
}];

const contributionMonitor: ContributionAttributionMonitor = {
  asOf: '2026-07-26T12:00:00Z',
  last7DaysStarts: 12,
  last7DaysCompletions: 7,
  previous7DaysStarts: 4,
  previous7DaysCompletions: 2,
  last30DaysStarts: 16,
  last30DaysCompletions: 9,
  lastStartedAt: '2026-07-26T11:30:00Z',
  lastCompletedAt: '2026-07-26T11:45:00Z',
  campaigns: [{
    source: 'tiktok',
    medium: 'paid-social',
    campaign: 'community-library-2026-07',
    content: 'card-06',
    starts: 12,
    completions: 7,
    lastStartedAt: '2026-07-26T11:30:00Z',
    lastCompletedAt: '2026-07-26T11:45:00Z',
  }, {
    source: 'not-recorded',
    medium: null,
    campaign: null,
    content: null,
    starts: 0,
    completions: 2,
    lastStartedAt: null,
    lastCompletedAt: '2026-07-23T09:00:00Z',
  }],
};

test('Signals translates price positions into human choice language', () => {
  assert.equal(commercePriceChoiceLabel('lowest'), 'Lowest-priced option');
  assert.equal(commercePriceChoiceLabel('median'), 'Mid-priced option');
  assert.equal(commercePriceChoiceLabel('higher'), 'Higher-priced option');
  assert.equal(commercePriceChoiceLabel('only'), 'Only priced option');
  assert.equal(commercePriceChoiceLabel('marketplace'), 'Marketplace option');
});

test('Signals preserves zero choice categories and names the denominator share', () => {
  const view = commerceSignalView(monitor, products);
  assert.deepEqual(view.priceChoices.map(choice => choice.choice), [
    'lowest',
    'median',
    'higher',
    'only',
    'marketplace',
  ]);
  assert.equal(view.priceChoices[0]?.share, 0.75);
  assert.equal(view.priceChoices[1]?.count, 0);
});

test('Signals projects catalogue labels and bounded visit context', () => {
  const view = commerceSignalView(monitor, products);
  assert.equal(view.topProducts[0]?.title, 'Jelo Glow Wash');
  assert.equal(view.recentVisits[0]?.image, '/glow-wash.png');
  assert.equal(view.recentVisits[0]?.marketLabel, 'Nigeria');
  assert.equal(view.recentVisits[0]?.priceChoiceLabel, 'Lowest-priced option');
  assert.equal(view.recentVisits[0]?.positionLabel, 'Shown 2nd');
  assert.equal(view.recentVisits[0]?.freshnessLabel, 'Price checked 1 day earlier');
});

test('Signals turns bounded campaign fields into concise human labels', () => {
  const view = contributionSignalView(contributionMonitor);
  assert.equal(view.campaigns[0]?.sourceLabel, 'TikTok');
  assert.equal(
    view.campaigns[0]?.detailLabel,
    'Community Library · Jul 2026 · Paid · Card 06',
  );
  assert.equal(view.campaigns[0]?.lastActivityAt, '2026-07-26T11:45:00Z');
  assert.equal(view.campaigns[1]?.sourceLabel, 'Not recorded');
  assert.equal(view.campaigns[1]?.detailLabel, 'Earlier submissions');
});
