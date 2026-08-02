import type { Sql } from 'postgres';
import { buildModerationAuditRow, type ModerationAction, type ModerationQueue } from './schema';

type Decision = Extract<ModerationAction['action'], 'approve' | 'reject'>;
type ActionMetadata = ModerationAction['metadata'];
type TransactionCapableSql = Sql & {
  begin?: <T>(run: (tx: Sql) => Promise<T>) => Promise<T>;
};

type ResearchAssignmentAction = 'claim' | 'defer' | 'retry';
type ResearchAssignmentTask = {
  status: 'pending' | 'in-progress' | 'completed' | 'dismissed';
  workState: 'ready' | 'assigned' | 'blocked' | 'retry';
  assignedOperatorId: string | null;
};
type ResearchAssignmentOperator = {
  id: string;
  role: 'moderator' | 'operator' | 'admin';
};

export function planResearchAssignmentTransition(input: {
  action: ResearchAssignmentAction;
  task: ResearchAssignmentTask;
  operator: ResearchAssignmentOperator;
  allowTakeover?: boolean;
}) {
  const { action, task, operator } = input;
  if (operator.role === 'moderator') {
    throw new Error('Research assignment requires an operator or admin.');
  }
  if (task.status !== 'pending' && task.status !== 'in-progress') {
    throw new Error('A terminal research task cannot be reassigned.');
  }

  const takeover = input.allowTakeover === true;
  if (takeover) {
    if (operator.role !== 'admin') {
      throw new Error('Only an admin may take over assigned research work.');
    }
    if (
      task.status !== 'in-progress'
      || task.assignedOperatorId === null
      || task.assignedOperatorId === operator.id
    ) {
      throw new Error('A takeover requires work owned by another operator.');
    }
  } else if (
    task.assignedOperatorId !== null
    && task.assignedOperatorId !== operator.id
  ) {
    throw new Error('The research task is owned by another operator.');
  }

  if (
    action === 'retry'
    && (
      task.status !== 'in-progress'
      || task.assignedOperatorId !== operator.id
      || !['assigned', 'blocked', 'retry'].includes(task.workState)
    )
  ) {
    throw new Error('Only the current owner may retry active research work.');
  }

  const workState = action === 'defer'
    ? 'blocked' as const
    : action === 'retry'
      ? 'retry' as const
      : 'assigned' as const;
  return {
    workState,
    takeover,
    previousOwnerId: task.assignedOperatorId,
    previousWorkState: task.workState,
    newOwnerId: operator.id,
  };
}

async function validateResearchAssignment(
  sql: Sql,
  operatorSubject: string,
  targetRef: string,
  action: ResearchAssignmentAction,
  options: { allowResearchTakeover?: boolean },
  lockTask: boolean,
) {
  const [operator] = await sql<ResearchAssignmentOperator[]>`
    select id, role
    from moderation_operators
    where auth_subject = ${operatorSubject} and active = true
    limit 1
  `;
  if (!operator) throw new Error('An active operator is required to assign research work.');

  const lock = lockTask ? sql`for update` : sql``;
  const [task] = await sql<{
    status: ResearchAssignmentTask['status'];
    work_state: ResearchAssignmentTask['workState'];
    assigned_operator_id: string | null;
  }[]>`
    select status, work_state, assigned_operator_id
    from community_research_tasks
    where id = ${targetRef}
    ${lock}
  `;
  if (!task) throw new Error('Moderation target does not exist.');
  return planResearchAssignmentTransition({
    action,
    operator,
    task: {
      status: task.status,
      workState: task.work_state,
      assignedOperatorId: task.assigned_operator_id,
    },
    allowTakeover: options.allowResearchTakeover,
  });
}

export function preflightResearchAssignment(
  sql: Sql,
  operatorSubject: string,
  targetRef: string,
  action: ResearchAssignmentAction,
  options: { allowResearchTakeover?: boolean } = {},
) {
  return validateResearchAssignment(sql, operatorSubject, targetRef, action, options, false);
}

// This module intentionally has no `server-only` marker: the authenticated Next
// writers and the private command-line operator share these exact database
// transitions. Browser-facing code imports `transitions.ts`, whose server-only
// boundary remains intact.

async function inTransaction<T>(sql: Sql, run: (tx: Sql) => Promise<T>): Promise<T> {
  const begin = (sql as TransactionCapableSql).begin;
  return typeof begin === 'function'
    ? await (begin.call(sql, run) as Promise<T>)
    : run(sql);
}

export async function recordModerationAction(sql: Sql, input: ModerationAction): Promise<void> {
  const row = buildModerationAuditRow(input);
  await sql`
    insert into moderation_audit_log (
      operator_subject, queue, action, target_ref, canonical_write, rationale, metadata
    ) values (
      ${row.operatorSubject}, ${row.queue}, ${row.action}, ${row.targetRef},
      ${row.canonicalWrite}, ${row.rationale}, ${sql.json(row.metadata)}
    )
  `;
}

async function transition(
  sql: Sql,
  queue: ModerationQueue,
  action: ModerationAction['action'],
  operatorSubject: string,
  targetRef: string,
  rationale: string | null,
  runUpdate: (tx: Sql) => Promise<{ id: string }[]>,
  metadata: ActionMetadata = {},
): Promise<string | null> {
  return inTransaction(sql, async tx => {
    const rows = await runUpdate(tx);
    if (rows.length === 0) return null;
    await recordModerationAction(tx, {
      operatorSubject,
      queue,
      action,
      targetRef,
      canonicalWrite: false,
      rationale,
      metadata,
    });
    return rows[0].id;
  });
}

async function reconcileTasksForContribution(sql: Sql, contributionId: string): Promise<number> {
  const [row] = await sql<{ updated_count: number }[]>`
    with affected as (
      select distinct task_id
      from community_research_task_mentions
      where contribution_id = ${contributionId}
    ),
    active_signals as (
      select
        mention.task_id,
        count(distinct mention.contribution_id)::integer as signal_count,
        min(contribution.submitted_at) as first_seen_at,
        max(contribution.submitted_at) as last_seen_at
      from community_research_task_mentions mention
      join community_contributions contribution on contribution.id = mention.contribution_id
      join affected on affected.task_id = mention.task_id
      where contribution.moderation_status <> 'rejected'
        and contribution.retain_until > now()
      group by mention.task_id
    ),
    updated as (
      update community_research_tasks task
      set
        signal_count = coalesce(active_signals.signal_count, 0),
        first_seen_at = coalesce(active_signals.first_seen_at, task.first_seen_at),
        last_seen_at = coalesce(active_signals.last_seen_at, task.last_seen_at),
        updated_at = now()
      from affected
      left join active_signals on active_signals.task_id = affected.task_id
      where task.id = affected.task_id
      returning task.id
    )
    select count(*)::integer as updated_count from updated
  `;
  return row?.updated_count ?? 0;
}

export async function decideContribution(
  sql: Sql,
  operatorSubject: string,
  id: string,
  decision: Decision,
  rationale: string | null = null,
) {
  const status = decision === 'approve' ? 'approved' : 'rejected';
  return inTransaction(sql, async tx => {
    const rows = await tx<{ id: string }[]>`
      update community_contributions
      set moderation_status = ${status}
      where id = ${id} and moderation_status = 'pending'
      returning id
    `;
    if (rows.length === 0) return null;

    let cascadedEdges = 0;
    let cascadedObservations = 0;
    let reconciledResearchTasks = 0;
    if (decision === 'reject') {
      const rejectedEdges = await tx<{ id: string }[]>`
        update community_knowledge_edges
        set moderation_status = 'rejected'
        where contribution_id = ${id} and moderation_status = 'pending'
        returning id
      `;
      const rejectedObservations = await tx<{ id: string }[]>`
        update community_observations
        set moderation_status = 'rejected'
        where contribution_id = ${id} and moderation_status = 'pending'
        returning id
      `;
      cascadedEdges = rejectedEdges.length;
      cascadedObservations = rejectedObservations.length;
      reconciledResearchTasks = await reconcileTasksForContribution(tx, id);
    }

    await recordModerationAction(tx, {
      operatorSubject,
      queue: 'community_contribution',
      action: decision,
      targetRef: id,
      canonicalWrite: false,
      rationale,
      metadata: decision === 'reject'
        ? { cascadedEdges, cascadedObservations, reconciledResearchTasks }
        : {},
    });
    return rows[0].id;
  });
}

export function decideEdge(
  sql: Sql,
  operatorSubject: string,
  id: string,
  decision: Decision,
  rationale: string | null = null,
) {
  const status = decision === 'approve' ? 'approved' : 'rejected';
  return transition(sql, 'community_edge', decision, operatorSubject, id, rationale, tx =>
    tx<{ id: string }[]>`
      update community_knowledge_edges set moderation_status = ${status}
      where id = ${id} and moderation_status = 'pending' returning id`);
}

export function decideObservation(
  sql: Sql,
  operatorSubject: string,
  id: string,
  decision: Decision,
  rationale: string | null = null,
) {
  const status = decision === 'approve' ? 'approved' : 'rejected';
  return transition(sql, 'community_observation', decision, operatorSubject, id, rationale, tx =>
    tx<{ id: string }[]>`
      update community_observations set moderation_status = ${status}
      where id = ${id} and moderation_status = 'pending' returning id`);
}

export async function correctApprovedObservation(
  sql: Sql,
  operatorSubject: string,
  id: string,
  disposition: 'defer' | 'reject',
  rationale: string,
) {
  const nextStatus = disposition === 'reject' ? 'rejected' : 'pending';
  return inTransaction(sql, async tx => {
    const rows = await tx<{ id: string }[]>`
      update community_observations
      set moderation_status = ${nextStatus}
      where id = ${id} and moderation_status = 'approved'
      returning id
    `;
    if (rows.length === 0) return null;

    await recordModerationAction(tx, {
      operatorSubject,
      queue: 'community_observation',
      action: disposition,
      targetRef: id,
      canonicalWrite: false,
      rationale,
      metadata: {
        correction: true,
        previousStatus: 'approved',
        nextStatus,
      },
    });
    return rows[0].id;
  });
}

export function decideModerationValue(
  sql: Sql,
  operatorSubject: string,
  id: string,
  decision: Decision,
  rationale: string | null = null,
) {
  const status = decision === 'approve' ? 'approved' : 'rejected';
  return transition(sql, 'community_moderation_value', decision, operatorSubject, id, rationale, tx =>
    tx<{ id: string }[]>`
      update community_moderation_values
      set status = ${status}, reviewed_at = now(), reviewer = ${operatorSubject}, review_note = ${rationale}
      where id = ${id} and status = 'pending' returning id`);
}

export async function canonicalModerationTargetExists(
  sql: Sql,
  kind: 'purpose' | 'product' | 'brand' | 'retailer',
  ref: string,
): Promise<boolean> {
  if (kind === 'purpose') {
    const rows = await sql<{ exists: boolean }[]>`
      select exists(select 1 from concerns where slug = ${ref}) as exists
    `;
    return rows[0]?.exists ?? false;
  }
  if (kind === 'brand') {
    const rows = await sql<{ exists: boolean }[]>`
      select exists(select 1 from brands where slug = ${ref}) as exists
    `;
    return rows[0]?.exists ?? false;
  }
  if (kind === 'retailer') {
    const rows = await sql<{ exists: boolean }[]>`
      select exists(select 1 from retailers where slug = ${ref}) as exists
    `;
    return rows[0]?.exists ?? false;
  }

  const rows = await sql<{ exists: boolean }[]>`
    select exists(
      select 1 from products where slug = ${ref} and is_published = true
    ) as exists
  `;
  if (rows[0]?.exists) return true;

  // Checked-in publication releases are also canonical public products, even
  // before their optional Neon mirror has caught up.
  const { products } = await import('@/data/catalogue');
  return products.some(product => product.slug === ref);
}

export function mapModerationValue(
  sql: Sql,
  operatorSubject: string,
  id: string,
  canonicalEntityKind: 'purpose' | 'product' | 'brand' | 'retailer',
  canonicalEntityRef: string,
  rationale: string | null = null,
) {
  return inTransaction(sql, async tx => {
    if (!await canonicalModerationTargetExists(tx, canonicalEntityKind, canonicalEntityRef)) {
      throw new Error('Canonical mapping target does not exist.');
    }
    const rows = await tx<{ id: string }[]>`
      update community_moderation_values
      set status = 'mapped', canonical_entity_kind = ${canonicalEntityKind}, canonical_entity_ref = ${canonicalEntityRef},
          reviewed_at = now(), reviewer = ${operatorSubject}, review_note = ${rationale}
      where id = ${id}
        and status = 'pending'
        and value_kind = ${canonicalEntityKind}
      returning id
    `;
    if (rows.length === 0) return null;
    await recordModerationAction(tx, {
      operatorSubject,
      queue: 'community_moderation_value',
      action: 'map',
      targetRef: id,
      canonicalWrite: false,
      rationale,
      metadata: { canonicalEntityKind, canonicalEntityRef },
    });
    return rows[0].id;
  });
}

export function decideRetailerApplication(
  sql: Sql,
  operatorSubject: string,
  id: string,
  decision: Decision,
  rationale: string | null = null,
) {
  const status = decision === 'approve' ? 'approved' : 'declined';
  return transition(sql, 'retailer_application', decision, operatorSubject, id, rationale, tx =>
    tx<{ id: string }[]>`
      update retailer_partnership_applications set status = ${status}, updated_at = now()
      where id = ${id} and status = 'submitted' returning id`);
}

export async function moderationTargetExists(sql: Sql, queue: ModerationQueue, targetRef: string): Promise<boolean> {
  const rows = queue === 'community_contribution'
    ? await sql<{ exists: boolean }[]>`select exists(select 1 from community_contributions where id::text = ${targetRef}) as exists`
    : queue === 'community_edge'
      ? await sql<{ exists: boolean }[]>`select exists(select 1 from community_knowledge_edges where id::text = ${targetRef}) as exists`
      : queue === 'community_observation'
        ? await sql<{ exists: boolean }[]>`select exists(select 1 from community_observations where id::text = ${targetRef}) as exists`
        : queue === 'community_moderation_value'
          ? await sql<{ exists: boolean }[]>`select exists(select 1 from community_moderation_values where id::text = ${targetRef}) as exists`
          : queue === 'community_research_task'
            ? await sql<{ exists: boolean }[]>`select exists(select 1 from community_research_tasks where id::text = ${targetRef}) as exists`
            : queue === 'retailer_application'
              ? await sql<{ exists: boolean }[]>`select exists(select 1 from retailer_partnership_applications where id::text = ${targetRef}) as exists`
              : await sql<{ exists: boolean }[]>`select exists(select 1 from commerce_events where id::text = ${targetRef}) as exists`;
  return rows[0]?.exists ?? false;
}

export async function recordNote(
  sql: Sql,
  queue: ModerationQueue,
  operatorSubject: string,
  targetRef: string,
  rationale: string,
  action: Extract<ModerationAction['action'], 'note' | 'defer' | 'claim' | 'retry'> = 'note',
  options: { allowResearchTakeover?: boolean } = {},
): Promise<void> {
  await inTransaction(sql, async tx => {
    if (!await moderationTargetExists(tx, queue, targetRef)) {
      throw new Error('Moderation target does not exist.');
    }

    let metadata: ActionMetadata = {};
    if (
      queue === 'community_research_task'
      && (action === 'claim' || action === 'defer' || action === 'retry')
    ) {
      const planned = await validateResearchAssignment(
        tx,
        operatorSubject,
        targetRef,
        action,
        options,
        true,
      );
      const updated = await tx<{ id: string }[]>`
        update community_research_tasks
        set
          status = 'in-progress',
          assigned_operator_id = ${planned.newOwnerId},
          work_state = ${planned.workState},
          next_action = ${rationale},
          last_reviewed_at = now(),
          updated_at = now()
        where id = ${targetRef}
        returning id
      `;
      if (!updated[0]) {
        throw new Error('The research task could not be updated.');
      }
      metadata = {
        workState: planned.workState,
        takeover: planned.takeover,
        previousOwnerId: planned.previousOwnerId,
        previousWorkState: planned.previousWorkState,
        newOwnerId: planned.newOwnerId,
      };
    }

    await recordModerationAction(tx, {
      operatorSubject,
      queue,
      action,
      targetRef,
      canonicalWrite: false,
      rationale,
      metadata,
    });
  });
}

export async function reconcileCommunityResearchTasks(
  sql: Sql,
  operatorSubject: string,
  rationale: string,
): Promise<number> {
  return inTransaction(sql, async tx => {
    const [drift] = await tx<{ count: number }[]>`
      select count(*)::integer as count
      from community_research_tasks task
      where task.signal_count <> (
        select count(distinct mention.contribution_id)::integer
        from community_research_task_mentions mention
        join community_contributions contribution on contribution.id = mention.contribution_id
        where mention.task_id = task.id
          and contribution.moderation_status <> 'rejected'
          and contribution.retain_until > now()
      )
    `;
    const driftCount = drift?.count ?? 0;
    if (driftCount === 0) return 0;

    await tx`
      with active_signals as (
        select
          task.id as task_id,
          count(distinct contribution.id)::integer as signal_count,
          min(contribution.submitted_at) as first_seen_at,
          max(contribution.submitted_at) as last_seen_at
        from community_research_tasks task
        left join community_research_task_mentions mention on mention.task_id = task.id
        left join community_contributions contribution
          on contribution.id = mention.contribution_id
          and contribution.moderation_status <> 'rejected'
          and contribution.retain_until > now()
        group by task.id
      )
      update community_research_tasks task
      set
        signal_count = active_signals.signal_count,
        first_seen_at = coalesce(active_signals.first_seen_at, task.first_seen_at),
        last_seen_at = coalesce(active_signals.last_seen_at, task.last_seen_at),
        updated_at = now()
      from active_signals
      where task.id = active_signals.task_id
        and task.signal_count <> active_signals.signal_count
    `;

    await recordModerationAction(tx, {
      operatorSubject,
      queue: 'community_research_task',
      action: 'reconcile',
      targetRef: 'active-signal-counts',
      canonicalWrite: false,
      rationale,
      metadata: { reconciledTaskCount: driftCount },
    });
    return driftCount;
  });
}
