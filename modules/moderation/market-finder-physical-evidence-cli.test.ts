import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { Sql } from "postgres";
import {
  parsePhysicalEvidenceCommand,
  resolvePhysicalEvidenceAdmin,
  runPhysicalEvidenceCommand,
} from "@/scripts/record-market-finder-physical-evidence";

const contributionId = "70928660-17c0-43ef-8bfa-c3f3fe109056";
const marketId = "8f961b67-bfa5-452e-8170-2e22543bb8d3";
const locationId = "4076abc0-2b39-4a30-baad-56933d6ce73b";
const identityVersionId = "9559d142-6578-4220-9894-bdbb10194760";
const observationId = "c890f30c-56cd-4474-84b8-e12bebdfa612";
const operatorSubject = "neon-auth|market-admin";

function recordArguments() {
  const observedAt = new Date(Date.now() - 60 * 60 * 1000);
  const expiresAt = new Date(observedAt.getTime() + 24 * 60 * 60 * 1000);
  return [
    "record",
    `--contribution-id=${contributionId}`,
    "--availability=in_stock",
    `--observed-at=${observedAt.toISOString()}`,
    `--expires-at=${expiresAt.toISOString()}`,
    "--source-method=field_visit",
    "--source-reference=field-visit:trade-fair:2026-09-01:01",
    "--observed-title=COSRX Aloe Soothing Sun Cream",
    "--observed-size=50 ml",
    "--price-ngn=12500.50",
    "--rationale=Independent field evidence confirms the exact shelf item.",
  ];
}

function queryText(strings: TemplateStringsArray) {
  return strings.join(" ? ").replace(/\s+/g, " ").trim();
}

function physicalEvidenceCliFixture() {
  const state = {
    status: "pending" as "pending" | "approved" | "rejected",
    inserted: false,
    writes: [] as string[],
    transactionModes: [] as string[],
  };
  const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = queryText(strings);
    if (/^(?:insert|update|delete) /i.test(query)) state.writes.push(query);
    if (query.includes("from moderation_operators")) {
      return [
        {
          id: "80542c0c-a112-46b7-b889-f91eeab6b14d",
          auth_subject: operatorSubject,
          role: "admin",
        },
      ];
    }
    if (query.includes("from community_contributions")) {
      return [
        { id: contributionId, moderation_status: "approved", retained: true },
      ];
    }
    if (query.includes("from market_finder_reports")) {
      return [
        {
          contribution_id: contributionId,
          market_id: marketId,
          retailer_location_id: locationId,
          product_identity_version_id: identityVersionId,
          outcome: "found_bought",
          moderation_status: "approved",
          location_state: "verified",
          identity_state: "active",
          product_published: true,
        },
      ];
    }
    if (query.includes("from physical_product_observations observation")) {
      return [
        {
          id: observationId,
          retailer_location_id: locationId,
          product_identity_version_id: identityVersionId,
          moderation_status: state.status,
          source_method: "field_visit",
          observed_at: new Date(Date.now() - 60 * 60 * 1000),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          location_state: "verified",
          location_current: true,
          identity_state: "active",
          product_published: true,
          market_slug: "lagos-trade-fair",
        },
      ];
    }
    if (query.startsWith("insert into physical_product_observations")) {
      state.inserted = true;
      return [{ id: observationId }];
    }
    if (query.startsWith("update physical_product_observations")) {
      state.status = values[0] as "approved" | "rejected";
      return [{ id: observationId }];
    }
    if (query.startsWith("insert into moderation_audit_log")) return [];
    throw new Error(`Unexpected CLI fixture query: ${query}`);
  }) as unknown as Sql;
  tag.json = (value) => value as never;
  const transactionTag = tag as unknown as {
    begin: <T>(
      optionsOrRun: string | ((transaction: Sql) => Promise<T>),
      run?: (transaction: Sql) => Promise<T>,
    ) => Promise<T>;
  };
  transactionTag.begin = async (optionsOrRun, run) => {
    const callback = typeof optionsOrRun === "string" ? run : optionsOrRun;
    state.transactionModes.push(
      typeof optionsOrRun === "string" ? optionsOrRun : "default",
    );
    if (!callback) throw new Error("Missing transaction callback.");
    return callback(tag);
  };
  return { sql: tag, state };
}

test("the CLI requires exact strict record and decision fields and defaults to dry-run", () => {
  const record = parsePhysicalEvidenceCommand(recordArguments());
  assert.equal(record.operation, "record");
  assert.equal(record.apply, false);
  if (record.operation !== "record")
    throw new Error("Expected record command.");
  assert.equal(record.evidence.contributionId, contributionId);
  assert.equal(record.evidence.priceNgn, 12_500.5);

  const decision = parsePhysicalEvidenceCommand([
    "decide",
    `--observation-id=${observationId}`,
    "--decision=reject",
    "--rationale=The evidence source cannot support this claim.",
  ]);
  assert.deepEqual(decision, {
    operation: "decide",
    apply: false,
    observationId,
    decision: "reject",
    rationale: "The evidence source cannot support this claim.",
  });
  assert.throws(() =>
    parsePhysicalEvidenceCommand(
      recordArguments().filter(
        (argument) => !argument.startsWith("--observed-size="),
      ),
    ),
  );
  assert.throws(() =>
    parsePhysicalEvidenceCommand([
      ...recordArguments(),
      "--contribution-id=not-a-uuid",
    ]),
  );
  assert.throws(() =>
    parsePhysicalEvidenceCommand([
      "decide",
      `--observation-id=${observationId}`,
      "--decision=approve",
      "--rationale=",
    ]),
  );
});

test("dry-run uses read-only preflight and emits no evidence payload", async () => {
  const fixture = physicalEvidenceCliFixture();
  const command = parsePhysicalEvidenceCommand(recordArguments());
  const result = await runPhysicalEvidenceCommand(
    fixture.sql,
    operatorSubject,
    command,
  );
  assert.deepEqual(fixture.state.transactionModes, ["read only"]);
  assert.deepEqual(fixture.state.writes, []);
  assert.equal(
    result.output,
    '{"mode":"dry-run","operation":"record","ready":true,"writes":false}',
  );
  assert.doesNotMatch(result.output, /COSRX|field-visit|Independent/);
});

test("apply records through the audited writer and returns only the observation ID", async () => {
  const fixture = physicalEvidenceCliFixture();
  const command = parsePhysicalEvidenceCommand([
    ...recordArguments(),
    "--apply",
  ]);
  const result = await runPhysicalEvidenceCommand(
    fixture.sql,
    operatorSubject,
    command,
  );
  assert.equal(result.output, observationId);
  assert.equal(fixture.state.inserted, true);
  assert.equal(
    fixture.state.writes.filter((query) =>
      query.startsWith("insert into moderation_audit_log"),
    ).length,
    1,
  );
});

test("decision dry-run is read-only while apply returns bounded cache scope", async () => {
  const dryFixture = physicalEvidenceCliFixture();
  const dryCommand = parsePhysicalEvidenceCommand([
    "decide",
    `--observation-id=${observationId}`,
    "--decision=approve",
    "--rationale=Current field evidence is sufficient.",
  ]);
  const dryResult = await runPhysicalEvidenceCommand(
    dryFixture.sql,
    operatorSubject,
    dryCommand,
  );
  assert.deepEqual(dryFixture.state.transactionModes, ["read only"]);
  assert.deepEqual(dryFixture.state.writes, []);
  assert.match(dryResult.output, /"nextStatus":"approved"/);

  const applyFixture = physicalEvidenceCliFixture();
  const applyCommand = parsePhysicalEvidenceCommand([
    "decide",
    `--observation-id=${observationId}`,
    "--decision=approve",
    "--rationale=Current field evidence is sufficient.",
    "--apply",
  ]);
  const applyResult = await runPhysicalEvidenceCommand(
    applyFixture.sql,
    operatorSubject,
    applyCommand,
  );
  assert.deepEqual(JSON.parse(applyResult.output), {
    observationId,
    nextStatus: "approved",
    cacheScope: {
      marketSlug: "lagos-trade-fair",
      retailerLocationId: locationId,
      productIdentityVersionId: identityVersionId,
    },
  });
  assert.equal(applyFixture.state.status, "approved");
  assert.equal(
    applyFixture.state.writes.filter((query) =>
      query.startsWith("insert into moderation_audit_log"),
    ).length,
    1,
  );
});

test("the command resolves one active admin through the protected operator authority", async () => {
  const fixture = physicalEvidenceCliFixture();
  assert.equal(
    await resolvePhysicalEvidenceAdmin(fixture.sql, "admin@jelocare.test"),
    operatorSubject,
  );
  const source = await readFile(
    path.join(
      process.cwd(),
      "scripts/record-market-finder-physical-evidence.ts",
    ),
    "utf8",
  );
  assert.match(source, /requireAdminDatabaseUrl\(\)/);
  assert.match(source, /MODERATION_OPERATOR_EMAIL/);
  assert.match(source, /and active = true/);
  assert.match(
    source,
    /rows\.length !== 1 \|\| rows\[0\]\.role !== ["']admin["']/,
  );
});
