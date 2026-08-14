import postgres from "postgres";
import { buildMigrationPlan } from "../lib/database/migration-governance";
import { readMigrationLedgerSnapshot } from "../lib/database/migration-ledger";
import { requireAdminDatabaseUrl } from "./lib/admin-database";
import { readCanonicalMigrationInventory } from "./lib/migration-files";

function parseOptions(argv: readonly string[]) {
  const unknown = argv.filter((option) => option !== "--json");
  if (unknown.length)
    throw new Error(`Unsupported status options: ${unknown.join(", ")}.`);
  return { json: argv.includes("--json") };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const connectionString = requireAdminDatabaseUrl();
  const inventory = await readCanonicalMigrationInventory();
  const sql = postgres(connectionString, {
    max: 1,
    prepare: false,
    connection: { application_name: "jelocare-read-only-migration-status" },
  });

  try {
    const snapshot = await sql.begin("read only", (transaction) =>
      readMigrationLedgerSnapshot(transaction),
    );
    const plan = buildMigrationPlan(inventory, snapshot);
    if (options.json) {
      console.log(JSON.stringify(plan, null, 2));
    } else {
      const counts = new Map<string, number>();
      for (const entry of plan.entries) {
        counts.set(entry.state, (counts.get(entry.state) ?? 0) + 1);
      }
      console.log(
        [
          `ledger=${plan.ledgerShape}`,
          `immutable=${String(plan.immutable)}`,
          `applied=${counts.get("applied") ?? 0}`,
          `legacy=${counts.get("legacy") ?? 0}`,
          `pending=${counts.get("pending") ?? 0}`,
          `drift=${counts.get("drift") ?? 0}`,
        ].join(" "),
      );
      for (const error of plan.errors) console.log(`blocked ${error}`);
      for (const entry of plan.entries) {
        if (entry.state === "applied") continue;
        console.log(
          [
            entry.state,
            entry.filename,
            entry.checksumSha256,
            entry.provenance ? `provenance=${entry.provenance}` : undefined,
            entry.detail,
          ]
            .filter(Boolean)
            .join(" "),
        );
      }
    }

    if (plan.errors.length) process.exitCode = 2;
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
