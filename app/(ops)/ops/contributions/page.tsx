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
import styles from '@/components/ops/inbox/inbox.module.css';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

export default async function ContributionsQueue({
  searchParams,
}: {
  searchParams: Promise<QueueSearchParams>;
}) {
  const operator = await requireConsoleOperator();
  const canDecide = can(operator.role, 'contributions.decide');
  const selectedId = selectedQueueItemId(await searchParams);
  const sql = getPostgresClient();
  const fetchedRows = await listPendingContributions(sql, LIMIT + 1);
  const recentRows = fetchedRows.slice(0, LIMIT);
  const hasMore = fetchedRows.length > LIMIT;
  const selectedRow = selectedId && !recentRows.some(row => row.id === selectedId)
    ? await findPendingContribution(sql, selectedId)
    : null;
  const rows = includeSelectedQueueItem(recentRows, selectedRow);
  const reviewItems = rows.map(contributionReviewItem);

  return (
    <OpsWorkspace title="Contributions">
      {rows.length === 0 ? (
        <EmptyState
          title="Nothing awaiting review"
          body="New contributions will appear here."
        />
      ) : (
        <>
          <ContributionsInbox rows={reviewItems} canDecide={canDecide} />
          {hasMore ? (
            <p className={styles.partial}>This view starts with the oldest {LIMIT}. More are waiting.</p>
          ) : null}
        </>
      )}
    </OpsWorkspace>
  );
}
