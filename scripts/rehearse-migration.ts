import { requireRehearsalDatabaseUrl } from "./lib/admin-database";
import {
  inventoryWithRehearsalMigration,
  readCanonicalMigrationInventory,
  readRehearsalMigration,
} from "./lib/migration-files";
import {
  assertRehearsalTarget,
  type RehearsalTarget,
} from "./lib/rehearsal-target";
import { attestNeonRehearsalTarget } from "./lib/neon-rehearsal-attestation";
import { runMigrations } from "./lib/run-migrations";

type RehearsalOptions = RehearsalTarget & { source?: string };

function optionValue(argument: string, name: string) {
  const prefix = `${name}=`;
  return argument.startsWith(prefix)
    ? argument.slice(prefix.length)
    : undefined;
}

function parseOptions(argv: readonly string[]): RehearsalOptions {
  const options: RehearsalOptions = {};
  for (const argument of argv) {
    const source = optionValue(argument, "--source");
    const projectId = optionValue(argument, "--project-id");
    const branchId = optionValue(argument, "--branch-id");
    const branchName = optionValue(argument, "--branch-name");
    const confirmation = optionValue(argument, "--confirm-target");
    if (source !== undefined) options.source = source;
    else if (projectId !== undefined) options.projectId = projectId;
    else if (branchId !== undefined) options.branchId = branchId;
    else if (branchName !== undefined) options.branchName = branchName;
    else if (confirmation !== undefined) options.confirmation = confirmation;
    else throw new Error(`Unsupported rehearsal option ${argument}.`);
  }
  if (!options.source)
    throw new Error("Rehearsal requires --source=<ignored migration file>.");
  return options;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const target = assertRehearsalTarget(options);
  const connectionString = requireRehearsalDatabaseUrl();
  const canonical = await readCanonicalMigrationInventory();
  const { migration } = await readRehearsalMigration(options.source!);
  const inventory = inventoryWithRehearsalMigration(canonical, migration);
  const candidate = inventory.at(-1)!;
  if (candidate.filename !== migration.filename) {
    throw new Error(
      "Rehearsal source must be the single next canonical migration version.",
    );
  }
  await attestNeonRehearsalTarget(target, connectionString);

  console.log(
    `Rehearsal target attested: ${target.projectId} ${target.branchName} (${target.branchId}); candidate ${candidate.filename} ${candidate.checksumSha256}.`,
  );
  await runMigrations({ connectionString, inventory, label: "rehearsal" });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
