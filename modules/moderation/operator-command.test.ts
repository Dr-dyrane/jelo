import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOperatorCommand } from '@/lib/moderation/operator-command';

const targetId = '6b1629ce-b151-4ed6-b91d-b985a6d725d8';

test('operator inspection is read-only by default', () => {
  assert.deepEqual(parseOperatorCommand([]), {
    action: 'inspect',
    apply: false,
    json: false,
  });
  assert.throws(() => parseOperatorCommand(['--apply']), /not valid for a read-only inspection/);
});

test('a decision is a dry-run unless apply is explicit', () => {
  const base = [
    '--action', 'reject',
    '--queue', 'community_contribution',
    '--target-id', targetId,
    '--rationale', 'Duplicate test submission.',
  ];
  assert.deepEqual(parseOperatorCommand(base), {
    action: 'reject',
    queue: 'community_contribution',
    targetId,
    rationale: 'Duplicate test submission.',
    apply: false,
    json: false,
  });
  assert.equal(parseOperatorCommand([...base, '--apply']).apply, true);
});

test('every consequential command requires an audit rationale', () => {
  assert.throws(() => parseOperatorCommand([
    '--action', 'approve',
    '--queue', 'community_observation',
    '--target-id', targetId,
  ]), /rationale is required/);
  assert.throws(() => parseOperatorCommand([
    '--action', 'reconcile',
  ]), /rationale is required/);
});

test('mapping is explicit, slug-only, and limited to the vocabulary queue', () => {
  assert.deepEqual(parseOperatorCommand([
    '--action', 'map',
    '--queue', 'community_moderation_value',
    '--target-id', targetId,
    '--canonical-kind', 'purpose',
    '--canonical-ref', 'keratosis-pilaris',
    '--rationale', 'Common-language alias for the existing concern.',
  ]), {
    action: 'map',
    queue: 'community_moderation_value',
    targetId,
    canonicalEntityKind: 'purpose',
    canonicalEntityRef: 'keratosis-pilaris',
    rationale: 'Common-language alias for the existing concern.',
    apply: false,
    json: false,
  });
  assert.throws(() => parseOperatorCommand([
    '--action', 'map',
    '--queue', 'community_contribution',
    '--target-id', targetId,
    '--canonical-kind', 'purpose',
    '--canonical-ref', 'keratosis-pilaris',
    '--rationale', 'Wrong queue.',
  ]), /only for community_moderation_value/);
  assert.throws(() => parseOperatorCommand([
    '--action', 'map',
    '--queue', 'community_moderation_value',
    '--target-id', targetId,
    '--canonical-kind', 'purpose',
    '--canonical-ref', 'Keratosis Pilaris',
    '--rationale', 'Not a canonical slug.',
  ]), /canonical slug/);
});

test('an admin correction names the observation disposition explicitly', () => {
  assert.deepEqual(parseOperatorCommand([
    '--action', 'correct',
    '--queue', 'community_observation',
    '--target-id', targetId,
    '--disposition', 'defer',
    '--rationale', 'Exact product identity still needs review.',
    '--apply',
  ]), {
    action: 'correct',
    queue: 'community_observation',
    targetId,
    disposition: 'defer',
    rationale: 'Exact product identity still needs review.',
    apply: true,
    json: false,
  });
  assert.throws(() => parseOperatorCommand([
    '--action', 'correct',
    '--queue', 'community_edge',
    '--target-id', targetId,
    '--disposition', 'reject',
    '--rationale', 'Wrong queue.',
  ]), /only for community_observation/);
});

test('retry is an attributable research-only transition', () => {
  assert.deepEqual(parseOperatorCommand([
    '--action', 'retry',
    '--queue', 'community_research_task',
    '--target-id', targetId,
    '--rationale', 'Check the recovered retailer page once more.',
  ]), {
    action: 'retry',
    queue: 'community_research_task',
    targetId,
    rationale: 'Check the recovered retailer page once more.',
    apply: false,
    json: false,
  });
  assert.throws(() => parseOperatorCommand([
    '--action', 'retry',
    '--queue', 'community_observation',
    '--target-id', targetId,
    '--rationale', 'Wrong queue.',
  ]), /only for community_research_task/);
});

test('unknown and action-incompatible flags are rejected', () => {
  assert.throws(() => parseOperatorCommand(['--payload', 'raw']), /Unknown flag/);
  assert.throws(() => parseOperatorCommand([
    '--action', 'note',
    '--queue', 'community_edge',
    '--target-id', targetId,
    '--rationale', 'Needs source review.',
    '--canonical-ref', 'not-applicable',
  ]), /not valid for this action/);
});
