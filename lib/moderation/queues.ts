import 'server-only';

import type { Sql } from 'postgres';

export type PendingObservation = {
  id: string;
  contributionId: string;
  kind: 'price' | 'outcome';
  subjectKind: string;
  subjectRef: string;
  amountNgn: number | null;
  outcome: string | null;
  observedOn: string | null;
  createdAt: string;
};

function boundedLimit(limit: number) {
  return Math.min(Math.max(Math.trunc(limit), 1), 500);
}

// Read-only view of the community observation moderation queue (ADR 0005 / 0007).
// Moderation input only: this reads pending rows and never writes, promotes, or
// touches a canonical catalogue record.
export async function listPendingObservations(sql: Sql, limit = 100): Promise<PendingObservation[]> {
  const rows = await sql<{
    id: string;
    contribution_id: string;
    observation_kind: 'price' | 'outcome';
    subject_kind: string;
    subject_ref: string;
    amount_ngn: number | null;
    outcome: string | null;
    observed_on: string | null;
    created_at: string;
  }[]>`
    select id, contribution_id, observation_kind, subject_kind, subject_ref,
           amount_ngn, outcome, observed_on, created_at
    from community_observations
    where moderation_status = 'pending'
    order by created_at desc
    limit ${boundedLimit(limit)}
  `;
  return rows.map(row => ({
    id: row.id,
    contributionId: row.contribution_id,
    kind: row.observation_kind,
    subjectKind: row.subject_kind,
    subjectRef: row.subject_ref,
    amountNgn: row.amount_ngn,
    outcome: row.outcome,
    observedOn: row.observed_on,
    createdAt: row.created_at,
  }));
}
