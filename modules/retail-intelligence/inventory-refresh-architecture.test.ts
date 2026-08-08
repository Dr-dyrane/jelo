import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const repository = readFileSync(resolve(root, 'lib/inventory/repository.ts'), 'utf8');
const worker = readFileSync(resolve(root, 'lib/inventory/refresh-worker.ts'), 'utf8');
const route = readFileSync(resolve(root, 'app/api/cron/inventory/route.ts'), 'utf8');
const workerScript = readFileSync(resolve(root, 'scripts/process-inventory-refresh.ts'), 'utf8');
const vercel = JSON.parse(
  readFileSync(resolve(root, 'vercel.json'), 'utf8'),
) as { crons?: Array<{ path: string; schedule: string }> };

test('one Vercel cron feeds the existing Neon inventory queue', () => {
  const inventoryCrons = vercel.crons?.filter(cron => cron.path === '/api/cron/inventory');
  assert.deepEqual(inventoryCrons, [{
    path: '/api/cron/inventory',
    schedule: '17 4 * * *',
  }]);
  assert.match(route, /const batchSize = 100/);
  assert.match(route, /enqueueDueInventoryOffers\(batchSize\)/);
  assert.match(route, /processInventoryRefreshBatch\(batchSize, \{ claimDeadlineAt \}\)/);
  assert.doesNotMatch(route, /insert\s+into\s+inventory_refresh_jobs/i);
});

test('runtime enqueue and claim both require a published exact HTTPS offer', () => {
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

test('manual workers can scope every claim-side mutation to one market', () => {
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
  assert.match(workerScript, /parseInventoryWorkerOptions\(process\.argv\.slice\(2\)\)/);
  assert.match(workerScript, /marketCode: options\.market/);
});

test('claims recover only expired bounded leases and terminal-set exhausted work', () => {
  assert.match(
    worker,
    /j\.status = 'processing'[\s\S]*j\.attempt_count < \$\{MAX_ATTEMPTS\}[\s\S]*j\.started_at <= now\(\) - \(\$\{INVENTORY_REFRESH_LEASE_MS\}/,
  );
  assert.match(
    worker,
    /exhausted_candidate as \([\s\S]*j\.attempt_count >= \$\{MAX_ATTEMPTS\}[\s\S]*exhausted as \([\s\S]*set status = 'failed'/,
  );
  assert.match(worker, /for update of j skip locked/);
  assert.match(
    worker,
    /set status = 'processing', attempt_count = j\.attempt_count \+ 1,[\s\S]*started_at = now\(\)/,
  );
});

test('completion and failure settle only the current claim generation', () => {
  const lockIndex = worker.indexOf('async function lockCurrentClaim');
  const offerUpdateIndex = worker.indexOf('update offers o');
  const historyInsertIndex = worker.indexOf('insert into offer_price_history');
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
  const guardedSettlements = worker.match(
    /status = 'processing'[\s\S]{0,180}attempt_count = \$\{job\.attempt_count\}/g,
  )?.length ?? 0;
  assert.ok(guardedSettlements >= 3);
  assert.match(worker, /claim\.current_url !== job\.url[\s\S]*set status = 'queued'/);
  assert.match(
    worker,
    /extract\(epoch from o\.updated_at\)::text as offer_version[\s\S]*extract\(epoch from o\.updated_at\)::text as current_offer_version/,
  );
  assert.match(
    worker,
    /claim\.current_offer_version !== job\.offer_version[\s\S]*set status = 'queued'/,
  );
  assert.match(worker, /Inventory refresh claim was superseded before completion/);
  assert.match(worker, /Inventory refresh claim was superseded before failure settlement/);
});

test('the cron stops claims before maxDuration and invalidates only after success', () => {
  assert.match(route, /export const maxDuration = 300/);
  assert.match(
    route,
    /requestStartedAt \+ INVENTORY_CRON_CLAIM_BUDGET_MS/,
  );
  assert.match(route, /if \(run\.affectedProductSlugs\.length > 0\)/);
  for (const path of [
    "revalidatePath('/')",
    "revalidatePath('/products')",
    "revalidatePath('/products/[slug]', 'page')",
    "revalidatePath('/concerns')",
    "revalidatePath('/concerns/[slug]', 'page')",
    "revalidatePath('/share')",
    'revalidatePath(`/products/${slug}`)',
    'revalidatePath(`/share/${slug}`)',
  ]) {
    assert.ok(route.includes(path), `missing inventory revalidation: ${path}`);
  }
  assert.match(route, /getInventoryRefreshBacklogSummary\(\)/);
  assert.match(route, /event: 'inventory_refresh_cron_completed'/);
  assert.match(route, /return Response\.json\(summary\)/);
});

test('the refresh worker tries the Woo Store API before HTML scraping', () => {
  assert.match(worker, /WOO_API_HOSTS/);
  assert.match(worker, /fetchWooStoreApi/);
  assert.match(worker, /await fetchWooStoreApi\(job\.url\) \?\? await fetchRetailerPage\(job\.url\)/);
  assert.match(worker, /wp-json\/wc\/store\/v1\/products\?slug=/);
});

test('the refresh worker skips Jumia offers that block server-side fetch', () => {
  assert.match(worker, /BLOCKED_HOSTS/);
  assert.match(worker, /jumia\.com\.ng/);
  assert.match(worker, /isBlockedHost\(job\.url\)/);
  assert.match(worker, /Retailer host blocks server-side fetch/);
});

test('all Woo retailers in the extraction adapters have a matching Woo API host', () => {
  const wooAdapterHosts = [
    'beautybydaz.com', 'luxbeautyng.com', 'teeka4.com', 'peronabeauty.com',
    'buybetter.ng', 'deoset.com', 'rhemabeautyshop.com', 'tosnigeria.com',
    'thebeautyprismng.com', 'sonavinebeauty.com', 'kadimezessentials.com',
    'dunescenter.com', 'sliquebeautylimited.com',
  ];
  for (const host of wooAdapterHosts) {
    assert.ok(worker.includes(`'${host}'`), `missing Woo API host entry for ${host}`);
  }
});
