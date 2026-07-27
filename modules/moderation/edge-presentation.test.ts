import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  edgeReviewItem,
  type EdgeReviewRecord,
} from '@/lib/moderation/edge-presentation';

function edgeRecord(overrides: Partial<EdgeReviewRecord> = {}): EdgeReviewRecord {
  return {
    id: '2c25591a-1c53-4b9a-a963-2692ce88a9d3',
    contributionId: '29a7f5bb-c4d3-47e9-bb0d-6a153156bd9c',
    contributionKind: 'product',
    contributionPayload: {
      kind: 'product',
      brands: [{
        id: 'brand:cerave',
        label: 'CeraVe',
        source: 'canonical',
      }],
      products: [{
        id: 'product:cerave-foaming-facial-cleanser',
        label: 'Foaming Facial Cleanser',
        source: 'canonical',
      }],
      retailers: [{
        id: 'retailer:teeka4',
        label: 'Teeka4',
        source: 'canonical',
      }],
      purposes: [{
        id: 'purpose:oily-skin',
        label: 'Oily skin',
        source: 'canonical',
      }],
    },
    subjectKind: 'anonymous_contribution',
    subjectRef: '29a7f5bb-c4d3-47e9-bb0d-6a153156bd9c',
    predicate: 'reported_retailer',
    objectKind: 'retailer',
    objectRef: 'retailer:teeka4',
    confidenceState: 'community_reported',
    metadata: { label: 'Teeka4' },
    createdAt: '2026-07-22T22:45:06.798Z',
    ...overrides,
  };
}

test('a current product-store relationship reads as a human claim, not an anonymous UUID triple', () => {
  const item = edgeReviewItem(edgeRecord());

  assert.equal(item.title, 'CeraVe Foaming Facial Cleanser');
  assert.equal(
    item.sentence,
    'CeraVe Foaming Facial Cleanser — bought from — Teeka4',
  );
  assert.equal(item.family, 'stores');
  assert.equal(item.relationshipLabel, 'Bought from');
  assert.equal(item.subject.label, 'CeraVe Foaming Facial Cleanser');
  assert.equal(item.object.label, 'Teeka4');
  assert.equal(item.object.matchState, 'linked');
  assert.equal(item.contribution.sourceLabel, 'Community');
  assert.equal(item.contribution.confidenceLabel, 'Community reported');
  assert.ok(item.image);

  const primaryCopy = [
    item.title,
    item.summary,
    item.sentence,
    item.relationshipLabel,
    item.subject.label,
    item.object.label,
  ].join(' ');
  assert.doesNotMatch(primaryCopy, /29a7f5bb|reported_retailer|anonymous_contribution|knowledge edge/i);
});

test('a current product-price relationship formats the value and keeps its observation decision separate', () => {
  const item = edgeReviewItem(edgeRecord({
    subjectKind: 'product',
    subjectRef: 'product:cerave-foaming-facial-cleanser',
    predicate: 'reported_price',
    objectKind: 'amount_ngn',
    objectRef: '17500',
    metadata: { purchaseDate: '2026-07-02' },
  }));

  assert.equal(item.title, 'CeraVe Foaming Facial Cleanser');
  assert.equal(item.relationshipLabel, 'Reported price');
  assert.equal(item.object.label, '₦17,500');
  assert.equal(item.reportedValue, '₦17,500');
  assert.equal(item.reportedDate, '2 Jul 2026');
  assert.deepEqual(item.linkedConsequences, [{
    kind: 'separate_observation',
    label: 'Price report stays separate',
    detail: 'This decision does not approve the related price report.',
  }]);
});

test('custom submitted values stay legible and explicitly retain their matching work', () => {
  const item = edgeReviewItem(edgeRecord({
    contributionPayload: {
      kind: 'product',
      products: [{
        id: 'product:face-facts-wonder-cream-fragrance-free',
        label: 'Wonder Cream Fragrance Free',
        source: 'canonical',
      }],
      brands: [{
        id: 'brand:face-facts',
        label: 'FACE FACTS',
        source: 'canonical',
      }],
      retailers: [{
        id: 'custom:sérénité beauty',
        label: 'Sérénité beauty',
        source: 'custom',
      }],
      purposes: [],
    },
    subjectRef: 'e1b8342a-0bed-4e11-966e-92a3957b6a35',
    objectRef: 'custom:sérénité beauty',
    metadata: { label: 'Sérénité beauty' },
  }));

  assert.equal(item.title, 'FACE FACTS Wonder Cream Fragrance Free');
  assert.equal(item.object.label, 'Sérénité beauty');
  assert.equal(item.matchingState, 'needs_matching');
  assert.equal(item.matchingLabel, 'Needs matching');
  assert.deepEqual(item.linkedConsequences, [{
    kind: 'vocabulary_matching',
    label: 'Name still needs matching',
    detail: 'This decision does not add the submitted name to the catalogue.',
  }]);
  assert.ok(item.image);
});

test('routine relationships use the parent contribution to name the real routine context', () => {
  const item = edgeReviewItem(edgeRecord({
    contributionKind: 'routine',
    contributionPayload: {
      kind: 'routine',
      products: [{
        id: 'product:anua-niacinamide-10-txa-4-serum',
        label: 'Niacinamide 10% + TXA 4% Serum',
        source: 'canonical',
      }],
      brands: [],
      retailers: [],
      purposes: [{
        id: 'purpose:dry-skin',
        label: 'Dry skin',
        source: 'canonical',
      }],
    },
    subjectRef: 'd621e3a8-0609-41ad-8227-9ccbf07e58f5',
    predicate: 'included_product',
    objectKind: 'product',
    objectRef: 'product:anua-niacinamide-10-txa-4-serum',
    metadata: { label: 'Niacinamide 10% + TXA 4% Serum' },
  }));

  assert.equal(item.title, 'Routine with ANUA Niacinamide 10% + TXA 4% Serum');
  assert.equal(
    item.sentence,
    'Routine with ANUA Niacinamide 10% + TXA 4% Serum — includes — ANUA Niacinamide 10% + TXA 4% Serum',
  );
  assert.equal(item.contribution.kindLabel, 'Routine contribution');
  assert.equal(item.family, 'products');
  assert.ok(item.image);
});

test('an exact published product reference keeps its approved image even when parent context is incomplete', () => {
  const item = edgeReviewItem(edgeRecord({
    contributionPayload: {
      kind: 'product',
      products: [],
      brands: [],
      retailers: [],
      purposes: [],
    },
    subjectKind: 'product',
    subjectRef: 'product:cerave-foaming-facial-cleanser',
    predicate: 'reported_price',
    objectKind: 'amount_ngn',
    objectRef: '17500',
    metadata: {},
  }));

  assert.equal(item.title, 'CeraVe Foaming Facial Cleanser');
  assert.equal(item.subject.matchState, 'linked');
  assert.ok(item.image);
});

test('a current store contribution uses the submitted store as its human subject', () => {
  const item = edgeReviewItem(edgeRecord({
    contributionKind: 'store',
    contributionPayload: {
      kind: 'store',
      products: [],
      brands: [],
      retailers: [{
        id: 'retailer:lux-beauty',
        label: 'Lux Beauty',
        source: 'canonical',
      }],
      purposes: [{
        id: 'purpose:dark-spots',
        label: 'Dark spots',
        source: 'canonical',
      }],
    },
    subjectRef: 'abb0eb59-3372-4d94-a97e-40918aa4e08e',
    predicate: 'reported_for',
    objectKind: 'purpose',
    objectRef: 'purpose:dark-spots',
    metadata: { label: 'Dark spots' },
  }));

  assert.equal(item.title, 'Lux Beauty');
  assert.equal(item.sentence, 'Lux Beauty — used for — Dark spots');
  assert.equal(item.contribution.kindLabel, 'Store contribution');
  assert.doesNotMatch(item.sentence, /abb0eb59|anonymous contribution/i);
});

test('all seven live relationship families use human labels instead of stored predicate names', () => {
  const cases: Array<{
    predicate: string;
    objectKind: string;
    objectRef: string;
    metadata: Record<string, unknown>;
    expectedFamily: string;
    expectedLabel: string;
  }> = [
    {
      predicate: 'reported_for',
      objectKind: 'purpose',
      objectRef: 'purpose:oily-skin',
      metadata: { label: 'Oily skin' },
      expectedFamily: 'uses',
      expectedLabel: 'Used for',
    },
    {
      predicate: 'reported_product',
      objectKind: 'product',
      objectRef: 'product:cerave-foaming-facial-cleanser',
      metadata: { label: 'Foaming Facial Cleanser' },
      expectedFamily: 'products',
      expectedLabel: 'Product named',
    },
    {
      predicate: 'reported_brand',
      objectKind: 'brand',
      objectRef: 'brand:cerave',
      metadata: { label: 'CeraVe' },
      expectedFamily: 'brands',
      expectedLabel: 'Brand named',
    },
    {
      predicate: 'reported_retailer',
      objectKind: 'retailer',
      objectRef: 'retailer:teeka4',
      metadata: { label: 'Teeka4' },
      expectedFamily: 'stores',
      expectedLabel: 'Bought from',
    },
    {
      predicate: 'reported_outcome',
      objectKind: 'experience',
      objectRef: 'love-it',
      metadata: {},
      expectedFamily: 'experiences',
      expectedLabel: 'Reported result',
    },
    {
      predicate: 'reported_price',
      objectKind: 'amount_ngn',
      objectRef: '17500',
      metadata: {},
      expectedFamily: 'prices',
      expectedLabel: 'Reported price',
    },
    {
      predicate: 'included_product',
      objectKind: 'product',
      objectRef: 'product:cerave-foaming-facial-cleanser',
      metadata: { label: 'Foaming Facial Cleanser' },
      expectedFamily: 'products',
      expectedLabel: 'Includes',
    },
  ];

  for (const example of cases) {
    const item = edgeReviewItem(edgeRecord(example));
    assert.equal(item.family, example.expectedFamily);
    assert.equal(item.relationshipLabel, example.expectedLabel);
    assert.doesNotMatch(item.sentence, new RegExp(example.predicate));
  }
});

test('malformed and unknown relationship data fails closed without inventing trust', () => {
  const malformedPayload = {
    products: [{ id: 42, label: 'Wrong shape', source: 'canonical' }],
    brands: 'not-an-array',
    retailers: [null],
    purposes: {},
  };
  const item = edgeReviewItem(edgeRecord({
    contributionPayload: malformedPayload,
    subjectRef: 'not-the-contribution-id',
    predicate: 'clinically_verified_for',
    objectKind: 'mystery',
    objectRef: 'raw:secret-value',
    confidenceState: 'verified',
    metadata: {},
  }));

  assert.equal(item.title, 'Product contribution');
  assert.equal(item.relationshipLabel, 'Relationship needs review');
  assert.equal(item.object.label, 'Value needs review');
  assert.equal(item.matchingState, 'unresolved');
  assert.equal(item.contribution.confidenceLabel, 'Confidence not recorded');
  assert.equal(item.image, null);

  const primaryProjection = JSON.stringify({
    title: item.title,
    summary: item.summary,
    sentence: item.sentence,
    relationshipLabel: item.relationshipLabel,
    contribution: item.contribution,
  });
  assert.doesNotMatch(primaryProjection, /clinically_verified_for|raw:secret-value|not-the-contribution-id/);
  assert.doesNotMatch(primaryProjection, /\bverified\b|\btrusted\b|\bsafe\b/i);

  assert.deepEqual(item.metadata.raw, {
    contributionKind: 'product',
    contributionPayload: malformedPayload,
    subjectKind: 'anonymous_contribution',
    subjectRef: 'not-the-contribution-id',
    relationship: 'clinically_verified_for',
    objectKind: 'mystery',
    objectRef: 'raw:secret-value',
    confidenceState: 'verified',
    metadata: {},
  });
});

test('the decision copy preserves the canonical-write boundary', () => {
  const item = edgeReviewItem(edgeRecord());

  assert.deepEqual(item.decisionScope, {
    approve: 'Approve this relationship only.',
    reject: 'Reject this relationship only.',
    boundary: 'This accepts the connection only. It does not verify a product, store, price or result.',
  });
  assert.doesNotMatch(JSON.stringify(item.decisionScope), /product approved|retailer verified|clinically safe/i);
});

test('the pending relationship queue projects parent context and remains oldest-first', async () => {
  const source = await readFile(
    path.join(process.cwd(), 'lib/moderation/queues.ts'),
    'utf8',
  );
  const pendingEdges = source.slice(
    source.indexOf('export async function listPendingEdges'),
    source.indexOf('export type PendingModerationValue'),
  );

  assert.match(pendingEdges, /contribution\.contribution_kind/);
  assert.match(pendingEdges, /contribution\.payload as contribution_payload/);
  assert.match(pendingEdges, /edge\.confidence_state/);
  assert.match(pendingEdges, /order by edge\.created_at asc/);
  assert.doesNotMatch(pendingEdges, /order by edge\.created_at desc/);
});
