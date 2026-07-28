import assert from 'node:assert/strict';
import test from 'node:test';
import { createConsultTimelineRecord } from './consult-timeline';

test('consult timeline exposes only session-safe comparison fields', () => {
  const record = createConsultTimelineRecord({
    concernSlugs: ['dry-dehydrated-skin'],
    market: 'NG',
    recommendedProductSlugs: ['cerave-pm-facial-moisturising-lotion-52ml'],
    createdAt: '2026-07-27T10:00:00.000Z',
  });

  assert.equal(record.schemaVersion, 2);
  assert.equal(record.followUpAt, '2026-08-24T10:00:00.000Z');
  assert.deepEqual(Object.keys(record).sort(), [
    'assessmentType',
    'concernSlugs',
    'createdAt',
    'followUpAt',
    'id',
    'market',
    'recommendedProductSlugs',
    'schemaVersion',
  ]);
});

test('consult timeline cannot encode inferred clinical state or trend', () => {
  const record = createConsultTimelineRecord({
    concernSlugs: ['dry-dehydrated-skin', 'dry-dehydrated-skin'],
    market: 'NG',
    recommendedProductSlugs: ['cerave-pm-facial-moisturising-lotion-52ml'],
    createdAt: '2026-07-27T10:00:00.000Z',
  });
  const serialized = JSON.stringify(record);

  assert.deepEqual(record.concernSlugs, ['dry-dehydrated-skin']);
  assert.doesNotMatch(serialized, /barrier|improving|worsening|stable|clinical/i);
});
