import assert from 'node:assert/strict';
import test from 'node:test';
import { buildModerationAuditRow, moderationActionSchema } from '@/lib/moderation/schema';

test('a valid promotion normalizes to an audit row', () => {
  const row = buildModerationAuditRow({
    operatorSubject: 'neon-auth|op-1',
    queue: 'community_observation',
    action: 'promote',
    targetRef: 'obs-123',
    canonicalWrite: true,
    rationale: 'Matches an existing exact offer.',
    metadata: {},
  });
  assert.deepEqual(row, {
    operatorSubject: 'neon-auth|op-1',
    queue: 'community_observation',
    action: 'promote',
    targetRef: 'obs-123',
    canonicalWrite: true,
    rationale: 'Matches an existing exact offer.',
    metadata: {},
  });
});

test('a read-only action defaults to no canonical write and no rationale', () => {
  const parsed = moderationActionSchema.parse({
    operatorSubject: 'neon-auth|op-1',
    queue: 'retailer_application',
    action: 'claim',
    targetRef: 'app-9',
  });
  assert.equal(parsed.canonicalWrite, false);
  assert.equal(parsed.rationale, null);
  assert.deepEqual(parsed.metadata, {});
});

test('mapping and reconciliation are explicit audit actions', () => {
  assert.equal(moderationActionSchema.parse({
    operatorSubject: 'op',
    queue: 'community_moderation_value',
    action: 'map',
    targetRef: 'value-1',
    metadata: { canonicalEntityRef: 'keratosis-pilaris' },
  }).action, 'map');
  assert.equal(moderationActionSchema.parse({
    operatorSubject: 'op',
    queue: 'community_research_task',
    action: 'reconcile',
    targetRef: 'active-signal-counts',
    metadata: { reconciledTaskCount: 2 },
  }).action, 'reconcile');
  assert.equal(moderationActionSchema.parse({
    operatorSubject: 'op',
    queue: 'community_research_task',
    action: 'retry',
    targetRef: 'task-1',
    rationale: 'Try the exact source again.',
  }).action, 'retry');
  assert.equal(moderationActionSchema.parse({
    operatorSubject: 'op',
    queue: 'community_research_task',
    action: 'assign',
    targetRef: 'task-1',
    rationale: 'Assign to the product evidence specialist.',
    metadata: { previousOwnerId: null, newOwnerId: 'operator-2' },
  }).action, 'assign');
  assert.equal(moderationActionSchema.parse({
    operatorSubject: 'op',
    queue: 'community_research_task',
    action: 'unassign',
    targetRef: 'task-1',
    rationale: 'Return this work to the shared queue.',
  }).action, 'unassign');
});

test('unknown actions, queues, and extra fields are rejected', () => {
  assert.throws(() => moderationActionSchema.parse({
    operatorSubject: 'op', queue: 'community_observation', action: 'delete', targetRef: 'x',
  }));
  assert.throws(() => moderationActionSchema.parse({
    operatorSubject: 'op', queue: 'unknown_queue', action: 'note', targetRef: 'x',
  }));
  assert.throws(() => moderationActionSchema.parse({
    operatorSubject: 'op', queue: 'community_observation', action: 'note', targetRef: 'x', escalate: true,
  }));
});
