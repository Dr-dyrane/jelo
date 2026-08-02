import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  canonicalResearchEntitySlug,
  researchTaskShapeIsValid,
} from '@/lib/community-intake/research-reference';
import { planResearchAssignmentTransition } from '@/lib/moderation/database-transitions';

const root = process.cwd();

function sourceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Expected to find ${start}`);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `Expected to find ${end} after ${start}`);
  return source.slice(startIndex, endIndex);
}

test('a new mention preserves assigned, blocked, and retry research workflow state', async () => {
  const [repository, migration] = await Promise.all([
    readFile(path.join(root, 'lib/community-intake/repository.ts'), 'utf8'),
    readFile(path.join(root, 'db/migrations/0030_community_research_workflow.sql'), 'utf8'),
  ]);
  const mentionUpdate = sourceBetween(
    repository,
    'if (mention) {',
    '    await transaction`\n      update community_intake_drafts',
  );

  assert.match(mentionUpdate, /signal_count = signal_count \+ 1/);
  assert.match(mentionUpdate, /last_seen_at = now\(\)/);
  assert.doesNotMatch(mentionUpdate, /\bstatus\s*=/);
  assert.doesNotMatch(mentionUpdate, /assigned_operator_id|work_state|next_action|last_reviewed_at/);

  assert.match(migration, /work_state in \('assigned', 'blocked', 'retry'\)/);
  assert.match(migration, /status = 'in-progress'/);

  const states = ['assigned', 'blocked', 'retry'].map(workState => ({
    status: 'in-progress',
    workState,
    assignedOperatorId: 'operator-1',
    nextAction: `${workState} next action`,
    signalCount: 2,
  }));
  for (const before of states) {
    const after = { ...before, signalCount: before.signalCount + 1 };
    assert.deepEqual(
      {
        status: after.status,
        workState: after.workState,
        assignedOperatorId: after.assignedOperatorId,
        nextAction: after.nextAction,
      },
      {
        status: before.status,
        workState: before.workState,
        assignedOperatorId: before.assignedOperatorId,
        nextAction: before.nextAction,
      },
    );
  }
});

test('a repeated task upsert cannot reopen or clear workflow ownership', async () => {
  const repository = await readFile(
    path.join(root, 'lib/community-intake/repository.ts'),
    'utf8',
  );
  const taskUpsert = sourceBetween(
    repository,
    'insert into community_research_tasks (',
    '      const [mention]',
  );

  assert.match(taskUpsert, /on conflict \(task_kind, entity_ref\) do update/);
  assert.doesNotMatch(taskUpsert, /\bstatus\s*=/);
  assert.doesNotMatch(taskUpsert, /assigned_operator_id|work_state|next_action|last_reviewed_at/);
});

test('canonical research references accept only the exact expected namespace and slug grammar', () => {
  assert.equal(canonicalResearchEntitySlug('product', 'product:known-product'), 'known-product');
  assert.equal(canonicalResearchEntitySlug('retailer', 'retailer:known-store'), 'known-store');
  for (const ref of [
    'known-product',
    'retailer:known-product',
    'product:',
    'product:nested:slug',
    'product:Uppercase',
    'product:bad_slug',
  ]) {
    assert.equal(canonicalResearchEntitySlug('product', ref), null, ref);
  }
});

test('research tasks allow only the four authoritative kind, source, and namespace shapes', async () => {
  const valid = [
    ['product-identity', 'product', 'custom', 'custom:Toner: sensitive – 50 ml'],
    ['product-retail-refresh', 'product', 'canonical', 'product:known-product'],
    ['retailer-identity', 'retailer', 'custom', 'custom:neighbourhood store'],
    ['retailer-refresh', 'retailer', 'canonical', 'retailer:known-store'],
  ] as const;
  valid.forEach(([taskKind, entityKind, entitySource, entityRef]) => {
    assert.equal(researchTaskShapeIsValid({ taskKind, entityKind, entitySource, entityRef }), true);
  });
  assert.equal(researchTaskShapeIsValid({
    taskKind: 'product-retail-refresh',
    entityKind: 'product',
    entitySource: 'canonical',
    entityRef: 'retailer:wrong-namespace',
  }), false);
  assert.equal(researchTaskShapeIsValid({
    taskKind: 'retailer-identity',
    entityKind: 'retailer',
    entitySource: 'custom',
    entityRef: 'retailer:wrong-namespace',
  }), false);

  const migration = await readFile(
    path.join(root, 'db/migrations/0031_community_research_task_shape.sql'),
    'utf8',
  );
  assert.match(migration, /community_research_tasks_shape_check/);
  for (const prefix of ['custom:', 'product:', 'retailer:']) assert.match(migration, new RegExp(prefix));
});

test('research ownership transitions enforce current ownership, admin takeover, retry, and terminal immutability', () => {
  const operator = { id: 'operator-1', role: 'operator' as const };
  assert.deepEqual(planResearchAssignmentTransition({
    action: 'claim',
    operator,
    task: { status: 'pending', workState: 'ready', assignedOperatorId: null, signalCount: 1 },
  }), {
    status: 'in-progress',
    workState: 'assigned',
    takeover: false,
    assignmentOperation: 'claim',
    previousOwnerId: null,
    previousWorkState: 'ready',
    newOwnerId: 'operator-1',
  });
  assert.equal(planResearchAssignmentTransition({
    action: 'defer',
    operator,
    task: { status: 'in-progress', workState: 'assigned', assignedOperatorId: 'operator-1', signalCount: 1 },
  }).workState, 'blocked');
  assert.equal(planResearchAssignmentTransition({
    action: 'retry',
    operator,
    task: { status: 'in-progress', workState: 'blocked', assignedOperatorId: 'operator-1', signalCount: 1 },
  }).workState, 'retry');

  assert.throws(() => planResearchAssignmentTransition({
    action: 'claim',
    operator,
    task: { status: 'in-progress', workState: 'assigned', assignedOperatorId: 'operator-2', signalCount: 1 },
  }), /owned by another/);
  assert.throws(() => planResearchAssignmentTransition({
    action: 'claim',
    operator: { id: 'moderator-1', role: 'moderator' },
    task: { status: 'pending', workState: 'ready', assignedOperatorId: null, signalCount: 1 },
  }), /operator or admin/);
  assert.throws(() => planResearchAssignmentTransition({
    action: 'claim',
    operator,
    task: { status: 'in-progress', workState: 'assigned', assignedOperatorId: 'operator-2', signalCount: 1 },
    allowTakeover: true,
  }), /Only an admin/);
  assert.deepEqual(planResearchAssignmentTransition({
    action: 'claim',
    operator: { id: 'admin-1', role: 'admin' },
    task: { status: 'in-progress', workState: 'blocked', assignedOperatorId: 'operator-2', signalCount: 1 },
    allowTakeover: true,
  }), {
    status: 'in-progress',
    workState: 'assigned',
    takeover: true,
    assignmentOperation: 'takeover',
    previousOwnerId: 'operator-2',
    previousWorkState: 'blocked',
    newOwnerId: 'admin-1',
  });
  assert.throws(() => planResearchAssignmentTransition({
    action: 'claim',
    operator: { id: 'admin-1', role: 'admin' },
    task: { status: 'pending', workState: 'ready', assignedOperatorId: null, signalCount: 1 },
    allowTakeover: true,
  }), /requires work owned by another/);
  assert.throws(() => planResearchAssignmentTransition({
    action: 'claim',
    operator,
    task: { status: 'completed', workState: 'ready', assignedOperatorId: null, signalCount: 1 },
  }), /terminal/);
  assert.throws(() => planResearchAssignmentTransition({
    action: 'claim',
    operator,
    task: { status: 'pending', workState: 'ready', assignedOperatorId: null, signalCount: 0 },
  }), /without an active report/);

  assert.deepEqual(planResearchAssignmentTransition({
    action: 'assign',
    operator: { id: 'admin-1', role: 'admin' },
    targetOperator: { id: 'operator-2', role: 'operator' },
    task: { status: 'pending', workState: 'ready', assignedOperatorId: null, signalCount: 1 },
  }), {
    status: 'in-progress',
    workState: 'assigned',
    takeover: false,
    assignmentOperation: 'assign',
    previousOwnerId: null,
    previousWorkState: 'ready',
    newOwnerId: 'operator-2',
  });
  assert.deepEqual(planResearchAssignmentTransition({
    action: 'unassign',
    operator: { id: 'admin-1', role: 'admin' },
    task: {
      status: 'in-progress',
      workState: 'blocked',
      assignedOperatorId: 'operator-2',
      signalCount: 1,
    },
  }), {
    status: 'pending',
    workState: 'ready',
    takeover: false,
    assignmentOperation: 'unassign',
    previousOwnerId: 'operator-2',
    previousWorkState: 'blocked',
    newOwnerId: null,
  });
  assert.throws(() => planResearchAssignmentTransition({
    action: 'assign',
    operator,
    targetOperator: { id: 'operator-2', role: 'operator' },
    task: { status: 'pending', workState: 'ready', assignedOperatorId: null, signalCount: 1 },
  }), /Only an admin/);
});
