import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  overrides?: Record<string, string>;
};

type PackageLock = {
  packages?: Record<string, { version?: string }>;
};

test("runtime dependencies stay on the reviewed security floor", async () => {
  const [manifest, lock] = await Promise.all([
    readFile("package.json", "utf8").then(
      (source) => JSON.parse(source) as PackageManifest,
    ),
    readFile("package-lock.json", "utf8").then(
      (source) => JSON.parse(source) as PackageLock,
    ),
  ]);

  assert.equal(manifest.dependencies?.next, "16.3.3");
  assert.equal(manifest.dependencies?.react, "19.2.8");
  assert.equal(manifest.dependencies?.["react-dom"], "19.2.8");
  assert.equal(manifest.dependencies?.sharp, "0.35.4");
  assert.equal(manifest.devDependencies?.["@types/react"], "19.2.18");
  assert.equal(manifest.devDependencies?.["@types/react-dom"], "19.2.5");
  assert.equal(manifest.devDependencies?.["eslint-config-next"], "16.3.3");
  assert.equal(manifest.overrides?.postcss, "8.5.23");

  assert.equal(lock.packages?.["node_modules/next"]?.version, "16.3.3");
  assert.equal(lock.packages?.["node_modules/react"]?.version, "19.2.8");
  assert.equal(lock.packages?.["node_modules/react-dom"]?.version, "19.2.8");
  assert.equal(lock.packages?.["node_modules/sharp"]?.version, "0.35.4");
  assert.equal(
    lock.packages?.["node_modules/@types/react"]?.version,
    "19.2.18",
  );
  assert.equal(
    lock.packages?.["node_modules/@types/react-dom"]?.version,
    "19.2.5",
  );
  assert.equal(lock.packages?.["node_modules/postcss"]?.version, "8.5.23");
  assert.equal(lock.packages?.["node_modules/nanoid"]?.version, "3.3.18");
  assert.equal(lock.packages?.["node_modules/undici"]?.version, "6.28.0");
  assert.equal(
    lock.packages?.[
      "node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion"
    ]?.version,
    "5.0.9",
  );
  assert.equal(
    lock.packages?.["node_modules/brace-expansion"]?.version,
    "1.1.18",
  );
  assert.equal(lock.packages?.["node_modules/js-yaml"]?.version, "4.3.2");
});
