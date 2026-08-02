import postgres, { type Sql } from 'postgres';
import { z } from 'zod';
import { parseOperatorCommand, type OperatorCommand } from '../lib/moderation/operator-command';
import {
  canonicalModerationTargetExists,
  correctApprovedObservation,
  decideContribution,
  decideEdge,
  decideModerationValue,
  decideObservation,
  mapModerationValue,
  moderationTargetExists,
  preflightResearchAssignment,
  reconcileCommunityResearchTasks,
  recordNote,
  updateResearchAssignment,
} from '../lib/moderation/database-transitions';

type OperatorRole = 'moderator' | 'operator' | 'admin';
type Operator = { auth_subject: string; role: OperatorRole };

function connectionString() {
  const value = process.env.DATABASE_URL_UNPOOLED
    ?? process.env.POSTGRES_URL_NON_POOLING
    ?? process.env.DATABASE_URL
    ?? process.env.POSTGRES_URL;
  if (!/^postgres(?:ql)?:\/\//.test(value ?? '')) {
    throw new Error('A private Neon connection string is required.');
  }
  return value!;
}

async function resolveOperator(sql: Sql): Promise<Operator> {
  const email = z.email().parse(process.env.MODERATION_OPERATOR_EMAIL);
  const rows = await sql<Operator[]>`
    select auth_subject, role
    from moderation_operators
    where lower(email) = lower(${email}) and active = true
    limit 2
  `;
  if (rows.length !== 1) {
    throw new Error('MODERATION_OPERATOR_EMAIL must identify exactly one active operator.');
  }
  return rows[0];
}

function assertCapability(role: OperatorRole, command: OperatorCommand) {
  if (command.action === 'inspect') return;
  if (command.action === 'reconcile') {
    if (role !== 'admin') throw new Error('Only an admin may reconcile research counters.');
    return;
  }
  if (command.action === 'correct') {
    if (role !== 'admin') throw new Error('Only an admin may correct a settled observation.');
    return;
  }
  if (command.action === 'assign' || command.action === 'unassign') {
    if (role !== 'admin') throw new Error('Only an admin may change another operator’s research assignment.');
    return;
  }
  if (
    command.queue === 'community_research_task'
    && (
      command.action === 'claim'
      || command.action === 'defer'
      || command.action === 'retry'
    )
  ) {
    if (role === 'moderator') throw new Error('Research assignment requires an operator or admin.');
    return;
  }
  if (command.action === 'note' || command.action === 'claim' || command.action === 'defer' || command.action === 'retry') return;
  if (role === 'admin' || role === 'operator') return;
  if (
    (command.action === 'approve' || command.action === 'reject')
    && (command.queue === 'community_edge' || command.queue === 'community_observation')
  ) return;
  throw new Error('The active operator role cannot perform this action.');
}

async function inspection(sql: Sql) {
  const [
    migration,
    contributions,
    queue,
    research,
    integrity,
  ] = await Promise.all([
    sql<{ latest: string; count: number }[]>`
      select coalesce(max(filename), 'none') as latest, count(*)::integer as count
      from schema_migrations
    `,
    sql<{ kind: string; pending: number; approved: number; rejected: number }[]>`
      select
        contribution_kind::text as kind,
        count(*) filter (
          where moderation_status = 'pending' and retain_until > now()
        )::integer as pending,
        count(*) filter (
          where moderation_status = 'approved' and retain_until > now()
        )::integer as approved,
        count(*) filter (where moderation_status = 'rejected')::integer as rejected
      from community_contributions
      group by contribution_kind
      order by contribution_kind
    `,
    sql<{
      pending_contributions: number;
      pending_edges: number;
      pending_observations: number;
      pending_values: number;
      oldest_pending_at: Date | null;
    }[]>`
      select
        (
          select count(*) from community_contributions
          where moderation_status = 'pending' and retain_until > now()
        )::integer as pending_contributions,
        (
          select count(*)
          from community_knowledge_edges edge
          join community_contributions contribution on contribution.id = edge.contribution_id
          where edge.moderation_status = 'pending'
            and contribution.moderation_status <> 'rejected'
            and contribution.retain_until > now()
        )::integer as pending_edges,
        (
          select count(*)
          from community_observations observation
          join community_contributions contribution on contribution.id = observation.contribution_id
          where observation.moderation_status = 'pending'
            and contribution.moderation_status <> 'rejected'
            and contribution.retain_until > now()
        )::integer as pending_observations,
        (
          select count(*)
          from community_moderation_values value
          where value.status = 'pending'
            and exists (
              select 1
              from community_moderation_mentions mention
              join community_contributions contribution on contribution.id = mention.contribution_id
              where mention.moderation_value_id = value.id
                and contribution.moderation_status <> 'rejected'
                and contribution.retain_until > now()
            )
        )::integer as pending_values,
        (
          select min(submitted_at)
          from community_contributions
          where moderation_status = 'pending' and retain_until > now()
        ) as oldest_pending_at
    `,
    sql<{ task_kind: string; task_count: number; active_signals: number }[]>`
      select
        task.task_kind,
        count(distinct task.id)::integer as task_count,
        count(*)::integer as active_signals
      from community_research_tasks task
      join community_research_task_mentions mention on mention.task_id = task.id
      join community_contributions contribution on contribution.id = mention.contribution_id
      where task.status in ('pending', 'in-progress')
        and contribution.moderation_status <> 'rejected'
        and contribution.retain_until > now()
      group by task.task_kind
      order by task.task_kind
    `,
    sql<{
      counter_drift: number;
      pending_children_of_rejected: number;
      expired_pending_contributions: number;
    }[]>`
      select
        (
          select count(*)
          from community_research_tasks task
          where task.signal_count <> (
            select count(distinct mention.contribution_id)
            from community_research_task_mentions mention
            join community_contributions contribution on contribution.id = mention.contribution_id
            where mention.task_id = task.id
              and contribution.moderation_status <> 'rejected'
              and contribution.retain_until > now()
          )
        )::integer as counter_drift,
        (
          select count(*) from (
            select edge.id
            from community_knowledge_edges edge
            join community_contributions contribution on contribution.id = edge.contribution_id
            where edge.moderation_status = 'pending'
              and contribution.moderation_status = 'rejected'
            union all
            select observation.id
            from community_observations observation
            join community_contributions contribution on contribution.id = observation.contribution_id
            where observation.moderation_status = 'pending'
              and contribution.moderation_status = 'rejected'
          ) orphaned_children
        )::integer as pending_children_of_rejected,
        (
          select count(*) from community_contributions
          where moderation_status = 'pending' and retain_until <= now()
        )::integer as expired_pending_contributions
    `,
  ]);

  const queueRow = queue[0];
  return {
    generatedAt: new Date().toISOString(),
    disclosure: 'aggregate-only',
    migrationLedger: migration[0],
    contributions,
    pendingQueues: {
      contributions: queueRow?.pending_contributions ?? 0,
      edges: queueRow?.pending_edges ?? 0,
      observations: queueRow?.pending_observations ?? 0,
      vocabulary: queueRow?.pending_values ?? 0,
      oldestContributionAt: queueRow?.oldest_pending_at?.toISOString() ?? null,
    },
    communityFirstResearch: research,
    integrity: integrity[0],
  };
}

async function applyOrPreview(sql: Sql, operator: Operator, command: Exclude<OperatorCommand, { action: 'inspect' }>) {
  assertCapability(operator.role, command);

  if (command.action === 'reconcile') {
    if (!command.apply) {
      return { mode: 'dry-run', action: command.action, queue: command.queue, wouldWrite: false };
    }
    const reconciled = await reconcileCommunityResearchTasks(sql, operator.auth_subject, command.rationale);
    return { mode: 'applied', action: command.action, queue: command.queue, reconciled, wouldWrite: reconciled > 0 };
  }

  if (command.action === 'correct') {
    if (!await moderationTargetExists(sql, command.queue, command.targetId)) {
      throw new Error('Moderation target does not exist.');
    }
    if (!command.apply) {
      return {
        mode: 'dry-run',
        action: command.action,
        queue: command.queue,
        targetId: command.targetId,
        disposition: command.disposition,
        wouldWrite: false,
      };
    }
    const settled = await correctApprovedObservation(
      sql,
      operator.auth_subject,
      command.targetId,
      command.disposition,
      command.rationale,
    );
    if (!settled) throw new Error('The observation is not approved; no correction was recorded.');
    return {
      mode: 'applied',
      action: command.action,
      queue: command.queue,
      targetId: command.targetId,
      disposition: command.disposition,
      wouldWrite: true,
    };
  }

  if (!await moderationTargetExists(sql, command.queue, command.targetId)) {
    throw new Error('Moderation target does not exist.');
  }
  if (command.action === 'map' && !await canonicalModerationTargetExists(
    sql,
    command.canonicalEntityKind,
    command.canonicalEntityRef,
  )) {
    throw new Error('Canonical mapping target does not exist.');
  }
  if (
    command.queue === 'community_research_task'
    && (
      command.action === 'claim'
      || command.action === 'defer'
      || command.action === 'retry'
      || command.action === 'assign'
      || command.action === 'unassign'
    )
  ) {
    await preflightResearchAssignment(
      sql,
      operator.auth_subject,
      command.targetId,
      command.action,
      command.action === 'assign' ? { targetOperatorId: command.targetOperatorId } : {},
    );
  }
  if (!command.apply) {
    return {
      mode: 'dry-run',
      action: command.action,
      queue: command.queue,
      targetId: command.targetId,
      wouldWrite: false,
    };
  }

  let settled: string | null | undefined;
  if (command.action === 'approve' || command.action === 'reject') {
    settled = command.queue === 'community_contribution'
      ? await decideContribution(sql, operator.auth_subject, command.targetId, command.action, command.rationale)
      : command.queue === 'community_edge'
        ? await decideEdge(sql, operator.auth_subject, command.targetId, command.action, command.rationale)
        : command.queue === 'community_observation'
          ? await decideObservation(sql, operator.auth_subject, command.targetId, command.action, command.rationale)
          : await decideModerationValue(sql, operator.auth_subject, command.targetId, command.action, command.rationale);
  } else if (command.action === 'map') {
    settled = await mapModerationValue(
      sql,
      operator.auth_subject,
      command.targetId,
      command.canonicalEntityKind,
      command.canonicalEntityRef,
      command.rationale,
    );
  } else if (command.action === 'assign' || command.action === 'unassign') {
    await updateResearchAssignment(
      sql,
      operator.auth_subject,
      command.targetId,
      command.action,
      command.rationale,
      command.action === 'assign' ? { targetOperatorId: command.targetOperatorId } : {},
    );
    settled = command.targetId;
  } else {
    await recordNote(
      sql,
      command.queue,
      operator.auth_subject,
      command.targetId,
      command.rationale,
      command.action,
    );
    settled = command.targetId;
  }

  if (!settled) throw new Error('The item is no longer pending; no action was recorded.');
  return {
    mode: 'applied',
    action: command.action,
    queue: command.queue,
    targetId: command.targetId,
    wouldWrite: true,
  };
}

async function main() {
  const command = parseOperatorCommand(process.argv.slice(2));
  const sql = postgres(connectionString(), { max: 1, prepare: false });
  try {
    const operator = await resolveOperator(sql);
    assertCapability(operator.role, command);
    const result = command.action === 'inspect'
      ? await inspection(sql)
      : await applyOrPreview(sql, operator, command);
    console.log(JSON.stringify(result, null, command.json ? 0 : 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Community moderation operator failed.');
  process.exitCode = 1;
});
