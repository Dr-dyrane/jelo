import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGlobalResearchSchedule,
  type CommunityResearchPriorityTask,
  type StaticResearchPriority,
} from '@/lib/catalogue/global-research-scheduler';

function community(overrides: Partial<CommunityResearchPriorityTask> = {}): CommunityResearchPriorityTask {
  return {
    taskKind: 'product-identity',
    entityKind: 'product',
    entityRef: 'custom:example-cleanser',
    entityLabel: 'Example Cleanser',
    entitySource: 'custom',
    signalCount: 1,
    lastSeenAt: '2026-07-24T10:00:00.000Z',
    status: 'pending',
    publicationStatus: 'private-research-only',
    ...overrides,
  };
}

function staticTask(overrides: Partial<StaticResearchPriority> = {}): StaticResearchPriority {
  return {
    rank: 1,
    discoveryId: 'static-example',
    title: 'Static Cleanser',
    brandHint: 'Static Brand',
    size: '200 ml',
    lane: 'gentle-cleansing',
    priorityScore: 180,
    nextAction: 'confirm-official-manufacturer-identity',
    publicationStatus: 'private-research-only',
    ...overrides,
  };
}

test('community tasks lead by signal count, then recency, before static priorities', () => {
  const schedule = buildGlobalResearchSchedule([
    community({ entityRef: 'custom:older', entityLabel: 'Older', signalCount: 2, lastSeenAt: '2026-07-20T10:00:00.000Z' }),
    community({ entityRef: 'custom:newer', entityLabel: 'Newer', signalCount: 2, lastSeenAt: '2026-07-24T10:00:00.000Z' }),
    community({ entityRef: 'custom:more-signals', entityLabel: 'More signals', signalCount: 3 }),
  ], [staticTask(), staticTask({ rank: 2, discoveryId: 'static-second', title: 'Second static' })]);

  assert.deepEqual(schedule.items.map(item => item.source), ['community', 'community', 'community', 'static', 'static']);
  assert.deepEqual(schedule.items.slice(0, 3).map(item => item.source === 'community' && item.task.entityRef), [
    'custom:more-signals', 'custom:newer', 'custom:older',
  ]);
  assert.deepEqual(schedule.items.map(item => item.rank), [1, 2, 3, 4, 5]);
  assert.equal(schedule.items.every(item => item.publicationStatus === 'private-research-only'), true);
});

test('deduplicates canonical product slugs before static work', () => {
  const schedule = buildGlobalResearchSchedule([
    community({
      taskKind: 'product-retail-refresh',
      entityRef: 'product:cosrx-salicylic-acid-daily-gentle-cleanser',
      entitySource: 'canonical',
      identity: { canonicalSlug: 'cosrx-salicylic-acid-daily-gentle-cleanser' },
    }),
  ], [staticTask({
    canonicalSlug: 'cosrx-salicylic-acid-daily-gentle-cleanser',
    discoveryId: 'duplicate-static',
  })]);

  assert.equal(schedule.items.length, 1);
  assert.equal(schedule.generatedFrom.deduplicatedStaticTaskCount, 1);
});

test('deduplicates only an exact normalized brand, name, and size identity', () => {
  const schedule = buildGlobalResearchSchedule([
    community({
      identity: { brand: 'CeraVe', name: 'Foaming Facial Cleanser', size: '473 ML' },
      entityLabel: 'Foaming Facial Cleanser',
    }),
    community({
      entityRef: 'custom:cerave-smaller',
      entityLabel: 'Foaming Facial Cleanser',
      identity: { brand: 'CeraVe', name: 'Foaming Facial Cleanser', size: '236 ml' },
    }),
  ], [staticTask({
    brandHint: 'CERAVE',
    title: 'Foaming Facial Cleanser',
    size: '473 ml',
  })]);

  assert.equal(schedule.items.length, 2);
  assert.equal(schedule.generatedFrom.deduplicatedStaticTaskCount, 1);
  assert.equal(schedule.items[1]?.source, 'community');
});

test('refuses a non-private research task rather than turning it into a publish candidate', () => {
  assert.throws(() => buildGlobalResearchSchedule([
    community({ publicationStatus: 'public-catalogue' as never }),
  ], []), /private-research-only/);
});
