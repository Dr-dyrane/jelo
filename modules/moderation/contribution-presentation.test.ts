import assert from 'node:assert/strict';
import test from 'node:test';
import {
  contributionReviewItem,
  type ContributionReviewRecord,
} from '@/lib/moderation/contribution-presentation';

const canonicalProductSlug = 'cosrx-salicylic-acid-daily-gentle-cleanser';

function reviewRecord(
  payload: Record<string, unknown> = {},
  overrides: Partial<ContributionReviewRecord> = {},
): ContributionReviewRecord {
  return {
    id: 'contribution-1',
    kind: 'product',
    payload,
    submittedAt: '2026-07-22T22:11:56.386Z',
    retainUntil: '2028-07-22T22:11:56.386Z',
    pendingEdgeCount: 0,
    pendingObservationCount: 0,
    attribution: null,
    ...overrides,
  };
}

test('prefixed and unprefixed canonical product ids resolve the same approved image', () => {
  const prefixed = contributionReviewItem(reviewRecord({
    products: [{
      id: `product:${canonicalProductSlug}`,
      label: 'Submitted cleanser label',
      source: 'canonical',
    }],
  }));
  const unprefixed = contributionReviewItem(reviewRecord({
    products: [{
      id: canonicalProductSlug,
      label: 'Submitted cleanser label',
      source: 'canonical',
    }],
  }));

  assert.ok(prefixed.image);
  assert.equal(unprefixed.image, prefixed.image);
  assert.deepEqual(prefixed.productNames, ['Salicylic Acid Daily Gentle Cleanser']);
  assert.deepEqual(unprefixed.productNames, prefixed.productNames);
});

test('malformed payload fields fail safely into a truthful empty projection', () => {
  const item = contributionReviewItem(reviewRecord({
    products: [
      null,
      'not-an-item',
      {},
      { id: 42, label: 'Wrong id type', source: 'canonical' },
      { id: ' ', label: 'Blank id', source: 'custom' },
      { id: 'product:blank-label', label: ' ', source: 'custom' },
    ],
    brands: { id: 'brand:not-an-array' },
    retailers: [undefined],
    purposes: 'Acne',
    priceNgn: '8500',
    outcome: { value: 'love-it' },
    purchaseDate: 20260722,
  }));

  assert.equal(item.title, 'Community submission');
  assert.equal(item.summary, '');
  assert.deepEqual(item.productValues, []);
  assert.deepEqual(item.brandValues, []);
  assert.deepEqual(item.storeValues, []);
  assert.deepEqual(item.purposeValues, []);
  assert.deepEqual(item.productNames, []);
  assert.deepEqual(item.brandNames, []);
  assert.deepEqual(item.storeNames, []);
  assert.deepEqual(item.purposeNames, []);
  assert.equal(item.priceNgn, null);
  assert.equal(item.outcome, null);
  assert.equal(item.purchaseDate, null);
  assert.equal(item.image, null);
  assert.equal(item.needsMatching, false);
});

test('any valid custom value marks the contribution as needing matching', () => {
  const canonicalOnly = contributionReviewItem(reviewRecord({
    purposes: [{ id: 'purpose:acne', label: 'Acne', source: 'canonical' }],
  }));
  const withCustomValue = contributionReviewItem(reviewRecord({
    purposes: [{ id: 'custom:chicken-skin', label: 'Chicken Skin', source: 'custom' }],
  }));

  assert.equal(canonicalOnly.needsMatching, false);
  assert.equal(withCustomValue.needsMatching, true);
  assert.deepEqual(canonicalOnly.purposeValues, [{ label: 'Acne', match: 'known' }]);
  assert.deepEqual(withCustomValue.purposeValues, [{ label: 'Chicken Skin', match: 'new' }]);
});

test('missing attribution is distinct from a directly opened contribution', () => {
  const missing = contributionReviewItem(reviewRecord());
  const direct = contributionReviewItem(reviewRecord({}, {
    attribution: {
      source: 'direct',
      medium: null,
      campaign: null,
    },
  }));

  assert.equal(missing.sourceLabel, 'Not recorded');
  assert.equal(direct.sourceLabel, 'Direct');
  assert.equal(missing.campaignLabel, null);
  assert.equal(direct.campaignLabel, null);
});

test('store summaries describe submitted data without claiming trust', () => {
  const item = contributionReviewItem(reviewRecord({
    retailers: [{
      id: 'retailer:lagos-skin-house',
      label: 'Lagos Skin House',
      source: 'canonical',
    }],
  }, {
    kind: 'store',
  }));

  assert.equal(item.title, 'Lagos Skin House');
  assert.equal(item.summary, '');
  assert.equal(item.summary.toLocaleLowerCase('en-NG').includes('trusted'), false);
});

test('routine titles stay scannable while the full product list remains available', () => {
  const item = contributionReviewItem(reviewRecord({
    products: [
      { id: 'product:first', label: 'Cleanser', source: 'custom' },
      { id: 'product:second', label: 'Toner', source: 'custom' },
      { id: 'product:third', label: 'Moisturiser', source: 'custom' },
    ],
  }, {
    kind: 'routine',
  }));

  assert.equal(item.title, 'Cleanser + 2 more');
  assert.deepEqual(item.productNames, ['Cleanser', 'Toner', 'Moisturiser']);
  assert.deepEqual(item.productValues, [
    { label: 'Cleanser', match: 'new' },
    { label: 'Toner', match: 'new' },
    { label: 'Moisturiser', match: 'new' },
  ]);
});

test('all submitted products, brands, retailers, and purposes remain visible', () => {
  const item = contributionReviewItem(reviewRecord({
    products: [
      {
        id: `product:${canonicalProductSlug}`,
        label: 'Submitted cleanser label',
        source: 'canonical',
      },
      {
        id: 'product:some-by-mi-aha-bha-pha-miracle-toner',
        label: 'AHA BHA PHA Miracle Toner',
        source: 'canonical',
      },
    ],
    brands: [
      { id: 'brand:cosrx', label: 'COSRX', source: 'canonical' },
      { id: 'brand:some-by-mi', label: 'SOME BY MI', source: 'canonical' },
    ],
    retailers: [
      { id: 'retailer:beauty-by-daz', label: 'Beauty by Daz', source: 'canonical' },
      { id: 'retailer:lux-beauty', label: 'Lux Beauty', source: 'canonical' },
    ],
    purposes: [
      { id: 'purpose:acne', label: 'Acne', source: 'canonical' },
      { id: 'purpose:dark-spots', label: 'Dark Spots', source: 'canonical' },
    ],
  }));

  assert.deepEqual(item.productNames, [
    'Salicylic Acid Daily Gentle Cleanser',
    'AHA BHA PHA Miracle Toner',
  ]);
  assert.deepEqual(item.brandNames, ['COSRX', 'SOME BY MI']);
  assert.deepEqual(item.storeNames, ['Beauty by Daz', 'Lux Beauty']);
  assert.deepEqual(item.purposeNames, ['Acne', 'Dark Spots']);
  assert.equal(item.productCount, 2);
});
