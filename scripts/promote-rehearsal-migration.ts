import path from "node:path";
import {
  CANONICAL_MIGRATIONS_DIRECTORY,
  copyMigrationBytesUnchanged,
  inventoryWithRehearsalMigration,
  readCanonicalMigrationInventory,
  readRehearsalMigration,
} from "./lib/migration-files";

type PromotionOptions = { source?: string; checksum?: string };

function optionValue(argument: string, name: string) {
  const prefix = `${name}=`;
  return argument.startsWith(prefix)
    ? argument.slice(prefix.length)
    : undefined;
}

function parseOptions(argv: readonly string[]) {
  const options: PromotionOptions = {};
  for (const argument of argv) {
    const source = optionValue(argument, "--source");
    const checksum = optionValue(argument, "--confirm-checksum");
    if (source !== undefined) options.source = source;
    else if (checksum !== undefined) options.checksum = checksum;
    else throw new Error(`Unsupported promotion option ${argument}.`);
  }
  if (!options.source || !options.checksum) {
    throw new Error(
      "Promotion requires --source=<rehearsed file> and --confirm-checksum=<digest>.",
    );
  }
  return options as Required<PromotionOptions>;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const canonical = await readCanonicalMigrationInventory();
  const { migration, resolvedSource } = await readRehearsalMigration(
    options.source,
  );
  const inventory = inventoryWithRehearsalMigration(canonical, migration);
  const candidate = inventory.at(-1)!;
  if (candidate.filename !== migration.filename) {
    throw new Error(
      "Promotion source must be the single next canonical migration version.",
    );
  }
  if (options.checksum !== candidate.checksumSha256) {
    throw new Error(
      "Promotion checksum confirmation does not match the rehearsed source bytes.",
    );
  }

  const destination = path.join(
    process.cwd(),
    CANONICAL_MIGRATIONS_DIRECTORY,
    candidate.filename,
  );
  await copyMigrationBytesUnchanged(
    resolvedSource,
    destination,
    candidate.checksumSha256,
  );

  console.log(
    `Promoted unchanged bytes to ${path.relative(process.cwd(), destination)} ${candidate.checksumSha256}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
