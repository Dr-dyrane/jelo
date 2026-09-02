import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { buildMigrationPlan } from "@/lib/database/migration-governance";
import { readMigrationLedgerSnapshot } from "@/lib/database/migration-ledger";
import {
  APPLICATION_RUNTIME_ROLE,
  applicationDatabaseUrl,
} from "@/lib/database/runtime-database-config";
import type { PostgresClient } from "@/lib/db/postgres";
import {
  evaluateMarketFinderReadiness,
  type MarketFinderReadinessProductCheck,
} from "@/lib/markets/readiness";
import {
  readMarketFinder,
  readMarketFinderDirectory,
} from "@/lib/markets/repository";
import { requireAdminDatabaseUrl } from "./lib/admin-database";
import { readCanonicalMigrationInventory } from "./lib/migration-files";
import { attestMarketFinderProductionDatabase } from "./lib/neon-production-attestation";

const pilotEnvironment = {
  MARKET_FINDER_PUBLIC_READ_ENABLED: "true",
  MARKET_FINDER_PUBLIC_MARKET_SLUG: "trade-fair",
} as const;

export const MARKET_FINDER_READ_SNAPSHOT =
  "isolation level repeatable read read only";

export function parseReadinessOptions(argv: readonly string[]) {
  const unknown = argv.filter((option) => option !== "--json");
  if (unknown.length > 0) {
    throw new Error("Unsupported Market Finder readiness option.");
  }
  return { json: argv.includes("--json") };
}

export function requireMarketFinderRuntimeDatabaseUrl(
  environment: {
    APP_DATABASE_URL?: string;
    [key: string]: string | undefined;
  } = process.env,
) {
  const candidate = applicationDatabaseUrl({
    NODE_ENV: "production",
    APP_DATABASE_URL: environment.APP_DATABASE_URL,
  });
  if (!candidate) {
    throw new Error(
      "APP_DATABASE_URL must use the restricted application runtime role.",
    );
  }
  return candidate;
}

export async function auditMarketFinderReadiness(input: {
  adminSql: ReturnType<typeof postgres>;
  runtimeSql: ReturnType<typeof postgres>;
  now?: Date;
}) {
  const inventory = await readCanonicalMigrationInventory();
  const now = input.now ?? new Date();
  const migrationPlan = await input.adminSql.begin(
    MARKET_FINDER_READ_SNAPSHOT,
    async (transaction) =>
      buildMigrationPlan(
        inventory,
        await readMigrationLedgerSnapshot(transaction),
      ),
  );
  const migrationOnly = evaluateMarketFinderReadiness({ migrationPlan });
  if (!migrationOnly.migrations.ready) return migrationOnly;

  return input.runtimeSql.begin(
    MARKET_FINDER_READ_SNAPSHOT,
    async (transaction) => {
      const client = transaction as unknown as PostgresClient;
      const [runtimeRole] = await transaction<
        { current_user: string; session_user: string }[]
      >`select current_user, session_user`;
      const runtimeRoleAttested =
        runtimeRole?.current_user === APPLICATION_RUNTIME_ROLE &&
        runtimeRole.session_user === APPLICATION_RUNTIME_ROLE;
      if (!runtimeRoleAttested) {
        return evaluateMarketFinderReadiness({
          migrationPlan,
          runtimeRoleAttested: false,
        });
      }

      const directory = await readMarketFinderDirectory("trade-fair", {
        client,
        environment: pilotEnvironment,
        logErrors: false,
        now,
      });
      const productChecks: MarketFinderReadinessProductCheck[] = [];
      if (directory.state === "current") {
        for (const product of directory.products) {
          productChecks.push({
            product,
            readModel: await readMarketFinder(
              { marketSlug: "trade-fair", productSlug: product.slug },
              {
                client,
                environment: pilotEnvironment,
                logErrors: false,
                now,
              },
            ),
          });
        }
      }

      return evaluateMarketFinderReadiness({
        migrationPlan,
        runtimeRoleAttested: true,
        directory,
        productChecks,
      });
    },
  );
}

async function main() {
  const options = parseReadinessOptions(process.argv.slice(2));
  const adminDatabaseUrl = requireAdminDatabaseUrl();
  const runtimeDatabaseUrl = requireMarketFinderRuntimeDatabaseUrl();
  await attestMarketFinderProductionDatabase({
    admin: adminDatabaseUrl,
    runtime: runtimeDatabaseUrl,
  });

  const adminSql = postgres(adminDatabaseUrl, {
    max: 1,
    prepare: false,
    connection: {
      application_name: "jelocare-market-finder-readiness-admin",
    },
  });
  const runtimeSql = postgres(runtimeDatabaseUrl, {
    max: 1,
    prepare: false,
    connection: {
      application_name: "jelocare-market-finder-readiness-runtime",
    },
  });

  try {
    const report = await auditMarketFinderReadiness({ adminSql, runtimeSql });
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(
        [
          `state=${report.state}`,
          "target=production-attested",
          `runtime-role=${report.runtime.roleAssessment}`,
          `public-read-data-ready=${String(report.publicReadDataReady)}`,
          `migrations=${report.migrations.applied}/${report.migrations.required}`,
          `products=${report.data.productCount}`,
          `packshot-bindings=${report.data.packshotCount}`,
          `locations=${report.data.currentLocationCount}`,
          "asset-delivery=not-assessed",
          "report-intake=not-assessed",
        ].join(" "),
      );
      for (const blocker of report.blockers) {
        console.log(`blocked ${blocker}`);
      }
    }
    if (!report.publicReadDataReady) process.exitCode = 2;
  } finally {
    await Promise.all([
      adminSql.end({ timeout: 5 }),
      runtimeSql.end({ timeout: 5 }),
    ]);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  void main().catch(() => {
    console.error("Market Finder readiness audit failed.");
    process.exitCode = 1;
  });
}
