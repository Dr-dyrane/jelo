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
import { EmptyState } from '@/components/ops/state/EmptyState';
import { RetailersInbox } from './RetailersInbox';
import opsStyles from '../../ops.module.css';
import styles from '@/components/ops/inbox/inbox.module.css';

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
  const recentRows = await listPendingRetailerApplications(sql, LIMIT);
  const selectedRow = selectedId && !recentRows.some(row => row.id === selectedId)
    ? await findPendingRetailerApplication(sql, selectedId)
    : null;
  const rows = includeSelectedQueueItem(recentRows, selectedRow);

  return (
    <>
      <h1 className={opsStyles.h1}>Retailer applications</h1>
      <p className={opsStyles.lede}>Submitted partnership applications. Approval feeds the existing verification lane (ADR 0003); it does not publish a retailer.</p>

      {rows.length === 0 ? (
        <EmptyState
          title="No pending applications"
          body="New retailer partnership applications will appear here when submitted."
        />
      ) : (
        <>
          <RetailersInbox rows={rows} canDecide={canDecide} />
          {recentRows.length === LIMIT ? (
            <p className={styles.partial}>Showing the {LIMIT} most recent — more may be pending.</p>
          ) : null}
        </>
      )}
    </>
  );
}
