import postgres from "postgres";
import {
  applyMigrationAtomically,
  type MigrationTransactionRunner,
} from "../../lib/database/migration-runner";
import {
  buildMigrationPlan,
  type MigrationDefinition,
} from "../../lib/database/migration-governance";
import {
  createGovernedMigrationLedger,
  insertAtomicMigrationRecord,
  MIGRATION_ADVISORY_LOCK_KEY,
  readMigrationLedgerSnapshot,
} from "../../lib/database/migration-ledger";

type RunMigrationsOptions = {
  connectionString: string;
  inventory: readonly MigrationDefinition[];
  label: "canonical" | "rehearsal";
};

function planFailure(errors: readonly string[]) {
  return new Error(
    `Migration plan is blocked. Run the read-only status command and resolve drift explicitly. ${errors.join(" ")}`,
  );
}

export async function runMigrations({
  connectionString,
  inventory,
  label,
}: RunMigrationsOptions) {
  const sql = postgres(connectionString, {
    max: 1,
    prepare: false,
    connection: { application_name: `jelocare-${label}-migration-runner` },
  });
  let lockAcquired = false;

  try {
    await sql`select pg_advisory_lock(${MIGRATION_ADVISORY_LOCK_KEY})`;
    lockAcquired = true;

    let snapshot = await readMigrationLedgerSnapshot(sql);
    if (snapshot.shape === "absent") {
      await sql.begin(async (transaction) => {
        await createGovernedMigrationLedger(transaction);
      });
      snapshot = await readMigrationLedgerSnapshot(sql);
    }

    const plan = buildMigrationPlan(inventory, snapshot);
    if (!plan.canApply) throw planFailure(plan.errors);

    const pending = new Set(
      plan.entries
        .filter((entry) => entry.state === "pending")
        .map((entry) => entry.filename),
    );
    for (const migration of inventory) {
      if (!pending.has(migration.filename)) {
        console.log(`skip ${migration.filename} ${migration.checksumSha256}`);
        continue;
      }

      const runner: MigrationTransactionRunner = {
        begin: (work) =>
          sql.begin(async (transaction) =>
            work({
              unsafe: (source) => transaction.unsafe(source),
              record: (definition) =>
                insertAtomicMigrationRecord(transaction, definition),
            }),
          ),
      };
      await applyMigrationAtomically(runner, migration, migration.source);
      console.log(`applied ${migration.filename} ${migration.checksumSha256}`);
    }
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
