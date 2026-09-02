import assert from "node:assert/strict";
import {
  access,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertMigrationReconciliationEvidence,
  buildMigrationInventory,
  buildMigrationPlan,
  migrationBytesSha256,
  reconciliationColumns,
  type MigrationDefinition,
  type MigrationLedgerRow,
} from "../../lib/database/migration-governance";
import { GOVERNED_MIGRATION_LEDGER_DDL } from "../../lib/database/migration-ledger";
import {
  assertRehearsalTarget,
  REHEARSAL_TARGET_CONFIRMATION,
} from "../../scripts/lib/rehearsal-target";
import { assertNeonRehearsalControlPlane } from "../../scripts/lib/neon-rehearsal-attestation";
import { copyMigrationBytesUnchanged } from "../../scripts/lib/migration-files";

async function checkedInSources() {
  const directory = path.join(process.cwd(), "db", "migrations");
  const files = (await readdir(directory)).filter((file) =>
    file.endsWith(".sql"),
  );
  return Promise.all(
    files.map(async (filename) => ({
      filename,
      source: await readFile(path.join(directory, filename), "utf8"),
    })),
  );
}

function governedRow(migration: MigrationDefinition): MigrationLedgerRow {
  return {
    filename: migration.filename,
    version: migration.version,
    migrationOrder: migration.migrationOrder,
    checksumSha256: migration.checksumSha256,
    provenance: "runner_atomic",
    appliedAt: "2026-08-14T00:00:00.000Z",
    recordedAt: "2026-08-14T00:00:00.000Z",
    recordedBy: "migration_admin",
    reconciliationReference: null,
  };
}

test("checked-in migrations have contiguous strict names and one pinned legacy duplicate", async () => {
  const inventory = buildMigrationInventory(await checkedInSources());
  assert.equal(inventory.length, 56);
  assert.equal(inventory[0]?.filename, "0001_catalogue_foundation.sql");
  assert.equal(
    inventory.at(-1)?.filename,
    "0055_market_finder_atomic_context.sql",
  );
  assert.equal(
    inventory.at(-1)?.checksumSha256,
    "e0a5e58ee2e39f54976031d5afc64d9e8a966e76cfe116e5130b2fd5d2bdc22d",
  );
  assert.deepEqual(
    inventory
      .filter((migration) => migration.version === 46)
      .map((migration) => migration.filename),
    [
      "0046_fix_customer_request_signal_bridge.sql",
      "0046_service_fee_policies.sql",
    ],
  );
});

test("migration validation rejects naming, gaps, new duplicates, and changed legacy bytes", async () => {
  assert.throws(
    () =>
      buildMigrationInventory([
        { filename: "1_bad-name.sql", source: "begin;\nselect 1;\ncommit;" },
      ]),
    /must match/,
  );
  assert.throws(
    () =>
      buildMigrationInventory([
        { filename: "0001_first.sql", source: "begin;\nselect 1;\ncommit;" },
        { filename: "0003_third.sql", source: "begin;\nselect 3;\ncommit;" },
      ]),
    /contiguous/,
  );
  assert.throws(
    () =>
      buildMigrationInventory([
        { filename: "0001_first.sql", source: "begin;\nselect 1;\ncommit;" },
        { filename: "0001_second.sql", source: "begin;\nselect 2;\ncommit;" },
      ]),
    /duplicated/,
  );

  const sources = await checkedInSources();
  const changed = sources.map((source) =>
    source.filename === "0046_service_fee_policies.sql"
      ? { ...source, source: `${source.source}\n-- rewritten` }
      : source,
  );
  assert.throws(
    () => buildMigrationInventory(changed),
    /digest-pinned historical 0046 pair/,
  );
});

test("migration plan accepts only a checksummed immutable prefix", () => {
  const inventory = buildMigrationInventory([
    { filename: "0001_first.sql", source: "begin;\nselect 1;\ncommit;" },
    { filename: "0002_second.sql", source: "begin;\nselect 2;\ncommit;" },
  ]);
  const clean = buildMigrationPlan(inventory, {
    shape: "governed",
    immutable: true,
    rows: [governedRow(inventory[0]!)],
  });
  assert.equal(clean.canApply, true);
  assert.deepEqual(
    clean.entries.map((entry) => entry.state),
    ["applied", "pending"],
  );

  const absentOverSchema = buildMigrationPlan(inventory, {
    shape: "absent",
    immutable: false,
    rows: [],
    details:
      "Migration ledger is absent while public schema contains 3 durable relations.",
  });
  assert.equal(absentOverSchema.canApply, false);
  assert.match(absentOverSchema.errors.join(" "), /ledger is absent/i);

  const legacy = buildMigrationPlan(inventory, {
    shape: "legacy",
    immutable: false,
    rows: [{ filename: inventory[0]!.filename }],
  });
  assert.equal(legacy.canApply, false);
  assert.match(legacy.errors.join(" "), /explicit governance initialization/);

  const changed = governedRow(inventory[0]!);
  changed.checksumSha256 = "0".repeat(64);
  const drift = buildMigrationPlan(inventory, {
    shape: "governed",
    immutable: true,
    rows: [changed],
  });
  assert.equal(drift.canApply, false);
  assert.match(drift.errors.join(" "), /checksum/);

  const outOfOrder = buildMigrationPlan(inventory, {
    shape: "governed",
    immutable: true,
    rows: [governedRow(inventory[1]!)],
  });
  assert.equal(outOfOrder.canApply, false);
  assert.match(outOfOrder.errors.join(" "), /earlier pending migration/);
});

test("0048 and 0049 reconciliation requires every exact numeric schema effect", () => {
  for (const filename of [
    "0048_money_columns_to_numeric.sql",
    "0049_fix_remaining_money_columns.sql",
  ]) {
    const evidence = reconciliationColumns(filename).map((column) => ({
      tableName: column.tableName,
      columnName: column.columnName,
      dataType: "numeric",
      numericPrecision: 12,
      numericScale: 2,
      isGenerated: column.generated ? "ALWAYS" : "NEVER",
      generationExpression: column.generated
        ? "product_subtotal_ngn + retailer_fee_ngn + tax_ngn + jelocare_fee_ngn + delivery_ngn"
        : null,
    }));
    assert.doesNotThrow(() =>
      assertMigrationReconciliationEvidence(filename, evidence),
    );
    assert.throws(
      () => assertMigrationReconciliationEvidence(filename, evidence.slice(1)),
      /required schema effect/,
    );
    const generatedIndex = evidence.findIndex(
      (column) => column.isGenerated === "ALWAYS",
    );
    if (generatedIndex >= 0) {
      const changedExpression = evidence.map((column, index) =>
        index === generatedIndex
          ? {
              ...column,
              generationExpression: `${column.generationExpression} + 1`,
            }
          : column,
      );
      assert.throws(
        () =>
          assertMigrationReconciliationEvidence(filename, changedExpression),
        /canonical five-component total/,
      );
    }
  }
  assert.throws(
    () => reconciliationColumns("0050_payment_integrity.sql"),
    /no checked-in schema-effect reconciliation contract/,
  );
});

test("ledger DDL is append-only and provenance distinguishes exact execution from reconciliation", () => {
  assert.match(GOVERNED_MIGRATION_LEDGER_DDL, /checksum_sha256 text not null/);
  assert.match(
    GOVERNED_MIGRATION_LEDGER_DDL,
    /schema_migrations_filename_version_check/,
  );
  assert.match(
    GOVERNED_MIGRATION_LEDGER_DDL,
    /unique index schema_migrations_unique_version_idx/,
  );
  assert.match(GOVERNED_MIGRATION_LEDGER_DDL, /where version <> 46/);
  assert.match(GOVERNED_MIGRATION_LEDGER_DDL, /0046_service_fee_policies\.sql/);
  assert.match(GOVERNED_MIGRATION_LEDGER_DDL, /schema_effect_reconciliation/);
  assert.match(GOVERNED_MIGRATION_LEDGER_DDL, /before update or delete/);
  assert.match(GOVERNED_MIGRATION_LEDGER_DDL, /before truncate/);
  assert.match(GOVERNED_MIGRATION_LEDGER_DDL, /applied_at is null/);
});

test("rehearsal target rejects primary-like or unconfirmed branch identities", () => {
  assert.deepEqual(
    assertRehearsalTarget({
      projectId: "spring-field-93817903",
      branchId: "br-safe-rehearsal",
      branchName: "rehearsal/payment-ledger-20260814",
      confirmation: REHEARSAL_TARGET_CONFIRMATION,
    }),
    {
      projectId: "spring-field-93817903",
      branchId: "br-safe-rehearsal",
      branchName: "rehearsal/payment-ledger-20260814",
    },
  );
  assert.throws(
    () =>
      assertRehearsalTarget({
        projectId: "spring-field-93817903",
        branchId: "br-production",
        branchName: "main",
        confirmation: REHEARSAL_TARGET_CONFIRMATION,
      }),
    /rehearsal/,
  );
  assert.throws(
    () =>
      assertRehearsalTarget({
        projectId: "spring-field-93817903",
        branchId: "br-safe-rehearsal",
        branchName: "rehearsal/payment-ledger-20260814",
        confirmation: "yes",
      }),
    /confirm-target/,
  );
});

test("rehearsal control-plane attestation binds the URL to an enabled non-primary child", () => {
  const target = {
    projectId: "spring-field-93817903",
    branchId: "br-safe-rehearsal",
    branchName: "rehearsal/payment-ledger-20260814",
  };
  const branch = {
    branch: {
      id: target.branchId,
      project_id: target.projectId,
      name: target.branchName,
      parent_id: "br-production",
      protected: false,
      default: false,
      primary: false,
    },
  };
  const endpoints = {
    endpoints: [
      {
        project_id: target.projectId,
        branch_id: target.branchId,
        host: "ep-safe-rehearsal.example",
        type: "read_write",
        disabled: false,
      },
    ],
  };
  const parent = {
    branch: {
      id: "br-production",
      project_id: target.projectId,
      name: "main",
      default: true,
    },
  };
  const url =
    "postgresql://migration_admin:secret@ep-safe-rehearsal.example/jelocare";
  assert.doesNotThrow(() =>
    assertNeonRehearsalControlPlane(target, url, branch, parent, endpoints),
  );
  assert.throws(
    () =>
      assertNeonRehearsalControlPlane(
        target,
        url,
        { branch: { ...branch.branch, protected: true } },
        parent,
        endpoints,
      ),
    /non-protected/,
  );
  assert.throws(
    () =>
      assertNeonRehearsalControlPlane(target, url, branch, parent, {
        endpoints: [
          { ...endpoints.endpoints[0], host: "ep-production.example" },
        ],
      }),
    /enabled read-write endpoint/,
  );
  assert.throws(
    () =>
      assertNeonRehearsalControlPlane(
        target,
        url,
        branch,
        { branch: { ...parent.branch, default: false } },
        endpoints,
      ),
    /default production branch/,
  );
});

test("promotion copies the rehearsed bytes exactly and refuses overwrite or hash drift", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "jelo-migration-promotion-"),
  );
  try {
    const source = path.join(directory, "0051_exact_bytes.sql");
    const destination = path.join(directory, "promoted.sql");
    const wrongDestination = path.join(directory, "wrong.sql");
    const bytes = Buffer.from(
      "begin;\nselect 'exact π bytes';\ncommit;\n",
      "utf8",
    );
    const checksum = migrationBytesSha256(bytes);
    await writeFile(source, bytes);

    await copyMigrationBytesUnchanged(source, destination, checksum);
    assert.deepEqual(await readFile(destination), bytes);
    await assert.rejects(
      copyMigrationBytesUnchanged(source, destination, checksum),
      /exist/i,
    );
    await assert.rejects(
      copyMigrationBytesUnchanged(source, wrongDestination, "0".repeat(64)),
      /confirmed checksum/,
    );
    await assert.rejects(access(wrongDestination));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
