import postgres from "postgres";
import {
  assertMigrationReconciliationEvidence,
  buildMigrationPlan,
  MIGRATION_CHECKSUM_PATTERN,
  reconciliationColumns,
  requireOperatorReference,
} from "../lib/database/migration-governance";
import {
  initializeLegacyMigrationLedger,
  insertReconciledMigrationRecord,
  MIGRATION_ADVISORY_LOCK_KEY,
  readMigrationColumnEvidence,
  readMigrationLedgerSnapshot,
} from "../lib/database/migration-ledger";
import { requireAdminDatabaseUrl } from "./lib/admin-database";
import { readCanonicalMigrationInventory } from "./lib/migration-files";

const INITIALIZE_CONFIRMATION = "initialize-checksummed-ledger";

type RepairOptions = {
  action: "initialize" | "reconcile";
  migration?: string;
  reference: string;
  confirmation?: string;
  checksum?: string;
};

function optionValue(argument: string, name: string) {
  const prefix = `${name}=`;
  return argument.startsWith(prefix)
    ? argument.slice(prefix.length)
    : undefined;
}

function parseOptions(argv: readonly string[]): RepairOptions {
  let initialize = false;
  let migration: string | undefined;
  let reference: string | undefined;
  let confirmation: string | undefined;
  let checksum: string | undefined;

  for (const argument of argv) {
    if (argument === "--initialize-governance") initialize = true;
    else if (optionValue(argument, "--reconcile") !== undefined) {
      migration = optionValue(argument, "--reconcile");
    } else if (optionValue(argument, "--reference") !== undefined) {
      reference = optionValue(argument, "--reference");
    } else if (optionValue(argument, "--confirm") !== undefined) {
      confirmation = optionValue(argument, "--confirm");
    } else if (optionValue(argument, "--confirm-checksum") !== undefined) {
      checksum = optionValue(argument, "--confirm-checksum");
    } else {
      throw new Error(`Unsupported repair option ${argument}.`);
    }
  }

  if (initialize === Boolean(migration)) {
    throw new Error(
      "Choose exactly one of --initialize-governance or --reconcile=<filename>.",
    );
  }
  return {
    action: initialize ? "initialize" : "reconcile",
    migration,
    reference: requireOperatorReference(reference),
    confirmation,
    checksum,
  };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const connectionString = requireAdminDatabaseUrl();
  const inventory = await readCanonicalMigrationInventory();
  const sql = postgres(connectionString, {
    max: 1,
    prepare: false,
    connection: {
      application_name: "jelocare-explicit-migration-ledger-repair",
    },
  });
  let lockAcquired = false;

  try {
    await sql`select pg_advisory_lock(${MIGRATION_ADVISORY_LOCK_KEY})`;
    lockAcquired = true;

    if (options.action === "initialize") {
      if (options.confirmation !== INITIALIZE_CONFIRMATION) {
        throw new Error(
          `Initialization requires --confirm=${INITIALIZE_CONFIRMATION}.`,
        );
      }
      await sql.begin(async (transaction) => {
        await initializeLegacyMigrationLedger(
          transaction,
          inventory,
          options.reference,
        );
      });
      console.log(
        "Initialized immutable checksummed ledger; historical rows retain legacy_filename_record provenance.",
      );
      return;
    }

    const migration = inventory.find(
      (candidate) => candidate.filename === options.migration,
    );
    if (!migration)
      throw new Error(
        `Unknown reconciliation target ${String(options.migration)}.`,
      );
    reconciliationColumns(migration.filename);
    if (!MIGRATION_CHECKSUM_PATTERN.test(options.checksum ?? "")) {
      throw new Error(
        "Reconciliation requires --confirm-checksum=<64 lowercase hex digest>.",
      );
    }
    if (options.checksum !== migration.checksumSha256) {
      throw new Error(
        `Checksum confirmation does not match canonical bytes for ${migration.filename}.`,
      );
    }

    await sql.begin("isolation level serializable", async (transaction) => {
      const before = await readMigrationLedgerSnapshot(transaction);
      const plan = buildMigrationPlan(inventory, before);
      if (!plan.canApply || before.shape !== "governed" || !before.immutable) {
        throw new Error(
          `Reconciliation is blocked by ledger drift. ${plan.errors.join(" ")}`,
        );
      }
      const firstPending = plan.entries.find(
        (entry) => entry.state === "pending",
      );
      if (firstPending?.filename !== migration.filename) {
        throw new Error(
          `${migration.filename} is not the first pending migration; expected ${firstPending?.filename ?? "none"}.`,
        );
      }

      const evidence = await readMigrationColumnEvidence(
        transaction,
        migration.filename,
      );
      assertMigrationReconciliationEvidence(migration.filename, evidence);
      await insertReconciledMigrationRecord(
        transaction,
        migration,
        options.reference,
      );

      const after = await readMigrationLedgerSnapshot(transaction);
      const afterPlan = buildMigrationPlan(inventory, after);
      const recorded = afterPlan.entries.find(
        (entry) => entry.filename === migration.filename,
      );
      if (
        afterPlan.errors.length ||
        recorded?.state !== "applied" ||
        recorded.provenance !== "schema_effect_reconciliation"
      ) {
        throw new Error(
          `Reconciled ledger row failed attestation. ${afterPlan.errors.join(" ")}`,
        );
      }
    });
    console.log(
      `Recorded verified schema effects for ${migration.filename} ${migration.checksumSha256}; original execution bytes and time remain unattested.`,
    );
  } finally {
    try {
      if (lockAcquired) {
        await sql`select pg_advisory_unlock(${MIGRATION_ADVISORY_LOCK_KEY})`;
      }
    } finally {
      await sql.end();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
