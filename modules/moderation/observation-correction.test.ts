import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import {
  correctObservationDecision,
  planObservationCorrection,
  preflightObservationCorrection,
  observationStatusFromAuditEvent,
  type ObservationModerationStatus,
} from '@/lib/moderation/database-transitions';

const observationId = '878dc8f7-1cfc-45a9-9d64-3c6d8129cee7';
const priorAuditId = 'c394426d-84a4-4e7c-8a98-e70e204a9b71';
const operatorSubject = 'neon-auth|admin-1';
const contributionId = '29a7f5bb-c4d3-47e9-bb0d-6a153156bd9c';

function correctionFixture(input: {
  status: ObservationModerationStatus;
  operatorRole?: 'moderator' | 'operator' | 'admin';
  operatorActive?: boolean;
  observationExists?: boolean;
  previousDecisionAuditId?: string | null;
  previousDecisionAction?: 'approve' | 'reject' | 'defer';
  previousDecisionMetadata?: Record<string, unknown>;
  failAuditInsert?: boolean;
  parentStatus?: ObservationModerationStatus;
  parentRetained?: boolean;
}) {
  const state = {
    status: input.status,
    queries: [] as string[],
    began: 0,
    committed: 0,
    rolledBack: 0,
    metadata: [] as unknown[],
    auditActions: [] as unknown[],
    correctionAuditCount: 0,
    latestAudit: {
      id: input.previousDecisionAuditId === undefined ? priorAuditId : input.previousDecisionAuditId,
      eventSequence: '41',
      action: input.previousDecisionAction ?? (
        input.status === 'approved'
          ? 'approve'
          : input.status === 'rejected'
            ? 'reject'
            : 'defer'
      ),
      metadata: input.previousDecisionMetadata ?? (
        input.status === 'pending'
          ? { correction: true, nextStatus: 'pending' }
          : {}
      ),
    },
  };
  const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.reduce((text, part, index) => {
      const value = values[index - 1];
      const interpolation = value && typeof value === 'object' && 'fragment' in value
        ? String(value.fragment)
        : ' ? ';
      return `${text}${interpolation}${part}`;
    }).replace(/\s+/g, ' ').trim();
    state.queries.push(query);

    if (query === '' || query === 'for share' || query === 'for update') {
      return { fragment: query };
    }
    if (query.includes('from moderation_operators')) {
      if (input.operatorActive === false) return [];
      return [{ id: '57a029b8-7905-44ce-a4c5-2b6679850977', role: input.operatorRole ?? 'admin' }];
    }
    if (query.includes('from community_contributions')) {
      return [{
        id: contributionId,
        moderation_status: input.parentStatus ?? 'approved',
        retained: input.parentRetained ?? true,
      }];
    }
    if (query.includes('from community_observations') && query.startsWith('select id, contribution_id')) {
      if (input.observationExists === false) return [];
      return [{
        id: observationId,
        contribution_id: contributionId,
        moderation_status: state.status,
      }];
    }
    if (query.includes('from moderation_audit_log')) {
      return state.latestAudit.id ? [state.latestAudit] : [];
    }
    if (query.startsWith('update community_observations')) {
      const nextStatus = values[0] as ObservationModerationStatus;
      const expectedStatus = values[2] as ObservationModerationStatus;
      if (state.status !== expectedStatus) return [];
      state.status = nextStatus;
      return [{ id: observationId }];
    }
    if (query.startsWith('insert into moderation_audit_log')) {
      if (input.failAuditInsert) throw new Error('simulated audit insert failure');
      state.auditActions.push(values[2]);
      state.correctionAuditCount += 1;
      state.latestAudit = {
        id: '77fcb055-9b65-48ac-b384-b4138647ee7a',
        eventSequence: '42',
        action: values[2] as 'approve' | 'reject' | 'defer',
        metadata: values[6] as Record<string, unknown>,
      };
      return [];
    }
    throw new Error(`Unexpected fixture query: ${query}`);
  }) as unknown as Sql & {
    begin: <T>(run: (transaction: Sql) => Promise<T>) => Promise<T>;
  };
  tag.json = value => {
    state.metadata.push(value);
    return value as never;
  };
  tag.begin = async run => {
    state.began += 1;
    const previousStatus = state.status;
    try {
      const callback = run as (transaction: Sql) => Promise<unknown>;
      const result = await callback(tag);
      state.committed += 1;
      return result as never;
    } catch (error) {
      state.status = previousStatus;
      state.rolledBack += 1;
      throw error;
    }
  };
  return { sql: tag as Sql, state };
}

test('the observation correction planner permits only the three audited settled transitions', () => {
  assert.deepEqual(
    planObservationCorrection(observationId, 'approved', 'defer', priorAuditId),
    {
      id: observationId,
      previousStatus: 'approved',
      nextStatus: 'pending',
      previousDecisionAuditId: priorAuditId,
      auditAction: 'defer',
    },
  );
  assert.equal(
    planObservationCorrection(observationId, 'approved', 'reject', priorAuditId).nextStatus,
    'rejected',
  );
  assert.equal(
    planObservationCorrection(observationId, 'rejected', 'defer', priorAuditId).nextStatus,
    'pending',
  );

  assert.throws(
    () => planObservationCorrection(observationId, 'pending', 'defer', priorAuditId),
    /pending observation/,
  );
  assert.throws(
    () => planObservationCorrection(observationId, 'rejected', 'reject', priorAuditId),
    /would not change/,
  );
  assert.throws(
    () => planObservationCorrection(observationId, 'mapped', 'defer', priorAuditId),
    /Mapped observations are not supported/,
  );
  assert.throws(
    () => planObservationCorrection(observationId, 'approved', 'defer', ''),
    /prior observation decision audit entry/,
  );
  assert.throws(
    () => planObservationCorrection(observationId, 'approved', 'approve' as never, priorAuditId),
    /Unsupported observation correction disposition/,
  );
});

test('causal audit events reconstruct only valid observation state changes', () => {
  assert.equal(observationStatusFromAuditEvent({
    id: priorAuditId,
    eventSequence: '1',
    action: 'approve',
    metadata: {},
  }), 'approved');
  assert.equal(observationStatusFromAuditEvent({
    id: priorAuditId,
    eventSequence: '2',
    action: 'reject',
    metadata: {},
  }), 'rejected');
  assert.equal(observationStatusFromAuditEvent({
    id: priorAuditId,
    eventSequence: '3',
    action: 'defer',
    metadata: { correction: true, nextStatus: 'pending' },
  }), 'pending');
  assert.throws(() => observationStatusFromAuditEvent({
    id: priorAuditId,
    eventSequence: '4',
    action: 'defer',
    metadata: {},
  }), /not a valid correction state event/);
  assert.throws(() => observationStatusFromAuditEvent({
    id: priorAuditId,
    eventSequence: '5',
    action: 'reject',
    metadata: { correction: true, nextStatus: 'pending' },
  }), /invalid state metadata/);
});

test('approved to pending locks admin authority before the observation and links the prior audit', async () => {
  const fixture = correctionFixture({ status: 'approved' });
  const result = await correctObservationDecision(
    fixture.sql,
    operatorSubject,
    observationId,
    'defer',
    '  Exact product identity needs another review.  ',
  );

  assert.equal(result.previousStatus, 'approved');
  assert.equal(result.nextStatus, 'pending');
  assert.equal(fixture.state.status, 'pending');
  assert.equal(fixture.state.committed, 1);
  const operatorLock = fixture.state.queries.findIndex(query => (
    query.includes('from moderation_operators') && query.endsWith('for share')
  ));
  const observationLock = fixture.state.queries.findIndex(query => (
    query.includes('from community_observations') && query.endsWith('for update')
  ));
  const parentLock = fixture.state.queries.findIndex(query => (
    query.includes('from community_contributions') && query.endsWith('for share')
  ));
  const causalAuditRead = fixture.state.queries.findIndex(query => (
    query.includes('from moderation_audit_log')
  ));
  assert.notEqual(operatorLock, -1);
  assert.notEqual(parentLock, -1);
  assert.notEqual(observationLock, -1);
  assert.notEqual(causalAuditRead, -1);
  assert.ok(
    operatorLock < parentLock && parentLock < observationLock,
    'the active admin and retained parent locks must precede the observation row lock',
  );
  assert.ok(
    observationLock < causalAuditRead,
    'causal audit history must be evaluated only after the observation is locked',
  );
  assert.match(
    fixture.state.queries[causalAuditRead],
    /action = 'defer' and metadata ->> 'correction' = 'true'/,
  );
  assert.match(fixture.state.queries[causalAuditRead], /order by event_sequence desc/);
  assert.deepEqual(fixture.state.metadata.at(-1), {
    correction: true,
    previousStatus: 'approved',
    nextStatus: 'pending',
    previousDecisionAuditId: priorAuditId,
  });
});

test('approved to rejected and rejected to pending use the canonical audit action', async () => {
  const reject = correctionFixture({ status: 'approved' });
  const rejected = await correctObservationDecision(
    reject.sql,
    operatorSubject,
    observationId,
    'reject',
    'The report cannot remain an exact-SKU observation.',
  );
  assert.equal(rejected.nextStatus, 'rejected');
  assert.equal(reject.state.status, 'rejected');
  assert.equal(reject.state.auditActions.at(-1), 'reject');

  const reopen = correctionFixture({ status: 'rejected' });
  const reopened = await correctObservationDecision(
    reopen.sql,
    operatorSubject,
    observationId,
    'defer',
    'Prior review intentionally kept this private while identity research continues.',
  );
  assert.equal(reopened.previousStatus, 'rejected');
  assert.equal(reopened.nextStatus, 'pending');
  assert.equal(reopen.state.status, 'pending');
  assert.equal(reopen.state.auditActions.at(-1), 'defer');
});

test('preflight is the CLI dry-run contract and apply revalidates the same writer under locks', async () => {
  const fixture = correctionFixture({ status: 'rejected' });
  const preview = await preflightObservationCorrection(
    fixture.sql,
    operatorSubject,
    observationId,
    'defer',
  );
  assert.equal(preview.previousStatus, 'rejected');
  assert.equal(preview.nextStatus, 'pending');
  assert.equal(fixture.state.status, 'rejected');
  assert.equal(fixture.state.queries.some(query => query.startsWith('update community_observations')), false);
  assert.equal(fixture.state.queries.some(query => query.startsWith('insert into moderation_audit_log')), false);

  await correctObservationDecision(
    fixture.sql,
    operatorSubject,
    observationId,
    'defer',
    'Return this private report to exact identity review.',
  );
  assert.equal(fixture.state.status, 'pending');
  assert.equal(fixture.state.committed, 1);
});

test('non-admin, deactivated, missing, blank, pending, and no-op corrections are denied', async () => {
  const operator = correctionFixture({ status: 'approved', operatorRole: 'operator' });
  await assert.rejects(
    () => correctObservationDecision(operator.sql, operatorSubject, observationId, 'defer', 'Reason.'),
    /Only an active admin/,
  );
  assert.equal(operator.state.queries.some(query => query.includes('from community_observations')), false);

  const inactive = correctionFixture({ status: 'approved', operatorActive: false });
  await assert.rejects(
    () => correctObservationDecision(inactive.sql, operatorSubject, observationId, 'defer', 'Reason.'),
    /Only an active admin/,
  );

  const missing = correctionFixture({ status: 'approved', observationExists: false });
  await assert.rejects(
    () => correctObservationDecision(missing.sql, operatorSubject, observationId, 'defer', 'Reason.'),
    /Moderation target does not exist/,
  );

  const blank = correctionFixture({ status: 'approved' });
  await assert.rejects(
    () => correctObservationDecision(blank.sql, operatorSubject, observationId, 'defer', '   '),
    /fresh correction reason/,
  );

  const pending = correctionFixture({ status: 'pending' });
  await assert.rejects(
    () => correctObservationDecision(pending.sql, operatorSubject, observationId, 'defer', 'Reason.'),
    /pending observation/,
  );

  const noOp = correctionFixture({ status: 'rejected' });
  await assert.rejects(
    () => correctObservationDecision(noOp.sql, operatorSubject, observationId, 'reject', 'Reason.'),
    /would not change/,
  );
});

test('reopening denies rejected or expired parents without creating an invisible pending orphan', async () => {
  const rejectedParent = correctionFixture({ status: 'rejected', parentStatus: 'rejected' });
  await assert.rejects(
    () => correctObservationDecision(
      rejectedParent.sql,
      operatorSubject,
      observationId,
      'defer',
      'The child needs review.',
    ),
    /Correct the rejected parent contribution/,
  );
  assert.equal(rejectedParent.state.status, 'rejected');
  assert.equal(rejectedParent.state.queries.some(query => query.startsWith('update community_observations')), false);

  const expiredParent = correctionFixture({ status: 'approved', parentRetained: false });
  await assert.rejects(
    () => correctObservationDecision(
      expiredParent.sql,
      operatorSubject,
      observationId,
      'defer',
      'The child needs review.',
    ),
    /expired parent contribution/,
  );
  assert.equal(expiredParent.state.status, 'approved');
  assert.equal(expiredParent.state.queries.some(query => query.startsWith('update community_observations')), false);
});

test('stale causal history and a duplicate correction retry fail closed', async () => {
  const stale = correctionFixture({
    status: 'rejected',
    previousDecisionAction: 'defer',
    previousDecisionMetadata: { correction: true, nextStatus: 'pending' },
  });
  await assert.rejects(
    () => correctObservationDecision(
      stale.sql,
      operatorSubject,
      observationId,
      'defer',
      'Do not reopen drifted state.',
    ),
    /does not match its latest causal audit event/,
  );
  assert.equal(stale.state.status, 'rejected');
  assert.equal(stale.state.correctionAuditCount, 0);

  const duplicate = correctionFixture({ status: 'approved' });
  await correctObservationDecision(
    duplicate.sql,
    operatorSubject,
    observationId,
    'defer',
    'Return this report to review once.',
  );
  await assert.rejects(
    () => correctObservationDecision(
      duplicate.sql,
      operatorSubject,
      observationId,
      'defer',
      'Retry the same correction.',
    ),
    /pending observation has no settled decision/,
  );
  assert.equal(duplicate.state.status, 'pending');
  assert.equal(duplicate.state.correctionAuditCount, 1);
});

test('correction fails closed when the SQL client cannot start a transaction', async () => {
  const fixture = correctionFixture({ status: 'approved' });
  Reflect.deleteProperty(fixture.sql as object, 'begin');
  await assert.rejects(
    () => correctObservationDecision(
      fixture.sql,
      operatorSubject,
      observationId,
      'defer',
      'Return to exact identity review.',
    ),
    /requires transactional database access/,
  );
  assert.equal(fixture.state.queries.length, 0);
  assert.equal(fixture.state.status, 'approved');
});

test('an audit insert failure rolls the observation update back', async () => {
  const fixture = correctionFixture({ status: 'approved', failAuditInsert: true });
  await assert.rejects(
    () => correctObservationDecision(
      fixture.sql,
      operatorSubject,
      observationId,
      'defer',
      'Return to exact identity review.',
    ),
    /simulated audit insert failure/,
  );
  assert.equal(fixture.state.status, 'approved');
  assert.equal(fixture.state.committed, 0);
  assert.equal(fixture.state.rolledBack, 1);
});
