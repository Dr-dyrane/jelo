import type { Sql } from 'postgres';
import { z } from 'zod';
import { catalogueIntakeCandidates } from '@/data/catalogue-intake';
import { isReleasedIntakeCandidate } from '@/data/published-intake-products';
import {
  assertCommunityResearchTaskShape,
  canonicalResearchEntitySlug,
} from './research-reference';

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

export function assertDeliberateIntakeResearchTarget(
  task: {
    taskKind: 'product-identity' | 'product-retail-refresh';
    entitySource: 'canonical' | 'custom';
  },
  candidateId: string,
) {
  if (task.taskKind !== 'product-identity' || task.entitySource !== 'custom') {
    throw new Error('Deliberate intake is available only for a custom product-identity task.');
  }
  if (!catalogueIntakeCandidates.some(candidate => candidate.id === candidateId)) {
    throw new Error('Deliberate intake resolution target is not in the checked-in intake manifest.');
  }
  if (isReleasedIntakeCandidate(candidateId)) {
    throw new Error('Deliberate intake resolution target is already explicitly released.');
  }
}

export function assertCommunityProductResearchOutcome(
  task: {
    taskKind: 'product-identity' | 'product-retail-refresh';
    entitySource: 'canonical' | 'custom';
    entityRef: string;
  },
  resolution: Pick<CommunityProductResearchResolutionRow, 'outcome' | 'canonicalProductSlug'>,
) {
  assertCommunityResearchTaskShape({
    taskKind: task.taskKind,
    entityKind: 'product',
    entitySource: task.entitySource,
    entityRef: task.entityRef,
  });
  if (task.entitySource !== 'canonical') return;

  const taskSlug = canonicalResearchEntitySlug('product', task.entityRef);
  if (!taskSlug) {
    throw new Error('Canonical product research task has an invalid product namespace.');
  }
  if (resolution.outcome !== 'existing-canonical-product') {
    throw new Error('Canonical product research requires an exact existing product outcome.');
  }
  if (taskSlug !== resolution.canonicalProductSlug) {
    throw new Error('Canonical product resolution must match the task’s canonical reference.');
  }
}

type ProductResearchTaskRow = {
  id: string;
  task_kind: 'product-identity' | 'product-retail-refresh';
  entity_source: 'canonical' | 'custom';
  entity_ref: string;
  assigned_operator_id: string | null;
  status: 'pending' | 'in-progress' | 'completed' | 'dismissed';
  work_state: 'ready' | 'assigned' | 'blocked' | 'retry';
  signal_count: number;
};

async function validateCommunityProductResearchResolution(
  sql: Sql,
  row: CommunityProductResearchResolutionRow,
  lockTask: boolean,
) {
  const [operator] = await sql<{
    id: string;
    role: 'moderator' | 'operator' | 'admin';
  }[]>`
    select id, role
    from moderation_operators
    where auth_subject = ${row.reviewedBy} and active = true
    limit 1
  `;
  if (!operator) throw new Error('A research resolution requires an active moderation operator.');
  if (operator.role === 'moderator') {
    throw new Error('A research resolution requires an operator or admin.');
  }

  const lock = lockTask ? sql`for update` : sql``;
  const [task] = await sql<ProductResearchTaskRow[]>`
    select id, task_kind, entity_source, entity_ref,
           assigned_operator_id, status, work_state, signal_count
    from community_research_tasks
    where id = ${row.taskId} and entity_kind = 'product'
    ${lock}
  `;
  if (!task) throw new Error('Community product research task does not exist.');
  if (task.signal_count <= 0) {
    throw new Error('Research work without an active report cannot be resolved.');
  }
  if (
    task.status !== 'in-progress'
    || task.assigned_operator_id !== operator.id
    || !['assigned', 'blocked', 'retry'].includes(task.work_state)
  ) {
    throw new Error('Research resolution requires the task’s current assigned operator.');
  }
  assertCommunityProductResearchOutcome({
    taskKind: task.task_kind,
    entitySource: task.entity_source,
    entityRef: task.entity_ref,
  }, row);

  if (row.canonicalProductSlug) {
    const [canonicalProduct] = await sql<{ exists: boolean }[]>`
      select exists(
        select 1
        from products
        where slug = ${row.canonicalProductSlug} and is_published = true
      ) as exists
    `;
    if (!canonicalProduct?.exists) {
      throw new Error('Canonical product resolution target is not published.');
    }
  }

  if (row.outcome === 'deliberate-intake-candidate') {
    assertDeliberateIntakeResearchTarget({
      taskKind: task.task_kind,
      entitySource: task.entity_source,
    }, row.candidateId!);
  }

  const [existing] = await sql<{ exists: boolean }[]>`
    select exists(
      select 1 from community_product_research_resolutions where task_id = ${row.taskId}
    ) as exists
  `;
  if (existing?.exists) throw new Error('Community research task already has a resolution.');
  return task;
}

export async function preflightCommunityProductResearchTask(
  sql: Sql,
  input: CommunityProductResearchResolutionInput,
) {
  const row = buildCommunityProductResearchResolution(input);
  await validateCommunityProductResearchResolution(sql, row, false);
  return row;
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
    await validateCommunityProductResearchResolution(transaction, row, true);

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
