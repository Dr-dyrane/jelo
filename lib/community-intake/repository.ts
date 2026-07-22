import 'server-only';

import { getPostgresClient } from '@/lib/db/postgres';
import { communityKnowledgeEdges, unknownCommunityValues } from './moderation';
import {
  emptyContributionDraft,
  finalContributionSchema,
  type ContributionDraft,
  type ContributionKind,
  type IntakeEvent,
} from './schema';

type DraftRow = {
  id: string;
  revision: number;
  expires_at: Date;
  status: 'draft' | 'submitted' | 'expired';
  payload: unknown;
};

type ContributionRow = { id: string };

export async function createCommunityDraft(kind: ContributionKind, editSecretHash: string) {
  const sql = getPostgresClient();
  const payload = emptyContributionDraft(kind);
  const [row] = await sql<DraftRow[]>`
    insert into community_intake_drafts (edit_secret_hash, contribution_kind, payload)
    values (${editSecretHash}, ${kind}, ${sql.json(payload)})
    returning id, revision, expires_at, status, payload
  `;
  return row;
}

export async function saveCommunityDraft(input: {
  id: string;
  editSecretHash: string;
  revision: number;
  draft: ContributionDraft;
  events: IntakeEvent[];
}) {
  const sql = getPostgresClient();
  return sql.begin(async transaction => {
    const [updated] = await transaction<DraftRow[]>`
      update community_intake_drafts
      set payload = ${transaction.json(input.draft)},
          contribution_kind = ${input.draft.kind},
          current_step = ${input.draft.currentStep},
          revision = revision + 1,
          updated_at = now(),
          expires_at = least(started_at + interval '30 days', now() + interval '30 days')
      where id = ${input.id}
        and edit_secret_hash = ${input.editSecretHash}
        and status = 'draft'
        and revision = ${input.revision}
      returning id, revision, expires_at, status, payload
    `;

    if (!updated) {
      const [current] = await transaction<Pick<DraftRow, 'revision' | 'status'>[]>`
        select revision, status
        from community_intake_drafts
        where id = ${input.id} and edit_secret_hash = ${input.editSecretHash}
      `;
      return current
        ? { ok: false as const, reason: 'revision' as const, revision: current.revision, status: current.status }
        : { ok: false as const, reason: 'missing' as const };
    }

    for (const event of input.events) {
      await transaction`
        insert into community_intake_events (
          draft_id, client_event_id, event_type, step, input_mode, results_count
        ) values (
          ${input.id}, ${event.id}, ${event.type}, ${event.step}, ${event.inputMode}, ${event.resultsCount}
        )
        on conflict (draft_id, client_event_id) do nothing
      `;
    }

    return { ok: true as const, revision: updated.revision, expiresAt: updated.expires_at };
  });
}

export async function submitCommunityDraft(input: { id: string; editSecretHash: string }) {
  const sql = getPostgresClient();
  return sql.begin(async transaction => {
    const [draftRow] = await transaction<DraftRow[]>`
      select id, revision, expires_at, status, payload
      from community_intake_drafts
      where id = ${input.id} and edit_secret_hash = ${input.editSecretHash}
      for update
    `;
    if (!draftRow) return { ok: false as const, reason: 'missing' as const };

    const [existing] = await transaction<ContributionRow[]>`
      select id from community_contributions where draft_id = ${input.id}
    `;
    if (existing) return { ok: true as const, contributionId: existing.id, duplicate: true as const };
    if (draftRow.status !== 'draft') return { ok: false as const, reason: 'closed' as const };

    const draft = finalContributionSchema.parse(draftRow.payload);
    const [contribution] = await transaction<ContributionRow[]>`
      insert into community_contributions (draft_id, contribution_kind, payload)
      values (${input.id}, ${draft.kind}, ${transaction.json(draft)})
      returning id
    `;

    for (const value of unknownCommunityValues(draft)) {
      const [moderationValue] = await transaction<{ id: string }[]>`
        insert into community_moderation_values (value_kind, raw_value, normalized_value)
        values (${value.kind}, ${value.rawValue}, ${value.normalizedValue})
        on conflict (value_kind, normalized_value) do update
        set occurrence_count = community_moderation_values.occurrence_count + 1,
            last_seen_at = now()
        returning id
      `;
      await transaction`
        insert into community_moderation_mentions (
          moderation_value_id, contribution_id, field_path, selected_context
        ) values (
          ${moderationValue.id}, ${contribution.id}, ${value.fieldPath},
          ${transaction.json({ contributionKind: draft.kind })}
        )
        on conflict (moderation_value_id, contribution_id, field_path) do nothing
      `;
    }

    for (const edge of communityKnowledgeEdges(draft, contribution.id)) {
      await transaction`
        insert into community_knowledge_edges (
          contribution_id, subject_kind, subject_ref, predicate, object_kind, object_ref, metadata
        ) values (
          ${contribution.id}, ${edge.subjectKind}, ${edge.subjectRef}, ${edge.predicate},
          ${edge.objectKind}, ${edge.objectRef}, ${transaction.json(edge.metadata)}
        )
        on conflict (contribution_id, subject_kind, subject_ref, predicate, object_kind, object_ref) do nothing
      `;
    }

    await transaction`
      update community_intake_drafts
      set status = 'submitted', submitted_at = now(), updated_at = now()
      where id = ${input.id}
    `;

    return { ok: true as const, contributionId: contribution.id, duplicate: false as const };
  });
}
