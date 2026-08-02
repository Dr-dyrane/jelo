import 'server-only';

import type { Sql } from 'postgres';

export type PendingResearchTask = {
  id: string;
  taskKind: 'product-identity' | 'product-retail-refresh' | 'retailer-identity' | 'retailer-refresh';
  entityKind: 'product' | 'retailer';
  entityRef: string;
  entityLabel: string;
  entitySource: 'canonical' | 'custom';
  signalCount: number;
  status: 'pending' | 'in-progress';
  workState: 'ready' | 'assigned' | 'blocked' | 'retry';
  nextAction: string | null;
  assigneeName: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: string;
};

export async function listPendingResearchTasks(
  sql: Sql,
  limit = 100,
): Promise<PendingResearchTask[]> {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
  const rows = await sql<{
    id: string;
    task_kind: PendingResearchTask['taskKind'];
    entity_kind: PendingResearchTask['entityKind'];
    entity_ref: string;
    entity_label: string;
    entity_source: PendingResearchTask['entitySource'];
    signal_count: number;
    status: PendingResearchTask['status'];
    work_state: PendingResearchTask['workState'];
    next_action: string | null;
    assignee_name: string | null;
    first_seen_at: string;
    last_seen_at: string;
    updated_at: string;
  }[]>`
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
      task.next_action,
      coalesce(operator.display_name, operator.email) as assignee_name,
      task.first_seen_at::text as first_seen_at,
      task.last_seen_at::text as last_seen_at,
      task.updated_at::text as updated_at
    from community_research_tasks task
    left join moderation_operators operator on operator.id = task.assigned_operator_id
    where task.status in ('pending', 'in-progress')
    order by
      case task.work_state when 'ready' then 0 when 'retry' then 1 when 'assigned' then 2 else 3 end,
      task.signal_count desc,
      task.first_seen_at asc,
      task.id asc
    limit ${boundedLimit}
  `;
  return rows.map(row => ({
    id: row.id,
    taskKind: row.task_kind,
    entityKind: row.entity_kind,
    entityRef: row.entity_ref,
    entityLabel: row.entity_label,
    entitySource: row.entity_source,
    signalCount: row.signal_count,
    status: row.status,
    workState: row.work_state,
    nextAction: row.next_action,
    assigneeName: row.assignee_name,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    updatedAt: row.updated_at,
  }));
}
