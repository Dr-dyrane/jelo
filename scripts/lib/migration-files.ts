import { constants } from "node:fs";
import {
  copyFile,
  readdir,
  readFile,
  realpath,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import {
  buildMigrationInventory,
  migrationBytesSha256,
  type MigrationDefinition,
  type MigrationSource,
} from "../../lib/database/migration-governance";
import { unwrapMigrationTransaction } from "../../lib/database/migration-runner";

export const CANONICAL_MIGRATIONS_DIRECTORY = path.join("db", "migrations");
export const REHEARSAL_MIGRATIONS_DIRECTORY = ".migration-rehearsal";

async function readUtf8Migration(
  filePath: string,
  filename: string,
): Promise<MigrationSource> {
  const bytes = await readFile(filePath);
  const source = bytes.toString("utf8");
  if (!Buffer.from(source, "utf8").equals(bytes)) {
    throw new Error(`${filename} must contain valid UTF-8 bytes.`);
  }
  return { filename, source };
}

export async function readCanonicalMigrationInventory(
  repositoryRoot = process.cwd(),
): Promise<readonly MigrationDefinition[]> {
  const directory = path.join(repositoryRoot, CANONICAL_MIGRATIONS_DIRECTORY);
  const entries = await readdir(directory, { withFileTypes: true });
  const sources: MigrationSource[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) {
      throw new Error(
        `Canonical migration directory contains non-file entry ${entry.name}.`,
      );
    }
    sources.push(
      await readUtf8Migration(path.join(directory, entry.name), entry.name),
    );
  }
  const inventory = buildMigrationInventory(sources);
  for (const migration of inventory) {
    unwrapMigrationTransaction(migration.source, migration.filename);
  }
  return inventory;
}

export async function readRehearsalMigration(
  sourcePath: string,
  repositoryRoot = process.cwd(),
) {
  const rehearsalRoot = path.resolve(
    repositoryRoot,
    REHEARSAL_MIGRATIONS_DIRECTORY,
  );
  const resolvedSource = await realpath(
    path.resolve(repositoryRoot, sourcePath),
  );
  const relative = path.relative(rehearsalRoot, resolvedSource);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `Rehearsal migration must be inside ${REHEARSAL_MIGRATIONS_DIRECTORY}/.`,
    );
  }
  if (relative.includes(path.sep)) {
    throw new Error(
      "Rehearsal migration must be a direct child of the rehearsal directory.",
    );
  }

  const migration = await readUtf8Migration(
    resolvedSource,
    path.basename(resolvedSource),
  );
  unwrapMigrationTransaction(migration.source, migration.filename);
  return { migration, resolvedSource };
}

export function inventoryWithRehearsalMigration(
  canonical: readonly MigrationDefinition[],
  rehearsal: MigrationSource,
) {
  return buildMigrationInventory([
    ...canonical.map((migration) => ({
      filename: migration.filename,
      source: migration.source,
    })),
    rehearsal,
  ]);
}

export async function copyMigrationBytesUnchanged(
  source: string,
  destination: string,
  expectedChecksum: string,
) {
  const sourceBytes = await readFile(source);
  if (migrationBytesSha256(sourceBytes) !== expectedChecksum) {
    throw new Error(
      "Rehearsal source bytes do not match the confirmed checksum.",
    );
  }

  await copyFile(source, destination, constants.COPYFILE_EXCL);
  try {
    const destinationBytes = await readFile(destination);
    if (
      migrationBytesSha256(destinationBytes) !== expectedChecksum ||
      !destinationBytes.equals(sourceBytes)
    ) {
      throw new Error(
        "Promoted migration bytes differ from the rehearsed source.",
      );
    }
  } catch (error) {
    await unlink(destination);
    throw error;
  }
}
