import { revalidatePath, revalidateTag } from "next/cache";
import {
  enqueueDueInventoryOffers,
  getInventoryRefreshBacklogSummary,
  getStaleOfferCount,
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
import { prepareBrowserFetchRuntime } from "@/lib/inventory/browser-fetch";
import { sendRefreshAlertIfNeeded } from "@/lib/inventory/refresh-alerting";
import { isAuthorizedCronRequest } from "@/modules/retail-intelligence/cron-auth";
import {
  staticFileSyncConfiguration,
  syncOffersToStaticFile,
  type StaticFileSyncResult,
} from "@/lib/inventory/static-file-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

function inventoryRefreshCapacity() {
  return {
    scheduledRunsPerDay: INVENTORY_CRON_RUNS_PER_DAY,
    batchAttemptLimit: INVENTORY_CRON_BATCH_SIZE,
    attemptSlotsPerDay: INVENTORY_CRON_RUNS_PER_DAY * INVENTORY_CRON_BATCH_SIZE,
    targetFreshnessHours: INVENTORY_REFRESH_FRESHNESS_MS / (60 * 60 * 1000),
    enqueueLookaheadHours: INVENTORY_CRON_LOOKAHEAD_HOURS,
  };
}

export async function GET(request: Request) {
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

  // Warm the single shared production browser before any offer receives a
  // processing lease. A cold pack download or extraction therefore cannot
  // consume the per-offer evidence budget or strand browser contexts.
  await prepareBrowserFetchRuntime();

  const claimDeadlineAt = requestStartedAt + INVENTORY_CRON_CLAIM_BUDGET_MS;
  const enqueue = await enqueueDueInventoryOffers(
    INVENTORY_CRON_BATCH_SIZE,
    INVENTORY_CRON_LOOKAHEAD_HOURS,
  );

  const batch = await processInventoryRefreshBatch(INVENTORY_CRON_BATCH_SIZE, {
    claimDeadlineAt,
  });
  const run = summarizeInventoryRefreshRun({
    ...enqueue,
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
  };

  console.info(
    JSON.stringify({ event: "inventory_refresh_cron_completed", ...summary }),
  );
  return Response.json(summary);
}
