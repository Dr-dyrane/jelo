import { getPostgresClient } from '@/lib/db/postgres';
import {
  findPendingContribution,
  listPendingContributions,
} from '@/lib/moderation/queues';
import {
  includeSelectedQueueItem,
  selectedQueueItemId,
  type QueueSearchParams,
} from '@/lib/moderation/queue-selection';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { contributionReviewItem } from '@/lib/moderation/contribution-presentation';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import { ContributionsInbox } from './ContributionsInbox';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 40;

export default async function ContributionsQueue({
  searchParams,
}: {
  searchParams: Promise<QueueSearchParams>;
}) {
  const operator = await requireConsoleOperator();
  const canDecide = can(operator.role, 'contributions.decide');
  const selectedId = selectedQueueItemId(await searchParams);
  const sql = getPostgresClient();
  const fetchedRows = await listPendingContributions(sql, PAGE_SIZE + 1);
  const recentRows = fetchedRows.slice(0, PAGE_SIZE);
  const hasMore = fetchedRows.length > PAGE_SIZE;
  const selectedRow = selectedId && !recentRows.some(row => row.id === selectedId)
    ? await findPendingContribution(sql, selectedId)
    : null;
  const rows = includeSelectedQueueItem(recentRows, selectedRow);
  const reviewItems = rows.map(contributionReviewItem);
  const lastQueueRow = recentRows.at(-1);
  const nextCursor = lastQueueRow
    ? { submittedAt: lastQueueRow.submittedAt, id: lastQueueRow.id }
    : null;

  return (
    <OpsWorkspace title="Contributions">
      {rows.length === 0 ? (
        <EmptyState
          title="You’re caught up."
          body="There’s nothing waiting."
          action={{ href: '/ops/activity', label: 'View insights' }}
        />
      ) : (
        <ContributionsInbox
          rows={reviewItems}
          canDecide={canDecide}
          initialHasMore={hasMore}
          initialCursor={nextCursor}
        />
      )}
    </OpsWorkspace>
  );
}
