import assert from 'node:assert/strict';
import test from 'node:test';
import { decisionInputSchema, mapValueInputSchema, noteInputSchema } from '@/lib/moderation/action-input';

const uuid = '11111111-1111-4111-8111-111111111111';

test('a decision requires a uuid target and a valid decision', () => {
  const parsed = decisionInputSchema.parse({ targetId: uuid, decision: 'approve' });
  assert.equal(parsed.rationale, null);
  assert.throws(() => decisionInputSchema.parse({ targetId: 'not-a-uuid', decision: 'approve' }));
  assert.throws(() => decisionInputSchema.parse({ targetId: uuid, decision: 'promote' }));
  assert.throws(() => decisionInputSchema.parse({ targetId: uuid, decision: 'approve', extra: 1 }));
});

test('mapping a value requires the canonical target', () => {
  const parsed = mapValueInputSchema.parse({ targetId: uuid, canonicalEntityKind: 'brand', canonicalEntityRef: 'cosrx' });
  assert.equal(parsed.canonicalEntityRef, 'cosrx');
  assert.throws(() => mapValueInputSchema.parse({ targetId: uuid, canonicalEntityKind: 'unknown', canonicalEntityRef: 'x' }));
  assert.throws(() => mapValueInputSchema.parse({ targetId: uuid, canonicalEntityKind: 'brand' }));
  assert.throws(() => mapValueInputSchema.parse({ targetId: uuid, canonicalEntityKind: 'brand', canonicalEntityRef: 'brand:cosrx' }));
});

test('a note requires non-empty text and defaults its action', () => {
  const parsed = noteInputSchema.parse({ targetId: uuid, rationale: 'Needs a second look.' });
  assert.equal(parsed.action, 'note');
  assert.throws(() => noteInputSchema.parse({ targetId: uuid, rationale: '' }));
  assert.throws(() => noteInputSchema.parse({ targetId: uuid, action: 'approve', rationale: 'x' }));
});
