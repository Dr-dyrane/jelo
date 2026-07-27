'use server';

import { getPostgresClient } from '@/lib/db/postgres';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { listPendingRetailerApplications } from '@/lib/moderation/queues';
import { retailerApplicationReviewItem } from '@/lib/moderation/retailer-presentation';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function fetchMoreRetailerApplicationsAction(
  afterSubmittedAt: string,
  afterId: string,
  limit = 40,
) {
  await requireConsoleOperator();

  const parsedDate = new Date(afterSubmittedAt);
  if (!Number.isFinite(parsedDate.valueOf()) || !uuidPattern.test(afterId)) {
    throw new Error('Invalid retailer application cursor.');
  }

  const requestedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 40;
  const safeLimit = Math.min(Math.max(requestedLimit, 1), 100);
  const fetchedRows = await listPendingRetailerApplications(
    getPostgresClient(),
    safeLimit + 1,
    {
      submittedAt: afterSubmittedAt,
      id: afterId,
    },
  );
  const rows = fetchedRows.slice(0, safeLimit);
  const lastRow = rows.at(-1);

  return {
    items: rows.map(retailerApplicationReviewItem),
    hasMore: fetchedRows.length > safeLimit,
    nextCursor: lastRow
      ? { submittedAt: lastRow.submittedAt, id: lastRow.id }
      : null,
  };
}
