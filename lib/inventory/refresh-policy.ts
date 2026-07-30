export const INVENTORY_REFRESH_LEASE_MS = 2 * 60 * 1000;
export const INVENTORY_CRON_CLAIM_BUDGET_MS = 270 * 1000;

export type InventoryRefreshRunStatus =
  | 'completed'
  | 'retrying'
  | 'failed'
  | 'discarded';

type InventoryRefreshRunItem = {
  status: InventoryRefreshRunStatus;
  productSlug: string;
  recoveredLease: boolean;
};

export function canClaimInventoryRefreshJob(
  claimDeadlineAt: number | undefined,
  now = Date.now(),
) {
  return claimDeadlineAt == null || now < claimDeadlineAt;
}

export function summarizeInventoryRefreshRun(input: {
  queued: number;
  withdrawn: number;
  results: readonly InventoryRefreshRunItem[];
  stoppedByDeadline: boolean;
}) {
  const affectedProductSlugs = [...new Set(
    input.results
      .filter(result => result.status === 'completed')
      .map(result => result.productSlug),
  )].sort();

  return {
    queued: input.queued,
    withdrawn: input.withdrawn,
    processed: input.results.length,
    completed: input.results.filter(result => result.status === 'completed').length,
    retrying: input.results.filter(result => result.status === 'retrying').length,
    failed: input.results.filter(result => result.status === 'failed').length,
    discarded: input.results.filter(result => result.status === 'discarded').length,
    recoveredLeases: input.results.filter(result => result.recoveredLease).length,
    stoppedByDeadline: input.stoppedByDeadline,
    affectedProductSlugs,
  };
}
