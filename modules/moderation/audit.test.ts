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
  });
  assert.deepEqual(row, {
    operatorSubject: 'neon-auth|op-1',
    queue: 'community_observation',
    action: 'promote',
    targetRef: 'obs-123',
    canonicalWrite: true,
    rationale: 'Matches an existing exact offer.',
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
