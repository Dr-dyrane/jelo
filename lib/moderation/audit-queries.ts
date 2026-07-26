import 'server-only';

import type { Sql } from 'postgres';
import type { ModerationAction } from './schema';

function boundedLimit(limit: number) {
  return Math.min(Math.max(Math.trunc(limit), 1), 500);
}

export type DecisionHistoryEntry = {
  id: string;
  operatorName: string;
  operatorEmail: string | null;
  queue: ModerationAction['queue'];
  action: ModerationAction['action'];
  targetRef: string;
  canonicalWrite: boolean;
  rationale: string | null;
  createdAt: string;
};

export type OverviewDecisionHistoryEntry = DecisionHistoryEntry & {
  targetLabel: string;
  globalRank: number;
  queueRank: number;
};

export async function listDecisionHistory(sql: Sql, limit = 100): Promise<DecisionHistoryEntry[]> {
  const rows = await sql<{
    id: string;
    operator_name: string;
    operator_email: string | null;
    queue: ModerationAction['queue'];
    action: ModerationAction['action'];
    target_ref: string;
    canonical_write: boolean;
    rationale: string | null;
    created_at: string;
  }[]>`
    select
      audit.id,
      coalesce(operator.display_name, operator.email, audit.operator_subject) as operator_name,
      operator.email as operator_email,
      audit.queue,
      audit.action,
      audit.target_ref,
      audit.canonical_write,
      audit.rationale,
      audit.created_at::text as created_at
    from moderation_audit_log as audit
    left join moderation_operators as operator on operator.auth_subject = audit.operator_subject
    order by audit.created_at desc
    limit ${boundedLimit(limit)}
  `;

  return rows.map(row => ({
    id: row.id,
    operatorName: row.operator_name,
    operatorEmail: row.operator_email,
    queue: row.queue,
    action: row.action,
    targetRef: row.target_ref,
    canonicalWrite: row.canonical_write,
    rationale: row.rationale,
    createdAt: row.created_at,
  }));
}

// Overview needs two truthful windows from the same audit projection:
// the latest decisions globally and the latest decisions for every queue.
// Ranking before limiting prevents a busy queue from making another queue look
// as though it has no history.
export async function listOverviewDecisionHistory(
  sql: Sql,
  globalLimit = 5,
  perQueueLimit = 3,
): Promise<OverviewDecisionHistoryEntry[]> {
  const globalWindow = boundedLimit(globalLimit);
  const queueWindow = boundedLimit(perQueueLimit);
  const rows = await sql<{
    id: string;
    operator_name: string;
    operator_email: string | null;
    queue: ModerationAction['queue'];
    action: ModerationAction['action'];
    target_ref: string;
    target_label: string;
    canonical_write: boolean;
    rationale: string | null;
    created_at: string;
    global_rank: number;
    queue_rank: number;
  }[]>`
    with enriched as (
      select
        audit.id,
        coalesce(operator.display_name, operator.email, audit.operator_subject) as operator_name,
        operator.email as operator_email,
        audit.queue,
        audit.action,
        audit.target_ref,
        coalesce(
          case
            when audit.queue = 'community_contribution' then (
              select coalesce(
                contribution.payload -> 'products' -> 0 ->> 'label',
                contribution.payload -> 'brands' -> 0 ->> 'label',
                initcap(contribution.contribution_kind::text) || ' contribution'
              )
              from community_contributions contribution
              where contribution.id::text = audit.target_ref
            )
            when audit.queue = 'community_observation' then (
              select coalesce(
                contribution.payload -> 'products' -> 0 ->> 'label',
                observation.subject_ref
              )
              from community_observations observation
              join community_contributions contribution on contribution.id = observation.contribution_id
              where observation.id::text = audit.target_ref
            )
            when audit.queue = 'community_edge' then (
              select coalesce(
                contribution.payload -> 'products' -> 0 ->> 'label',
                edge.subject_ref
              )
              from community_knowledge_edges edge
              join community_contributions contribution on contribution.id = edge.contribution_id
              where edge.id::text = audit.target_ref
            )
            when audit.queue = 'community_moderation_value' then (
              select value.raw_value
              from community_moderation_values value
              where value.id::text = audit.target_ref
            )
            when audit.queue = 'community_research_task' then (
              select task.entity_label
              from community_research_tasks task
              where task.id::text = audit.target_ref
            )
            when audit.queue = 'retailer_application' then (
              select application.store_name
              from retailer_partnership_applications application
              where application.id::text = audit.target_ref
            )
            else null
          end,
          audit.target_ref
        ) as target_label,
        audit.canonical_write,
        audit.rationale,
        audit.created_at,
        row_number() over (order by audit.created_at desc) as global_rank,
        row_number() over (partition by audit.queue order by audit.created_at desc) as queue_rank
      from moderation_audit_log audit
      left join moderation_operators operator on operator.auth_subject = audit.operator_subject
    )
    select
      id,
      operator_name,
      operator_email,
      queue,
      action,
      target_ref,
      target_label,
      canonical_write,
      rationale,
      created_at::text as created_at,
      global_rank::int as global_rank,
      queue_rank::int as queue_rank
    from enriched
    where global_rank <= ${globalWindow} or queue_rank <= ${queueWindow}
    order by created_at desc
  `;

  return rows.map(row => ({
    id: row.id,
    operatorName: row.operator_name,
    operatorEmail: row.operator_email,
    queue: row.queue,
    action: row.action,
    targetRef: row.target_ref,
    targetLabel: row.target_label,
    canonicalWrite: row.canonical_write,
    rationale: row.rationale,
    createdAt: row.created_at,
    globalRank: row.global_rank,
    queueRank: row.queue_rank,
  }));
}
