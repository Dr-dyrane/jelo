import { requireAdminDatabaseUrl } from "./lib/admin-database";
import { readCanonicalMigrationInventory } from "./lib/migration-files";
import { runMigrations } from "./lib/run-migrations";

async function main() {
  if (process.argv.length > 2) {
    throw new Error(
      "db:migrate accepts no arguments; use db:migrations:status to plan.",
    );
  }
  const connectionString = requireAdminDatabaseUrl();
  const inventory = await readCanonicalMigrationInventory();
  await runMigrations({ connectionString, inventory, label: "canonical" });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
