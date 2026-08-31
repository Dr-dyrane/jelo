import { createHash } from "node:crypto";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const POSTGRES_PATCH_VERSION = "3.4.7";
export const POSTGRES_RECONNECT_BEFORE =
  "setTimeout(connect, closedDate ? closedDate + delay - performance.now() : 0)";
export const POSTGRES_RECONNECT_AFTER =
  "setTimeout(connect, closedDate ? Math.max(0, closedDate + delay - performance.now()) : 0)";

const TARGETS = [
  {
    relativePath: "node_modules/postgres/src/connection.js",
    cleanSha256:
      "0847375f271c373745b4c2af1bbb5dc2da5ee6f69937cc52516b5b6a667af7a4",
  },
  {
    relativePath: "node_modules/postgres/cjs/src/connection.js",
    cleanSha256:
      "68bac70e765b38266d8ff6e7602870abc63a72560f813c173fdd10d2a9bdab2e",
  },
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function occurrences(value, needle) {
  return value.split(needle).length - 1;
}

function classifySource(source, target) {
  const beforeCount = occurrences(source, POSTGRES_RECONNECT_BEFORE);
  const afterCount = occurrences(source, POSTGRES_RECONNECT_AFTER);

  if (
    beforeCount === 1 &&
    afterCount === 0 &&
    sha256(source) === target.cleanSha256
  ) {
    return {
      state: "clean",
      output: source.replace(
        POSTGRES_RECONNECT_BEFORE,
        POSTGRES_RECONNECT_AFTER,
      ),
    };
  }

  if (beforeCount === 0 && afterCount === 1) {
    const restored = source.replace(
      POSTGRES_RECONNECT_AFTER,
      POSTGRES_RECONNECT_BEFORE,
    );
    if (sha256(restored) === target.cleanSha256) {
      return { state: "patched", output: source };
    }
  }

  throw new Error(
    `Refusing to patch unexpected postgres source: ${target.relativePath}`,
  );
}

export async function applyPostgresReconnectPatch(root = process.cwd()) {
  const packagePath = path.join(root, "node_modules/postgres/package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));

  if (packageJson.version !== POSTGRES_PATCH_VERSION) {
    throw new Error(
      `Postgres reconnect patch requires postgres ${POSTGRES_PATCH_VERSION}; found ${String(packageJson.version)}`,
    );
  }

  const inspected = await Promise.all(
    TARGETS.map(async (target) => {
      const absolutePath = path.join(root, target.relativePath);
      const source = await readFile(absolutePath, "utf8");
      const classification = classifySource(source, target);
      return { ...target, absolutePath, ...classification };
    }),
  );

  for (const target of inspected.filter((entry) => entry.state === "clean")) {
    const metadata = await stat(target.absolutePath);
    const temporaryPath = `${target.absolutePath}.jelocare-patch-${process.pid}`;
    await writeFile(temporaryPath, target.output, {
      encoding: "utf8",
      flag: "wx",
      mode: metadata.mode,
    });
    await rename(temporaryPath, target.absolutePath);
  }

  return {
    version: POSTGRES_PATCH_VERSION,
    patched: inspected.filter((entry) => entry.state === "clean").length,
    alreadyPatched: inspected.filter((entry) => entry.state === "patched")
      .length,
  };
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;
if (invokedPath === import.meta.url) {
  applyPostgresReconnectPatch()
    .then((result) => {
      console.log(
        `Postgres ${result.version} reconnect clamp verified (${result.patched} patched, ${result.alreadyPatched} already patched).`,
      );
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
