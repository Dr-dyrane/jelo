import { revalidatePath, revalidateTag } from "next/cache";
import {
  enqueueDueInventoryOffers,
  getInventoryRefreshBacklogSummary,
  getStaleOfferCount,
} from "@/lib/inventory/repository";
import {
  INVENTORY_CRON_CLAIM_BUDGET_MS,
  summarizeInventoryRefreshRun,
} from "@/lib/inventory/refresh-policy";
import { processInventoryRefreshBatch } from "@/lib/inventory/refresh-worker";
import { sendRefreshAlertIfNeeded } from "@/lib/inventory/refresh-alerting";
import { isAuthorizedCronRequest } from "@/modules/retail-intelligence/cron-auth";
import {
  staticFileSyncConfig,
  syncOffersToStaticFile,
} from "@/lib/inventory/static-file-sync";

export const runtime = "nodejs";
export const maxDuration = 300;
const batchSize = 100;

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

  // Dry-run mode: enqueue due offers and report the backlog without fetching
  // retailer pages or writing to the database. Useful for local testing and
  // for verifying that the cron is wired up correctly.
  const dryRun = new URL(request.url).searchParams.has("dry-run");

  const claimDeadlineAt = requestStartedAt + INVENTORY_CRON_CLAIM_BUDGET_MS;
  const enqueue = await enqueueDueInventoryOffers(batchSize);

  if (dryRun) {
    const backlog = await getInventoryRefreshBacklogSummary();
    const summary = { dryRun: true, enqueue, backlog };
    console.info(
      JSON.stringify({ event: "inventory_refresh_cron_dry_run", ...summary }),
    );
    return Response.json(summary);
  }

  const batch = await processInventoryRefreshBatch(batchSize, {
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
    // catalogue tag so stale ISR results do not persist until the natural
    // revalidate window expires.
    revalidateTag("catalogue", { expire: 0 });
  }

  const backlog = await getInventoryRefreshBacklogSummary();
  const staleOffers = await getStaleOfferCount();
  const backlogWithStale = { ...backlog, staleOffers };

  // Send an alert if the cron is failing or falling behind.
  await sendRefreshAlertIfNeeded(run, backlogWithStale);

  // Sync refreshed offers back to the static data file via GitHub API.
  // This is opt-in (requires STATIC_FILE_SYNC_ENABLED=true and GITHUB_TOKEN)
  // and only updates offers refreshed by automation — never manual ones.
  let staticFileSync = null;
  if (staticFileSyncConfig()) {
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
    if (completedRefreshes.length > 0) {
      try {
        staticFileSync = await syncOffersToStaticFile({
          refreshedOffers: completedRefreshes,
        });
      } catch (error) {
        staticFileSync = {
          synced: 0,
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

  const summary = { run, backlog: backlogWithStale, staticFileSync };

  console.info(
    JSON.stringify({ event: "inventory_refresh_cron_completed", ...summary }),
  );
  return Response.json(summary);
}
