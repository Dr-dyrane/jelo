import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  applyPostgresReconnectPatch,
  POSTGRES_PATCH_VERSION,
  POSTGRES_RECONNECT_AFTER,
  POSTGRES_RECONNECT_BEFORE,
} from "../../scripts/apply-postgres-reconnect-patch.mjs";

const TARGETS = [
  "node_modules/postgres/src/connection.js",
  "node_modules/postgres/cjs/src/connection.js",
] as const;

async function cleanInstalledSource(relativePath: (typeof TARGETS)[number]) {
  const source = await readFile(path.join(process.cwd(), relativePath), "utf8");
  return source.includes(POSTGRES_RECONNECT_AFTER)
    ? source.replace(POSTGRES_RECONNECT_AFTER, POSTGRES_RECONNECT_BEFORE)
    : source;
}

async function fixture(version: string = POSTGRES_PATCH_VERSION) {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "jelocare-postgres-patch-"),
  );
  await mkdir(path.join(root, "node_modules/postgres/src"), {
    recursive: true,
  });
  await mkdir(path.join(root, "node_modules/postgres/cjs/src"), {
    recursive: true,
  });
  await writeFile(
    path.join(root, "node_modules/postgres/package.json"),
    JSON.stringify({ version }),
  );
  for (const target of TARGETS) {
    await writeFile(
      path.join(root, target),
      await cleanInstalledSource(target),
    );
  }
  return root;
}

test("the install patch applies the exact reconnect clamp and is idempotent", async () => {
  const root = await fixture();
  try {
    assert.deepEqual(await applyPostgresReconnectPatch(root), {
      version: POSTGRES_PATCH_VERSION,
      patched: 2,
      alreadyPatched: 0,
    });

    for (const target of TARGETS) {
      const source = await readFile(path.join(root, target), "utf8");
      assert.equal(source.includes(POSTGRES_RECONNECT_BEFORE), false);
      assert.equal(source.includes(POSTGRES_RECONNECT_AFTER), true);
    }

    assert.deepEqual(await applyPostgresReconnectPatch(root), {
      version: POSTGRES_PATCH_VERSION,
      patched: 0,
      alreadyPatched: 2,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the install patch fails closed before writing unexpected dependency bytes", async () => {
  const root = await fixture();
  try {
    const firstPath = path.join(root, TARGETS[0]);
    const secondPath = path.join(root, TARGETS[1]);
    const firstBefore = await readFile(firstPath, "utf8");
    await writeFile(
      secondPath,
      `${await readFile(secondPath, "utf8")}\n// drift`,
    );

    await assert.rejects(
      applyPostgresReconnectPatch(root),
      /Refusing to patch unexpected postgres source/,
    );
    assert.equal(await readFile(firstPath, "utf8"), firstBefore);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the install patch is pinned to postgres 3.4.7 and the prepare lifecycle", async () => {
  const root = await fixture("3.4.8");
  try {
    await assert.rejects(
      applyPostgresReconnectPatch(root),
      /requires postgres 3\.4\.7; found 3\.4\.8/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  const packageJson = JSON.parse(
    await readFile(path.join(process.cwd(), "package.json"), "utf8"),
  );
  assert.equal(packageJson.dependencies.postgres, POSTGRES_PATCH_VERSION);
  assert.equal(
    packageJson.scripts.prepare,
    "node scripts/apply-postgres-reconnect-patch.mjs && husky",
  );
});
