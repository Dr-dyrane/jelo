import 'server-only';

import type { Sql } from 'postgres';
import { canonicalResearchEntitySlug } from '@/lib/community-intake/research-reference';
import { resolveOpsProductImages } from './ops-product-visuals';

export type PendingResearchTask = {
  id: string;
  taskKind: 'product-identity' | 'product-retail-refresh' | 'retailer-identity' | 'retailer-refresh';
  entityKind: 'product' | 'retailer';
  entityRef: string;
  entityLabel: string;
  entitySource: 'canonical' | 'custom';
  canonicalTargetRef: string | null;
  image: string | null;
  signalCount: number;
  status: 'pending' | 'in-progress';
  workState: 'ready' | 'assigned' | 'blocked' | 'retry';
  workRank: number;
  nextAction: string | null;
  assigneeName: string | null;
  assignedOperatorId: string | null;
  isOwnedByCurrentOperator: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: string;
};

export type ResearchTaskCursor = {
  workRank: number;
  signalCount: number;
  firstSeenAt: string;
  id: string;
};

export type ResearchAssignmentOption = {
  id: string;
  label: string;
  role: 'operator' | 'admin';
};

export type ResearchCanonicalOption = {
  id: string;
  label: string;
};

export type ResearchCanonicalOptions = {
  products: ResearchCanonicalOption[];
  retailers: ResearchCanonicalOption[];
};

type ResearchTaskRow = {
  id: string;
  task_kind: PendingResearchTask['taskKind'];
  entity_kind: PendingResearchTask['entityKind'];
  entity_ref: string;
  entity_label: string;
  entity_source: PendingResearchTask['entitySource'];
  signal_count: number;
  status: PendingResearchTask['status'];
  work_state: PendingResearchTask['workState'];
  work_rank: number;
  next_action: string | null;
  assigned_operator_id: string | null;
  assignee_name: string | null;
  first_seen_at: string;
  last_seen_at: string;
  updated_at: string;
};

async function presentResearchTasks(
  rows: ResearchTaskRow[],
  currentOperatorId: string,
): Promise<PendingResearchTask[]> {
  const productRefs = rows.map(row => (
    row.entity_kind === 'product' && row.entity_source === 'canonical'
      ? row.entity_ref
      : null
  ));
  const images = await resolveOpsProductImages(productRefs);
  return rows.map(row => ({
    id: row.id,
    taskKind: row.task_kind,
    entityKind: row.entity_kind,
    entityRef: row.entity_ref,
    entityLabel: row.entity_label,
    entitySource: row.entity_source,
    canonicalTargetRef: row.entity_source === 'canonical'
      ? canonicalResearchEntitySlug(row.entity_kind, row.entity_ref)
      : null,
    image: images.get(row.entity_ref) ?? null,
    signalCount: row.signal_count,
    status: row.status,
    workState: row.work_state,
    workRank: row.work_rank,
    nextAction: row.next_action,
    assigneeName: row.assignee_name,
    assignedOperatorId: row.assigned_operator_id,
    isOwnedByCurrentOperator: row.assigned_operator_id === currentOperatorId,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    updatedAt: row.updated_at,
  }));
}

export async function listPendingResearchTasks(
  sql: Sql,
  currentOperatorId: string,
  limit = 100,
  after?: ResearchTaskCursor,
): Promise<PendingResearchTask[]> {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
  const afterCursor = after
    ? sql`
        and (
          (case task.work_state when 'ready' then 0 when 'retry' then 1 when 'assigned' then 2 else 3 end)
            > ${after.workRank}
          or (
            (case task.work_state when 'ready' then 0 when 'retry' then 1 when 'assigned' then 2 else 3 end)
              = ${after.workRank}
            and task.signal_count < ${after.signalCount}
          )
          or (
            (case task.work_state when 'ready' then 0 when 'retry' then 1 when 'assigned' then 2 else 3 end)
              = ${after.workRank}
            and task.signal_count = ${after.signalCount}
            and task.first_seen_at > ${after.firstSeenAt}::text::timestamptz
          )
          or (
            (case task.work_state when 'ready' then 0 when 'retry' then 1 when 'assigned' then 2 else 3 end)
              = ${after.workRank}
            and task.signal_count = ${after.signalCount}
            and task.first_seen_at = ${after.firstSeenAt}::text::timestamptz
            and task.id > ${after.id}::uuid
          )
        )
      `
    : sql``;
  const rows = await sql<ResearchTaskRow[]>`
    select
      task.id,
      task.task_kind,
      task.entity_kind,
      task.entity_ref,
      task.entity_label,
      task.entity_source,
      task.signal_count,
      task.status,
      task.work_state,
      case task.work_state when 'ready' then 0 when 'retry' then 1 when 'assigned' then 2 else 3 end
        as work_rank,
      task.next_action,
      task.assigned_operator_id,
      coalesce(operator.display_name, operator.email) as assignee_name,
      task.first_seen_at::text as first_seen_at,
      task.last_seen_at::text as last_seen_at,
      task.updated_at::text as updated_at
    from community_research_tasks task
    left join moderation_operators operator on operator.id = task.assigned_operator_id
    where task.status in ('pending', 'in-progress')
      and task.signal_count > 0
      ${afterCursor}
    order by
      work_rank asc,
      task.signal_count desc,
      task.first_seen_at asc,
      task.id asc
    limit ${boundedLimit}
  `;
  return presentResearchTasks(rows, currentOperatorId);
}

export async function findPendingResearchTask(
  sql: Sql,
  currentOperatorId: string,
  id: string,
): Promise<PendingResearchTask | null> {
  const rows = await sql<ResearchTaskRow[]>`
    select
      task.id,
      task.task_kind,
      task.entity_kind,
      task.entity_ref,
      task.entity_label,
      task.entity_source,
      task.signal_count,
      task.status,
      task.work_state,
      case task.work_state when 'ready' then 0 when 'retry' then 1 when 'assigned' then 2 else 3 end
        as work_rank,
      task.next_action,
      task.assigned_operator_id,
      coalesce(operator.display_name, operator.email) as assignee_name,
      task.first_seen_at::text as first_seen_at,
      task.last_seen_at::text as last_seen_at,
      task.updated_at::text as updated_at
    from community_research_tasks task
    left join moderation_operators operator on operator.id = task.assigned_operator_id
    where task.status in ('pending', 'in-progress')
      and task.signal_count > 0
      and task.id = ${id}
    limit 1
  `;
  return (await presentResearchTasks(rows, currentOperatorId))[0] ?? null;
}

export async function listResearchAssignmentOptions(sql: Sql): Promise<ResearchAssignmentOption[]> {
  const rows = await sql<{
    id: string;
    label: string;
    role: ResearchAssignmentOption['role'];
  }[]>`
    select id, coalesce(nullif(btrim(display_name), ''), email) as label, role
    from moderation_operators
    where active = true
      and role in ('operator', 'admin')
      and coalesce(nullif(btrim(display_name), ''), email) is not null
    order by label asc, id asc
  `;
  return rows;
}

export async function listResearchCanonicalOptions(sql: Sql): Promise<ResearchCanonicalOptions> {
  const [products, retailers] = await Promise.all([
    sql<{ id: string; label: string }[]>`
      select product.slug as id,
             brand.name || ' ' || product.name || ' · ' || product.size as label
      from products product
      join brands brand on brand.id = product.brand_id
      where product.is_published = true
      order by brand.name asc, product.name asc, product.size asc, product.slug asc
    `,
    sql<{ id: string; label: string }[]>`
      select slug as id, name as label
      from retailers
      order by name asc, slug asc
    `,
  ]);
  return { products, retailers };
}
