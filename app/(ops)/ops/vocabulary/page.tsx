import { getPostgresClient } from '@/lib/db/postgres';
import {
  findPendingModerationValue,
  listPendingModerationValues,
} from '@/lib/moderation/queues';
import {
  includeSelectedQueueItem,
  selectedQueueItemId,
  type QueueSearchParams,
} from '@/lib/moderation/queue-selection';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { VocabularyInbox } from './VocabularyInbox';
import opsStyles from '../../ops.module.css';
import styles from '@/components/ops/inbox/inbox.module.css';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

export default async function VocabularyQueue({
  searchParams,
}: {
  searchParams: Promise<QueueSearchParams>;
}) {
  const operator = await requireConsoleOperator();
  const canDecide = can(operator.role, 'vocabulary.decide');
  const selectedId = selectedQueueItemId(await searchParams);
  const sql = getPostgresClient();
  const recentRows = await listPendingModerationValues(sql, LIMIT);
  const selectedRow = selectedId && !recentRows.some(row => row.id === selectedId)
    ? await findPendingModerationValue(sql, selectedId)
    : null;
  const rows = includeSelectedQueueItem(recentRows, selectedRow);

  return (
    <>
      <h1 className={opsStyles.h1}>Custom vocabulary</h1>
      <p className={opsStyles.lede}>Values shoppers typed that no canonical entity matched. Approve to accept the term, or reject; mapping to a canonical entity comes next.</p>

      {rows.length === 0 ? (
        <EmptyState
          title="No custom vocabulary pending"
          body="New custom terms typed by contributors will appear here."
        />
      ) : (
        <>
          <VocabularyInbox rows={rows} canDecide={canDecide} />
          {recentRows.length === LIMIT ? (
            <p className={styles.partial}>Showing the {LIMIT} most recent — more may be pending.</p>
          ) : null}
        </>
      )}
    </>
  );
}
