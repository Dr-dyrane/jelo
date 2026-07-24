import 'server-only';

import type { Sql } from 'postgres';
import { buildModerationAuditRow, type ModerationAction } from './schema';

// Appends an audit row inside the caller's transaction, so a promotion and its
// trail commit or roll back together (ADR 0007). This writes only the audit log
// and never any canonical catalogue table; the caller performs the gated
// promotion in the same transaction and passes canonicalWrite: true when it does.
export async function recordModerationAction(sql: Sql, input: ModerationAction): Promise<void> {
  const row = buildModerationAuditRow(input);
  await sql`
    insert into moderation_audit_log (
      operator_subject, queue, action, target_ref, canonical_write, rationale
    ) values (
      ${row.operatorSubject}, ${row.queue}, ${row.action}, ${row.targetRef},
      ${row.canonicalWrite}, ${row.rationale}
    )
  `;
}
