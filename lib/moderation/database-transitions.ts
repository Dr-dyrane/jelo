import type { Sql } from 'postgres';
import { buildModerationAuditRow, type ModerationAction, type ModerationQueue } from './schema';

type Decision = Extract<ModerationAction['action'], 'approve' | 'reject'>;
type ActionMetadata = ModerationAction['metadata'];
type TransactionCapableSql = Sql & {
  begin?: <T>(run: (tx: Sql) => Promise<T>) => Promise<T>;
};

export type ResearchAssignmentAction = 'claim' | 'defer' | 'retry' | 'assign' | 'unassign';
type ResearchAssignmentTask = {
  status: 'pending' | 'in-progress' | 'completed' | 'dismissed';
  workState: 'ready' | 'assigned' | 'blocked' | 'retry';
  assignedOperatorId: string | null;
  signalCount: number;
};
type ResearchAssignmentOperator = {
  id: string;
  role: 'moderator' | 'operator' | 'admin';
};

export type ObservationCorrectionDisposition = 'defer' | 'reject';
export type ObservationModerationStatus = 'pending' | 'mapped' | 'approved' | 'rejected';
export type ObservationCorrectionPlan = {
  id: string;
  previousStatus: Extract<ObservationModerationStatus, 'approved' | 'rejected'>;
  nextStatus: Extract<ObservationModerationStatus, 'pending' | 'rejected'>;
  previousDecisionAuditId: string;
  auditAction: ObservationCorrectionDisposition;
};
export type ObservationCausalAuditEvent = {
  id: string;
  eventSequence: string;
  action: 'approve' | 'reject' | 'defer';
  metadata: Record<string, unknown>;
};

export function observationStatusFromAuditEvent(
  event: ObservationCausalAuditEvent,
): Extract<ObservationModerationStatus, 'pending' | 'approved' | 'rejected'> {
  const hasCorrectionMarker = Object.prototype.hasOwnProperty.call(event.metadata, 'correction');
  if (event.action === 'approve') {
    if (hasCorrectionMarker) {
      throw new Error('An approve audit cannot be an observation correction state event.');
    }
    return 'approved';
  }
  const isCorrection = event.metadata.correction === true;
  if (event.action === 'defer') {
    if (!isCorrection || event.metadata.nextStatus !== 'pending') {
      throw new Error('The latest observation defer audit is not a valid correction state event.');
    }
    return 'pending';
  }
  if (hasCorrectionMarker && !isCorrection) {
    throw new Error('The latest observation reject audit has an invalid correction marker.');
  }
  if (!isCorrection) return 'rejected';
  if (event.metadata.nextStatus !== 'rejected') {
    throw new Error('The latest observation reject correction has invalid state metadata.');
  }
  return 'rejected';
}

export function planObservationCorrection(
  id: string,
  previousStatus: ObservationModerationStatus,
  disposition: ObservationCorrectionDisposition,
  previousDecisionAuditId: string,
): ObservationCorrectionPlan {
  if (disposition !== 'defer' && disposition !== 'reject') {
    throw new Error('Unsupported observation correction disposition.');
  }
  if (previousStatus === 'pending') {
    throw new Error('A pending observation has no settled decision to correct.');
  }
  if (previousStatus === 'mapped') {
    throw new Error('Mapped observations are not supported by the correction pathway.');
  }

  const nextStatus = disposition === 'defer' ? 'pending' as const : 'rejected' as const;
  if (previousStatus === nextStatus) {
    throw new Error('The requested observation correction would not change its status.');
  }
  if (!previousDecisionAuditId) {
    throw new Error('The prior observation decision audit entry is required.');
  }

  return {
    id,
    previousStatus,
    nextStatus,
    previousDecisionAuditId,
    auditAction: disposition,
  };
}

export function planResearchAssignmentTransition(input: {
  action: ResearchAssignmentAction;
  task: ResearchAssignmentTask;
  operator: ResearchAssignmentOperator;
  targetOperator?: ResearchAssignmentOperator;
  allowTakeover?: boolean;
}) {
  const { action, task, operator } = input;
  if (operator.role === 'moderator') {
    throw new Error('Research assignment requires an operator or admin.');
  }
  if (task.status !== 'pending' && task.status !== 'in-progress') {
    throw new Error('A terminal research task cannot be reassigned.');
  }
  if (task.signalCount <= 0 && action !== 'unassign') {
    throw new Error('Research work without an active report cannot be assigned or resolved.');
  }

  if (action === 'assign') {
    if (operator.role !== 'admin') {
      throw new Error('Only an admin may assign research work to another operator.');
    }
    if (!input.targetOperator || input.targetOperator.role === 'moderator') {
      throw new Error('Choose an active research operator or admin.');
    }
    if (task.assignedOperatorId === input.targetOperator.id) {
      throw new Error('Research work is already assigned to that operator.');
    }
    return {
      status: 'in-progress' as const,
      workState: 'assigned' as const,
      takeover: task.assignedOperatorId !== null,
      assignmentOperation: task.assignedOperatorId === null ? 'assign' as const : 'reassign' as const,
      previousOwnerId: task.assignedOperatorId,
      previousWorkState: task.workState,
      newOwnerId: input.targetOperator.id,
    };
  }

  if (action === 'unassign') {
    if (operator.role !== 'admin') {
      throw new Error('Only an admin may unassign research work.');
    }
    if (task.status !== 'in-progress' || task.assignedOperatorId === null) {
      throw new Error('Only assigned research work can be unassigned.');
    }
    return {
      status: 'pending' as const,
      workState: 'ready' as const,
      takeover: false,
      assignmentOperation: 'unassign' as const,
      previousOwnerId: task.assignedOperatorId,
      previousWorkState: task.workState,
      newOwnerId: null,
    };
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
    status: 'in-progress' as const,
    workState,
    takeover,
    assignmentOperation: takeover ? 'takeover' as const : action,
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
  options: { allowResearchTakeover?: boolean; targetOperatorId?: string },
  lockTask: boolean,
) {
  const operatorLock = lockTask ? sql`for share` : sql``;
  const [operator] = await sql<ResearchAssignmentOperator[]>`
    select id, role
    from moderation_operators
    where auth_subject = ${operatorSubject} and active = true
    limit 1
    ${operatorLock}
  `;
  if (!operator) throw new Error('An active operator is required to assign research work.');

  const [targetOperator] = action === 'assign'
    ? await sql<ResearchAssignmentOperator[]>`
        select id, role
        from moderation_operators
        where id = ${options.targetOperatorId ?? null}
          and active = true
          and role in ('operator', 'admin')
        limit 1
        ${operatorLock}
      `
    : [];

  const lock = lockTask ? sql`for update` : sql``;
  const [task] = await sql<{
    status: ResearchAssignmentTask['status'];
    work_state: ResearchAssignmentTask['workState'];
    assigned_operator_id: string | null;
    signal_count: number;
  }[]>`
    select status, work_state, assigned_operator_id, signal_count
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
      signalCount: task.signal_count,
    },
    targetOperator,
    allowTakeover: options.allowResearchTakeover,
  });
}

export function preflightResearchAssignment(
  sql: Sql,
  operatorSubject: string,
  targetRef: string,
  action: ResearchAssignmentAction,
  options: { allowResearchTakeover?: boolean; targetOperatorId?: string } = {},
) {
  return validateResearchAssignment(sql, operatorSubject, targetRef, action, options, false);
}

export async function updateResearchAssignment(
  sql: Sql,
  operatorSubject: string,
  targetRef: string,
  action: ResearchAssignmentAction,
  rationale: string,
  options: { allowResearchTakeover?: boolean; targetOperatorId?: string } = {},
): Promise<void> {
  await inTransaction(sql, async tx => {
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
        status = ${planned.status},
        assigned_operator_id = ${planned.newOwnerId},
        work_state = ${planned.workState},
        next_action = ${planned.workState === 'ready' ? null : rationale},
        last_reviewed_at = now(),
        updated_at = now()
      where id = ${targetRef}
      returning id
    `;
    if (!updated[0]) throw new Error('The research task could not be updated.');

    await recordModerationAction(tx, {
      operatorSubject,
      queue: 'community_research_task',
      action,
      targetRef,
      canonicalWrite: false,
      rationale,
      metadata: {
        assignmentOperation: planned.assignmentOperation,
        workState: planned.workState,
        takeover: planned.takeover,
        previousOwnerId: planned.previousOwnerId,
        previousWorkState: planned.previousWorkState,
        newOwnerId: planned.newOwnerId,
      },
    });
  });
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

async function inRequiredTransaction<T>(sql: Sql, run: (tx: Sql) => Promise<T>): Promise<T> {
  const begin = (sql as TransactionCapableSql).begin;
  if (typeof begin !== 'function') {
    throw new Error('Observation correction requires transactional database access.');
  }
  return await (begin.call(sql, run) as Promise<T>);
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

async function validateObservationCorrection(
  sql: Sql,
  operatorSubject: string,
  id: string,
  disposition: ObservationCorrectionDisposition,
  lockRows: boolean,
) {
  const operatorLock = lockRows ? sql`for share` : sql``;
  const [operator] = await sql<{ id: string; role: 'moderator' | 'operator' | 'admin' }[]>`
    select id, role
    from moderation_operators
    where auth_subject = ${operatorSubject} and active = true
    limit 1
    ${operatorLock}
  `;
  if (!operator || operator.role !== 'admin') {
    throw new Error('Only an active admin may correct a settled observation.');
  }

  const parentLock = lockRows ? sql`for share` : sql``;
  const [parentContribution] = disposition === 'defer'
    ? await sql<{
        id: string;
        moderation_status: ObservationModerationStatus;
        retained: boolean;
      }[]>`
        select contribution.id, contribution.moderation_status,
               (contribution.retain_until > now()) as retained
        from community_contributions contribution
        where contribution.id = (
          select observation.contribution_id
          from community_observations observation
          where observation.id = ${id}
        )
        ${parentLock}
      `
    : [];

  const observationLock = lockRows ? sql`for update` : sql``;
  const [observation] = await sql<{
    id: string;
    contribution_id: string;
    moderation_status: ObservationModerationStatus;
  }[]>`
    select id, contribution_id, moderation_status
    from community_observations
    where id = ${id}
    ${observationLock}
  `;
  if (!observation) throw new Error('Moderation target does not exist.');
  if (disposition === 'defer') {
    if (!parentContribution || parentContribution.id !== observation.contribution_id) {
      throw new Error('The observation parent contribution is unavailable.');
    }
    if (parentContribution.moderation_status === 'rejected') {
      throw new Error('Correct the rejected parent contribution before reopening this observation.');
    }
    if (!parentContribution.retained) {
      throw new Error('An expired parent contribution cannot return an observation to review.');
    }
  }

  const [previousDecision] = await sql<ObservationCausalAuditEvent[]>`
    select
      id,
      event_sequence::text as "eventSequence",
      action,
      metadata
    from moderation_audit_log
    where queue = 'community_observation'
      and target_ref = ${id}
      and (
        action in ('approve', 'reject')
        or (action = 'defer' and metadata ->> 'correction' = 'true')
      )
    order by event_sequence desc
    limit 1
  `;
  if (!previousDecision) {
    throw new Error('The prior observation decision audit entry is required.');
  }
  const auditedStatus = observationStatusFromAuditEvent(previousDecision);
  if (auditedStatus !== observation.moderation_status) {
    throw new Error('The observation status does not match its latest causal audit event.');
  }

  return planObservationCorrection(
    observation.id,
    observation.moderation_status,
    disposition,
    previousDecision.id,
  );
}

export function preflightObservationCorrection(
  sql: Sql,
  operatorSubject: string,
  id: string,
  disposition: ObservationCorrectionDisposition,
) {
  return validateObservationCorrection(sql, operatorSubject, id, disposition, false);
}

export async function correctObservationDecision(
  sql: Sql,
  operatorSubject: string,
  id: string,
  disposition: ObservationCorrectionDisposition,
  rationale: string,
) {
  const normalizedRationale = rationale.trim();
  if (!normalizedRationale || normalizedRationale.length > 2000) {
    throw new Error('A fresh correction reason between 1 and 2,000 characters is required.');
  }

  return inRequiredTransaction(sql, async tx => {
    const planned = await validateObservationCorrection(
      tx,
      operatorSubject,
      id,
      disposition,
      true,
    );
    const [updated] = await tx<{ id: string }[]>`
      update community_observations
      set moderation_status = ${planned.nextStatus}
      where id = ${id} and moderation_status = ${planned.previousStatus}
      returning id
    `;
    if (!updated) throw new Error('The observation decision changed before correction could be saved.');

    await recordModerationAction(tx, {
      operatorSubject,
      queue: 'community_observation',
      action: planned.auditAction,
      targetRef: id,
      canonicalWrite: false,
      rationale: normalizedRationale,
      metadata: {
        correction: true,
        previousStatus: planned.previousStatus,
        nextStatus: planned.nextStatus,
        previousDecisionAuditId: planned.previousDecisionAuditId,
      },
    });
    return planned;
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
  if (queue === 'community_research_task' && action !== 'note') {
    await updateResearchAssignment(sql, operatorSubject, targetRef, action, rationale, options);
    return;
  }
  await inTransaction(sql, async tx => {
    if (!await moderationTargetExists(tx, queue, targetRef)) {
      throw new Error('Moderation target does not exist.');
    }

    await recordModerationAction(tx, {
      operatorSubject,
      queue,
      action,
      targetRef,
      canonicalWrite: false,
      rationale,
      metadata: {},
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
