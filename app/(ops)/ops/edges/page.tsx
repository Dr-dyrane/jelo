import { getPostgresClient } from '@/lib/db/postgres';
import { findPendingEdge, listPendingEdges } from '@/lib/moderation/queues';
import {
  includeSelectedQueueItem,
  selectedQueueItemId,
  type QueueSearchParams,
} from '@/lib/moderation/queue-selection';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { edgeReviewItem } from '@/lib/moderation/edge-presentation';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import { EdgesInbox } from './EdgesInbox';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

export default async function EdgesQueue({
  searchParams,
}: {
  searchParams: Promise<QueueSearchParams>;
}) {
  const operator = await requireConsoleOperator();
  const canDecide = can(operator.role, 'edges.decide');
  const selectedId = selectedQueueItemId(await searchParams);
  const sql = getPostgresClient();
  const fetchedRows = await listPendingEdges(sql, LIMIT + 1);
  const recentRows = fetchedRows.slice(0, LIMIT);
  const hasMore = fetchedRows.length > LIMIT;
  const selectedRow = selectedId && !recentRows.some(row => row.id === selectedId)
    ? await findPendingEdge(sql, selectedId)
    : null;
  const rows = includeSelectedQueueItem(recentRows, selectedRow);
  const reviewItems = rows.map(edgeReviewItem);
  const lastQueueRow = recentRows.at(-1);
  const nextCursor = lastQueueRow
    ? { createdAt: lastQueueRow.createdAt, id: lastQueueRow.id }
    : null;

  return (
    <OpsWorkspace title="Relationships">
      {rows.length === 0 ? (
        <EmptyState
          title="Nothing awaiting review"
          body="New relationships will appear here."
        />
      ) : (
        <EdgesInbox
          rows={reviewItems}
          canDecide={canDecide}
          initialHasMore={hasMore}
          initialCursor={nextCursor}
        />
      )}
    </OpsWorkspace>
  );
}
