import { revalidatePath, revalidateTag } from "next/cache";
import { getPostgresClient } from "@/lib/db/postgres";
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
  readInventoryRefreshReportingSnapshot,
  type InventoryCronFailurePhase,
  summarizeInventoryCronFailure,
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
  normalizeStaticOfferUrl,
  syncOffersToStaticFile,
  type StaticFileSyncResult,
} from "@/lib/inventory/static-file-sync";
import {
  recordScheduledOwnerCompleted,
  recordScheduledOwnerFailed,
  recordScheduledOwnerStarted,
} from "@/lib/market-truth/scheduled-owner-receipts";
import type { ScheduledOwnerOutcomeCode } from "@/lib/market-truth/types";

export const runtime = "nodejs";
export const maxDuration = 300;

type StaticSyncOfferIdentity = {
  offerId: string;
  productSlug: string;
  retailer: string;
  requestedUrl: string;
  marketCode: string;
  currencyCode: string;
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

async function readStaticSyncOfferIdentities(
  offerIds: readonly string[],
): Promise<Map<string, StaticSyncOfferIdentity>> {
  const uniqueOfferIds = [...new Set(offerIds.filter(Boolean))];
  if (uniqueOfferIds.length === 0) return new Map();

  const sql = getPostgresClient();
  const rows = await sql<
    {
      offer_id: string;
      product_slug: string;
      retailer: string;
      requested_url: string;
      market_code: string;
      currency_code: string | null;
    }[]
  >`
    select
      o.id::text as offer_id,
      p.slug as product_slug,
      r.name as retailer,
      o.url as requested_url,
      o.market_code,
      o.currency_code
    from offers o
    join products p on p.id = o.product_id
    join retailers r on r.id = o.retailer_id
    where o.id::text in ${sql(uniqueOfferIds)}
      and p.is_published = true
      and o.match_kind = 'exact'
      and o.url ~* '^https://'
  `;

  return new Map(
    rows.map((row) => [
      row.offer_id,
      {
        offerId: row.offer_id,
        productSlug: row.product_slug,
        retailer: row.retailer,
        requestedUrl:
          normalizeStaticOfferUrl(row.requested_url) ?? row.requested_url,
        marketCode: row.market_code,
        currencyCode: row.currency_code ?? "",
      },
    ]),
  );
}

function boundedInventoryCronError(error: unknown) {
  const name = error instanceof Error ? error.name : "UnknownError";
  const message = error instanceof Error ? error.message : String(error);
  return { name, message: message.slice(0, 1_000) };
}

function inventoryCronFailureResponse(input: {
  phase: InventoryCronFailurePhase;
  requestStartedAt: number;
  error: unknown;
}) {
  const failure = summarizeInventoryCronFailure(input);
  console.error(
    JSON.stringify({
      event: "inventory_refresh_cron_failed",
      ...failure,
      error: boundedInventoryCronError(input.error),
    }),
  );
  return Response.json(
    { failure, capacity: inventoryRefreshCapacity() },
    { status: 503 },
  );
}

async function recordInventoryReceiptStarted(startedAt: string) {
  try {
    await recordScheduledOwnerStarted({
      owner: "inventory-refresh",
      startedAt,
    });
    return true;
  } catch {
    console.error(
      JSON.stringify({
        event: "market_truth_receipt_write_failed",
        owner: "inventory-refresh",
        phase: "started",
      }),
    );
    return false;
  }
}

async function recordInventoryReceiptFailed(
  startedAt: string,
  receiptStarted: boolean,
) {
  if (!receiptStarted) return false;
  try {
    await recordScheduledOwnerFailed({
      owner: "inventory-refresh",
      startedAt,
      failedAt: new Date().toISOString(),
      outcomeCode: "unexpected-failure",
    });
    return true;
  } catch {
    console.error(
      JSON.stringify({
        event: "market_truth_receipt_write_failed",
        owner: "inventory-refresh",
        phase: "failed",
      }),
    );
    return false;
  }
}

async function recordInventoryReceiptCompleted(input: {
  startedAt: string;
  receiptStarted: boolean;
  outcomeCode: ScheduledOwnerOutcomeCode;
  counts: Record<string, number>;
}) {
  if (!input.receiptStarted) return false;
  try {
    await recordScheduledOwnerCompleted({
      owner: "inventory-refresh",
      startedAt: input.startedAt,
      completedAt: new Date().toISOString(),
      outcomeCode: input.outcomeCode,
      counts: input.counts,
    });
    return true;
  } catch {
    console.error(
      JSON.stringify({
        event: "market_truth_receipt_write_failed",
        owner: "inventory-refresh",
        phase: "completed",
      }),
    );
    return false;
  }
}

export async function GET(request: Request) {
  const requestStartedAt = Date.now();
  const receiptStartedAt = new Date(requestStartedAt).toISOString();
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
    try {
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
    } catch (error) {
      return inventoryCronFailureResponse({
        phase: "dry_run",
        requestStartedAt,
        error,
      });
    }
  }

  const receiptStarted = await recordInventoryReceiptStarted(receiptStartedAt);
  if (!receiptStarted) {
    return inventoryCronFailureResponse({
      phase: "receipt",
      requestStartedAt,
      error: new Error("market_truth_receipt_start_failed"),
    });
  }
  let failurePhase: InventoryCronFailurePhase = "preflight";
  try {
    // Warm the single shared production browser before any offer receives a
    // processing lease. A cold pack download or extraction therefore cannot
    // consume the per-offer evidence budget or strand browser contexts.
    await prepareBrowserFetchRuntime();

    failurePhase = "run";
    const claimDeadlineAt = requestStartedAt + INVENTORY_CRON_CLAIM_BUDGET_MS;
    const enqueue = await enqueueDueInventoryOffers(
      INVENTORY_CRON_BATCH_SIZE,
      INVENTORY_CRON_LOOKAHEAD_HOURS,
    );

    const batch = await processInventoryRefreshBatch(
      INVENTORY_CRON_BATCH_SIZE,
      { claimDeadlineAt },
    );
    const run = summarizeInventoryRefreshRun({
      ...enqueue,
      results: batch.results,
      stoppedByDeadline: batch.stoppedByDeadline,
    });

    failurePhase = "projection";
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/products/[slug]", "page");
    revalidatePath("/concerns");
    revalidatePath("/concerns/[slug]", "page");
    revalidatePath("/share");
    revalidatePath("/retailers");
    revalidatePath("/retailers/[slug]", "page");
    revalidatePath("/lagos");
    revalidateTag("catalogue", { expire: 0 });
    if (run.affectedProductSlugs.length > 0) {
      for (const slug of run.affectedProductSlugs) {
        revalidatePath(`/products/${slug}`);
        revalidatePath(`/share/${slug}`);
      }
    }

    failurePhase = "reporting";
    const backlogWithStale = await readInventoryRefreshReportingSnapshot({
      readBacklog: getInventoryRefreshBacklogSummary,
      readStaleOfferCount: getStaleOfferCount,
    });

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
            errors: [
              `static_file_sync_misconfigured:${syncConfiguration.issue}`,
            ],
          }
        : null;
    if (syncConfiguration.status === "ready") {
      const staticSyncCandidates = batch.results.filter(
        (result) =>
          result.status === "completed" || result.terminalInvalidation != null,
      );
      try {
        const identityByOfferId = await readStaticSyncOfferIdentities(
          staticSyncCandidates.map((result) => result.offerId),
        );
        const identityErrors: string[] = [];
        const exactIdentity = (result: InventoryRefreshResult) => {
          const identity = identityByOfferId.get(result.offerId);
          const requestedUrl = normalizeStaticOfferUrl(result.requestedUrl);
          if (
            !identity ||
            identity.productSlug !== result.productSlug ||
            identity.retailer !== result.retailer ||
            !requestedUrl ||
            identity.requestedUrl !== requestedUrl ||
            identity.marketCode !== result.marketCode ||
            (result.currencyCode != null &&
              identity.currencyCode !== result.currencyCode)
          ) {
            identityErrors.push(
              `static_file_sync_offer_identity_not_found:${result.offerId}`,
            );
            return null;
          }
          return identity;
        };

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
          .flatMap((result) => {
            const identity = exactIdentity(result);
            return identity
              ? [
                  {
                    ...identity,
                    priceNgn: result.priceMinor ?? null,
                    available:
                      result.inventoryStatus === "in_stock" ||
                      result.inventoryStatus === "low_stock",
                    inventoryStatus: result.inventoryStatus ?? "unknown",
                    lastVerifiedAt: new Date(result.verifiedAt),
                    verificationExpiresAt: new Date(
                      result.verificationExpiresAt,
                    ),
                    verificationMethod: result.verificationMethod,
                    extractionConfidence: result.extractionConfidence,
                  },
                ]
              : [];
          });
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
          .flatMap((result) => {
            const identity = exactIdentity(result);
            return identity
              ? [
                  {
                    ...identity,
                    invalidatedAt: new Date(
                      result.terminalInvalidation.invalidatedAt,
                    ),
                    reason: result.terminalInvalidation.reason,
                  },
                ]
              : [];
          });
        if (completedRefreshes.length > 0 || terminalInvalidations.length > 0) {
          staticFileSync = await syncOffersToStaticFile({
            refreshedOffers: completedRefreshes,
            invalidatedOffers: terminalInvalidations,
            config: syncConfiguration.config,
          });
          staticFileSync.skipped += identityErrors.length;
          staticFileSync.errors.unshift(...identityErrors);
        } else if (identityErrors.length > 0) {
          staticFileSync = {
            synced: 0,
            invalidated: 0,
            skipped: identityErrors.length,
            committed: false,
            commitSha: null,
            errors: identityErrors,
          };
        }
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

    if (staticFileSync?.errors.length) {
      console.warn(
        JSON.stringify({
          event: "inventory_static_file_sync_failed",
          reasons: staticFileSync.errors.map((error) => error.split(":", 1)[0]),
        }),
      );
    }

    const hasExceptions =
      run.retrying > 0 ||
      run.deferred > 0 ||
      run.failed > 0 ||
      run.discarded > 0 ||
      run.stoppedByDeadline ||
      Boolean(staticFileSync?.errors.length);
    const outcomeCode: ScheduledOwnerOutcomeCode = hasExceptions
      ? "completed-with-exceptions"
      : run.processed === 0 && run.queued === 0
        ? "no-due-work"
        : "completed";
    const receiptRecorded = await recordInventoryReceiptCompleted({
      startedAt: receiptStartedAt,
      receiptStarted,
      outcomeCode,
      counts: {
        queued: run.queued,
        withdrawn: run.withdrawn,
        processed: run.processed,
        completed: run.completed,
        retrying: run.retrying,
        deferred: run.deferred,
        failed: run.failed,
        discarded: run.discarded,
        due: backlogWithStale.due,
        staleOffers: backlogWithStale.staleOffers,
      },
    });
    const summary = {
      run,
      backlog: backlogWithStale,
      capacity: inventoryRefreshCapacity(),
      staticFileSync,
      receipt: {
        recorded: receiptRecorded,
        outcomeCode,
      },
    };

    console.info(
      JSON.stringify({ event: "inventory_refresh_cron_completed", ...summary }),
    );
    return Response.json(summary, { status: receiptRecorded ? 200 : 503 });
  } catch (error) {
    await recordInventoryReceiptFailed(receiptStartedAt, receiptStarted);
    return inventoryCronFailureResponse({
      phase: failurePhase,
      requestStartedAt,
      error,
    });
  }
}
