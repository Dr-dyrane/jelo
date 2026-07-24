import 'server-only';

import type { Sql } from 'postgres';
import { recordModerationAction } from './audit';
import type { ModerationAction, ModerationQueue } from './schema';

type Decision = Extract<ModerationAction['action'], 'approve' | 'reject'>;

// Runs a guarded status change and its audit row in one transaction (ADR 0007).
// The UPDATE is conditional, so an already-decided or missing row changes nothing
// and writes no audit — the action is idempotent. Nothing here writes a canonical
// catalogue record; canonicalWrite stays false for every increment-2 action.
async function transition(
  sql: Sql,
  queue: ModerationQueue,
  action: ModerationAction['action'],
  operatorSubject: string,
  targetRef: string,
  rationale: string | null,
  runUpdate: (tx: Sql) => Promise<{ id: string }[]>,
): Promise<string | null> {
  return sql.begin(async tx => {
    const rows = await runUpdate(tx);
    if (rows.length === 0) return null;
    await recordModerationAction(tx, { operatorSubject, queue, action, targetRef, canonicalWrite: false, rationale });
    return rows[0].id;
  });
}

// An operator note or deferral — audits an existing target without changing status.
export async function recordNote(
  sql: Sql,
  queue: ModerationQueue,
  operatorSubject: string,
  targetRef: string,
  rationale: string,
  action: Extract<ModerationAction['action'], 'note' | 'defer' | 'claim'> = 'note',
): Promise<void> {
  await recordModerationAction(sql, { operatorSubject, queue, action, targetRef, canonicalWrite: false, rationale });
}

export function decideContribution(sql: Sql, operatorSubject: string, id: string, decision: Decision, rationale: string | null = null) {
  const status = decision === 'approve' ? 'approved' : 'rejected';
  return transition(sql, 'community_contribution', decision, operatorSubject, id, rationale, tx =>
    tx<{ id: string }[]>`
      update community_contributions set moderation_status = ${status}
      where id = ${id} and moderation_status = 'pending' returning id`);
}

export function decideEdge(sql: Sql, operatorSubject: string, id: string, decision: Decision, rationale: string | null = null) {
  const status = decision === 'approve' ? 'approved' : 'rejected';
  return transition(sql, 'community_edge', decision, operatorSubject, id, rationale, tx =>
    tx<{ id: string }[]>`
      update community_knowledge_edges set moderation_status = ${status}
      where id = ${id} and moderation_status = 'pending' returning id`);
}

export function decideObservation(sql: Sql, operatorSubject: string, id: string, decision: Decision, rationale: string | null = null) {
  const status = decision === 'approve' ? 'approved' : 'rejected';
  return transition(sql, 'community_observation', decision, operatorSubject, id, rationale, tx =>
    tx<{ id: string }[]>`
      update community_observations set moderation_status = ${status}
      where id = ${id} and moderation_status = 'pending' returning id`);
}

export function decideModerationValue(sql: Sql, operatorSubject: string, id: string, decision: Decision, rationale: string | null = null) {
  const status = decision === 'approve' ? 'approved' : 'rejected';
  return transition(sql, 'community_moderation_value', decision, operatorSubject, id, rationale, tx =>
    tx<{ id: string }[]>`
      update community_moderation_values
      set status = ${status}, reviewed_at = now(), reviewer = ${operatorSubject}, review_note = ${rationale}
      where id = ${id} and status = 'pending' returning id`);
}

// Maps a custom value to an EXISTING canonical entity: it annotates the value row
// only, it does not create a canonical record, so canonicalWrite stays false and
// the audit action is 'approve'. Creating a brand-new canonical row (promote /
// canonicalWrite:true) is deferred and must run the catalogue publication gates.
export function mapModerationValue(
  sql: Sql,
  operatorSubject: string,
  id: string,
  canonicalEntityKind: string,
  canonicalEntityRef: string,
  rationale: string | null = null,
) {
  return transition(sql, 'community_moderation_value', 'approve', operatorSubject, id, rationale, tx =>
    tx<{ id: string }[]>`
      update community_moderation_values
      set status = 'mapped', canonical_entity_kind = ${canonicalEntityKind}, canonical_entity_ref = ${canonicalEntityRef},
          reviewed_at = now(), reviewer = ${operatorSubject}, review_note = ${rationale}
      where id = ${id} and status = 'pending' returning id`);
}

// A retailer application decision is a triage status, not a canonical retailer write:
// 'approved' feeds the existing verification lane (ADR 0003), it does not publish a
// retailer. Only submitted applications are transitionable (table CHECK).
export function decideRetailerApplication(
  sql: Sql,
  operatorSubject: string,
  id: string,
  decision: Decision,
  rationale: string | null = null,
) {
  const status = decision === 'approve' ? 'approved' : 'declined';
  return transition(sql, 'retailer_application', decision, operatorSubject, id, rationale, tx =>
    tx<{ id: string }[]>`
      update retailer_partnership_applications set status = ${status}, updated_at = now()
      where id = ${id} and status = 'submitted' returning id`);
}
