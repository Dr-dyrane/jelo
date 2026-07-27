import type { Sql } from 'postgres';
import { z } from 'zod';

export const communityResearchResolutionOutcomes = [
  'existing-canonical-product',
  'deliberate-intake-candidate',
  'ambiguous-family',
  'bundle',
  'dismissed-duplicate',
] as const;

export const communityResearchResolutionPublicationStatus = 'private-research-only' as const;

const taskId = z.uuid();
const catalogueReference = z.string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a lowercase hyphenated catalogue reference.');
const auditMetadata = z.record(
  z.string().trim().min(1).max(80),
  z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]),
).default({});
const commonShape = {
  taskId,
  reviewedBy: z.string().trim().min(1).max(320),
  rationale: z.string().trim().min(1).max(2000),
  auditMetadata,
};

const existingCanonicalProduct = z.object({
  ...commonShape,
  outcome: z.literal('existing-canonical-product'),
  canonicalSlug: catalogueReference,
}).strict();

const deliberateIntakeCandidate = z.object({
  ...commonShape,
  outcome: z.literal('deliberate-intake-candidate'),
  candidateId: catalogueReference,
}).strict();

const ambiguousFamily = z.object({
  ...commonShape,
  outcome: z.literal('ambiguous-family'),
}).strict();

const bundle = z.object({
  ...commonShape,
  outcome: z.literal('bundle'),
}).strict();

const dismissedDuplicate = z.object({
  ...commonShape,
  outcome: z.literal('dismissed-duplicate'),
  canonicalSlug: catalogueReference.nullable().optional(),
  candidateId: catalogueReference.nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.canonicalSlug && value.candidateId) {
    context.addIssue({
      code: 'custom',
      message: 'A dismissed duplicate may reference a canonical product or an intake candidate, not both.',
    });
  }
});

export const communityProductResearchResolutionSchema = z.discriminatedUnion('outcome', [
  existingCanonicalProduct,
  deliberateIntakeCandidate,
  ambiguousFamily,
  bundle,
  dismissedDuplicate,
]);

export type CommunityProductResearchResolutionInput = z.input<
  typeof communityProductResearchResolutionSchema
>;
export type CommunityProductResearchResolution = z.output<
  typeof communityProductResearchResolutionSchema
>;

export type CommunityProductResearchResolutionRow = {
  taskId: string;
  outcome: typeof communityResearchResolutionOutcomes[number];
  canonicalProductSlug: string | null;
  candidateId: string | null;
  reviewedBy: string;
  rationale: string;
  auditMetadata: Record<string, string | number | boolean | null>;
  canonicalWrite: false;
  publicationStatus: typeof communityResearchResolutionPublicationStatus;
  taskStatus: 'completed' | 'dismissed';
};

export function buildCommunityProductResearchResolution(
  input: CommunityProductResearchResolutionInput,
): CommunityProductResearchResolutionRow {
  const parsed = communityProductResearchResolutionSchema.parse(input);
  const canonicalProductSlug = 'canonicalSlug' in parsed
    ? parsed.canonicalSlug ?? null
    : null;
  const candidateId = 'candidateId' in parsed ? parsed.candidateId ?? null : null;

  return {
    taskId: parsed.taskId,
    outcome: parsed.outcome,
    canonicalProductSlug,
    candidateId,
    reviewedBy: parsed.reviewedBy,
    rationale: parsed.rationale,
    auditMetadata: parsed.auditMetadata,
    canonicalWrite: false,
    publicationStatus: communityResearchResolutionPublicationStatus,
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

/**
 * Records a terminal research decision only. It intentionally has no writer for
 * catalogue intake, dossiers, releases, products, offers, or public assets.
 */
export async function resolveCommunityProductResearchTask(
  sql: Sql,
  input: CommunityProductResearchResolutionInput,
) {
  const row = buildCommunityProductResearchResolution(input);

  return inTransaction(sql, async transaction => {
    const [operator] = await transaction<{ role: 'moderator' | 'operator' | 'admin' }[]>`
      select role
      from moderation_operators
      where auth_subject = ${row.reviewedBy} and active = true
      limit 1
    `;
    if (!operator) throw new Error('A research resolution requires an active moderation operator.');
    if (operator.role === 'moderator') {
      throw new Error('A research resolution requires an operator or admin.');
    }

    const [task] = await transaction<{ id: string }[]>`
      select id
      from community_research_tasks
      where id = ${row.taskId} and entity_kind = 'product'
      for update
    `;
    if (!task) throw new Error('Community product research task does not exist.');

    if (row.canonicalProductSlug) {
      const [canonicalProduct] = await transaction<{ exists: boolean }[]>`
        select exists(
          select 1 from products where slug = ${row.canonicalProductSlug}
        ) as exists
      `;
      if (!canonicalProduct?.exists) {
        throw new Error('Canonical product resolution target does not exist.');
      }
    }

    const inserted = await transaction<{ task_id: string }[]>`
      insert into community_product_research_resolutions (
        task_id, outcome, canonical_product_slug, candidate_id,
        reviewed_by, rationale, audit_metadata, canonical_write, publication_status
      ) values (
        ${row.taskId}, ${row.outcome}, ${row.canonicalProductSlug}, ${row.candidateId},
        ${row.reviewedBy}, ${row.rationale}, ${transaction.json(row.auditMetadata)},
        ${row.canonicalWrite}, ${row.publicationStatus}
      )
      on conflict (task_id) do nothing
      returning task_id
    `;
    if (!inserted[0]) throw new Error('Community research task already has a resolution.');

    await transaction`
      update community_research_tasks
      set status = ${row.taskStatus}, updated_at = now()
      where id = ${row.taskId}
    `;

    return row;
  });
}
