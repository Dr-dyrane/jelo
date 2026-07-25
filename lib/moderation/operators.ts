import 'server-only';

import type { Sql } from 'postgres';
import type { ModerationRole } from './access';

export type ConsoleOperatorRecord = {
  id: string;
  authSubject: string;
  displayName: string | null;
  email: string | null;
  role: ModerationRole;
  active: boolean;
  decisionsToday: number;
  lastActionAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listConsoleOperators(sql: Sql): Promise<ConsoleOperatorRecord[]> {
  const rows = await sql<{
    id: string;
    auth_subject: string;
    display_name: string | null;
    email: string | null;
    role: ModerationRole;
    active: boolean;
    decisions_today: number;
    last_action_at: string | null;
    created_at: string;
    updated_at: string;
  }[]>`
    select
      operator.id,
      operator.auth_subject,
      operator.display_name,
      operator.email,
      operator.role,
      operator.active,
      count(audit.id) filter (where audit.created_at >= date_trunc('day', now()))::int as decisions_today,
      max(audit.created_at)::text as last_action_at,
      operator.created_at::text as created_at,
      operator.updated_at::text as updated_at
    from moderation_operators as operator
    left join moderation_audit_log as audit on audit.operator_subject = operator.auth_subject
    group by operator.id
    order by operator.active desc, operator.display_name asc nulls last, operator.email asc nulls last
  `;

  return rows.map(row => ({
    id: row.id,
    authSubject: row.auth_subject,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    active: row.active,
    decisionsToday: row.decisions_today,
    lastActionAt: row.last_action_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
