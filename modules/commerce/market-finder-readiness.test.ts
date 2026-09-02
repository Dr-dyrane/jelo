import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { MigrationPlan } from "@/lib/database/migration-governance";
import type {
  MarketFinderDirectoryModel,
  MarketFinderMarket,
  MarketFinderProductIdentity,
  MarketFinderReadModel,
} from "@/lib/markets/domain";
import {
  evaluateMarketFinderReadiness,
  MARKET_FINDER_REQUIRED_MIGRATIONS,
} from "@/lib/markets/readiness";
import {
  MARKET_FINDER_READ_SNAPSHOT,
  parseReadinessOptions,
  requireMarketFinderRuntimeDatabaseUrl,
} from "@/scripts/audit-market-finder-readiness";
import {
  assertNeonProductionControlPlane,
  MARKET_FINDER_PRODUCTION_DATABASE_TARGET,
} from "@/scripts/lib/neon-production-attestation";

const market: MarketFinderMarket = {
  id: "market-id",
  slug: "trade-fair",
  name: "Lagos Trade Fair",
  city: "Lagos",
  stateRegion: "Lagos",
  countryCode: "NG",
};

const product: MarketFinderProductIdentity = {
  identityVersionId: "identity-version",
  productId: "product-id",
  slug: "exact-product-50ml",
  brand: "Exact Brand",
  variant: "Exact Product",
  size: "50 ml",
  packageVersion: "v1",
  formulaVersion: "v1",
};

function migrationPlan(
  state: "applied" | "pending" = "applied",
): MigrationPlan {
  return {
    ledgerShape: "governed",
    immutable: true,
    errors: [],
    canApply: state === "pending",
    entries: MARKET_FINDER_REQUIRED_MIGRATIONS.map((filename, index) => ({
      filename,
      version: 53 + index,
      migrationOrder: 54 + index,
      checksumSha256: "a".repeat(64),
      state,
    })),
  };
}

const directory: MarketFinderDirectoryModel = {
  state: "current",
  market,
  products: [product],
  evaluatedAt: "2026-09-02T12:00:00.000Z",
};

const currentRead: MarketFinderReadModel = {
  state: "current",
  context: { market, product },
  locations: [
    {
      id: "location-id",
      slug: "reviewed-shop",
      name: "Reviewed Shop",
      retailerName: "Reviewed Retailer",
      placeName: null,
      shopNumber: "A43",
      floor: null,
      locationVerificationExpiresAt: "2026-09-08T12:00:00.000Z",
      locationIdentityEvidenceExpiresAt: "2026-09-08T12:00:00.000Z",
      observation: {
        id: "observation-id",
        availability: "in_stock",
        priceNgn: 11860,
        observedAt: "2026-09-02T10:00:00.000Z",
        expiresAt: "2026-09-05T10:00:00.000Z",
        sourceMethod: "branch_online_record",
        observedTitle: "Exact Product",
        observedSize: "50 ml",
      },
      action: {
        kind: "website",
        destination: "https://shop.example/product",
        href: "https://shop.example/product",
        expiresAt: "2026-09-08T12:00:00.000Z",
      },
    },
  ],
  researchRecords: [],
  evaluatedAt: "2026-09-02T12:00:00.000Z",
};

test("readiness stops at the governed migration gate before reading pilot data", () => {
  const report = evaluateMarketFinderReadiness({
    migrationPlan: migrationPlan("pending"),
  });

  assert.equal(report.state, "blocked");
  assert.equal(report.migrations.applied, 0);
  assert.equal(report.data.checked, false);
  assert.equal(report.data.directoryState, "not-checked");
  assert.deepEqual(
    report.blockers,
    MARKET_FINDER_REQUIRED_MIGRATIONS.map(
      (filename) => `migration-not-applied:${filename}`,
    ),
  );
});

test("readiness passes only for exact current reads with native packshots", () => {
  const report = evaluateMarketFinderReadiness({
    migrationPlan: migrationPlan(),
    runtimeRoleAttested: true,
    directory,
    productChecks: [{ product, readModel: currentRead, hasPackshot: true }],
  });

  assert.equal(report.state, "ready");
  assert.equal(report.publicReadDataReady, true);
  assert.equal(report.reportIntakeAssessment, "not-assessed");
  assert.equal(report.assetDeliveryAssessment, "not-assessed");
  assert.equal(report.runtime.roleAssessment, "attested");
  assert.deepEqual(report.blockers, []);
  assert.deepEqual(report.data, {
    checked: true,
    directoryState: "current",
    productCount: 1,
    productCheckCount: 1,
    packshotCount: 1,
    currentLocationCount: 1,
  });
});

test("missing packshots and non-current exact reads block activation", () => {
  const unavailable: MarketFinderReadModel = {
    state: "unavailable",
    context: { market, product },
    locations: [],
    researchRecords: [],
    reason: "no-usable-action",
    evaluatedAt: "2026-09-02T12:00:00.000Z",
  };
  const report = evaluateMarketFinderReadiness({
    migrationPlan: migrationPlan(),
    runtimeRoleAttested: true,
    directory,
    productChecks: [{ product, readModel: unavailable, hasPackshot: false }],
  });

  assert.equal(report.state, "blocked");
  assert.deepEqual(report.blockers, [
    "packshot-missing:exact-product-50ml",
    "product-unavailable:exact-product-50ml:no-usable-action",
  ]);
});

test("an empty current-shaped directory can never produce a false ready", () => {
  const report = evaluateMarketFinderReadiness({
    migrationPlan: migrationPlan(),
    runtimeRoleAttested: true,
    directory: { ...directory, products: [] },
    productChecks: [],
  });

  assert.equal(report.state, "blocked");
  assert.deepEqual(report.blockers, ["directory-product-missing"]);
});

test("a product read from another market can never satisfy the directory", () => {
  const report = evaluateMarketFinderReadiness({
    migrationPlan: migrationPlan(),
    runtimeRoleAttested: true,
    directory,
    productChecks: [
      {
        product,
        readModel: {
          ...currentRead,
          context: {
            ...currentRead.context,
            market: { ...market, id: "another-market-id" },
          },
        },
        hasPackshot: true,
      },
    ],
  });

  assert.equal(report.state, "blocked");
  assert.deepEqual(report.blockers, [
    "read-market-mismatch:exact-product-50ml",
  ]);
});

test("missing application-runtime attestation blocks data evaluation", () => {
  const report = evaluateMarketFinderReadiness({
    migrationPlan: migrationPlan(),
    runtimeRoleAttested: false,
  });

  assert.equal(report.state, "blocked");
  assert.equal(report.runtime.roleAssessment, "blocked");
  assert.equal(report.data.checked, false);
  assert.deepEqual(report.blockers, ["runtime-role-not-attested"]);
});

test("production control-plane attestation binds both credentials to the exact branch", () => {
  const target = MARKET_FINDER_PRODUCTION_DATABASE_TARGET;
  const branch = {
    branch: {
      id: target.branchId,
      project_id: target.projectId,
      name: target.branchName,
      current_state: "ready",
      primary: true,
      default: true,
    },
  };
  const endpoints = {
    endpoints: [
      {
        project_id: target.projectId,
        branch_id: target.branchId,
        host: "ep-production.example",
        hosts: {
          read_write_host: "ep-production.example",
          read_write_pooled_host: "ep-production-pooler.example",
        },
        type: "read_write",
        disabled: false,
      },
    ],
  };
  const credentials = {
    admin: "postgresql://production_admin:secret@ep-production.example/neondb",
    runtime:
      "postgresql://jelocare_app_runtime:secret@ep-production-pooler.example/neondb",
  };

  assert.doesNotThrow(() =>
    assertNeonProductionControlPlane(credentials, branch, endpoints),
  );
  assert.throws(
    () =>
      assertNeonProductionControlPlane(
        credentials,
        {
          branch: {
            ...branch.branch,
            id: "br-rehearsal",
            name: "rehearsal/market-finder",
            primary: false,
            default: false,
          },
        },
        endpoints,
      ),
    /production target/,
  );
  assert.throws(
    () =>
      assertNeonProductionControlPlane(
        {
          ...credentials,
          runtime: credentials.runtime.replace(
            "production-pooler",
            "rehearsal",
          ),
        },
        branch,
        endpoints,
      ),
    /production Neon endpoint/,
  );
});

test("runtime credential and unsupported-option failures never echo secrets", () => {
  assert.equal(
    requireMarketFinderRuntimeDatabaseUrl({
      APP_DATABASE_URL:
        "postgresql://jelocare_app_runtime:secret@ep-production.example/neondb",
    }),
    "postgresql://jelocare_app_runtime:secret@ep-production.example/neondb",
  );
  assert.throws(
    () =>
      requireMarketFinderRuntimeDatabaseUrl({
        APP_DATABASE_URL:
          "postgresql://production_admin:do-not-print@ep-production.example/neondb",
      }),
    /restricted application runtime role/,
  );

  const secretOption = "--password=do-not-print";
  assert.throws(
    () => parseReadinessOptions([secretOption]),
    (error: unknown) =>
      error instanceof Error && !error.message.includes(secretOption),
  );
});

test("the documented silent npm wrapper cannot echo a forwarded argument", () => {
  const sentinel = "--password=readiness-sentinel-must-not-print";
  const environment = { ...process.env };
  delete environment.MIGRATION_DATABASE_URL;
  delete environment.APP_DATABASE_URL;
  const result = spawnSync(
    "npm",
    ["run", "--silent", "market-finder:readiness", "--", sentinel],
    {
      encoding: "utf8",
      env: environment,
    },
  );

  assert.equal(result.status, 1);
  assert.doesNotMatch(
    `${result.stdout}\n${result.stderr}`,
    /readiness-sentinel/,
  );
  assert.match(
    `${result.stdout}\n${result.stderr}`,
    /Market Finder readiness audit failed\./,
  );
});

test("the operator command uses a stable read-only runtime snapshot and bounded output", async () => {
  const source = await readFile(
    "scripts/audit-market-finder-readiness.ts",
    "utf8",
  );
  const runbook = await readFile("docs/operations/RUNBOOKS.md", "utf8");

  assert.equal(
    MARKET_FINDER_READ_SNAPSHOT,
    "isolation level repeatable read read only",
  );
  assert.match(source, /select current_user, session_user/);
  assert.match(source, /APPLICATION_RUNTIME_ROLE/);
  assert.match(source, /logErrors:\s*false/);
  assert.match(
    source,
    /MARKET_FINDER_PUBLIC_MARKET_SLUG:\s*["']trade-fair["']/,
  );
  assert.match(source, /asset-delivery=not-assessed/);
  assert.match(source, /report-intake=not-assessed/);
  assert.match(
    source,
    /console\.error\("Market Finder readiness audit failed\."\)/,
  );
  assert.doesNotMatch(source, /error instanceof Error\s*\?\s*error\.message/);
  assert.doesNotMatch(
    source,
    /--apply|insert into|update\s+physical_|delete from/i,
  );
  assert.match(runbook, /npm run --silent market-finder:readiness/);
});
