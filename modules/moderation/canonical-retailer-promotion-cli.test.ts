import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import type { Sql } from "postgres";
import {
  canonicalRetailerPromotionFingerprint,
  parseCanonicalRetailerPromotionCommand,
  parseCanonicalRetailerPromotionManifest,
  readCanonicalRetailerPromotionManifest,
  resolveCanonicalRetailerPromotionAdmin,
  runCanonicalRetailerPromotion,
  type CanonicalRetailerPromotionManifest,
  verifyCanonicalRetailerPromotionEvidence,
} from "@/scripts/promote-canonical-retailer";

const now = new Date("2026-09-02T12:00:00.000Z");
const operatorId = "22222222-2222-4222-8222-222222222222";
const operatorSubject = "neon-auth|retailer-admin";
const taskId = "33333333-3333-4333-8333-333333333333";
const retailerId = "44444444-4444-4444-8444-444444444444";
const sourceReference = "private-ledger:88888888-8888-4888-8888-888888888888";
const evidenceBytes = Buffer.from("retained exact retailer identity evidence");
const evidenceSha256 = createHash("sha256").update(evidenceBytes).digest("hex");
let evidenceDirectory = "";
let evidenceArtifactPath = "";

before(async () => {
  evidenceDirectory = await mkdtemp(
    path.join(os.tmpdir(), "jelocare-retailer-evidence-"),
  );
  evidenceArtifactPath = path.join(evidenceDirectory, "identity-evidence.txt");
  await writeFile(evidenceArtifactPath, evidenceBytes);
});

after(async () => {
  if (evidenceDirectory) {
    await rm(evidenceDirectory, { recursive: true, force: true });
  }
});

function promotionManifest(): CanonicalRetailerPromotionManifest {
  return parseCanonicalRetailerPromotionManifest(
    {
      manifestVersion: 1,
      reviewedAt: "2026-09-02T11:00:00.000Z",
      rationale:
        "The reviewed business identity and retailer trust score are attributable to the retained evidence.",
      retailer: {
        id: retailerId,
        slug: "unit-spec-retailer",
        name: "Unit Spec Retailer",
        trustScore: 42,
      },
      provenance: {
        researchTask: {
          id: taskId,
          entityRef: "custom:unit spec retailer",
          entityLabel: "Unit Spec Retailer",
          identityBinding: {
            method: "exact-normalized-task-identity",
          },
        },
        identityEvidence: {
          sourceMethod: "field_visit",
          sourceReference,
          artifactPath: evidenceArtifactPath,
          evidenceSha256,
          observedAt: "2026-09-01T10:00:00.000Z",
          expiresAt: "2026-12-01T10:00:00.000Z",
        },
      },
    },
    now,
  );
}

function queryText(strings: TemplateStringsArray, values: unknown[]) {
  return strings
    .reduce((text, part, index) => {
      const value = values[index - 1];
      const interpolation =
        value && typeof value === "object" && "fragment" in value
          ? String(value.fragment)
          : " ? ";
      return `${text}${index === 0 ? "" : interpolation}${part}`;
    }, "")
    .replace(/\s+/g, " ")
    .trim();
}

type FixtureTask = {
  id: string;
  task_kind: string;
  entity_kind: string;
  entity_source: string;
  entity_ref: string;
  entity_label: string;
  signal_count: number;
  status: string;
  assigned_operator_id: string | null;
  work_state: string;
  next_action: string | null;
};

type FixtureRetailer = {
  id: string;
  slug: string;
  name: string;
  trust_score: number;
};

type FixtureResolution = {
  task_id: string;
  outcome: string;
  canonical_retailer_slug: string | null;
  reviewed_by: string;
  rationale: string;
  audit_metadata: Record<string, unknown>;
  reviewed_at: string;
  canonical_write: boolean;
  publication_status: string;
};

type FixtureAudit = {
  operator_subject: string;
  queue: string;
  action: string;
  target_ref: string;
  canonical_write: boolean;
  rationale: string | null;
  metadata: Record<string, unknown>;
};

function promotionFixture(
  input: {
    operatorRole?: string;
    retailerRows?: FixtureRetailer[];
    failAudit?: boolean;
    retainedMention?: boolean;
  } = {},
) {
  const manifest = promotionManifest();
  const initialTask: FixtureTask = {
    id: taskId,
    task_kind: "retailer-identity",
    entity_kind: "retailer",
    entity_source: "custom",
    entity_ref: manifest.provenance.researchTask.entityRef,
    entity_label: manifest.provenance.researchTask.entityLabel,
    signal_count: 0,
    status: "in-progress",
    assigned_operator_id: operatorId,
    work_state: "assigned",
    next_action: "Verify the exact business identity and reviewed score.",
  };
  const state = {
    task: { ...initialTask },
    retailers: [...(input.retailerRows ?? [])],
    resolution: null as FixtureResolution | null,
    audits: [] as FixtureAudit[],
    transactionModes: [] as string[],
    queries: [] as string[],
    jsonValues: [] as unknown[],
  };

  const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = queryText(strings, values);
    state.queries.push(query);
    if (query === "" || query === "for share" || query === "for update") {
      return { fragment: query };
    }
    if (query.includes("pg_advisory_xact_lock")) {
      return [];
    }
    if (query.includes("from moderation_operators")) {
      if (input.operatorRole === "inactive") return [];
      return [
        {
          id: operatorId,
          auth_subject: operatorSubject,
          role: input.operatorRole ?? "admin",
        },
      ];
    }
    if (
      query.includes("from community_research_tasks") &&
      query.includes("select id, task_kind")
    ) {
      return [state.task];
    }
    if (
      query.includes("from retailers") &&
      query.includes("select id, slug, name, trust_score")
    ) {
      return state.retailers;
    }
    if (query.includes("select exists(") && query.includes("from retailers")) {
      return [
        {
          exists: state.retailers.some(
            (retailer) => retailer.slug === manifest.retailer.slug,
          ),
        },
      ];
    }
    if (
      query.includes("from community_retailer_research_resolutions") &&
      query.includes("select task_id")
    ) {
      return state.resolution ? [state.resolution] : [];
    }
    if (
      query.includes("select exists(") &&
      query.includes("community_retailer_research_resolutions")
    ) {
      return [{ exists: state.resolution !== null }];
    }
    if (
      query.includes("from moderation_audit_log") &&
      query.includes("select operator_subject")
    ) {
      return state.audits;
    }
    if (query.includes("from community_research_task_mentions mention")) {
      return input.retainedMention === false
        ? []
        : [{ contribution_id: "77777777-7777-4777-8777-777777777777" }];
    }
    if (query.startsWith("insert into retailers")) {
      const retailer: FixtureRetailer = {
        id: String(values[0]),
        slug: String(values[1]),
        name: String(values[2]),
        trust_score: Number(values[3]),
      };
      state.retailers.push(retailer);
      return [{ id: retailer.id }];
    }
    if (
      query.startsWith("insert into community_retailer_research_resolutions")
    ) {
      state.resolution = {
        task_id: String(values[0]),
        outcome: String(values[1]),
        canonical_retailer_slug: values[2] === null ? null : String(values[2]),
        reviewed_by: String(values[3]),
        rationale: String(values[4]),
        audit_metadata: values[5] as Record<string, unknown>,
        reviewed_at: now.toISOString(),
        canonical_write: Boolean(values[6]),
        publication_status: String(values[7]),
      };
      return [{ task_id: taskId }];
    }
    if (query.startsWith("update community_research_tasks")) {
      state.task.status = "completed";
      state.task.assigned_operator_id = null;
      state.task.work_state = "ready";
      state.task.next_action = null;
      return [{ id: taskId }];
    }
    if (query.startsWith("insert into moderation_audit_log")) {
      if (input.failAudit) throw new Error("simulated private source failure");
      state.audits.push({
        operator_subject: String(values[0]),
        queue: String(values[1]),
        action: String(values[2]),
        target_ref: String(values[3]),
        canonical_write: Boolean(values[4]),
        rationale: values[5] === null ? null : String(values[5]),
        metadata: values[6] as Record<string, unknown>,
      });
      return [];
    }
    throw new Error(`Unexpected promotion fixture query: ${query}`);
  }) as unknown as Sql;
  tag.json = (value) => {
    state.jsonValues.push(value);
    return value as never;
  };

  const root = (() => undefined) as unknown as {
    begin: <T>(
      options: string,
      run: (transaction: Sql) => Promise<T>,
    ) => Promise<T>;
  };
  root.begin = async (options, run) => {
    state.transactionModes.push(options);
    const snapshot = {
      task: { ...state.task },
      retailers: state.retailers.map((row) => ({ ...row })),
      resolution: state.resolution ? { ...state.resolution } : null,
      audits: state.audits.map((row) => ({ ...row })),
    };
    try {
      return await run(tag);
    } catch (error) {
      state.task = snapshot.task;
      state.retailers = snapshot.retailers;
      state.resolution = snapshot.resolution;
      state.audits = snapshot.audits;
      throw error;
    }
  };
  return {
    manifest,
    sql: root as unknown as Sql,
    querySql: tag as Sql,
    state,
  };
}

test("the private manifest is strict, dry-run-first, and binds an explicit reviewed trust score", () => {
  const manifest = promotionManifest();
  assert.equal(
    parseCanonicalRetailerPromotionCommand([
      "--manifest=/absolute/private/retailer.json",
    ]).apply,
    false,
  );
  assert.equal(
    parseCanonicalRetailerPromotionCommand([
      "--manifest=/absolute/private/retailer.json",
      "--apply",
    ]).apply,
    true,
  );
  assert.throws(() => parseCanonicalRetailerPromotionCommand(["--apply"]));
  assert.throws(() =>
    parseCanonicalRetailerPromotionCommand(["--manifest=./retailer.json"]),
  );
  assert.throws(() =>
    parseCanonicalRetailerPromotionManifest(
      {
        ...manifest,
        retailer: { ...manifest.retailer, trustScore: undefined },
      },
      now,
    ),
  );
  for (const invalidSourceReference of [
    "https://retailer.invalid/private?token=must-not-persist",
    "private-ledger:https://retailer.invalid",
    "private-ledger:operator@retailer.invalid",
    "private-ledger:/private/evidence/file",
    "private-ledger:00000000-0000-0000-0000-000000000000",
    "private-ledger:ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF",
  ]) {
    assert.throws(() =>
      parseCanonicalRetailerPromotionManifest(
        {
          ...manifest,
          provenance: {
            ...manifest.provenance,
            identityEvidence: {
              ...manifest.provenance.identityEvidence,
              sourceReference: invalidSourceReference,
            },
          },
        },
        now,
      ),
    );
  }
  assert.throws(() =>
    parseCanonicalRetailerPromotionManifest(
      {
        ...manifest,
        retailer: { ...manifest.retailer, trustScore: 101 },
      },
      now,
    ),
  );
  assert.throws(() =>
    parseCanonicalRetailerPromotionManifest(
      {
        ...manifest,
        provenance: {
          ...manifest.provenance,
          identityEvidence: {
            ...manifest.provenance.identityEvidence,
            evidenceSha256: "not-an-exact-digest",
          },
        },
      },
      now,
    ),
  );
  assert.throws(
    () =>
      parseCanonicalRetailerPromotionManifest(
        {
          ...manifest,
          provenance: {
            ...manifest.provenance,
            identityEvidence: {
              ...manifest.provenance.identityEvidence,
              expiresAt: "2027-09-01T10:00:00.000Z",
            },
          },
        },
        now,
      ),
    /source-specific maximum window/,
  );
  assert.notEqual(
    canonicalRetailerPromotionFingerprint(manifest),
    canonicalRetailerPromotionFingerprint({
      ...manifest,
      retailer: { ...manifest.retailer, trustScore: 84 },
    }),
  );
});

test("the private manifest loader rejects repository paths and symlinks before reading", async () => {
  const manifest = promotionManifest();
  const manifestPath = path.join(evidenceDirectory, "retailer-promotion.json");
  await writeFile(manifestPath, JSON.stringify(manifest));
  assert.equal(
    (await readCanonicalRetailerPromotionManifest(manifestPath, now)).retailer
      .slug,
    "unit-spec-retailer",
  );

  const symlinkPath = path.join(
    evidenceDirectory,
    "retailer-promotion-link.json",
  );
  await symlink(manifestPath, symlinkPath);
  await assert.rejects(
    () => readCanonicalRetailerPromotionManifest(symlinkPath, now),
    /unavailable or outside the allowed size/,
  );
  await assert.rejects(
    () =>
      readCanonicalRetailerPromotionManifest(
        path.join(process.cwd(), "package.json"),
        now,
      ),
    /must remain outside the repository/,
  );

  const repositoryLink = path.join(evidenceDirectory, "repository-link");
  await symlink(process.cwd(), repositoryLink, "dir");
  await assert.rejects(
    () =>
      readCanonicalRetailerPromotionManifest(
        path.join(repositoryLink, "package.json"),
        now,
      ),
    /unavailable or outside the allowed size/,
  );
  await assert.rejects(
    () =>
      verifyCanonicalRetailerPromotionEvidence({
        ...manifest,
        provenance: {
          ...manifest.provenance,
          identityEvidence: {
            ...manifest.provenance.identityEvidence,
            artifactPath: path.join(repositoryLink, "package.json"),
          },
        },
      }),
    /unavailable or outside the allowed size/,
  );
});

test("dry-run authenticates an active admin and plans no writes in a read-only transaction", async () => {
  const fixture = promotionFixture();
  const result = await runCanonicalRetailerPromotion(
    fixture.sql,
    fixture.manifest,
    {
      operatorEmail: "admin@jelocare.invalid",
      now,
    },
  );
  assert.equal(result.mode, "dry-run");
  assert.equal(result.writes, false);
  assert.equal(result.retailer.action, "create-and-resolve");
  assert.equal(result.retailer.trustScore, 42);
  assert.equal(result.audit.canonicalWrite, true);
  assert.deepEqual(fixture.state.transactionModes, [
    "isolation level read committed read only",
  ]);
  assert.equal(fixture.state.retailers.length, 0);
  assert.equal(fixture.state.resolution, null);
  assert.equal(fixture.state.audits.length, 0);
  assert.match(fixture.state.queries[0], /pg_advisory_xact_lock/);
  const output = JSON.stringify(result);
  assert.doesNotMatch(output, /private-ledger/);
  assert.doesNotMatch(output, new RegExp(evidenceSha256));
  assert.doesNotMatch(output, /jelocare-retailer-evidence/);
  assert.doesNotMatch(output, /retained evidence/);
  assert.doesNotMatch(output, /admin@jelocare/);
});

test("apply creates, resolves, closes, and audits once after the READ COMMITTED identity lock", async () => {
  const fixture = promotionFixture();
  const applied = await runCanonicalRetailerPromotion(
    fixture.sql,
    fixture.manifest,
    {
      apply: true,
      operatorEmail: "admin@jelocare.invalid",
      now,
    },
  );
  assert.equal(applied.mode, "applied");
  assert.equal(applied.writes, true);
  assert.deepEqual(fixture.state.transactionModes, [
    "isolation level read committed",
  ]);
  assert.match(fixture.state.queries[0], /pg_advisory_xact_lock/);
  assert.ok(
    fixture.state.queries.findIndex((query) =>
      query.includes("from moderation_operators"),
    ) > 0,
  );
  assert.equal(
    fixture.state.queries.some(
      (query) =>
        query.includes("from community_research_tasks") &&
        query.endsWith("for update"),
    ),
    true,
  );
  const retainedMentionQuery = fixture.state.queries.find((query) =>
    query.includes("from community_research_task_mentions mention"),
  );
  assert.ok(retainedMentionQuery);
  assert.doesNotMatch(retainedMentionQuery, /for (?:share|update)$/);
  assert.deepEqual(fixture.state.retailers, [
    {
      id: retailerId,
      slug: "unit-spec-retailer",
      name: "Unit Spec Retailer",
      trust_score: 42,
    },
  ]);
  assert.equal(
    fixture.state.resolution?.outcome,
    "existing-canonical-retailer",
  );
  assert.equal(fixture.state.resolution?.canonical_write, false);
  assert.equal(fixture.state.task.status, "completed");
  assert.equal(fixture.state.task.assigned_operator_id, null);
  assert.equal(fixture.state.audits.length, 1);
  assert.equal(fixture.state.audits[0].queue, "community_research_task");
  assert.equal(fixture.state.audits[0].action, "promote");
  assert.equal(fixture.state.audits[0].canonical_write, true);
  assert.equal(
    fixture.state.audits[0].metadata.identitySourceReference,
    fixture.manifest.provenance.identityEvidence.sourceReference,
  );
  assert.equal(
    fixture.state.audits[0].metadata.manifestFingerprint,
    canonicalRetailerPromotionFingerprint(fixture.manifest),
  );
  assert.doesNotMatch(
    JSON.stringify(fixture.state.audits[0].metadata),
    /jelocare-retailer-evidence/,
  );

  const rerun = await runCanonicalRetailerPromotion(
    fixture.sql,
    fixture.manifest,
    {
      apply: true,
      operatorEmail: "another-admin@jelocare.invalid",
      now: new Date("2027-01-02T12:00:00.000Z"),
    },
  );
  assert.equal(rerun.writes, false);
  assert.equal(rerun.retailer.action, "unchanged");
  assert.equal(fixture.state.retailers.length, 1);
  assert.equal(fixture.state.audits.length, 1);
});

test("id, slug, and case-insensitive name conflicts fail before any write", async () => {
  const conflicts: FixtureRetailer[][] = [
    [
      {
        id: retailerId,
        slug: "different-slug",
        name: "Different Retailer",
        trust_score: 42,
      },
    ],
    [
      {
        id: "55555555-5555-4555-8555-555555555555",
        slug: "unit-spec-retailer",
        name: "Different Retailer",
        trust_score: 42,
      },
    ],
    [
      {
        id: "66666666-6666-4666-8666-666666666666",
        slug: "different-retailer",
        name: "UNIT SPEC RETAILER",
        trust_score: 42,
      },
    ],
  ];
  for (const retailerRows of conflicts) {
    const fixture = promotionFixture({ retailerRows });
    await assert.rejects(
      () =>
        runCanonicalRetailerPromotion(fixture.sql, fixture.manifest, {
          apply: true,
          operatorEmail: "admin@jelocare.invalid",
          now,
        }),
      /id, slug, name, or reviewed trust score conflicts/,
    );
    assert.equal(fixture.state.resolution, null);
    assert.equal(fixture.state.audits.length, 0);
  }
});

test("partial state, non-admin authority, and a failed audit all fail closed", async () => {
  const exact = promotionManifest().retailer;
  const partial = promotionFixture({
    retailerRows: [
      {
        id: exact.id,
        slug: exact.slug,
        name: exact.name,
        trust_score: exact.trustScore,
      },
    ],
  });
  await assert.rejects(
    () =>
      runCanonicalRetailerPromotion(partial.sql, partial.manifest, {
        apply: true,
        operatorEmail: "admin@jelocare.invalid",
        now,
      }),
    /missing or conflicting resolution, task closure, or audit trail/,
  );

  const operator = promotionFixture({ operatorRole: "operator" });
  await assert.rejects(
    () =>
      runCanonicalRetailerPromotion(operator.sql, operator.manifest, {
        apply: true,
        operatorEmail: "operator@jelocare.invalid",
        now,
      }),
    /exactly one active admin/,
  );
  assert.equal(operator.state.retailers.length, 0);

  const failedAudit = promotionFixture({ failAudit: true });
  await assert.rejects(() =>
    runCanonicalRetailerPromotion(failedAudit.sql, failedAudit.manifest, {
      apply: true,
      operatorEmail: "admin@jelocare.invalid",
      now,
    }),
  );
  assert.equal(failedAudit.state.retailers.length, 0);
  assert.equal(failedAudit.state.resolution, null);
  assert.equal(failedAudit.state.task.status, "in-progress");
  assert.equal(failedAudit.state.audits.length, 0);
});

test("first create requires an assigned matching lead and an authoritative retained mention", async () => {
  const blocked = promotionFixture();
  blocked.state.task.work_state = "blocked";
  await assert.rejects(
    () =>
      runCanonicalRetailerPromotion(blocked.sql, blocked.manifest, {
        apply: true,
        operatorEmail: "admin@jelocare.invalid",
        now,
      }),
    /active admin's assigned retailer identity task/,
  );

  const unrelated = promotionFixture();
  const unrelatedManifest = {
    ...unrelated.manifest,
    retailer: {
      ...unrelated.manifest.retailer,
      slug: "unrelated-store",
      name: "Unrelated Store",
    },
  };
  await assert.rejects(
    () =>
      runCanonicalRetailerPromotion(unrelated.sql, unrelatedManifest, {
        apply: true,
        operatorEmail: "admin@jelocare.invalid",
        now,
      }),
    /does not exactly match the assigned custom lead/,
  );

  const noMention = promotionFixture({ retainedMention: false });
  await assert.rejects(
    () =>
      runCanonicalRetailerPromotion(noMention.sql, noMention.manifest, {
        apply: true,
        operatorEmail: "admin@jelocare.invalid",
        now,
      }),
    /authoritative retained, non-rejected research mention/,
  );
  assert.equal(noMention.state.retailers.length, 0);
});

test("a conflicting promote audit prevents an exact rerun from hiding partial history", async () => {
  const fixture = promotionFixture();
  await runCanonicalRetailerPromotion(fixture.sql, fixture.manifest, {
    apply: true,
    operatorEmail: "admin@jelocare.invalid",
    now,
  });
  fixture.state.audits.push({
    ...fixture.state.audits[0],
    canonical_write: false,
  });
  await assert.rejects(
    () =>
      runCanonicalRetailerPromotion(fixture.sql, fixture.manifest, {
        apply: true,
        operatorEmail: "admin@jelocare.invalid",
        now,
      }),
    /missing or conflicting resolution, task closure, or audit trail/,
  );
});

test("evidence bytes are recomputed before a new write and private paths stay hidden", async () => {
  const fixture = promotionFixture();
  const mismatched = {
    ...fixture.manifest,
    provenance: {
      ...fixture.manifest.provenance,
      identityEvidence: {
        ...fixture.manifest.provenance.identityEvidence,
        evidenceSha256:
          "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      },
    },
  };
  await assert.rejects(
    () =>
      runCanonicalRetailerPromotion(fixture.sql, mismatched, {
        operatorEmail: "admin@jelocare.invalid",
        now,
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /does not match the reviewed SHA-256 digest/);
      assert.doesNotMatch(error.message, /jelocare-retailer-evidence/);
      return true;
    },
  );
  assert.deepEqual(fixture.state.transactionModes, [
    "isolation level read committed read only",
  ]);
  assert.equal(fixture.state.retailers.length, 0);
  assert.equal(fixture.state.resolution, null);
  assert.equal(fixture.state.audits.length, 0);
});

test("the operator uses protected authority and has no offer, location, stock, or application writer", async () => {
  const fixture = promotionFixture();
  assert.equal(
    (
      await resolveCanonicalRetailerPromotionAdmin(
        fixture.querySql,
        "admin@jelocare.invalid",
      )
    ).auth_subject,
    operatorSubject,
  );
  const source = await readFile(
    path.join(process.cwd(), "scripts/promote-canonical-retailer.ts"),
    "utf8",
  );
  const environmentNames = [
    ...source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g),
  ].map((match) => match[1]);
  assert.deepEqual([...new Set(environmentNames)].sort(), [
    "MIGRATION_DATABASE_URL",
    "MODERATION_OPERATOR_EMAIL",
  ]);
  assert.match(source, /requireAdminDatabaseUrl\(\{/);
  assert.match(
    source,
    /apply\s*\? ["']isolation level read committed["']\s*: ["']isolation level read committed read only["']/,
  );
  assert.match(source, /insert into retailers/);
  assert.doesNotMatch(source, /insert into offers/);
  assert.doesNotMatch(
    source,
    /insert into retailer_(?:locations|applications)/,
  );
  assert.doesNotMatch(source, /insert into physical_product_observations/);
  assert.doesNotMatch(source, /update retailer_applications/);
  assert.match(source, /queue: ["']community_research_task["']/);
  assert.match(source, /action: ["']promote["']/);
  assert.match(source, /canonicalWrite: true/);
});

test("both runtime retailer writers share the lock and seed rejects normalized name collisions", async () => {
  const [promotionSource, seedSource, lockSource] = await Promise.all([
    readFile(
      path.join(process.cwd(), "scripts/promote-canonical-retailer.ts"),
      "utf8",
    ),
    readFile(path.join(process.cwd(), "scripts/seed-catalogue.ts"), "utf8"),
    readFile(
      path.join(process.cwd(), "scripts/lib/retailer-identity-lock.ts"),
      "utf8",
    ),
  ]);
  const sharedImport =
    /import \{ acquireCanonicalRetailerIdentityLock \} from ["'].\/lib\/retailer-identity-lock["']/;
  assert.match(promotionSource, sharedImport);
  assert.match(seedSource, sharedImport);
  assert.match(
    lockSource,
    /pg_catalog\.pg_advisory_xact_lock\(\s*pg_catalog\.hashtext\(["']jelocare:canonical-retailer["']\),\s*pg_catalog\.hashtext\(["']identity-write["']\)\s*\)/,
  );
  assert.match(
    promotionSource,
    /async \(transaction\) => \{[\s\S]*?await acquireCanonicalRetailerIdentityLock\(transaction\);[\s\S]*?resolveCanonicalRetailerPromotionAdmin/,
  );
  assert.match(
    promotionSource,
    /lower\(btrim\(name\)\) = lower\(btrim\(\$\{manifest\.retailer\.name\}\)\)/,
  );
  assert.match(
    seedSource,
    /await acquireCanonicalRetailerIdentityLock\(tx\);[\s\S]*?select slug[\s\S]*?from retailers[\s\S]*?lower\(btrim\(name\)\) = lower\(btrim\(\$\{offer\.retailer\}\)\)[\s\S]*?slug <> \$\{retailerSlug\}[\s\S]*?insert into retailers/,
  );
});
