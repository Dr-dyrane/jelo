import "server-only";

import type { Sql } from "postgres";
import { listOverviewDecisionHistory } from "@/lib/moderation/audit-queries";
import { humanizeRef } from "@/lib/humanize/refs";
import { can, type Capability } from "@/lib/moderation/capabilities";
import type { ModerationRole } from "@/lib/moderation/access";
import { resolveOpsProductImages } from "@/lib/moderation/ops-product-visuals";
import type {
  OpsOrderQueueAgeFact,
  OpsOrderQueueAgeKind,
} from "@/lib/commerce/order-queue-age-policy";
import {
  buildOverviewBriefing,
  overviewQueueKindForAuditQueue,
  OVERVIEW_QUEUES,
  type OverviewBriefingReadModel,
  type OverviewAuditEntry,
  type OverviewFeaturedItemFact,
  type OverviewQueueFact,
  type OverviewQueueKind,
} from "./overview-briefing";

const QUEUE_CAPABILITIES: Record<OverviewQueueKind, Capability> = {
  orders: "orders.manage",
  contributions: "contributions.decide",
  edges: "edges.decide",
  observations: "observations.decide",
  vocabulary: "vocabulary.decide",
  retailers: "retailers.decide",
};

type OverviewQueueRow = {
  kind: OverviewQueueKind;
  pending_count: number;
  oldest_pending_at: string | null;
};

type OverviewOldestItemRow = {
  queue_kind: OverviewQueueKind;
  record_id: string;
  created_at: string;
  title: string;
  summary: string;
  product_ref: string | null;
};

type OpsOrderQueueAgeRow = {
  as_of: string;
  policy_kind: OpsOrderQueueAgeKind | null;
  actionable_count: number;
  clocked_count: number;
  oldest_waiting_at: string | null;
};

export type OpsOrderQueueAgeSnapshot = {
  asOf: string;
  facts: OpsOrderQueueAgeFact[];
};

export async function readOpsOrderQueueAgeFacts(
  sql: Sql,
): Promise<OpsOrderQueueAgeSnapshot> {
  return sql.begin("read only", async (transaction) => {
    const rows = await transaction<OpsOrderQueueAgeRow[]>`
      with database_clock as (
        select now() as as_of
      ),
      ops_order_waiting as (
        select
          orders.id,
          case
            when orders.state = 'delivered' then open_return.created_at
            else wait_anchor.created_at
          end as waiting_since,
          case
            when orders.state = 'delivered' then 'return_review'
            when wait_anchor.action = 'payment_review_required' then 'payment_review'
            else 'operator_action'
          end as policy_kind
        from assisted_orders as orders
        cross join database_clock
        left join lateral (
          select requested_return.created_at
          from assisted_order_events as requested_return
          where requested_return.order_id = orders.id
            and requested_return.action = 'return_requested'
            and not exists (
              select 1 from assisted_order_events as return_decision
              where return_decision.order_id = orders.id
                and return_decision.sequence_id > requested_return.sequence_id
                and return_decision.action in ('return_declined', 'refund_pending')
            )
          order by requested_return.sequence_id desc
          limit 1
        ) as open_return on orders.state = 'delivered'
        left join lateral (
          select anchor.created_at, anchor.action
          from assisted_order_events as anchor
          where anchor.order_id = orders.id
            and anchor.to_state = orders.state
            and (
              anchor.from_state is distinct from anchor.to_state
              or anchor.action = 'payment_review_required'
            )
          order by anchor.sequence_id desc
          limit 1
        ) as wait_anchor on orders.state <> 'delivered'
        where orders.retain_until > database_clock.as_of
          and (
            orders.state in (
              'requested', 'quoting', 'needs_response', 'payment_pending',
              'paid', 'procurement', 'retailer_confirmed', 'out_for_delivery',
              'refund_pending'
            )
            or (orders.state = 'delivered' and open_return.created_at is not null)
          )
      )
      select
        database_clock.as_of::text as as_of,
        ops_order_waiting.policy_kind,
        count(ops_order_waiting.id)::int as actionable_count,
        count(ops_order_waiting.waiting_since)::int as clocked_count,
        min(ops_order_waiting.waiting_since)::text as oldest_waiting_at
      from database_clock
      left join ops_order_waiting on true
      group by database_clock.as_of, ops_order_waiting.policy_kind
      order by ops_order_waiting.policy_kind
    `;

    const asOf = rows[0]?.as_of;
    if (!asOf || rows.some((row) => row.as_of !== asOf)) {
      throw new Error("Ops order queue age database clock is unavailable.");
    }

    return {
      asOf,
      facts: rows.flatMap((row) =>
        row.policy_kind
          ? [
              {
                kind: row.policy_kind,
                actionableCount: row.actionable_count,
                clockedCount: row.clocked_count,
                oldestWaitingAt: row.oldest_waiting_at,
              },
            ]
          : [],
      ),
    };
  });
}

async function listOverviewQueueFacts(sql: Sql): Promise<OverviewQueueFact[]> {
  const rows = await sql<OverviewQueueRow[]>`
    with ops_order_waiting as (
      select
        orders.id,
        case
          when orders.state = 'delivered' then open_return.created_at
          else wait_anchor.created_at
        end as waiting_since
      from assisted_orders as orders
      left join lateral (
        select requested_return.created_at
        from assisted_order_events as requested_return
        where requested_return.order_id = orders.id
          and requested_return.action = 'return_requested'
          and not exists (
            select 1 from assisted_order_events as return_decision
            where return_decision.order_id = orders.id
              and return_decision.sequence_id > requested_return.sequence_id
              and return_decision.action in ('return_declined', 'refund_pending')
          )
        order by requested_return.sequence_id desc
        limit 1
      ) as open_return on orders.state = 'delivered'
      left join lateral (
        select anchor.created_at
        from assisted_order_events as anchor
        where anchor.order_id = orders.id
          and anchor.to_state = orders.state
          and (
            anchor.from_state is distinct from anchor.to_state
            or anchor.action = 'payment_review_required'
          )
        order by anchor.sequence_id desc
        limit 1
      ) as wait_anchor on orders.state <> 'delivered'
      where orders.retain_until > now()
        and (
          orders.state in (
            'requested', 'quoting', 'needs_response', 'payment_pending',
            'paid', 'procurement', 'retailer_confirmed', 'out_for_delivery',
            'refund_pending'
          )
          or (orders.state = 'delivered' and open_return.created_at is not null)
        )
    )
    select 'orders'::text as kind, count(*)::int as pending_count,
      case
        when count(waiting_since) = count(*) then min(waiting_since)::text
        else null
      end as oldest_pending_at
    from ops_order_waiting
    union all
    select 'contributions'::text as kind, count(*)::int as pending_count, min(submitted_at)::text as oldest_pending_at
    from community_contributions
    where moderation_status = 'pending' and retain_until > now()
    union all
    select 'edges'::text as kind, count(*)::int as pending_count, min(edge.created_at)::text as oldest_pending_at
    from community_knowledge_edges as edge
    join community_contributions as contribution on contribution.id = edge.contribution_id
    where edge.moderation_status = 'pending'
      and contribution.moderation_status <> 'rejected'
      and contribution.retain_until > now()
    union all
    select 'observations'::text as kind, count(*)::int as pending_count, min(observation.created_at)::text as oldest_pending_at
    from community_observations as observation
    join community_contributions as contribution on contribution.id = observation.contribution_id
    where observation.moderation_status = 'pending'
      and contribution.moderation_status <> 'rejected'
      and contribution.retain_until > now()
    union all
    select 'vocabulary'::text as kind, count(distinct value.id)::int as pending_count, min(contribution.submitted_at)::text as oldest_pending_at
    from community_moderation_values as value
    join community_moderation_mentions as mention on mention.moderation_value_id = value.id
    join community_contributions as contribution on contribution.id = mention.contribution_id
    where value.status = 'pending'
      and contribution.moderation_status <> 'rejected'
      and contribution.retain_until > now()
    union all
    select 'retailers'::text as kind, count(*)::int as pending_count,
      min(coalesce(submitted_at, updated_at))::text as oldest_pending_at
    from retailer_partnership_applications
    where status = 'submitted'
  `;

  return rows.map((row) => ({
    kind: row.kind,
    pendingCount: row.pending_count,
    oldestPendingAt: row.oldest_pending_at,
  }));
}

async function listOverviewOldestItems(
  sql: Sql,
): Promise<OverviewFeaturedItemFact[]> {
  const rows = await sql<OverviewOldestItemRow[]>`
    with pending_items as (
      select
        'contributions'::text as queue_kind,
        contribution.id::text as record_id,
        contribution.submitted_at as created_at,
        coalesce(
          contribution.payload #>> '{products,0,label}',
          contribution.payload #>> '{brands,0,label}',
          initcap(contribution.contribution_kind::text) || ' contribution'
        ) as title,
        coalesce(
          contribution.payload #>> '{retailers,0,label}',
          contribution.payload #>> '{brands,0,label}',
          initcap(contribution.contribution_kind::text)
        ) as summary,
        case
          when contribution.payload #>> '{products,0,source}' = 'canonical'
            then contribution.payload #>> '{products,0,id}'
          else null
        end as product_ref
      from community_contributions contribution
      where contribution.moderation_status = 'pending'
        and contribution.retain_until > now()
      union all
      select
        'edges'::text,
        edge.id::text,
        edge.created_at,
        coalesce(
          contribution.payload #>> '{products,0,label}',
          edge.subject_ref
        ),
        concat_ws(
          ' · ',
          initcap(replace(edge.predicate, '_', ' ')),
          nullif(initcap(replace(split_part(edge.object_ref, ':', 2), '-', ' ')), '')
        ),
        case
          when contribution.payload #>> '{products,0,source}' = 'canonical'
            then contribution.payload #>> '{products,0,id}'
          else null
        end
      from community_knowledge_edges edge
      join community_contributions contribution on contribution.id = edge.contribution_id
      where edge.moderation_status = 'pending'
        and contribution.moderation_status <> 'rejected'
        and contribution.retain_until > now()
      union all
      select
        'observations'::text,
        observation.id::text,
        observation.created_at,
        coalesce(
          contribution.payload #>> '{products,0,label}',
          observation.subject_ref
        ),
        case
          when observation.observation_kind = 'price' then
            '₦' || to_char(observation.amount_ngn, 'FM999,999,999')
          when observation.outcome = 'love-it' then 'Love it'
          when observation.outcome = 'helped' then 'Helped'
          when observation.outcome = 'unsure' then 'Not sure'
          when observation.outcome = 'didnt-help' then 'Didn’t help'
          else 'Community report'
        end,
        case
          when observation.subject_kind = 'product'
            and contribution.payload #>> '{products,0,source}' = 'canonical'
            and observation.subject_ref = contribution.payload #>> '{products,0,id}'
            then observation.subject_ref
          else null
        end
      from community_observations observation
      join community_contributions contribution on contribution.id = observation.contribution_id
      where observation.moderation_status = 'pending'
        and contribution.moderation_status <> 'rejected'
        and contribution.retain_until > now()
      union all
      select
        'vocabulary'::text,
        value.id::text,
        min(contribution.submitted_at),
        value.raw_value,
        initcap(value.value_kind) || ' · ' || value.occurrence_count::text ||
          case when value.occurrence_count = 1 then ' mention' else ' mentions' end,
        null::text
      from community_moderation_values value
      join community_moderation_mentions mention on mention.moderation_value_id = value.id
      join community_contributions contribution on contribution.id = mention.contribution_id
      where value.status = 'pending'
        and contribution.moderation_status <> 'rejected'
        and contribution.retain_until > now()
      group by value.id, value.raw_value, value.value_kind, value.occurrence_count
      union all
      select
        'retailers'::text,
        application.id::text,
        coalesce(application.submitted_at, application.updated_at),
        application.store_name,
        coalesce(
          application.payload ->> 'city',
          application.payload ->> 'state',
          'Retailer application'
        ),
        null::text
      from retailer_partnership_applications application
      where application.status = 'submitted'
    ),
    ranked_items as (
      select
        pending_items.*,
        row_number() over (
          partition by queue_kind
          order by created_at asc, record_id asc
        ) as queue_rank
      from pending_items
    )
    select
      queue_kind,
      record_id,
      created_at::text,
      title,
      summary,
      product_ref
    from ranked_items
    where queue_rank <= 2
    order by queue_kind, queue_rank
  `;

  return rows.map((row) => {
    const product = row.product_ref ? humanizeRef(row.product_ref) : null;
    return {
      id: row.record_id,
      queueKind: row.queue_kind,
      title: row.title,
      summary: row.summary,
      createdAt: row.created_at,
      image: product?.displayApproved ? (product.image ?? null) : null,
    };
  });
}

// The queue projection is one small aggregate read; audit history is independent
// and may fail without making reliable queue counts look partial.
export async function loadOverviewBriefing(
  sql: Sql,
  role: ModerationRole,
): Promise<OverviewBriefingReadModel> {
  const [queueFacts, oldestItemsResult, auditResult] = await Promise.all([
    listOverviewQueueFacts(sql),
    listOverviewOldestItems(sql).then(
      (rows) => ({ rows, unavailable: false }),
      (error) => {
        console.error("Could not load oldest operations records.", error);
        return { rows: [], unavailable: true };
      },
    ),
    listOverviewDecisionHistory(sql, 5, 3).then(
      (rows) => ({ rows, unavailable: false }),
      (error) => {
        console.error("Could not load recent operations decisions.", error);
        return { rows: [], unavailable: true };
      },
    ),
  ]);

  const productImages = await resolveOpsProductImages(
    auditResult.rows.map((row) => row.productRef),
  );
  const recentDecisions = auditResult.rows
    .filter((row) => row.globalRank <= 5)
    .map<OverviewAuditEntry>((row) => ({
      id: row.id,
      operatorName: row.operatorName,
      queue: row.queue,
      action: row.action,
      targetLabel: row.targetLabel,
      createdAt: row.createdAt,
      image: row.productRef
        ? (productImages.get(row.productRef) ?? null)
        : null,
    }));
  const recentDecisionsByQueue: Partial<
    Record<OverviewQueueKind, OverviewAuditEntry[]>
  > = {};
  for (const row of auditResult.rows) {
    if (row.queueRank > 3) continue;
    const queueKind = overviewQueueKindForAuditQueue(row.queue);
    if (!queueKind) continue;
    (recentDecisionsByQueue[queueKind] ??= []).push({
      id: row.id,
      operatorName: row.operatorName,
      queue: row.queue,
      action: row.action,
      targetLabel: row.targetLabel,
      createdAt: row.createdAt,
      image: row.productRef
        ? (productImages.get(row.productRef) ?? null)
        : null,
    });
  }

  return buildOverviewBriefing({
    queueFacts,
    actionableQueueKinds: OVERVIEW_QUEUES.filter((queue) =>
      can(role, QUEUE_CAPABILITIES[queue.kind]),
    ).map((queue) => queue.kind),
    oldestItems: oldestItemsResult.rows,
    upNextUnavailable: oldestItemsResult.unavailable,
    recentDecisions,
    recentDecisionsByQueue,
    recentDecisionsUnavailable: auditResult.unavailable,
  });
}
