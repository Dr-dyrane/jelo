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
