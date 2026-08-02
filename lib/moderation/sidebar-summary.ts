import 'server-only';

import type { Sql } from 'postgres';
import type { ModerationOperator } from './access';

export type OpsSidebarSummary = {
  displayName: string;
  email: string;
  decisionsToday: number;
  lastActionLabel: string;
};

export async function getOpsSidebarSummary(
  sql: Sql,
  operator: ModerationOperator,
): Promise<OpsSidebarSummary> {
  const [profile] = await sql<{ display_name: string | null; email: string | null }[]>`
    select display_name, email
    from moderation_operators
    where id = ${operator.id}
    limit 1
  `;

  const [activity] = await sql<{
    decisions_today: number;
    last_action_at: string | null;
  }[]>`
    select
      count(id)::int as decisions_today,
      (array_agg(created_at order by event_sequence desc))[1]::text as last_action_at
    from moderation_audit_log
    where operator_subject = ${operator.authSubject}
      and created_at >= date_trunc('day', now())
  `;

  return {
    displayName: profile?.display_name ?? operator.authSubject.slice(0, 24),
    email: profile?.email ?? '—',
    decisionsToday: activity?.decisions_today ?? 0,
    lastActionLabel: activity?.last_action_at ? relativeLabel(activity.last_action_at) : 'No actions today',
  };
}

function relativeLabel(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
