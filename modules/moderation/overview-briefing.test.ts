import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOverviewBriefing, OVERVIEW_QUEUE_ORDER, type OverviewQueueFact } from '@/app/(ops)/ops/overview-briefing';

const generatedAt = '2026-07-25T12:00:00.000Z';

function queueFacts(overrides: Partial<Record<OverviewQueueFact['kind'], Partial<OverviewQueueFact>>> = {}): OverviewQueueFact[] {
  return OVERVIEW_QUEUE_ORDER.map(kind => ({
    kind,
    pendingCount: 0,
    oldestPendingAt: null,
    ...overrides[kind],
  }));
}

test('overview total is the sum of its visible queue topology', () => {
  const briefing = buildOverviewBriefing({
    queueFacts: queueFacts({ contributions: { pendingCount: 2 }, observations: { pendingCount: 3 } }),
    actionableQueueKinds: OVERVIEW_QUEUE_ORDER,
    generatedAt,
  });

  assert.equal(briefing.pendingTotal, 5);
  assert.equal(briefing.queues.reduce((total, queue) => total + queue.pendingCount, 0), 5);
});

test('overview recommends the oldest actionable pending queue with a human reason', () => {
  const briefing = buildOverviewBriefing({
    queueFacts: queueFacts({
      observations: { pendingCount: 4, oldestPendingAt: '2026-07-24T12:00:00.000Z' },
      edges: { pendingCount: 1, oldestPendingAt: '2026-07-23T12:00:00.000Z' },
    }),
    actionableQueueKinds: OVERVIEW_QUEUE_ORDER,
    generatedAt,
  });

  assert.deepEqual(briefing.nextAction, {
    queueKind: 'edges',
    href: '/ops/edges',
    label: 'Knowledge edges',
    reasonCode: 'oldest-actionable-pending',
    reasonText: 'Oldest item waiting',
  });
});

test('overview uses topology order as its stable equal-timestamp tie-break', () => {
  const briefing = buildOverviewBriefing({
    queueFacts: queueFacts({
      edges: { pendingCount: 1, oldestPendingAt: '2026-07-22T12:00:00.000Z' },
      observations: { pendingCount: 1, oldestPendingAt: '2026-07-22T12:00:00.000Z' },
    }),
    actionableQueueKinds: OVERVIEW_QUEUE_ORDER,
    generatedAt,
  });

  assert.equal(briefing.nextAction?.queueKind, 'edges');
});

test('permissions exclude unavailable decisions from the recommendation but retain viewable topology', () => {
  const briefing = buildOverviewBriefing({
    queueFacts: queueFacts({
      contributions: { pendingCount: 1, oldestPendingAt: '2026-07-20T12:00:00.000Z' },
      observations: { pendingCount: 1, oldestPendingAt: '2026-07-21T12:00:00.000Z' },
    }),
    actionableQueueKinds: ['edges', 'observations'],
    generatedAt,
  });

  assert.equal(briefing.nextAction?.queueKind, 'observations');
  assert.equal(briefing.queues.find(queue => queue.kind === 'contributions')?.operatorCanAct, false);
  assert.equal(briefing.queues.find(queue => queue.kind === 'contributions')?.href, '/ops/contributions');
});

test('zero queues remain linked topology and clear queues have no recommendation', () => {
  const briefing = buildOverviewBriefing({ queueFacts: queueFacts(), actionableQueueKinds: OVERVIEW_QUEUE_ORDER, generatedAt });

  assert.equal(briefing.pendingTotal, 0);
  assert.equal(briefing.nextAction, null);
  assert.deepEqual(briefing.queues.map(queue => [queue.kind, queue.pendingCount, queue.href]), [
    ['contributions', 0, '/ops/contributions'],
    ['edges', 0, '/ops/edges'],
    ['observations', 0, '/ops/observations'],
    ['vocabulary', 0, '/ops/vocabulary'],
    ['retailers', 0, '/ops/retailers'],
  ]);
});

test('recent audit activity is a compact five-entry projection', () => {
  const briefing = buildOverviewBriefing({
    queueFacts: queueFacts(),
    actionableQueueKinds: OVERVIEW_QUEUE_ORDER,
    generatedAt,
    recentDecisions: Array.from({ length: 6 }, (_, index) => ({
      id: `decision-${index}`,
      operatorName: 'Maya',
      action: 'approve' as const,
      queue: 'community_observation' as const,
      createdAt: `2026-07-25T12:0${index}:00.000Z`,
    })),
  });

  assert.equal(briefing.recentDecisions.length, 5);
  assert.equal(briefing.recentDecisions[0]?.description, 'Approved observation');
  assert.equal(briefing.recentDecisions[0]?.queueKind, 'observations');
});
