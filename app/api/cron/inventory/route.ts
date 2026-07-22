import { enqueueDueInventoryOffers } from '@/lib/inventory/repository';
import { processInventoryRefreshBatch } from '@/lib/inventory/refresh-worker';
import { isAuthorizedCronRequest } from '@/modules/retail-intelligence/cron-auth';

export const runtime = 'nodejs';
export const maxDuration = 300;
const batchSize = 20;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const queued = await enqueueDueInventoryOffers(batchSize);
  const results = await processInventoryRefreshBatch(batchSize);
  const completed = results.filter(result => result.status === 'completed').length;
  const failed = results.length - completed;

  return Response.json({ queued, processed: results.length, completed, failed });
}
