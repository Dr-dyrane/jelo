import { getPostgresClient } from '@/lib/db/postgres';
import {
  findPendingRetailerApplication,
  listPendingRetailerApplications,
} from '@/lib/moderation/queues';
import {
  includeSelectedQueueItem,
  selectedQueueItemId,
  type QueueSearchParams,
} from '@/lib/moderation/queue-selection';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { retailerApplicationReviewItem } from '@/lib/moderation/retailer-presentation';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import { RetailersInbox } from './RetailersInbox';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

export default async function RetailerApplicationsQueue({
  searchParams,
}: {
  searchParams: Promise<QueueSearchParams>;
}) {
  const operator = await requireConsoleOperator();
  const canDecide = can(operator.role, 'retailers.decide');
  const selectedId = selectedQueueItemId(await searchParams);
  const sql = getPostgresClient();
  const fetchedRows = await listPendingRetailerApplications(sql, LIMIT + 1);
  const recentRows = fetchedRows.slice(0, LIMIT);
  const hasMore = fetchedRows.length > LIMIT;
  const selectedRow = selectedId && !recentRows.some(row => row.id === selectedId)
    ? await findPendingRetailerApplication(sql, selectedId)
    : null;
  const rows = includeSelectedQueueItem(recentRows, selectedRow);
  const reviewItems = rows.map(retailerApplicationReviewItem);
  const lastQueueRow = recentRows.at(-1);
  const nextCursor = lastQueueRow
    ? { submittedAt: lastQueueRow.submittedAt, id: lastQueueRow.id }
    : null;

  return (
    <OpsWorkspace title="Retailer applications">
      {rows.length === 0 ? (
        <EmptyState
          title="You’re caught up."
          body="There’s nothing waiting."
          action={{ href: '/ops/activity', label: 'View insights' }}
        />
      ) : (
        <RetailersInbox
          rows={reviewItems}
          canDecide={canDecide}
          initialHasMore={hasMore}
          initialCursor={nextCursor}
        />
      )}
    </OpsWorkspace>
  );
}
