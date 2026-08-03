import { requireCustomer } from '@/lib/customer/access';
import { createSyntheticCustomerPortal } from '@/lib/customer/development-fixture';
import type { CustomerPortalShelfItem } from '@/lib/customer/portal-model';
import type { CustomerShelfRecord } from '@/lib/customer/shelf-repository';
import { customerShelfService } from '@/lib/customer/shelf-service';

export const dynamic = 'force-dynamic';

const PRIVATE_DOWNLOAD_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Content-Type': 'application/json; charset=utf-8',
  'Content-Disposition': 'attachment; filename="jelocare-shelf.json"',
  'X-Content-Type-Options': 'nosniff',
};

export async function GET() {
  const customer = await requireCustomer();
  let records: readonly (CustomerPortalShelfItem | CustomerShelfRecord)[];
  if (customer.source === 'synthetic-development') {
    records = createSyntheticCustomerPortal().shelf;
  } else {
    const read = await customerShelfService.read(customer);
    if (read.status === 'unavailable') {
      return Response.json(
        { status: 'unavailable', message: 'Shelf export is unavailable right now.' },
        { status: 503, headers: PRIVATE_DOWNLOAD_HEADERS },
      );
    }
    records = read.items;
  }

  const items = records.map(item => ({
    identityVersionId: item.identityVersionId,
    savedAt: item.savedAt,
    saveOrigin: item.saveOrigin,
    lifecycleState: item.lifecycleState,
    reviewedSnapshot: item.snapshot,
  }));

  return new Response(JSON.stringify({
    format: 'jelocare-shelf-export-v1',
    exportedAt: new Date().toISOString(),
    items,
  }, null, 2), {
    status: 200,
    headers: PRIVATE_DOWNLOAD_HEADERS,
  });
}
