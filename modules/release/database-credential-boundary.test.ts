import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  APPLICATION_RUNTIME_ROLE,
  applicationDatabaseUrl,
} from "../../lib/database/runtime-database-config";
import {
  requireAdminDatabaseUrl,
  requireRehearsalDatabaseUrl,
} from "../../scripts/lib/admin-database";

test("production application configuration accepts only the exact APP_DATABASE_URL runtime login", () => {
  const exact = `postgresql://${APPLICATION_RUNTIME_ROLE}:secret@ep-safe.example/db`;
  const owner = "postgresql://owner:secret@ep-safe.example/db";

  assert.equal(
    applicationDatabaseUrl({ NODE_ENV: "production", APP_DATABASE_URL: exact }),
    exact,
  );
  assert.equal(
    applicationDatabaseUrl({
      NODE_ENV: "production",
      APP_DATABASE_URL: exact,
      DATABASE_URL: owner,
      POSTGRES_URL: owner,
    }),
    exact,
    "local-only aliases cannot override the canonical production credential",
  );
  assert.equal(
    applicationDatabaseUrl({
      NODE_ENV: "production",
      APP_DATABASE_URL: owner,
      DATABASE_URL: exact,
      POSTGRES_URL: exact,
    }),
    undefined,
    "an unsafe APP_DATABASE_URL cannot fall through to a local-only alias",
  );
  assert.equal(
    applicationDatabaseUrl({
      NODE_ENV: "production",
      APP_DATABASE_URL: "not-a-url",
      DATABASE_URL: exact,
    }),
    undefined,
    "an invalid APP_DATABASE_URL cannot fall through to a local-only alias",
  );
  assert.equal(
    applicationDatabaseUrl({ NODE_ENV: "production", DATABASE_URL: exact }),
    undefined,
  );
  assert.equal(
    applicationDatabaseUrl({ NODE_ENV: "production", POSTGRES_URL: exact }),
    undefined,
  );

  for (const VERCEL_ENV of ["preview", "production"]) {
    assert.equal(
      applicationDatabaseUrl({
        VERCEL_ENV,
        DATABASE_URL: exact,
        POSTGRES_URL: exact,
      }),
      undefined,
      `Vercel ${VERCEL_ENV} cannot use local-only database aliases`,
    );
    assert.equal(
      applicationDatabaseUrl({
        VERCEL_ENV,
        APP_DATABASE_URL: exact,
        DATABASE_URL: owner,
        POSTGRES_URL: owner,
      }),
      exact,
    );
    assert.equal(
      applicationDatabaseUrl({
        NODE_ENV: "development",
        VERCEL_ENV,
        DATABASE_URL: exact,
      }),
      undefined,
      `Vercel ${VERCEL_ENV} remains fail-closed when NODE_ENV is mis-set`,
    );
  }
});

test("development and tests retain ordered local database compatibility", () => {
  const app = "postgresql://app-local:secret@127.0.0.1/jelocare";
  const database = "postgresql://database-local:secret@127.0.0.1/jelocare";
  const postgres = "postgresql://postgres-local:secret@127.0.0.1/jelocare";
  assert.equal(
    applicationDatabaseUrl({
      NODE_ENV: "development",
      APP_DATABASE_URL: app,
      DATABASE_URL: database,
      POSTGRES_URL: postgres,
    }),
    app,
  );
  assert.equal(
    applicationDatabaseUrl({
      NODE_ENV: "development",
      DATABASE_URL: database,
      POSTGRES_URL: postgres,
    }),
    database,
  );
  assert.equal(
    applicationDatabaseUrl({ NODE_ENV: "test", POSTGRES_URL: postgres }),
    postgres,
  );
  assert.equal(
    applicationDatabaseUrl({
      VERCEL_ENV: "development",
      DATABASE_URL: database,
    }),
    database,
  );
  assert.equal(
    applicationDatabaseUrl({
      NODE_ENV: "test",
      APP_DATABASE_URL: "not-a-url",
      DATABASE_URL: database,
    }),
    undefined,
    "an invalid preferred local URL cannot fall through to a second credential",
  );
});

test("administrative operators accept only the named direct admin credential", () => {
  const direct = "postgresql://migration_admin:secret@ep-safe.example/jelocare";
  assert.equal(
    requireAdminDatabaseUrl({ MIGRATION_DATABASE_URL: direct }),
    direct,
  );
  for (const rejected of [
    {},
    { DATABASE_URL_UNPOOLED: direct },
    { POSTGRES_URL_NON_POOLING: direct },
    {
      MIGRATION_DATABASE_URL:
        "postgresql://jelocare_app_runtime:secret@ep-safe.example/jelocare",
    },
    {
      MIGRATION_DATABASE_URL:
        "postgresql://jelocare_shelf_runtime:secret@ep-safe.example/jelocare",
    },
    {
      MIGRATION_DATABASE_URL:
        "postgresql://migration_admin:secret@ep-safe-pooler.example/jelocare",
    },
  ]) {
    assert.throws(
      () => requireAdminDatabaseUrl(rejected),
      /MIGRATION_DATABASE_URL/,
    );
  }
});

test("rehearsal database authority is separate from production and unavailable in Vercel", () => {
  const direct =
    "postgresql://migration_admin:secret@ep-rehearsal.example/jelocare";
  assert.equal(
    requireRehearsalDatabaseUrl({ MIGRATION_REHEARSAL_DATABASE_URL: direct }),
    direct,
  );
  for (const rejected of [
    {
      MIGRATION_DATABASE_URL: direct,
      MIGRATION_REHEARSAL_DATABASE_URL: direct,
    },
    { MIGRATION_REHEARSAL_DATABASE_URL: direct, VERCEL: "1" },
    { MIGRATION_REHEARSAL_DATABASE_URL: direct, VERCEL_ENV: "preview" },
    {
      MIGRATION_REHEARSAL_DATABASE_URL:
        "postgresql://migration_admin:secret@ep-safe-pooler.example/jelocare",
    },
  ]) {
    assert.throws(
      () => requireRehearsalDatabaseUrl(rejected),
      /rehearsal|Rehearsal|MIGRATION/,
    );
  }
});

test("application runtime audit tables remain append-only after the bulk grant", async () => {
  const migration = await readFile(
    "db/migrations/0035_runtime_database_roles.sql",
    "utf8",
  );
  const bulkGrant = migration.indexOf(
    "grant select, insert, update, delete on all tables in schema public to jelocare_app_runtime;",
  );
  const moderationAuditRevoke = migration.indexOf(
    "revoke update, delete on table public.moderation_audit_log from jelocare_app_runtime;",
  );
  const operatorAuditRevoke = migration.indexOf(
    "revoke update, delete on table public.moderation_operator_access_audit from jelocare_app_runtime;",
  );

  assert.ok(bulkGrant >= 0);
  assert.ok(moderationAuditRevoke > bulkGrant);
  assert.ok(operatorAuditRevoke > bulkGrant);
});

test("every database mutation step in reconciliation uses the admin-only resolver", async () => {
  const paths = [
    "scripts/migrate-database.ts",
    "scripts/seed-catalogue.ts",
    "scripts/seed-external-catalogue.ts",
    "scripts/seed-product-asset-metadata.ts",
    "scripts/seed-editorial-assets.ts",
    "scripts/import-customer-shelf.ts",
    "scripts/seed-moderation-operator.ts",
    "scripts/manage-community-data.ts",
    "scripts/resolve-community-research-task.ts",
    "scripts/resolve-community-retailer-research-task.ts",
    "scripts/record-manual-inventory-observation.ts",
    "scripts/queue-inventory-refresh.ts",
    "scripts/purge-community-intake-drafts.ts",
    "scripts/purge-consult-ai-generations.ts",
  ];
  for (const path of paths) {
    const source = await readFile(path, "utf8");
    assert.match(source, /requireAdminDatabaseUrl\(\)/, path);
    assert.doesNotMatch(
      source,
      /DATABASE_URL_UNPOOLED|POSTGRES_URL_NON_POOLING|process\.env\.(?:DATABASE_URL|POSTGRES_URL)/,
      path,
    );
  }

  const legacyAssetImporter = await readFile(
    "scripts/import-product-assets.mjs",
    "utf8",
  );
  assert.match(legacyAssetImporter, /process\.env\.MIGRATION_DATABASE_URL/);
  assert.doesNotMatch(
    legacyAssetImporter,
    /DATABASE_URL_UNPOOLED|POSTGRES_URL_NON_POOLING|process\.env\.(?:DATABASE_URL|POSTGRES_URL)/,
  );

  const runtime = await readFile("lib/db/postgres.ts", "utf8");
  assert.match(runtime, /applicationDatabaseUrl\(process\.env\)/);
  assert.match(runtime, /user: APPLICATION_RUNTIME_ROLE/);
  assert.match(runtime, /Runtime database access is unavailable\./);

  const inventoryRuntime = await readFile(
    "lib/inventory/refresh-worker.ts",
    "utf8",
  );
  assert.match(inventoryRuntime, /applicationDatabaseUrl\(process\.env\)/);
  assert.match(inventoryRuntime, /user: APPLICATION_RUNTIME_ROLE/);
  assert.match(inventoryRuntime, /Runtime database access is unavailable\./);
  assert.doesNotMatch(
    inventoryRuntime,
    /process\.env\.DATABASE_URL\s*\?\?|process\.env\.POSTGRES_URL/,
  );
});
