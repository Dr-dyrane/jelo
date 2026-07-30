import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canClaimInventoryRefreshJob,
  INVENTORY_CRON_CLAIM_BUDGET_MS,
  INVENTORY_REFRESH_LEASE_MS,
  summarizeInventoryRefreshRun,
} from '@/lib/inventory/refresh-policy';

test('the cron claim deadline is absolute and leaves bounded settlement room', () => {
  const requestStartedAt = 1_000_000;
  const deadline = requestStartedAt + INVENTORY_CRON_CLAIM_BUDGET_MS;

  assert.equal(canClaimInventoryRefreshJob(undefined, deadline + 1), true);
  assert.equal(canClaimInventoryRefreshJob(deadline, deadline - 1), true);
  assert.equal(canClaimInventoryRefreshJob(deadline, deadline), false);
  assert.equal(canClaimInventoryRefreshJob(deadline, deadline + 1), false);
  assert.ok(INVENTORY_CRON_CLAIM_BUDGET_MS + 12_000 < 300_000);
  assert.ok(INVENTORY_REFRESH_LEASE_MS > 12_000);
});

test('the structured run summary separates retry and terminal outcomes', () => {
  const summary = summarizeInventoryRefreshRun({
    queued: 3,
    withdrawn: 1,
    stoppedByDeadline: true,
    results: [
      {
        status: 'completed',
        productSlug: 'zinc-cleanser',
        recoveredLease: false,
      },
      {
        status: 'completed',
        productSlug: 'alpha-serum',
        recoveredLease: true,
      },
      {
        status: 'completed',
        productSlug: 'alpha-serum',
        recoveredLease: false,
      },
      {
        status: 'retrying',
        productSlug: 'retry-toner',
        recoveredLease: false,
      },
      {
        status: 'failed',
        productSlug: 'failed-lotion',
        recoveredLease: true,
      },
      {
        status: 'discarded',
        productSlug: 'withdrawn-cream',
        recoveredLease: false,
      },
    ],
  });

  assert.deepEqual(summary, {
    queued: 3,
    withdrawn: 1,
    processed: 6,
    completed: 3,
    retrying: 1,
    failed: 1,
    discarded: 1,
    recoveredLeases: 2,
    stoppedByDeadline: true,
    affectedProductSlugs: ['alpha-serum', 'zinc-cleanser'],
  });
});
