import type { Sql } from 'postgres';
import { z } from 'zod';

export const communityRetailerResearchResolutionOutcomes = [
  'existing-canonical-retailer',
  'ambiguous-retailer',
  'dismissed-duplicate',
] as const;

const common = {
  taskId: z.uuid(),
  reviewedBy: z.string().trim().min(1).max(320),
  rationale: z.string().trim().min(1).max(2000),
  auditMetadata: z.record(
    z.string().trim().min(1).max(80),
    z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]),
  ).default({}),
};

const canonicalSlug = z.string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use the exact canonical retailer slug.');

export const communityRetailerResearchResolutionSchema = z.discriminatedUnion('outcome', [
  z.object({
    ...common,
    outcome: z.literal('existing-canonical-retailer'),
    canonicalSlug,
  }).strict(),
  z.object({
    ...common,
    outcome: z.literal('ambiguous-retailer'),
  }).strict(),
  z.object({
    ...common,
    outcome: z.literal('dismissed-duplicate'),
  }).strict(),
]);

export type CommunityRetailerResearchResolutionInput = z.input<
  typeof communityRetailerResearchResolutionSchema
>;

export type CommunityRetailerResearchResolutionRow = {
  taskId: string;
  outcome: typeof communityRetailerResearchResolutionOutcomes[number];
  canonicalRetailerSlug: string | null;
  reviewedBy: string;
  rationale: string;
  auditMetadata: Record<string, string | number | boolean | null>;
  canonicalWrite: false;
  publicationStatus: 'private-research-only';
  taskStatus: 'completed' | 'dismissed';
};

export function buildCommunityRetailerResearchResolution(
  input: CommunityRetailerResearchResolutionInput,
): CommunityRetailerResearchResolutionRow {
  const parsed = communityRetailerResearchResolutionSchema.parse(input);
  return {
    taskId: parsed.taskId,
    outcome: parsed.outcome,
    canonicalRetailerSlug: 'canonicalSlug' in parsed ? parsed.canonicalSlug : null,
    reviewedBy: parsed.reviewedBy,
    rationale: parsed.rationale,
    auditMetadata: parsed.auditMetadata,
    canonicalWrite: false,
    publicationStatus: 'private-research-only',
    taskStatus: parsed.outcome === 'dismissed-duplicate' ? 'dismissed' : 'completed',
  };
}

type TransactionCapableSql = Sql & {
  begin?: <T>(run: (transaction: Sql) => Promise<T>) => Promise<T>;
};

async function inTransaction<T>(sql: Sql, run: (transaction: Sql) => Promise<T>): Promise<T> {
  const begin = (sql as TransactionCapableSql).begin;
  return typeof begin === 'function'
    ? await (begin.call(sql, run) as Promise<T>)
    : run(sql);
}

/** Records a terminal retailer research decision without changing retailer or offer data. */
export async function resolveCommunityRetailerResearchTask(
  sql: Sql,
  input: CommunityRetailerResearchResolutionInput,
) {
  const row = buildCommunityRetailerResearchResolution(input);

  return inTransaction(sql, async transaction => {
    const [operator] = await transaction<{ role: 'moderator' | 'operator' | 'admin' }[]>`
      select role
      from moderation_operators
      where auth_subject = ${row.reviewedBy} and active = true
      limit 1
    `;
    if (!operator || operator.role === 'moderator') {
      throw new Error('A retailer research resolution requires an active operator or admin.');
    }

    const [task] = await transaction<{
      id: string;
      entity_source: 'canonical' | 'custom';
      entity_ref: string;
    }[]>`
      select id, entity_source, entity_ref
      from community_research_tasks
      where id = ${row.taskId} and entity_kind = 'retailer'
      for update
    `;
    if (!task) throw new Error('Community retailer research task does not exist.');

    if (row.outcome === 'existing-canonical-retailer') {
      if (task.entity_source === 'canonical' && task.entity_ref !== row.canonicalRetailerSlug) {
        throw new Error('Canonical retailer resolution must match the task’s canonical reference.');
      }
      const [retailer] = await transaction<{ exists: boolean }[]>`
        select exists(
          select 1 from retailers where slug = ${row.canonicalRetailerSlug}
        ) as exists
      `;
      if (!retailer?.exists) throw new Error('Canonical retailer resolution target does not exist.');
    }

    const inserted = await transaction<{ task_id: string }[]>`
      insert into community_retailer_research_resolutions (
        task_id, outcome, canonical_retailer_slug, reviewed_by,
        rationale, audit_metadata, canonical_write, publication_status
      ) values (
        ${row.taskId}, ${row.outcome}, ${row.canonicalRetailerSlug}, ${row.reviewedBy},
        ${row.rationale}, ${transaction.json(row.auditMetadata)},
        ${row.canonicalWrite}, ${row.publicationStatus}
      )
      on conflict (task_id) do nothing
      returning task_id
    `;
    if (!inserted[0]) throw new Error('Community retailer research task already has a resolution.');

    await transaction`
      update community_research_tasks
      set
        status = ${row.taskStatus},
        assigned_operator_id = null,
        work_state = 'ready',
        next_action = null,
        last_reviewed_at = now(),
        updated_at = now()
      where id = ${row.taskId}
    `;

    return row;
  });
}
