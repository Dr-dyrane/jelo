import { revalidatePath, revalidateTag } from "next/cache";
import {
  enqueueDueInventoryOffers,
  getInventoryRefreshBacklogSummary,
  getStaleOfferCount,
  seedManualInventoryRefreshRun,
} from "@/lib/inventory/repository";
import {
  INVENTORY_CRON_BATCH_SIZE,
  INVENTORY_CRON_CLAIM_BUDGET_MS,
  INVENTORY_CRON_LOOKAHEAD_HOURS,
  INVENTORY_CRON_RUNS_PER_DAY,
  INVENTORY_REFRESH_FRESHNESS_MS,
  summarizeInventoryRefreshRun,
} from "@/lib/inventory/refresh-policy";
import {
  processInventoryRefreshBatch,
  type InventoryRefreshResult,
} from "@/lib/inventory/refresh-worker";
import { sendRefreshAlertIfNeeded } from "@/lib/inventory/refresh-alerting";
import { isAuthorizedCronRequest } from "@/modules/retail-intelligence/cron-auth";
import {
  staticFileSyncConfiguration,
  syncOffersToStaticFile,
  type StaticFileSyncResult,
} from "@/lib/inventory/static-file-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

const MANUAL_REFRESH_CONFIRMATION = "refresh-all-exact-offers";
const MANUAL_REFRESH_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type ManualInventoryRefreshOptions = {
  mode: "full" | "continue";
  marketCode: string;
  cutoff: Date;
};

function inventoryRefreshCapacity() {
  return {
    scheduledRunsPerDay: INVENTORY_CRON_RUNS_PER_DAY,
    batchAttemptLimit: INVENTORY_CRON_BATCH_SIZE,
    attemptSlotsPerDay: INVENTORY_CRON_RUNS_PER_DAY * INVENTORY_CRON_BATCH_SIZE,
    targetFreshnessHours: INVENTORY_REFRESH_FRESHNESS_MS / (60 * 60 * 1000),
    enqueueLookaheadHours: INVENTORY_CRON_LOOKAHEAD_HOURS,
  };
}

function parseManualInventoryRefreshOptions(
  request: Request,
): ManualInventoryRefreshOptions {
  const searchParams = new URL(request.url).searchParams;
  const mode = searchParams.get("manual");
  const marketCode = searchParams.get("market")?.toUpperCase();
  const cutoffValue = searchParams.get("cutoff");
  const confirmation = searchParams.get("confirm");

  if (mode !== "full" && mode !== "continue") {
    throw new Error("Manual inventory refresh mode must be full or continue.");
  }
  if (!marketCode || !/^[A-Z]{2}$/.test(marketCode)) {
    throw new Error(
      "Manual inventory refresh market must be a two-letter code.",
    );
  }
  if (confirmation !== MANUAL_REFRESH_CONFIRMATION) {
    throw new Error("Manual inventory refresh confirmation is missing.");
  }

  const cutoff = cutoffValue ? new Date(cutoffValue) : new Date(Number.NaN);
  const now = Date.now();
  if (
    Number.isNaN(cutoff.getTime()) ||
    cutoff.getTime() > now + 5 * 60 * 1000 ||
    cutoff.getTime() < now - MANUAL_REFRESH_MAX_AGE_MS
  ) {
    throw new Error(
      "Manual inventory refresh cutoff is outside the allowed window.",
    );
  }

  return { mode, marketCode, cutoff };
}

function manualRefreshResults(results: readonly InventoryRefreshResult[]) {
  return results.map((result) => ({
    offerId: result.offerId,
    productSlug: result.productSlug,
    retailer: result.retailer,
    status: result.status,
    failureReason: result.failureReason,
    inventoryStatus: result.inventoryStatus,
    priceMinor: result.priceMinor,
    currencyCode: result.currencyCode,
  }));
}

async function runInventoryRefresh(
  request: Request,
  manualOptions?: ManualInventoryRefreshOptions,
) {
  const requestStartedAt = Date.now();
  if (
    !isAuthorizedCronRequest(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Dry-run mode reports the current backlog without enqueueing, claiming,
  // refreshing, alerting, cache invalidation, or static-file synchronization.
  const dryRun = new URL(request.url).searchParams.has("dry-run");

  if (dryRun) {
    const backlog = await getInventoryRefreshBacklogSummary();
    const summary = {
      dryRun: true,
      writesPerformed: 0,
      backlog,
      capacity: inventoryRefreshCapacity(),
    };
    console.info(
      JSON.stringify({ event: "inventory_refresh_cron_dry_run", ...summary }),
    );
    return Response.json(summary);
  }

  const claimDeadlineAt = requestStartedAt + INVENTORY_CRON_CLAIM_BUDGET_MS;
  const scheduledEnqueue = async () => {
    const enqueue = await enqueueDueInventoryOffers(
      INVENTORY_CRON_BATCH_SIZE,
      INVENTORY_CRON_LOOKAHEAD_HOURS,
    );
    return enqueue;
  };
  const manualSeed =
    manualOptions?.mode === "full"
      ? await seedManualInventoryRefreshRun({
          marketCode: manualOptions.marketCode,
          runCutoff: manualOptions.cutoff,
        })
      : null;
  const enqueueSummary = manualSeed
    ? {
        queued: manualSeed.inserted + manualSeed.requeued,
        withdrawn: manualSeed.withdrawn,
      }
    : manualOptions
      ? { queued: 0, withdrawn: 0 }
      : await scheduledEnqueue();

  const batch = await processInventoryRefreshBatch(INVENTORY_CRON_BATCH_SIZE, {
    claimDeadlineAt,
    marketCode: manualOptions?.marketCode,
  });
  const run = summarizeInventoryRefreshRun({
    ...enqueueSummary,
    results: batch.results,
    stoppedByDeadline: batch.stoppedByDeadline,
  });

  if (run.affectedProductSlugs.length > 0) {
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/products/[slug]", "page");
    revalidatePath("/concerns");
    revalidatePath("/concerns/[slug]", "page");
    revalidatePath("/share");
    revalidateTag("catalogue", { expire: 0 });
    for (const slug of run.affectedProductSlugs) {
      revalidatePath(`/products/${slug}`);
      revalidatePath(`/share/${slug}`);
    }
  } else {
    // Even when no offers were refreshed in this run, the database may have
    // been updated externally (e.g. price corrections). Revalidate the shared
    // catalogue tag and all product/share paths so stale ISR results do not
    // persist until the natural revalidate window expires.
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/products/[slug]", "page");
    revalidatePath("/concerns");
    revalidatePath("/concerns/[slug]", "page");
    revalidatePath("/share");
    revalidateTag("catalogue", { expire: 0 });
  }

  const backlog = await getInventoryRefreshBacklogSummary();
  const staleOffers = await getStaleOfferCount();
  const backlogWithStale = { ...backlog, staleOffers };

  // Send an alert if the cron is failing or falling behind.
  await sendRefreshAlertIfNeeded(run, backlogWithStale);

  // Sync refreshed offers back to the static data file via GitHub API.
  // This is opt-in (requires STATIC_FILE_SYNC_ENABLED=true and GITHUB_TOKEN)
  // Updates automation refreshes and proposes typed terminal invalidations;
  // manual observations and exhausted transient failures are never changed.
  const syncConfiguration = staticFileSyncConfiguration();
  let staticFileSync: StaticFileSyncResult | null =
    syncConfiguration.status === "misconfigured"
      ? {
          synced: 0,
          invalidated: 0,
          skipped: 0,
          committed: false,
          commitSha: null,
          errors: [`static_file_sync_misconfigured:${syncConfiguration.issue}`],
        }
      : null;
  if (syncConfiguration.status === "ready") {
    const completedRefreshes = batch.results
      .filter(
        (
          result,
        ): result is typeof result & {
          retailer: string;
          verificationMethod: string;
          extractionConfidence: number;
          verifiedAt: string;
          verificationExpiresAt: string;
        } =>
          result.status === "completed" &&
          typeof result.retailer === "string" &&
          typeof result.verificationMethod === "string" &&
          typeof result.extractionConfidence === "number" &&
          typeof result.verifiedAt === "string" &&
          typeof result.verificationExpiresAt === "string",
      )
      .map((result) => ({
        productSlug: result.productSlug,
        retailer: result.retailer,
        priceNgn: result.priceMinor ?? null,
        available:
          result.inventoryStatus === "in_stock" ||
          result.inventoryStatus === "low_stock",
        inventoryStatus: result.inventoryStatus ?? "unknown",
        lastVerifiedAt: new Date(result.verifiedAt),
        verificationExpiresAt: new Date(result.verificationExpiresAt),
        verificationMethod: result.verificationMethod,
        extractionConfidence: result.extractionConfidence,
      }));
    const terminalInvalidations = batch.results
      .filter(
        (
          result,
        ): result is typeof result & {
          retailer: string;
          terminalInvalidation: NonNullable<
            InventoryRefreshResult["terminalInvalidation"]
          >;
        } =>
          result.status === "deferred" &&
          typeof result.retailer === "string" &&
          result.terminalInvalidation != null,
      )
      .map((result) => ({
        productSlug: result.productSlug,
        retailer: result.retailer,
        invalidatedAt: new Date(result.terminalInvalidation.invalidatedAt),
        reason: result.terminalInvalidation.reason,
      }));
    if (completedRefreshes.length > 0 || terminalInvalidations.length > 0) {
      try {
        staticFileSync = await syncOffersToStaticFile({
          refreshedOffers: completedRefreshes,
          invalidatedOffers: terminalInvalidations,
          config: syncConfiguration.config,
        });
      } catch (error) {
        staticFileSync = {
          synced: 0,
          invalidated: 0,
          skipped: 0,
          committed: false,
          commitSha: null,
          errors: [
            `static_file_sync_failed: ${error instanceof Error ? error.message : "unknown"}`,
          ],
        };
      }
    }
  }

  if (staticFileSync?.errors.length) {
    console.warn(
      JSON.stringify({
        event: "inventory_static_file_sync_failed",
        reasons: staticFileSync.errors.map((error) => error.split(":", 1)[0]),
      }),
    );
  }

  const summary = {
    run,
    backlog: backlogWithStale,
    capacity: inventoryRefreshCapacity(),
    staticFileSync,
    ...(manualOptions
      ? {
          manualRefresh: {
            mode: manualOptions.mode,
            marketCode: manualOptions.marketCode,
            cutoff: manualOptions.cutoff.toISOString(),
            seed: manualSeed,
            results: manualRefreshResults(batch.results),
          },
        }
      : {}),
  };

  console.info(
    JSON.stringify({ event: "inventory_refresh_cron_completed", ...summary }),
  );
  return Response.json(summary);
}

export async function GET(request: Request) {
  return runInventoryRefresh(request);
}

export async function POST(request: Request) {
  let manualOptions: ManualInventoryRefreshOptions;
  try {
    manualOptions = parseManualInventoryRefreshOptions(request);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Manual inventory refresh request is invalid.",
      },
      { status: 400 },
    );
  }
  return runInventoryRefresh(request, manualOptions);
}
