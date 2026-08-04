import { revalidatePath } from 'next/cache';
import { reconcilePendingProductRequests } from '@/lib/customer/pending-request-reconciliation';
import { isAuthorizedCronRequest } from '@/modules/retail-intelligence/cron-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await reconcilePendingProductRequests(200);

  if (result.matched > 0) {
    // The shelf and private-requests sections read dynamic data; revalidate the
    // Me layout so matched requests leave "Still identifying" and products
    // appear in "My Products" without a manual refresh.
    revalidatePath('/me', 'layout');
    revalidatePath('/me/shelf');
  }

  console.info(JSON.stringify({
    event: 'pending_request_reconciliation_cron_completed',
    scanned: result.scanned,
    matched: result.matched,
  }));

  return Response.json(result);
}
