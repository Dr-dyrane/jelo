import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres, { type Sql } from "postgres";
import { z, ZodError } from "zod";
import { buildCommunityRetailerResearchResolution } from "@/lib/community-intake/retailer-research-resolution";
import { recordModerationAction } from "@/lib/moderation/database-transitions";
import { requireAdminDatabaseUrl } from "./lib/admin-database";
import { acquireCanonicalRetailerIdentityLock } from "./lib/retailer-identity-lock";

const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_EVIDENCE_BYTES = 32 * 1024 * 1024;
const UUID_ZERO = "00000000-0000-0000-0000-000000000000";
const FORBIDDEN_TEXT_CHARACTERS =
  /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/;
const PLACEHOLDER_PUBLIC_WORDS =
  /\b(?:demo|example|fake|fixture|placeholder|sample|test)\b/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const PRIVATE_LEDGER_REFERENCE_PREFIX = "private-ledger:";
const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const evidenceMaximumDays = {
  field_visit: 180,
  retailer_confirmation: 90,
  branch_online_record: 30,
  partnership_application: 90,
} as const;

type EvidenceSourceMethod = keyof typeof evidenceMaximumDays;
type PromotionAction = "create-and-resolve" | "unchanged";

type TransactionSql = Sql & {
  begin?: <T>(
    options: string,
    run: (transaction: Sql) => Promise<T>,
  ) => Promise<T>;
};

type OperatorRow = {
  id: string;
  auth_subject: string;
  role: string;
};

type ResearchTaskRow = {
  id: string;
  task_kind: string;
  entity_kind: string;
  entity_source: string;
  entity_ref: string;
  entity_label: string;
  status: string;
  assigned_operator_id: string | null;
  work_state: string;
  next_action: string | null;
};

type RetailerRow = {
  id: string;
  slug: string;
  name: string;
  trust_score: number;
};

type ResolutionRow = {
  task_id: string;
  outcome: string;
  canonical_retailer_slug: string | null;
  reviewed_by: string;
  rationale: string;
  audit_metadata: Record<string, unknown>;
  reviewed_at: Date | string;
  canonical_write: boolean;
  publication_status: string;
};

type AuditRow = {
  operator_subject: string;
  queue: string;
  action: string;
  target_ref: string;
  canonical_write: boolean;
  rationale: string | null;
  metadata: Record<string, unknown>;
};

type RetainedMentionRow = {
  contribution_id: string;
};

class RetailerPromotionInputError extends Error {}
class RetailerPromotionConflictError extends Error {}
class RetailerPromotionAuthorizationError extends Error {}

const exactUuidSchema = z
  .uuid()
  .refine((value) => value !== UUID_ZERO, "A non-zero UUID is required.")
  .refine((value) => value === value.toLowerCase(), {
    message: "Use the canonical lowercase UUID form.",
  });

const privateLedgerReferenceSchema = exactTextSchema(51).refine((value) => {
  if (!value.startsWith(PRIVATE_LEDGER_REFERENCE_PREFIX)) return false;
  return exactUuidSchema.safeParse(
    value.slice(PRIVATE_LEDGER_REFERENCE_PREFIX.length),
  ).success;
}, "Use exactly private-ledger:<canonical lowercase non-zero UUID>.");

const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(SLUG_PATTERN, "Use an exact lowercase hyphenated slug.");

function exactTextSchema(maximumLength: number, publicValue = false) {
  let schema = z
    .string()
    .min(1)
    .max(maximumLength)
    .refine((value) => value === value.trim(), {
      message: "Surrounding whitespace is not allowed.",
    })
    .refine((value) => !FORBIDDEN_TEXT_CHARACTERS.test(value), {
      message: "Control and directional formatting characters are not allowed.",
    });
  if (publicValue) {
    schema = schema.refine((value) => !PLACEHOLDER_PUBLIC_WORDS.test(value), {
      message: "Placeholder public data is not allowed.",
    });
  }
  return schema;
}

const sourceMethodSchema = z.enum(
  Object.keys(evidenceMaximumDays) as [
    EvidenceSourceMethod,
    ...EvidenceSourceMethod[],
  ],
);

const canonicalRetailerPromotionManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    reviewedAt: z.iso.datetime(),
    rationale: exactTextSchema(2000),
    retailer: z
      .object({
        id: exactUuidSchema,
        slug: slugSchema,
        name: exactTextSchema(160, true),
        trustScore: z.number().int().min(0).max(100),
      })
      .strict(),
    provenance: z
      .object({
        researchTask: z
          .object({
            id: exactUuidSchema,
            entityRef: exactTextSchema(160).refine(
              (value) => value.startsWith("custom:"),
              "Use the exact custom retailer research reference.",
            ),
            entityLabel: exactTextSchema(120),
            identityBinding: z.discriminatedUnion("method", [
              z
                .object({
                  method: z.literal("exact-normalized-task-identity"),
                })
                .strict(),
              z
                .object({
                  method: z.literal("reviewed-alias"),
                  taskAlias: exactTextSchema(120),
                  canonicalName: exactTextSchema(160, true),
                  rationale: exactTextSchema(500),
                })
                .strict(),
            ]),
          })
          .strict(),
        identityEvidence: z
          .object({
            sourceMethod: sourceMethodSchema,
            sourceReference: privateLedgerReferenceSchema,
            artifactPath: exactTextSchema(1000).refine(
              (value) => path.isAbsolute(value),
              "Use an absolute private evidence artifact path.",
            ),
            evidenceSha256: z
              .string()
              .regex(SHA256_PATTERN, "Use a lowercase SHA-256 digest."),
            observedAt: z.iso.datetime(),
            expiresAt: z.iso.datetime(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export type CanonicalRetailerPromotionManifest = z.infer<
  typeof canonicalRetailerPromotionManifestSchema
>;

export type CanonicalRetailerPromotionCommand = {
  manifestPath: string;
  apply: boolean;
};

type PromotionMetadata = {
  operation: "canonical_retailer_create";
  manifestFingerprint: string;
  retailerId: string;
  retailerSlug: string;
  trustScore: number;
  identitySourceMethod: EvidenceSourceMethod;
  identitySourceReference: string;
  identityEvidenceSha256: string;
  identityObservedAt: string;
  identityExpiresAt: string;
  identityReviewedAt: string;
  identityBindingMethod: "exact-normalized-task-identity" | "reviewed-alias";
  identityBindingRationale: string | null;
};

type PromotionPlan = {
  action: PromotionAction;
  metadata: PromotionMetadata;
};

function timestamp(value: string) {
  return Date.parse(value);
}

function isOutsideRepository(
  absolutePath: string,
  repositoryRoot = REPOSITORY_ROOT,
) {
  const repositoryRelativePath = path.relative(repositoryRoot, absolutePath);
  return (
    repositoryRelativePath !== "" &&
    (repositoryRelativePath === ".." ||
      repositoryRelativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(repositoryRelativePath))
  );
}

export function parseCanonicalRetailerPromotionManifest(
  input: unknown,
  now = new Date(),
): CanonicalRetailerPromotionManifest {
  const manifest = canonicalRetailerPromotionManifestSchema.parse(input);
  if (!Number.isFinite(now.getTime())) {
    throw new RetailerPromotionInputError(
      "A valid operator clock is required.",
    );
  }

  const reviewedAt = timestamp(manifest.reviewedAt);
  const observedAt = timestamp(manifest.provenance.identityEvidence.observedAt);
  const expiresAt = timestamp(manifest.provenance.identityEvidence.expiresAt);
  const maximumExpiresAt =
    observedAt +
    evidenceMaximumDays[manifest.provenance.identityEvidence.sourceMethod] *
      86_400_000;
  const issues: string[] = [];
  if (reviewedAt > now.getTime()) {
    issues.push("reviewedAt must not be future-dated");
  }
  if (observedAt > reviewedAt) {
    issues.push(
      "identityEvidence.observedAt must not be later than reviewedAt",
    );
  }
  if (expiresAt <= reviewedAt) {
    issues.push("identityEvidence.expiresAt must be current at review time");
  }
  if (expiresAt > maximumExpiresAt) {
    issues.push(
      "identityEvidence.expiresAt exceeds the source-specific maximum window",
    );
  }
  if (issues.length > 0) {
    throw new RetailerPromotionConflictError(
      `Canonical retailer promotion manifest has unsafe date windows: ${issues.join("; ")}.`,
    );
  }
  const evidenceArtifactPath =
    manifest.provenance.identityEvidence.artifactPath;
  if (!isOutsideRepository(evidenceArtifactPath)) {
    throw new RetailerPromotionConflictError(
      "Identity evidence artifact must remain outside the repository.",
    );
  }
  return manifest;
}

export function parseCanonicalRetailerPromotionCommand(
  args: string[],
): CanonicalRetailerPromotionCommand {
  let manifestPath: string | null = null;
  let apply = false;
  for (const argument of args) {
    if (argument === "--apply") {
      if (apply) {
        throw new RetailerPromotionInputError(
          "--apply may be provided only once.",
        );
      }
      apply = true;
      continue;
    }
    if (argument.startsWith("--manifest=")) {
      if (manifestPath !== null) {
        throw new RetailerPromotionInputError(
          "--manifest may be provided only once.",
        );
      }
      const suppliedPath = argument.slice("--manifest=".length);
      if (!suppliedPath) {
        throw new RetailerPromotionInputError(
          "--manifest requires a JSON file path.",
        );
      }
      if (!path.isAbsolute(suppliedPath)) {
        throw new RetailerPromotionInputError(
          "--manifest requires an absolute private JSON file path.",
        );
      }
      manifestPath = path.normalize(suppliedPath);
      continue;
    }
    throw new RetailerPromotionInputError(
      "Unknown canonical retailer promotion option.",
    );
  }
  if (manifestPath === null) {
    throw new RetailerPromotionInputError("--manifest is required.");
  }
  return { manifestPath, apply };
}

export async function readCanonicalRetailerPromotionManifest(
  manifestPath: string,
  now = new Date(),
) {
  if (!path.isAbsolute(manifestPath) || !isOutsideRepository(manifestPath)) {
    throw new RetailerPromotionInputError(
      "Canonical retailer promotion manifest must remain outside the repository.",
    );
  }
  let manifestStat;
  let bytes;
  try {
    manifestStat = await lstat(manifestPath);
    if (
      !manifestStat.isFile() ||
      manifestStat.size <= 0 ||
      manifestStat.size > MAX_MANIFEST_BYTES
    ) {
      throw new Error("invalid manifest shape");
    }
    const [resolvedManifestPath, resolvedRepositoryRoot] = await Promise.all([
      realpath(manifestPath),
      realpath(REPOSITORY_ROOT),
    ]);
    if (!isOutsideRepository(resolvedManifestPath, resolvedRepositoryRoot)) {
      throw new Error("manifest resolves inside repository");
    }
    bytes = await readFile(resolvedManifestPath);
    if (bytes.byteLength <= 0 || bytes.byteLength > MAX_MANIFEST_BYTES) {
      throw new Error("manifest changed size");
    }
  } catch {
    throw new RetailerPromotionInputError(
      "Canonical retailer promotion manifest is unavailable or outside the allowed size.",
    );
  }
  let input: unknown;
  try {
    input = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new RetailerPromotionInputError(
      "Canonical retailer promotion manifest is not valid JSON.",
    );
  }
  return parseCanonicalRetailerPromotionManifest(input, now);
}

export function canonicalRetailerPromotionFingerprint(
  manifest: CanonicalRetailerPromotionManifest,
) {
  return createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
}

export async function verifyCanonicalRetailerPromotionEvidence(
  manifest: CanonicalRetailerPromotionManifest,
) {
  const artifactPath = manifest.provenance.identityEvidence.artifactPath;
  let artifactStat;
  let bytes;
  try {
    artifactStat = await lstat(artifactPath);
    if (
      !artifactStat.isFile() ||
      artifactStat.size <= 0 ||
      artifactStat.size > MAX_EVIDENCE_BYTES
    ) {
      throw new Error("invalid artifact shape");
    }
    const [resolvedArtifactPath, resolvedRepositoryRoot] = await Promise.all([
      realpath(artifactPath),
      realpath(REPOSITORY_ROOT),
    ]);
    if (!isOutsideRepository(resolvedArtifactPath, resolvedRepositoryRoot)) {
      throw new Error("artifact resolves inside repository");
    }
    bytes = await readFile(resolvedArtifactPath);
    if (bytes.byteLength <= 0 || bytes.byteLength > MAX_EVIDENCE_BYTES) {
      throw new Error("artifact changed size");
    }
  } catch {
    throw new RetailerPromotionConflictError(
      "Identity evidence artifact is unavailable or outside the allowed size.",
    );
  }
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  if (actualSha256 !== manifest.provenance.identityEvidence.evidenceSha256) {
    throw new RetailerPromotionConflictError(
      "Identity evidence artifact does not match the reviewed SHA-256 digest.",
    );
  }
  return actualSha256;
}

function promotionMetadata(
  manifest: CanonicalRetailerPromotionManifest,
): PromotionMetadata {
  const evidence = manifest.provenance.identityEvidence;
  return {
    operation: "canonical_retailer_create",
    manifestFingerprint: canonicalRetailerPromotionFingerprint(manifest),
    retailerId: manifest.retailer.id,
    retailerSlug: manifest.retailer.slug,
    trustScore: manifest.retailer.trustScore,
    identitySourceMethod: evidence.sourceMethod,
    identitySourceReference: evidence.sourceReference,
    identityEvidenceSha256: evidence.evidenceSha256,
    identityObservedAt: evidence.observedAt,
    identityExpiresAt: evidence.expiresAt,
    identityReviewedAt: manifest.reviewedAt,
    identityBindingMethod:
      manifest.provenance.researchTask.identityBinding.method,
    identityBindingRationale:
      manifest.provenance.researchTask.identityBinding.method ===
      "reviewed-alias"
        ? manifest.provenance.researchTask.identityBinding.rationale
        : null,
  };
}

export async function resolveCanonicalRetailerPromotionAdmin(
  sql: Sql,
  operatorEmail: string | undefined,
  lock = false,
) {
  const parsedEmail = z.email().safeParse(operatorEmail);
  if (!parsedEmail.success) {
    throw new RetailerPromotionAuthorizationError(
      "MODERATION_OPERATOR_EMAIL must be a valid email address.",
    );
  }
  const operatorLock = lock ? sql`for share` : sql``;
  const rows = await sql<OperatorRow[]>`
    select id, auth_subject, role
    from moderation_operators
    where lower(email) = lower(${parsedEmail.data})
      and active = true
    limit 2
    ${operatorLock}
  `;
  if (rows.length !== 1 || rows[0].role !== "admin") {
    throw new RetailerPromotionAuthorizationError(
      "MODERATION_OPERATOR_EMAIL must identify exactly one active admin.",
    );
  }
  return rows[0];
}

function metadataMatches(
  actual: Record<string, unknown>,
  expected: PromotionMetadata,
) {
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index]) &&
    expectedKeys.every(
      (key) => actual[key] === expected[key as keyof PromotionMetadata],
    )
  );
}

function requireTaskIdentity(
  rows: ResearchTaskRow[],
  manifest: CanonicalRetailerPromotionManifest,
) {
  const task = rows[0];
  if (
    rows.length !== 1 ||
    !task ||
    task.id !== manifest.provenance.researchTask.id ||
    task.task_kind !== "retailer-identity" ||
    task.entity_kind !== "retailer" ||
    task.entity_source !== "custom" ||
    task.entity_ref !== manifest.provenance.researchTask.entityRef ||
    task.entity_label !== manifest.provenance.researchTask.entityLabel
  ) {
    throw new RetailerPromotionConflictError(
      "Retailer identity research provenance is missing or conflicts.",
    );
  }
  const binding = manifest.provenance.researchTask.identityBinding;
  const taskReferenceLabel = task.entity_ref.slice("custom:".length);
  const normalizedTaskReference = normalizeIdentityText(taskReferenceLabel);
  const normalizedTaskLabel = normalizeIdentityText(task.entity_label);
  const normalizedRetailerName = normalizeIdentityText(manifest.retailer.name);
  const normalizedRetailerSlug = normalizeIdentityText(manifest.retailer.slug);
  if (binding.method === "exact-normalized-task-identity") {
    if (
      normalizedTaskReference !== normalizedRetailerSlug ||
      normalizedTaskLabel !== normalizedRetailerName
    ) {
      throw new RetailerPromotionConflictError(
        "Canonical retailer identity does not exactly match the assigned custom lead.",
      );
    }
  } else if (
    binding.taskAlias !== task.entity_label ||
    binding.canonicalName !== manifest.retailer.name
  ) {
    throw new RetailerPromotionConflictError(
      "Reviewed retailer alias mapping does not bind the assigned lead to the canonical name.",
    );
  }
  return task;
}

function requireActiveOwnedTask(task: ResearchTaskRow, operatorId: string) {
  if (
    task.status !== "in-progress" ||
    task.assigned_operator_id !== operatorId ||
    task.work_state !== "assigned" ||
    task.next_action === null
  ) {
    throw new RetailerPromotionConflictError(
      "Canonical retailer creation requires the active admin's assigned retailer identity task.",
    );
  }
}

function normalizeIdentityText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function requireCurrentEvidenceForCreate(
  manifest: CanonicalRetailerPromotionManifest,
  now: Date,
) {
  if (
    timestamp(manifest.provenance.identityEvidence.expiresAt) <= now.getTime()
  ) {
    throw new RetailerPromotionConflictError(
      "Identity evidence must be current at operator time for canonical retailer creation.",
    );
  }
}

function exactRetailer(
  rows: RetailerRow[],
  manifest: CanonicalRetailerPromotionManifest,
) {
  if (rows.length === 0) return null;
  const retailer = rows[0];
  if (
    rows.length !== 1 ||
    !retailer ||
    retailer.id !== manifest.retailer.id ||
    retailer.slug !== manifest.retailer.slug ||
    retailer.name !== manifest.retailer.name ||
    Number(retailer.trust_score) !== manifest.retailer.trustScore
  ) {
    throw new RetailerPromotionConflictError(
      "Canonical retailer id, slug, name, or reviewed trust score conflicts.",
    );
  }
  return retailer;
}

function requireCompleteExistingState(
  task: ResearchTaskRow,
  resolutions: ResolutionRow[],
  audits: AuditRow[],
  manifest: CanonicalRetailerPromotionManifest,
  metadata: PromotionMetadata,
) {
  const resolution = resolutions[0];
  const audit = audits[0];
  if (
    resolutions.length !== 1 ||
    !resolution ||
    resolution.task_id !== task.id ||
    resolution.outcome !== "existing-canonical-retailer" ||
    resolution.canonical_retailer_slug !== manifest.retailer.slug ||
    resolution.rationale !== manifest.rationale ||
    resolution.canonical_write !== false ||
    resolution.publication_status !== "private-research-only" ||
    !metadataMatches(resolution.audit_metadata, metadata) ||
    task.status !== "completed" ||
    task.assigned_operator_id !== null ||
    task.work_state !== "ready" ||
    task.next_action !== null ||
    audits.length !== 1 ||
    !audit ||
    audit.queue !== "community_research_task" ||
    audit.action !== "promote" ||
    audit.target_ref !== task.id ||
    audit.canonical_write !== true ||
    audit.rationale !== manifest.rationale ||
    audit.operator_subject !== resolution.reviewed_by ||
    !metadataMatches(audit.metadata, metadata)
  ) {
    throw new RetailerPromotionConflictError(
      "Canonical retailer promotion has a missing or conflicting resolution, task closure, or audit trail.",
    );
  }
}

async function buildPromotionPlan(
  sql: Sql,
  manifest: CanonicalRetailerPromotionManifest,
  operator: OperatorRow,
  lock: boolean,
): Promise<PromotionPlan> {
  const rowLock = lock ? sql`for share` : sql``;
  const taskLock = lock ? sql`for update` : sql``;
  const taskRows = await sql<ResearchTaskRow[]>`
    select id, task_kind, entity_kind, entity_source, entity_ref, entity_label,
      status, assigned_operator_id, work_state, next_action
    from community_research_tasks
    where id = ${manifest.provenance.researchTask.id}
    limit 2
    ${taskLock}
  `;
  const task = requireTaskIdentity(taskRows, manifest);
  const retailerRows = await sql<RetailerRow[]>`
    select id, slug, name, trust_score
    from retailers
    where id = ${manifest.retailer.id}
      or slug = ${manifest.retailer.slug}
      or lower(btrim(name)) = lower(btrim(${manifest.retailer.name}))
    order by id
    limit 4
    ${rowLock}
  `;
  const retailer = exactRetailer(retailerRows, manifest);
  const resolutions = await sql<ResolutionRow[]>`
    select task_id, outcome, canonical_retailer_slug, reviewed_by, rationale,
      audit_metadata, reviewed_at, canonical_write, publication_status
    from community_retailer_research_resolutions
    where task_id = ${task.id}
    limit 2
    ${rowLock}
  `;
  const audits = await sql<AuditRow[]>`
    select operator_subject, queue, action, target_ref, canonical_write,
      rationale, metadata
    from moderation_audit_log
    where queue = 'community_research_task'
      and target_ref = ${task.id}
      and action = 'promote'
    order by event_sequence
    limit 2
    ${rowLock}
  `;
  const metadata = promotionMetadata(manifest);

  if (retailer) {
    requireCompleteExistingState(task, resolutions, audits, manifest, metadata);
    return { action: "unchanged", metadata };
  }
  if (resolutions.length !== 0 || audits.length !== 0) {
    throw new RetailerPromotionConflictError(
      "Canonical retailer promotion is in an incomplete state.",
    );
  }
  requireActiveOwnedTask(task, operator.id);
  const retainedMentions = await sql<RetainedMentionRow[]>`
    select mention.contribution_id
    from community_research_task_mentions mention
    join community_contributions contribution
      on contribution.id = mention.contribution_id
    where mention.task_id = ${task.id}
      and contribution.retain_until > now()
      and contribution.moderation_status <> 'rejected'
    order by mention.created_at, mention.contribution_id
    limit 1
  `;
  if (retainedMentions.length !== 1) {
    throw new RetailerPromotionConflictError(
      "Canonical retailer creation requires an authoritative retained, non-rejected research mention.",
    );
  }
  return { action: "create-and-resolve", metadata };
}

function boundedResult(
  mode: "applied" | "dry-run",
  manifest: CanonicalRetailerPromotionManifest,
  plan: PromotionPlan,
  writes: boolean,
) {
  return {
    mode,
    ready: true,
    writes,
    retailer: {
      id: manifest.retailer.id,
      slug: manifest.retailer.slug,
      name: manifest.retailer.name,
      trustScore: manifest.retailer.trustScore,
      action: plan.action,
    },
    researchTask: {
      id: manifest.provenance.researchTask.id,
      resultingStatus: "completed" as const,
    },
    resolution: {
      outcome: "existing-canonical-retailer" as const,
      canonicalWrite: false,
      publicationStatus: "private-research-only" as const,
    },
    audit: {
      queue: "community_research_task" as const,
      action: "promote" as const,
      canonicalWrite: true,
    },
  };
}

export type CanonicalRetailerPromotionResult = ReturnType<typeof boundedResult>;

export async function runCanonicalRetailerPromotion(
  sql: Sql,
  untrustedManifest: unknown,
  options: {
    apply?: boolean;
    operatorEmail?: string;
    now?: Date;
  } = {},
): Promise<CanonicalRetailerPromotionResult> {
  const now = options.now ?? new Date();
  const manifest = parseCanonicalRetailerPromotionManifest(
    untrustedManifest,
    now,
  );
  const begin = (sql as TransactionSql).begin;
  if (typeof begin !== "function") {
    throw new RetailerPromotionConflictError(
      "Canonical retailer promotion requires transactional database access.",
    );
  }
  const apply = options.apply === true;
  return (await begin.call(
    sql,
    apply
      ? "isolation level read committed"
      : "isolation level read committed read only",
    async (transaction) => {
      await acquireCanonicalRetailerIdentityLock(transaction);
      const operator = await resolveCanonicalRetailerPromotionAdmin(
        transaction,
        options.operatorEmail ?? process.env.MODERATION_OPERATOR_EMAIL,
        apply,
      );
      const plan = await buildPromotionPlan(
        transaction,
        manifest,
        operator,
        apply,
      );
      if (!apply || plan.action === "unchanged") {
        if (plan.action === "create-and-resolve") {
          requireCurrentEvidenceForCreate(manifest, now);
          await verifyCanonicalRetailerPromotionEvidence(manifest);
        }
        return boundedResult(
          apply ? "applied" : "dry-run",
          manifest,
          plan,
          false,
        );
      }

      requireCurrentEvidenceForCreate(manifest, now);
      await verifyCanonicalRetailerPromotionEvidence(manifest);

      const inserted = await transaction<{ id: string }[]>`
        insert into retailers (id, slug, name, trust_score)
        values (
          ${manifest.retailer.id}, ${manifest.retailer.slug},
          ${manifest.retailer.name}, ${manifest.retailer.trustScore}
        )
        returning id
      `;
      if (inserted.length !== 1 || inserted[0].id !== manifest.retailer.id) {
        throw new RetailerPromotionConflictError(
          "Canonical retailer could not be created exactly once.",
        );
      }

      const resolution = buildCommunityRetailerResearchResolution({
        taskId: manifest.provenance.researchTask.id,
        reviewedBy: operator.auth_subject,
        rationale: manifest.rationale,
        auditMetadata: plan.metadata,
        outcome: "existing-canonical-retailer",
        canonicalSlug: manifest.retailer.slug,
      });
      const resolutionRows = await transaction<{ task_id: string }[]>`
        insert into community_retailer_research_resolutions (
          task_id, outcome, canonical_retailer_slug, reviewed_by,
          rationale, audit_metadata, canonical_write, publication_status
        ) values (
          ${resolution.taskId}, ${resolution.outcome},
          ${resolution.canonicalRetailerSlug}, ${resolution.reviewedBy},
          ${resolution.rationale}, ${transaction.json(resolution.auditMetadata)},
          ${resolution.canonicalWrite}, ${resolution.publicationStatus}
        )
        on conflict (task_id) do nothing
        returning task_id
      `;
      if (
        resolutionRows.length !== 1 ||
        resolutionRows[0].task_id !== resolution.taskId
      ) {
        throw new RetailerPromotionConflictError(
          "Canonical retailer research resolution could not be recorded exactly once.",
        );
      }
      const closedTasks = await transaction<{ id: string }[]>`
        update community_research_tasks
        set
          status = ${resolution.taskStatus},
          assigned_operator_id = null,
          work_state = 'ready',
          next_action = null,
          last_reviewed_at = now(),
          updated_at = now()
        where id = ${resolution.taskId}
          and status = 'in-progress'
          and work_state = 'assigned'
          and assigned_operator_id = ${operator.id}
        returning id
      `;
      if (closedTasks.length !== 1 || closedTasks[0].id !== resolution.taskId) {
        throw new RetailerPromotionConflictError(
          "Canonical retailer research task could not be closed exactly once.",
        );
      }
      await recordModerationAction(transaction, {
        operatorSubject: operator.auth_subject,
        queue: "community_research_task",
        action: "promote",
        targetRef: manifest.provenance.researchTask.id,
        canonicalWrite: true,
        rationale: manifest.rationale,
        metadata: plan.metadata,
      });

      return boundedResult("applied", manifest, plan, true);
    },
  )) as CanonicalRetailerPromotionResult;
}

async function main() {
  const command = parseCanonicalRetailerPromotionCommand(process.argv.slice(2));
  const now = new Date();
  const manifest = await readCanonicalRetailerPromotionManifest(
    command.manifestPath,
    now,
  );
  const databaseUrl = requireAdminDatabaseUrl({
    MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL,
  });
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const result = await runCanonicalRetailerPromotion(sql, manifest, {
      apply: command.apply,
      operatorEmail: process.env.MODERATION_OPERATOR_EMAIL,
      now,
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function safeErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    const paths = [
      ...new Set(
        error.issues.map((issue) => issue.path.join(".") || "manifest"),
      ),
    ];
    return `Canonical retailer promotion manifest validation failed at ${paths.join(", ")}.`;
  }
  if (
    error instanceof RetailerPromotionInputError ||
    error instanceof RetailerPromotionConflictError ||
    error instanceof RetailerPromotionAuthorizationError
  ) {
    return error.message;
  }
  if (
    error instanceof Error &&
    error.message.startsWith("MIGRATION_DATABASE_URL")
  ) {
    return error.message;
  }
  return "Canonical retailer promotion failed.";
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  void main().catch((error) => {
    console.error(safeErrorMessage(error));
    process.exitCode = 1;
  });
}
