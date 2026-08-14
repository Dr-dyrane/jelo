import { readCanonicalMigrationInventory } from "./lib/migration-files";

async function main() {
  if (process.argv.length > 2)
    throw new Error("db:migrations:validate accepts no arguments.");
  const inventory = await readCanonicalMigrationInventory();
  const latest = inventory.at(-1)!;
  console.log(
    `Migration inventory valid (${inventory.length} files; latest ${latest.filename} ${latest.checksumSha256}).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
