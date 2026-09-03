import type { MigrationPlan } from "@/lib/database/migration-governance";
import type {
  MarketFinderDirectoryModel,
  MarketFinderMarket,
  MarketFinderProductIdentity,
  MarketFinderReadModel,
} from "@/lib/markets/domain";
import { resolveMarketFinderProductPackshot } from "@/lib/markets/presentation";

export const MARKET_FINDER_REQUIRED_MIGRATIONS = [
  "0053_physical_market_finder.sql",
  "0054_market_finder_report_current_context.sql",
  "0055_market_finder_atomic_context.sql",
] as const;

export type MarketFinderReadinessProductCheck = {
  product: MarketFinderProductIdentity;
  readModel: MarketFinderReadModel;
};

export type MarketFinderReadinessReport = {
  state: "ready" | "blocked";
  marketSlug: "trade-fair";
  publicReadDataReady: boolean;
  reportIntakeAssessment: "not-assessed";
  assetDeliveryAssessment: "not-assessed";
  runtime: {
    roleAssessment: "not-assessed" | "attested" | "blocked";
  };
  migrations: {
    ready: boolean;
    required: number;
    applied: number;
  };
  data: {
    checked: boolean;
    directoryState: MarketFinderDirectoryModel["state"] | "not-checked";
    productCount: number;
    productCheckCount: number;
    packshotCount: number;
    packshotUnavailableCount: number;
    currentLocationCount: number;
  };
  blockers: string[];
};

function sameProductIdentity(
  expected: MarketFinderProductIdentity,
  actual: MarketFinderProductIdentity,
) {
  return (
    expected.identityVersionId === actual.identityVersionId &&
    expected.productId === actual.productId &&
    expected.slug === actual.slug &&
    expected.brand === actual.brand &&
    expected.variant === actual.variant &&
    expected.size === actual.size &&
    expected.packageVersion === actual.packageVersion &&
    expected.formulaVersion === actual.formulaVersion
  );
}

function sameMarketIdentity(
  expected: MarketFinderMarket,
  actual: MarketFinderMarket,
) {
  return (
    expected.id === actual.id &&
    expected.slug === actual.slug &&
    expected.name === actual.name &&
    expected.city === actual.city &&
    expected.stateRegion === actual.stateRegion &&
    expected.countryCode === actual.countryCode
  );
}

/**
 * Combines governed migration state with the exact public repository models.
 * The report intentionally contains only public slugs and bounded counts.
 */
export function evaluateMarketFinderReadiness(input: {
  migrationPlan: MigrationPlan;
  runtimeRoleAttested?: boolean;
  directory?: MarketFinderDirectoryModel;
  productChecks?: readonly MarketFinderReadinessProductCheck[];
}): MarketFinderReadinessReport {
  const blockers = new Set<string>();
  const migrationEntries = new Map(
    input.migrationPlan.entries.map((entry) => [entry.filename, entry]),
  );

  if (input.migrationPlan.ledgerShape !== "governed") {
    blockers.add("migration-ledger-not-governed");
  }
  if (!input.migrationPlan.immutable) {
    blockers.add("migration-ledger-not-immutable");
  }
  if (input.migrationPlan.errors.length > 0) {
    blockers.add("migration-plan-errors");
  }

  let appliedRequiredMigrations = 0;
  for (const filename of MARKET_FINDER_REQUIRED_MIGRATIONS) {
    const entry = migrationEntries.get(filename);
    if (entry?.state === "applied") {
      appliedRequiredMigrations += 1;
    } else {
      blockers.add(`migration-not-applied:${filename}`);
    }
  }

  const migrationsReady =
    appliedRequiredMigrations === MARKET_FINDER_REQUIRED_MIGRATIONS.length &&
    input.migrationPlan.ledgerShape === "governed" &&
    input.migrationPlan.immutable &&
    input.migrationPlan.errors.length === 0;

  const productChecks = input.productChecks ?? [];
  let productCount = 0;
  let packshotCount = 0;
  let packshotUnavailableCount = 0;
  let currentLocationCount = 0;
  let directoryState: MarketFinderReadinessReport["data"]["directoryState"] =
    "not-checked";

  const runtimeRoleAttested = input.runtimeRoleAttested === true;
  const runtimeRoleAssessment = !migrationsReady
    ? "not-assessed"
    : runtimeRoleAttested
      ? "attested"
      : "blocked";
  if (migrationsReady && !runtimeRoleAttested) {
    blockers.add("runtime-role-not-attested");
  }

  if (migrationsReady && runtimeRoleAttested) {
    if (!input.directory) {
      blockers.add("directory-not-checked");
    } else {
      directoryState = input.directory.state;
      if (input.directory.state !== "current") {
        blockers.add(
          `directory-${input.directory.state}:${input.directory.reason}`,
        );
      } else {
        productCount = input.directory.products.length;
        if (input.directory.market.slug !== "trade-fair") {
          blockers.add("directory-market-mismatch");
        }
        if (productCount === 0) {
          blockers.add("directory-product-missing");
        }
        const checksBySlug = new Map<
          string,
          MarketFinderReadinessProductCheck
        >();
        for (const check of productChecks) {
          if (checksBySlug.has(check.product.slug)) {
            blockers.add(`duplicate-product-check:${check.product.slug}`);
          } else {
            checksBySlug.set(check.product.slug, check);
          }
        }

        const directorySlugs = new Set<string>();
        for (const product of input.directory.products) {
          if (directorySlugs.has(product.slug)) {
            blockers.add(`duplicate-directory-product:${product.slug}`);
            continue;
          }
          directorySlugs.add(product.slug);

          const check = checksBySlug.get(product.slug);
          if (!check) {
            blockers.add(`product-not-checked:${product.slug}`);
            continue;
          }
          if (!sameProductIdentity(product, check.product)) {
            blockers.add(`directory-identity-mismatch:${product.slug}`);
          }
          if (resolveMarketFinderProductPackshot(product)) {
            packshotCount += 1;
          } else {
            packshotUnavailableCount += 1;
          }
          if (check.readModel.state !== "current") {
            blockers.add(
              `product-${check.readModel.state}:${product.slug}:${check.readModel.reason}`,
            );
            continue;
          }
          if (!sameProductIdentity(product, check.readModel.context.product)) {
            blockers.add(`read-identity-mismatch:${product.slug}`);
          }
          if (
            !sameMarketIdentity(
              input.directory.market,
              check.readModel.context.market,
            )
          ) {
            blockers.add(`read-market-mismatch:${product.slug}`);
          }
          if (check.readModel.locations.length === 0) {
            blockers.add(`current-location-missing:${product.slug}`);
          } else {
            currentLocationCount += check.readModel.locations.length;
          }
        }

        for (const check of productChecks) {
          if (!directorySlugs.has(check.product.slug)) {
            blockers.add(`unexpected-product-check:${check.product.slug}`);
          }
        }
      }
    }
  }

  const publicReadDataReady = blockers.size === 0;
  return {
    state: publicReadDataReady ? "ready" : "blocked",
    marketSlug: "trade-fair",
    publicReadDataReady,
    reportIntakeAssessment: "not-assessed",
    assetDeliveryAssessment: "not-assessed",
    runtime: {
      roleAssessment: runtimeRoleAssessment,
    },
    migrations: {
      ready: migrationsReady,
      required: MARKET_FINDER_REQUIRED_MIGRATIONS.length,
      applied: appliedRequiredMigrations,
    },
    data: {
      checked:
        migrationsReady && runtimeRoleAttested && input.directory !== undefined,
      directoryState,
      productCount,
      productCheckCount: productChecks.length,
      packshotCount,
      packshotUnavailableCount,
      currentLocationCount,
    },
    blockers: [...blockers],
  };
}
