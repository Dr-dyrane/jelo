import assert from 'node:assert/strict';
import test from 'node:test';
import type { Product } from '@/data/products';
import type { PendingObservation } from '@/lib/moderation/queues';
import {
  observationProductSlug,
  observationReviewItem,
} from '@/lib/moderation/observation-presentation';

function observation(
  overrides: Partial<PendingObservation> = {},
): PendingObservation {
  return {
    id: '878dc8f7-1cfc-45a9-9d64-3c6d8129cee7',
    contributionId: '29a7f5bb-c4d3-47e9-bb0d-6a153156bd9c',
    kind: 'price',
    subjectKind: 'product',
    subjectRef: 'product:cerave-foaming-facial-cleanser',
    resolvedProductRef: null,
    amountNgn: 17_500,
    outcome: null,
    observedOn: '2026-07-02',
    createdAt: '2026-07-22T22:45:06.798Z',
    ...overrides,
  };
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    slug: 'cerave-foaming-facial-cleanser',
    brand: 'CeraVe',
    name: 'Foaming Facial Cleanser',
    size: '355 ml',
    category: 'Face',
    step: 'Cleanse',
    image: 'https://example.com/cerave.png',
    displayLine: 'Cleanse',
    bestFor: [],
    concerns: [],
    skinTypes: [],
    sensitiveFriendly: true,
    usage: 'Use as directed.',
    evidence: 'moderate',
    offers: [],
    ...overrides,
  };
}

test('a product observation uses only the exact resolved catalogue identity', () => {
  const item = observationReviewItem(observation(), product());

  assert.equal(observationProductSlug(item), 'cerave-foaming-facial-cleanser');
  assert.equal(item.title, 'CeraVe Foaming Facial Cleanser');
  assert.equal(item.summary, '₦17,500');
  assert.deepEqual(item.identity, {
    state: 'resolved_product',
    image: 'https://example.com/cerave.png',
    detail: 'Face · 355 ml',
  });
});

test('a mismatched product object cannot lend its image to another report', () => {
  const item = observationReviewItem(
    observation({
      subjectRef: 'product:not-in-the-catalogue',
    }),
    product(),
  );

  assert.equal(item.title, 'Not In The Catalogue');
  assert.equal(item.identity.state, 'unresolved_product');
  assert.equal(item.identity.image, null);
  assert.equal(item.identity.detail, 'Product needs matching');
});

test('non-product observations stay image-free and human-readable', () => {
  const item = observationReviewItem(observation({
    subjectKind: 'purpose',
    subjectRef: 'purpose:dark-spots',
  }));

  assert.equal(observationProductSlug(item), null);
  assert.equal(item.title, 'Dark Spots');
  assert.deepEqual(item.identity, {
    state: 'non_product',
    image: null,
    detail: 'Community report',
  });
});
