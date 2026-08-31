import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertConsultAiRetentionOperatorEnvironment,
  CONSULT_AI_RETENTION_CONFIRMATION,
  CONSULT_AI_RETENTION_MAX_LIMIT,
  CONSULT_AI_RETENTION_MIN_LIMIT,
  executeConsultAiRetentionOperator,
  parseConsultAiRetentionOptions,
} from "../../scripts/lib/consult-ai-retention";

test("Ask retention defaults to a bounded dry run and rejects unknown input", () => {
  assert.deepEqual(parseConsultAiRetentionOptions([]), {
    apply: false,
    limit: 100,
  });
  assert.deepEqual(parseConsultAiRetentionOptions(["--limit", "1"]), {
    apply: false,
    limit: CONSULT_AI_RETENTION_MIN_LIMIT,
  });
  assert.deepEqual(parseConsultAiRetentionOptions(["--limit=500"]), {
    apply: false,
    limit: CONSULT_AI_RETENTION_MAX_LIMIT,
  });

  for (const invalid of [
    ["--limit", "0"],
    ["--limit", "501"],
    ["--limit", "1.5"],
    ["--limit", "01"],
    ["--limit"],
    ["--limit=20", "--limit=21"],
    ["--apply", "--apply"],
    ["--unknown"],
    ["20"],
  ]) {
    assert.throws(() => parseConsultAiRetentionOptions(invalid));
  }
});

test("apply requires the exact confirmation and confirmation cannot decorate a dry run", () => {
  assert.deepEqual(
    parseConsultAiRetentionOptions([
      "--apply",
      "--limit",
      "20",
      "--confirm",
      CONSULT_AI_RETENTION_CONFIRMATION,
    ]),
    { apply: true, limit: 20 },
  );
  assert.throws(() => parseConsultAiRetentionOptions(["--apply"]));
  assert.throws(() =>
    parseConsultAiRetentionOptions([
      "--apply",
      "--confirm=purge-expired-consult-ai-generation",
    ]),
  );
  assert.throws(() =>
    parseConsultAiRetentionOptions([
      `--confirm=${CONSULT_AI_RETENTION_CONFIRMATION}`,
    ]),
  );
});

test("operator is unavailable in Vercel", () => {
  assert.doesNotThrow(() => assertConsultAiRetentionOperatorEnvironment({}));
  assert.throws(
    () => assertConsultAiRetentionOperatorEnvironment({ VERCEL: "1" }),
    /unavailable in every Vercel environment/,
  );
  assert.throws(
    () =>
      assertConsultAiRetentionOperatorEnvironment({ VERCEL_ENV: "preview" }),
    /unavailable in every Vercel environment/,
  );
});

test("dry run never calls delete and reports only aggregate counts", async () => {
  let deleteCalls = 0;
  const result = await executeConsultAiRetentionOperator(
    { apply: false, limit: 20 },
    {
      countEligible: async () => 37,
      applyBatch: async () => {
        deleteCalls += 1;
        return { eligible: 37, selected: 20, deleted: 20, remaining: 17 };
      },
    },
  );

  assert.equal(deleteCalls, 0);
  assert.deepEqual(result, {
    mode: "dry-run",
    eligible: 37,
    selected: 20,
    deleted: 0,
    remaining: 37,
  });
  assert.deepEqual(Object.keys(result).sort(), [
    "deleted",
    "eligible",
    "mode",
    "remaining",
    "selected",
  ]);
});

test("apply forwards one bounded batch and zero-delete reruns succeed", async () => {
  const limits: number[] = [];
  const aggregateWithPrivateData = {
    eligible: 12,
    selected: 12,
    deleted: 12,
    remaining: 0,
    providerData: "must-not-escape",
  };
  const first = await executeConsultAiRetentionOperator(
    { apply: true, limit: 12 },
    {
      countEligible: async () => {
        throw new Error("apply must use its transactional batch dependency");
      },
      applyBatch: async (limit) => {
        limits.push(limit);
        return aggregateWithPrivateData;
      },
    },
  );
  const rerun = await executeConsultAiRetentionOperator(
    { apply: true, limit: 12 },
    {
      countEligible: async () => 0,
      applyBatch: async (limit) => {
        limits.push(limit);
        return { eligible: 0, selected: 0, deleted: 0, remaining: 0 };
      },
    },
  );

  assert.deepEqual(limits, [12, 12]);
  assert.deepEqual(first, {
    mode: "applied",
    eligible: 12,
    selected: 12,
    deleted: 12,
    remaining: 0,
  });
  assert.deepEqual(rerun, {
    mode: "applied",
    eligible: 0,
    selected: 0,
    deleted: 0,
    remaining: 0,
  });
});

test("source, package, migration, and docs preserve the protected retention contract", async () => {
  const [script, migration, packageJson, runbook, plan, neon] =
    await Promise.all([
      readFile("scripts/purge-consult-ai-generations.ts", "utf8"),
      readFile("db/migrations/0040_consult_ai_generations.sql", "utf8"),
      readFile("package.json", "utf8"),
      readFile("docs/operations/RUNBOOKS.md", "utf8"),
      readFile("docs/ai/ASK_JELO_GATEWAY_PLAN.md", "utf8"),
      readFile("docs/data/NEON.md", "utf8"),
    ]);

  const environmentGuard = script.indexOf(
    "assertConsultAiRetentionOperatorEnvironment(process.env)",
  );
  const connectionGuard = script.indexOf("requireAdminDatabaseUrl()");
  const connectionOpen = script.indexOf("postgres(connectionString");
  assert.ok(environmentGuard >= 0 && environmentGuard < connectionGuard);
  assert.ok(connectionGuard >= 0 && connectionGuard < connectionOpen);
  assert.doesNotMatch(
    script,
    /DATABASE_URL_UNPOOLED|POSTGRES_URL_NON_POOLING|process\.env\.(?:DATABASE_URL|POSTGRES_URL)/,
  );
  assert.match(script, /sql\.begin\(["']read only["']/);
  assert.match(
    script,
    /where retain_until <= now\(\)[\s\S]*order by retain_until, id[\s\S]*limit \$\{limit\}[\s\S]*for update skip locked/,
  );
  assert.match(
    script,
    /delete from public\.consult_ai_generations[\s\S]*returning 1/,
  );
  assert.doesNotMatch(script, /returning (?:generation\.)?id/);
  assert.match(script, /JSON\.stringify\(result\)/);
  assert.match(script, /main\(\)\.catch\(\(\) =>/);
  assert.doesNotMatch(script, /console\.error\(\s*(?:error|cause)\b/);
  assert.match(
    script,
    /Ask Jelo retention operator failed; no generation data or connection details were printed\./,
  );
  assert.match(
    migration,
    /revoke delete on table consult_ai_generations from jelocare_app_runtime/,
  );
  assert.match(packageJson, /"consult:ai:retention":/);
  assert.match(runbook, /fresh action-time production authority/i);
  assert.match(runbook, /--confirm=purge-expired-consult-ai-generations/);
  assert.match(runbook, /never runs in Vercel/i);
  assert.match(plan, /runtime role remains denied\s+`DELETE`/i);
  assert.match(plan, /aggregate counts only/i);
  assert.match(neon, /not an automatic deletion guarantee/i);
  assert.match(neon, /npm run consult:ai:retention/);
});
