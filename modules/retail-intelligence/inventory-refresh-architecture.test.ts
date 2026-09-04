import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { verifiedRetailOffers } from "@/data/retail-offers";
import {
  INVENTORY_CRON_BATCH_SIZE,
  INVENTORY_CRON_LOOKAHEAD_HOURS,
  INVENTORY_CRON_RUNS_PER_DAY,
  INVENTORY_DEFERRED_RECHECK_MS,
  INVENTORY_REFRESH_FRESHNESS_MS,
} from "@/lib/inventory/refresh-policy";

const root = process.cwd();
const repository = readFileSync(
  resolve(root, "lib/inventory/repository.ts"),
  "utf8",
);
const worker = readFileSync(
  resolve(root, "lib/inventory/refresh-worker.ts"),
  "utf8",
);
const route = readFileSync(
  resolve(root, "app/api/cron/inventory/route.ts"),
  "utf8",
);
const healthRoute = readFileSync(
  resolve(root, "app/api/cron/inventory-health/route.ts"),
  "utf8",
);
const staticIntegrationWorkflow = readFileSync(
  resolve(root, ".github/workflows/inventory-static-integration.yml"),
  "utf8",
);
const workerScript = readFileSync(
  resolve(root, "scripts/process-inventory-refresh.ts"),
  "utf8",
);
const vercel = JSON.parse(
  readFileSync(resolve(root, "vercel.json"), "utf8"),
) as { crons?: Array<{ path: string; schedule: string }> };

test("one hourly Vercel cron has three-pass daily capacity for the exact offer set", () => {
  const inventoryCrons = vercel.crons?.filter(
    (cron) => cron.path === "/api/cron/inventory",
  );
  assert.deepEqual(inventoryCrons, [
    {
      path: "/api/cron/inventory",
      schedule: "17 * * * *",
    },
  ]);
  assert.equal(INVENTORY_CRON_RUNS_PER_DAY, 24);
  assert.equal(INVENTORY_CRON_BATCH_SIZE, 100);
  assert.equal(INVENTORY_CRON_LOOKAHEAD_HOURS, 1);
  assert.equal(INVENTORY_REFRESH_FRESHNESS_MS, 24 * 60 * 60 * 1000);
  const exactOfferCount = Object.values(verifiedRetailOffers).flat().length;
  assert.ok(
    INVENTORY_CRON_RUNS_PER_DAY * INVENTORY_CRON_BATCH_SIZE >=
      exactOfferCount * 3,
    `Daily capacity must retain three attempt slots per exact offer; found ${exactOfferCount} offers`,
  );
  assert.match(
    route,
    /enqueueDueInventoryOffers\(\s*INVENTORY_CRON_BATCH_SIZE,\s*INVENTORY_CRON_LOOKAHEAD_HOURS,?\s*\)/,
  );
  assert.match(
    route,
    /processInventoryRefreshBatch\(INVENTORY_CRON_BATCH_SIZE,\s*\{[\s\S]*claimDeadlineAt[\s\S]*\}\)/,
  );
  assert.match(route, /attemptSlotsPerDay/);
  assert.match(route, /targetFreshnessHours/);
  assert.doesNotMatch(route, /insert\s+into\s+inventory_refresh_jobs/i);
});

test("runtime enqueue and claim both require a published exact HTTPS offer", () => {
  assert.match(
    repository,
    /candidates as \([\s\S]*join products p on p\.id = o\.product_id[\s\S]*p\.is_published = true[\s\S]*o\.match_kind = 'exact'[\s\S]*o\.url ~\* '\^https:\/\/'/,
  );
  assert.match(
    repository,
    /withdrawn as \([\s\S]*job\.status in \('queued', 'processing'\)[\s\S]*p\.is_published = false[\s\S]*o\.match_kind <> 'exact'[\s\S]*o\.url !~\* '\^https:\/\/'/,
  );
  assert.match(
    worker,
    /candidate as \([\s\S]*join offers o on o\.id = j\.offer_id[\s\S]*join products p on p\.id = o\.product_id[\s\S]*p\.is_published = true[\s\S]*o\.match_kind = 'exact'[\s\S]*o\.url ~\* '\^https:\/\/'/,
  );
});

test("runtime enqueue skips active jobs before limiting candidates", () => {
  const candidatesStart = repository.indexOf("), candidates as (");
  const insertedStart = repository.indexOf("), inserted as (", candidatesStart);
  assert.ok(candidatesStart >= 0 && insertedStart > candidatesStart);

  const candidates = repository.slice(candidatesStart, insertedStart);
  assert.match(
    candidates,
    /not exists \([\s\S]*from inventory_refresh_jobs active_job[\s\S]*active_job\.offer_id = o\.id[\s\S]*active_job\.status in \('queued', 'processing'\)/,
  );
  assert.ok(candidates.indexOf("not exists") < candidates.indexOf("order by"));
  assert.ok(candidates.indexOf("order by") < candidates.indexOf("limit"));
  assert.doesNotMatch(repository, /rescheduled as \(/);
  assert.doesNotMatch(
    repository,
    /set next_attempt_at = now\(\)[\s\S]*from candidates/,
  );
});

test("manual workers can scope every claim-side mutation to one market", () => {
  assert.match(
    worker,
    /exhausted_candidate as \([\s\S]*join offers o on o\.id = j\.offer_id[\s\S]*o\.market_code = \$\{marketCode \?\? null\}/,
  );
  assert.match(
    worker,
    /candidate as \([\s\S]*o\.market_code = \$\{marketCode \?\? null\}/,
  );
  assert.match(worker, /claim\.current_market_code !== job\.market_code/);
  assert.match(worker, /o\.market_code = \$\{job\.market_code\}/);
  assert.match(
    workerScript,
    /parseInventoryWorkerOptions\(process\.argv\.slice\(2\)\)/,
  );
  assert.match(workerScript, /marketCode: options\.market/);
});

test("claims recover expired leases and defer exhausted work for daily recheck", () => {
  assert.match(
    worker,
    /j\.status = 'processing'[\s\S]*j\.attempt_count < \$\{MAX_ATTEMPTS\}[\s\S]*j\.started_at <= now\(\) - \(\$\{INVENTORY_REFRESH_LEASE_MS\}/,
  );
  assert.match(
    worker,
    /exhausted_candidate as \([\s\S]*j\.attempt_count >= \$\{MAX_ATTEMPTS\}[\s\S]*exhausted as \([\s\S]*set status = 'queued'[\s\S]*INVENTORY_DEFERRED_RECHECK_MS/,
  );
  assert.equal(INVENTORY_DEFERRED_RECHECK_MS, 24 * 60 * 60 * 1000);
  assert.match(worker, /for update of j skip locked/);
  assert.match(
    worker,
    /set status = 'processing', attempt_count = j\.attempt_count \+ 1,[\s\S]*started_at = now\(\)/,
  );
});

test("completion and failure settle only the current claim generation", () => {
  const lockIndex = worker.indexOf("async function lockCurrentClaim");
  const offerUpdateIndex = worker.indexOf("update offers o");
  const historyInsertIndex = worker.indexOf("insert into offer_price_history");
  assert.ok(lockIndex >= 0 && lockIndex < offerUpdateIndex);
  assert.ok(offerUpdateIndex < historyInsertIndex);

  assert.match(
    worker,
    /j\.status = 'processing'[\s\S]*j\.attempt_count = \$\{job\.attempt_count\}[\s\S]*for update of j, o, p/,
  );
  assert.match(
    worker,
    /where o\.id = \$\{job\.offer_id\}[\s\S]*o\.url = \$\{job\.url\}[\s\S]*o\.updated_at\)::text = \$\{job\.offer_version\}[\s\S]*o\.match_kind = 'exact'[\s\S]*p\.is_published = true/,
  );
  const guardedSettlements =
    worker.match(
      /status = 'processing'[\s\S]{0,180}attempt_count = \$\{job\.attempt_count\}/g,
    )?.length ?? 0;
  assert.ok(guardedSettlements >= 3);
  assert.match(
    worker,
    /claim\.current_url !== job\.url[\s\S]*set status = 'queued'/,
  );
  assert.match(
    worker,
    /extract\(epoch from o\.updated_at\)::text as offer_version[\s\S]*extract\(epoch from o\.updated_at\)::text as current_offer_version/,
  );
  assert.match(
    worker,
    /claim\.current_offer_version !== job\.offer_version[\s\S]*set status = 'queued'/,
  );
  assert.match(
    worker,
    /Inventory refresh claim was superseded before completion/,
  );
  assert.match(
    worker,
    /Inventory refresh claim was superseded before failure settlement/,
  );
});

test("the cron stops claims before maxDuration and invalidates only after success", () => {
  assert.match(route, /export const maxDuration = 300/);
  assert.match(route, /requestStartedAt \+ INVENTORY_CRON_CLAIM_BUDGET_MS/);
  assert.match(route, /if \(run\.affectedProductSlugs\.length > 0\)/);
  for (const path of [
    /revalidatePath\(['"]\/['"]\)/,
    /revalidatePath\(['"]\/products['"]\)/,
    /revalidatePath\(['"]\/products\/\[slug\]['"],\s*['"]page['"]\)/,
    /revalidatePath\(['"]\/concerns['"]\)/,
    /revalidatePath\(['"]\/concerns\/\[slug\]['"],\s*['"]page['"]\)/,
    /revalidatePath\(['"]\/share['"]\)/,
    /revalidatePath\(`\/products\/\$\{slug\}`\)/,
    /revalidatePath\(`\/share\/\$\{slug\}`\)/,
  ]) {
    assert.match(route, path, `missing inventory revalidation: ${path}`);
  }
  assert.match(route, /getInventoryRefreshBacklogSummary\(\)/);
  assert.match(route, /event: ['"]inventory_refresh_cron_completed['"]/);
  assert.match(route, /return Response\.json\(summary\)/);
});

test("the refresh worker tries the Woo Store API before HTML scraping", () => {
  assert.match(worker, /WOO_API_HOSTS/);
  assert.match(worker, /fetchWooStoreApi/);
  assert.match(
    worker,
    /await fetchWooStoreApi\(\s*job\.url,\s*extractionDeadlineAt,?\s*\)/,
  );
  assert.match(
    worker,
    /await fetchRetailerPage\(\s*job\.url,\s*extractionDeadlineAt,?\s*\)/,
  );
  assert.match(worker, /wp-json\/wc\/store\/v1\/products\?slug=/);
});

test("the refresh worker falls back to browser fetch for Jumia offers that block server-side fetch", () => {
  assert.match(worker, /BLOCKED_HOSTS/);
  assert.match(worker, /jumia\.com\.ng/);
  assert.match(worker, /isBlockedHost\(job\.url\)/);
  assert.match(worker, /fetchRetailerPageWithBrowser/);
  assert.match(worker, /isBrowserFetchAvailable/);
});

test("all Woo retailers in the extraction adapters have a matching Woo API host", () => {
  const wooAdapterHosts = [
    "beautybydaz.com",
    "luxbeautyng.com",
    "teeka4.com",
    "peronabeauty.com",
    "buybetter.ng",
    "deoset.com",
    "rhemabeautyshop.com",
    "tosnigeria.com",
    "thebeautyprismng.com",
    "sonavinebeauty.com",
    "kadimezessentials.com",
    "dunescenter.com",
    "sliquebeautylimited.com",
  ];
  for (const host of wooAdapterHosts) {
    assert.ok(worker.includes(host), `missing Woo API host entry for ${host}`);
  }
});

test("the cron dry-run returns before every write-capable operation", () => {
  assert.match(route, /dry-run/);
  assert.match(route, /searchParams\.has\(['"]dry-run['"]\)/);
  assert.match(route, /inventory_refresh_cron_dry_run/);
  assert.match(route, /writesPerformed: 0/);
  assert.match(route, /capacity: inventoryRefreshCapacity\(\)/);

  const dryRunStart = route.indexOf("if (dryRun)");
  const firstEnqueue = route.indexOf(
    "const enqueue = await enqueueDueInventoryOffers",
  );
  assert.ok(dryRunStart >= 0 && firstEnqueue > dryRunStart);
  const dryRunBranch = route.slice(dryRunStart, firstEnqueue);
  assert.match(dryRunBranch, /getInventoryRefreshBacklogSummary\(\)/);
  assert.match(dryRunBranch, /return Response\.json\(summary\)/);
  assert.doesNotMatch(
    dryRunBranch,
    /enqueueDueInventoryOffers|processInventoryRefreshBatch|revalidatePath|revalidateTag|sendRefreshAlertIfNeeded|syncOffersToStaticFile/,
  );
});

test("the production cron exposes no manual full-refresh mutation surface", () => {
  assert.doesNotMatch(route, /export async function POST/);
  assert.doesNotMatch(
    route,
    /seedManualInventoryRefreshRun|MANUAL_REFRESH_CONFIRMATION|manualRefresh/,
  );
});

test("the worker terminal-sets only proven scope contradictions", () => {
  assert.match(worker, /assertClassifiedInventoryRefreshScope\(\(\) =>/);
  assert.match(worker, /inventoryRefreshFailureSettlement\(\{/);
  assert.match(
    worker,
    /provenTerminalContradiction = decision\.invalidateOffer/,
  );
});

test("only proven contradictions expire persisted offers and enter static review", () => {
  assert.match(
    worker,
    /inventoryRefreshFailureSettlement\(\{[\s\S]*attemptCount: job\.attempt_count,[\s\S]*maxAttempts: MAX_ATTEMPTS/,
  );
  assert.match(
    worker,
    /invalidatedAt = provenTerminalContradiction \? new Date\(\) : undefined/,
  );
  assert.match(
    worker,
    /if \(invalidatedAt\) \{[\s\S]*update offers o[\s\S]*verification_expires_at = least\([\s\S]*coalesce\(o\.verification_expires_at, \$\{invalidatedAt\}\)[\s\S]*updated_at = \$\{invalidatedAt\}/,
  );
  assert.match(
    worker,
    /terminalInvalidation:[\s\S]*invalidatedAt\.toISOString\(\)/,
  );
  assert.match(
    worker,
    /if \(invalidatedAt\) \{[\s\S]*could not expire the offer and settle the job atomically/,
  );
  assert.match(
    route,
    /result\.status === ["']deferred["'][\s\S]*result\.terminalInvalidation != null/,
  );
  assert.match(route, /invalidatedOffers: terminalInvalidations/);
});

test("an independent scheduled watchdog is read-only and visibly fails on degraded health", () => {
  const healthCrons = vercel.crons?.filter(
    (cron) => cron.path === "/api/cron/inventory-health",
  );
  assert.deepEqual(healthCrons, [
    { path: "/api/cron/inventory-health", schedule: "7 * * * *" },
  ]);
  assert.match(healthRoute, /isAuthorizedCronRequest/);
  assert.match(healthRoute, /writesPerformed: 0/);
  assert.match(healthRoute, /inventory_health_watchdog_checked/);
  assert.match(healthRoute, /status === "healthy" \? 200 : 503/);
  assert.match(healthRoute, /INVENTORY_DEFERRED_RECHECK_ERROR_CODE/);
  assert.equal(
    healthRoute.match(
      /left\(last_error, char_length\(\$\{deferredErrorPrefix\}\)\) = \$\{deferredErrorPrefix\}/g,
    )?.length,
    2,
    "recent and total deferred counts must use only the typed daily marker",
  );
  assert.doesNotMatch(
    healthRoute,
    /enqueueDueInventoryOffers|processInventoryRefreshBatch|revalidatePath|revalidateTag|sendRefreshAlertIfNeeded|syncOffersToStaticFile/,
  );
  assert.doesNotMatch(healthRoute, /\b(insert|update|delete)\b/i);
});

test("static integration failures remain native workflow signals without issue publication", () => {
  assert.doesNotMatch(staticIntegrationWorkflow, /issues: write/);
  assert.doesNotMatch(staticIntegrationWorkflow, /report-failure:/);
  assert.doesNotMatch(staticIntegrationWorkflow, /gh issue/);
  assert.match(
    staticIntegrationWorkflow,
    /name: Integrate inventory static proposal/,
  );
  assert.match(staticIntegrationWorkflow, /npm run verify:release/);
});

test("the cron exposes static-sync configuration failures as bounded codes", () => {
  assert.match(route, /staticFileSyncConfiguration\(\)/);
  assert.match(
    route,
    /static_file_sync_misconfigured:\$\{syncConfiguration\.issue\}/,
  );
  assert.match(route, /event: ["']inventory_static_file_sync_failed["']/);
  assert.match(
    route,
    /reasons: staticFileSync\.errors\.map\(\(error\) => error\.split\(["']:["'], 1\)\[0\]\)/,
  );
});

test("the cron sends email alerts when offers defer or the backlog grows", () => {
  assert.match(route, /sendRefreshAlertIfNeeded/);
  const alerting = readFileSync(
    resolve(root, "lib/inventory/refresh-alerting.ts"),
    "utf8",
  );
  assert.match(alerting, /sendAlertEmail/);
  assert.match(alerting, /INVENTORY_ALERT_EMAIL/);
  assert.match(alerting, /hello@jelocare\.com/);
  assert.match(alerting, /inventory_refresh_deferred_rechecks/);
  assert.match(alerting, /inventory_refresh_failed_offers/);
  assert.match(alerting, /inventory_refresh_zero_completions/);
  assert.match(alerting, /inventory_refresh_backlog_growing/);
});

test("every successful refresh expires on the daily freshness boundary", () => {
  assert.match(worker, /INVENTORY_REFRESH_FRESHNESS_MS/);
  assert.doesNotMatch(worker, /const validityDays =/);
  assert.match(worker, /verification_expires_at = \$\{verificationExpiresAt\}/);
  assert.match(
    worker,
    /verificationExpiresAt: verificationExpiresAt\.toISOString\(\)/,
  );
});
