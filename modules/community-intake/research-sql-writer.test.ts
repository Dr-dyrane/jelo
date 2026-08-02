import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import {
  resolveCommunityProductResearchTask,
} from '@/lib/community-intake/research-resolution';
import {
  resolveCommunityRetailerResearchTask,
} from '@/lib/community-intake/retailer-research-resolution';
import { recordNote, updateResearchAssignment } from '@/lib/moderation/database-transitions';

const taskId = '6b1629ce-b151-4ed6-b91d-b985a6d725d8';
const operatorId = 'd7b8e2f5-69ce-4a5e-8c37-51b8cce8a3b4';
const secondOperatorId = '3e2f0f51-28aa-4f29-a502-60f8d4dce6f0';
const operatorSubject = 'neon-auth|operator-1';

type FixtureTask = {
  id: string;
  task_kind: 'product-identity' | 'product-retail-refresh' | 'retailer-identity' | 'retailer-refresh';
  entity_source: 'canonical' | 'custom';
  entity_ref: string;
  assigned_operator_id: string | null;
  status: 'pending' | 'in-progress' | 'completed' | 'dismissed';
  work_state: 'ready' | 'assigned' | 'blocked' | 'retry';
  signal_count: number;
};

function sqlFixture(input: {
  task: FixtureTask;
  operatorRole?: 'moderator' | 'operator' | 'admin';
  targetExists?: boolean;
  resolutionExists?: boolean;
  failTaskUpdate?: boolean;
  targetOperatorId?: string;
}) {
  const state = {
    queries: [] as string[],
    began: 0,
    committed: 0,
    rolledBack: 0,
    jsonValues: [] as unknown[],
  };
  const tag = ((strings: TemplateStringsArray) => {
    const query = strings.join(' ? ').replace(/\s+/g, ' ').trim();
    state.queries.push(query);
    if (query === '' || query === 'for update' || query === 'for share') return { fragment: query };
    if (query.includes('select exists(select 1 from community_research_tasks')) {
      return [{ exists: true }];
    }
    if (query.includes('from moderation_operators')) {
      if (query.includes('where id =')) {
        return [{ id: input.targetOperatorId ?? secondOperatorId, role: 'operator' }];
      }
      return [{ id: operatorId, role: input.operatorRole ?? 'operator' }];
    }
    if (query.includes('from community_research_tasks') && query.includes('select id, task_kind')) {
      return [input.task];
    }
    if (query.includes('select status, work_state, assigned_operator_id')) {
      return [{
        status: input.task.status,
        work_state: input.task.work_state,
        assigned_operator_id: input.task.assigned_operator_id,
        signal_count: input.task.signal_count,
      }];
    }
    if (query.includes('from products')) return [{ exists: input.targetExists ?? true }];
    if (query.includes('from retailers')) return [{ exists: input.targetExists ?? true }];
    if (query.includes('from community_product_research_resolutions where')) {
      return [{ exists: input.resolutionExists ?? false }];
    }
    if (query.includes('from community_retailer_research_resolutions where')) {
      return [{ exists: input.resolutionExists ?? false }];
    }
    if (query.startsWith('insert into community_product_research_resolutions')) {
      return [{ task_id: taskId }];
    }
    if (query.startsWith('insert into community_retailer_research_resolutions')) {
      return [{ task_id: taskId }];
    }
    if (query.startsWith('update community_research_tasks')) {
      if (input.failTaskUpdate) throw new Error('simulated task update failure');
      return [{ id: taskId }];
    }
    if (query.startsWith('insert into moderation_audit_log')) return [];
    throw new Error(`Unexpected fixture query: ${query}`);
  }) as unknown as Sql & {
    begin: <T>(run: (transaction: Sql) => Promise<T>) => Promise<T>;
  };
  tag.json = value => {
    state.jsonValues.push(value);
    return value as never;
  };
  tag.begin = async run => {
    state.began += 1;
    try {
      const callback = run as (transaction: Sql) => Promise<unknown>;
      const result = await callback(tag);
      state.committed += 1;
      return result as never;
    } catch (error) {
      state.rolledBack += 1;
      throw error;
    }
  };
  return { sql: tag as Sql, state };
}

function productTask(overrides: Partial<FixtureTask> = {}): FixtureTask {
  return {
    id: taskId,
    task_kind: 'product-retail-refresh',
    entity_source: 'canonical',
    entity_ref: 'product:known-product',
    assigned_operator_id: operatorId,
    status: 'in-progress',
    work_state: 'assigned',
    signal_count: 1,
    ...overrides,
  };
}

function retailerTask(overrides: Partial<FixtureTask> = {}): FixtureTask {
  return {
    id: taskId,
    task_kind: 'retailer-refresh',
    entity_source: 'canonical',
    entity_ref: 'retailer:known-store',
    assigned_operator_id: operatorId,
    status: 'in-progress',
    work_state: 'assigned',
    signal_count: 1,
    ...overrides,
  };
}

test('product SQL writer locks, exact-binds, inserts once, and terminalizes atomically', async () => {
  const fixture = sqlFixture({ task: productTask() });
  const result = await resolveCommunityProductResearchTask(fixture.sql, {
    taskId,
    reviewedBy: operatorSubject,
    rationale: 'Exact published identity matches.',
    outcome: 'existing-canonical-product',
    canonicalSlug: 'known-product',
  });
  assert.equal(result.outcome, 'existing-canonical-product');
  assert.equal(fixture.state.began, 1);
  assert.equal(fixture.state.committed, 1);
  assert.equal(fixture.state.rolledBack, 0);
  assert.equal(fixture.state.queries.includes('for update'), true);
  assert.equal(fixture.state.queries.some(query => query.startsWith('insert into community_product_research_resolutions')), true);
  assert.equal(fixture.state.queries.some(query => query.startsWith('update community_research_tasks')), true);
});

test('admin reassign and unassign lock the task and audit both ownership edges', async () => {
  const reassignment = sqlFixture({
    task: productTask({ assigned_operator_id: operatorId }),
    operatorRole: 'admin',
    targetOperatorId: secondOperatorId,
  });
  await updateResearchAssignment(
    reassignment.sql,
    operatorSubject,
    taskId,
    'assign',
    'Route this to the operator reviewing exact identity.',
    { targetOperatorId: secondOperatorId },
  );
  assert.equal(reassignment.state.began, 1);
  assert.equal(reassignment.state.committed, 1);
  assert.equal(reassignment.state.queries.includes('for update'), true);
  assert.equal(reassignment.state.queries.some(query => query.startsWith('update community_research_tasks')), true);
  assert.deepEqual(reassignment.state.jsonValues.at(-1), {
    assignmentOperation: 'reassign',
    workState: 'assigned',
    takeover: true,
    previousOwnerId: operatorId,
    previousWorkState: 'assigned',
    newOwnerId: secondOperatorId,
  });

  const unassignment = sqlFixture({
    task: productTask({ assigned_operator_id: secondOperatorId }),
    operatorRole: 'admin',
  });
  await updateResearchAssignment(
    unassignment.sql,
    operatorSubject,
    taskId,
    'unassign',
    'Return this to the shared research queue.',
  );
  assert.equal(unassignment.state.committed, 1);
  assert.deepEqual(unassignment.state.jsonValues.at(-1), {
    assignmentOperation: 'unassign',
    workState: 'ready',
    takeover: false,
    previousOwnerId: secondOperatorId,
    previousWorkState: 'assigned',
    newOwnerId: null,
  });
});

test('canonical SQL writers reject non-exact outcomes, wrong ownership, and a second resolution before mutation', async () => {
  const ambiguous = sqlFixture({ task: productTask() });
  await assert.rejects(() => resolveCommunityProductResearchTask(ambiguous.sql, {
    taskId,
    reviewedBy: operatorSubject,
    rationale: 'Not exact.',
    outcome: 'ambiguous-family',
  }), /exact existing product/);
  assert.equal(ambiguous.state.queries.some(query => query.startsWith('insert into community_product_research_resolutions')), false);

  const wrongOwner = sqlFixture({ task: productTask({ assigned_operator_id: 'other-operator' }) });
  await assert.rejects(() => resolveCommunityProductResearchTask(wrongOwner.sql, {
    taskId,
    reviewedBy: operatorSubject,
    rationale: 'Wrong owner.',
    outcome: 'existing-canonical-product',
    canonicalSlug: 'known-product',
  }), /current assigned operator/);

  const existing = sqlFixture({ task: productTask(), resolutionExists: true });
  await assert.rejects(() => resolveCommunityProductResearchTask(existing.sql, {
    taskId,
    reviewedBy: operatorSubject,
    rationale: 'Duplicate decision.',
    outcome: 'existing-canonical-product',
    canonicalSlug: 'known-product',
  }), /already has a resolution/);
  assert.equal(existing.state.queries.some(query => query.startsWith('insert into community_product_research_resolutions')), false);
});

test('retailer SQL writer exact-binds the production namespace and rolls back a failed terminal update', async () => {
  const fixture = sqlFixture({ task: retailerTask(), failTaskUpdate: true });
  await assert.rejects(() => resolveCommunityRetailerResearchTask(fixture.sql, {
    taskId,
    reviewedBy: operatorSubject,
    rationale: 'Exact store identity matches.',
    outcome: 'existing-canonical-retailer',
    canonicalSlug: 'known-store',
  }), /simulated task update failure/);
  assert.equal(fixture.state.began, 1);
  assert.equal(fixture.state.committed, 0);
  assert.equal(fixture.state.rolledBack, 1);
  assert.equal(fixture.state.queries.some(query => query.startsWith('insert into community_retailer_research_resolutions')), true);
});

test('assignment SQL writer locks ownership and enforces admin takeover in the shared transaction', async () => {
  const claim = sqlFixture({ task: productTask({ assigned_operator_id: null, status: 'pending', work_state: 'ready' }) });
  await recordNote(
    claim.sql,
    'community_research_task',
    operatorSubject,
    taskId,
    'Check the exact manufacturer record.',
    'claim',
  );
  assert.equal(claim.state.committed, 1);
  assert.equal(claim.state.queries.includes('for update'), true);
  assert.equal(claim.state.queries.some(query => query.startsWith('insert into moderation_audit_log')), true);

  const deniedTakeover = sqlFixture({ task: productTask({ assigned_operator_id: 'other-operator' }) });
  await assert.rejects(() => recordNote(
    deniedTakeover.sql,
    'community_research_task',
    operatorSubject,
    taskId,
    'Take ownership.',
    'claim',
    { allowResearchTakeover: true },
  ), /Only an admin/);
  assert.equal(deniedTakeover.state.queries.some(query => query.startsWith('update community_research_tasks')), false);
  assert.equal(deniedTakeover.state.rolledBack, 1);
});
