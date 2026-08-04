import { revalidatePath } from 'next/cache';
import {
  enqueueDueInventoryOffers,
  getInventoryRefreshBacklogSummary,
} from '@/lib/inventory/repository';
import {
  INVENTORY_CRON_CLAIM_BUDGET_MS,
  summarizeInventoryRefreshRun,
} from '@/lib/inventory/refresh-policy';
import { processInventoryRefreshBatch } from '@/lib/inventory/refresh-worker';
import { isAuthorizedCronRequest } from '@/modules/retail-intelligence/cron-auth';

export const runtime = 'nodejs';
export const maxDuration = 300;
const batchSize = 100;

export async function GET(request: Request) {
  const requestStartedAt = Date.now();
  if (!isAuthorizedCronRequest(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const claimDeadlineAt = requestStartedAt + INVENTORY_CRON_CLAIM_BUDGET_MS;
  const enqueue = await enqueueDueInventoryOffers(batchSize);
  const batch = await processInventoryRefreshBatch(batchSize, { claimDeadlineAt });
  const run = summarizeInventoryRefreshRun({
    ...enqueue,
    results: batch.results,
    stoppedByDeadline: batch.stoppedByDeadline,
  });

  if (run.affectedProductSlugs.length > 0) {
    revalidatePath('/');
    revalidatePath('/products');
    revalidatePath('/products/[slug]', 'page');
    revalidatePath('/concerns');
    revalidatePath('/concerns/[slug]', 'page');
    revalidatePath('/share');
    for (const slug of run.affectedProductSlugs) {
      revalidatePath(`/products/${slug}`);
      revalidatePath(`/share/${slug}`);
    }
  }

  const backlog = await getInventoryRefreshBacklogSummary();
  const summary = { run, backlog };
  console.info(JSON.stringify({ event: 'inventory_refresh_cron_completed', ...summary }));
  return Response.json(summary);
}
