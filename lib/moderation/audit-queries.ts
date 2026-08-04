import 'server-only';

import type { Sql } from 'postgres';
import type { ModerationAction } from './schema';

function boundedLimit(limit: number) {
  return Math.min(Math.max(Math.trunc(limit), 1), 500);
}

const uuidPattern = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';

export type DecisionHistoryEntry = {
  id: string;
  eventSequence: string;
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
  productRef: string | null;
  globalRank: number;
  queueRank: number;
};

export async function listDecisionHistory(sql: Sql, limit = 100): Promise<DecisionHistoryEntry[]> {
  const rows = await sql<{
    id: string;
    event_sequence: string;
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
      audit.event_sequence::text as event_sequence,
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
    order by audit.event_sequence desc
    limit ${boundedLimit(limit)}
  `;

  return rows.map(row => ({
    id: row.id,
    eventSequence: row.event_sequence,
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
    event_sequence: string;
    operator_name: string;
    operator_email: string | null;
    queue: ModerationAction['queue'];
    action: ModerationAction['action'];
    target_ref: string;
    target_label: string;
    product_ref: string | null;
    canonical_write: boolean;
    rationale: string | null;
    created_at: string;
    global_rank: number;
    queue_rank: number;
  }[]>`
    with enriched as (
      select
        audit.id,
        audit.event_sequence,
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
        case
          when audit.queue = 'community_contribution' then (
            select case
              when contribution.payload #>> '{products,0,source}' = 'canonical'
                then contribution.payload #>> '{products,0,id}'
              else null
            end
            from community_contributions contribution
            where contribution.id = case
              when audit.target_ref ~* ${uuidPattern} then audit.target_ref::uuid
              else null
            end
          )
          when audit.queue = 'community_observation' then (
            select case
              when observation.subject_kind = 'product'
                and contribution.payload #>> '{products,0,source}' = 'canonical'
                and observation.subject_ref = contribution.payload #>> '{products,0,id}'
                then observation.subject_ref
              else null
            end
            from community_observations observation
            join community_contributions contribution
              on contribution.id = observation.contribution_id
            where observation.id = case
              when audit.target_ref ~* ${uuidPattern} then audit.target_ref::uuid
              else null
            end
          )
          when audit.queue = 'community_edge' then (
            select case
              when contribution.payload #>> '{products,0,source}' = 'canonical'
                then contribution.payload #>> '{products,0,id}'
              else null
            end
            from community_knowledge_edges edge
            join community_contributions contribution
              on contribution.id = edge.contribution_id
            where edge.id = case
              when audit.target_ref ~* ${uuidPattern} then audit.target_ref::uuid
              else null
            end
          )
          when audit.queue = 'community_moderation_value' then (
            select case
              when value.status = 'mapped'
                and value.canonical_entity_kind = 'product'
                then value.canonical_entity_ref
              else null
            end
            from community_moderation_values value
            where value.id = case
              when audit.target_ref ~* ${uuidPattern} then audit.target_ref::uuid
              else null
            end
          )
          when audit.queue = 'community_research_task' then (
            select coalesce(
              case
                when resolution.canonical_product_slug is not null
                  then 'product:' || resolution.canonical_product_slug
                else null
              end,
              case
                when task.entity_kind = 'product' and task.entity_source = 'canonical'
                  then task.entity_ref
                else null
              end
            )
            from community_research_tasks task
            left join community_product_research_resolutions resolution
              on resolution.task_id = task.id
              and resolution.resolution_cycle = task.resolution_cycle
            where task.id = case
              when audit.target_ref ~* ${uuidPattern} then audit.target_ref::uuid
              else null
            end
          )
          when audit.queue = 'commerce_signal' then (
            select event.product_slug
            from commerce_events event
            where event.id = case
              when audit.target_ref ~* ${uuidPattern} then audit.target_ref::uuid
              else null
            end
          )
          else null
        end as product_ref,
        audit.canonical_write,
        audit.rationale,
        audit.created_at,
        row_number() over (order by audit.event_sequence desc) as global_rank,
        row_number() over (
          partition by audit.queue
          order by audit.event_sequence desc
        ) as queue_rank
      from moderation_audit_log audit
      left join moderation_operators operator on operator.auth_subject = audit.operator_subject
    )
    select
      id,
      event_sequence::text as event_sequence,
      operator_name,
      operator_email,
      queue,
      action,
      target_ref,
      target_label,
      product_ref,
      canonical_write,
      rationale,
      created_at::text as created_at,
      global_rank::int as global_rank,
      queue_rank::int as queue_rank
    from enriched
    where global_rank <= ${globalWindow} or queue_rank <= ${queueWindow}
    order by event_sequence desc
  `;

  return rows.map(row => ({
    id: row.id,
    eventSequence: row.event_sequence,
    operatorName: row.operator_name,
    operatorEmail: row.operator_email,
    queue: row.queue,
    action: row.action,
    targetRef: row.target_ref,
    targetLabel: row.target_label,
    productRef: row.product_ref,
    canonicalWrite: row.canonical_write,
    rationale: row.rationale,
    createdAt: row.created_at,
    globalRank: row.global_rank,
    queueRank: row.queue_rank,
  }));
}
