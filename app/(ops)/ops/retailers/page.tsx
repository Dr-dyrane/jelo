import { getPostgresClient } from '@/lib/db/postgres';
import { listPendingRetailerApplications } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { RetailersInbox } from './RetailersInbox';
import opsStyles from '../../ops.module.css';
import styles from '@/components/ops/inbox/inbox.module.css';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

export default async function RetailerApplicationsQueue() {
  const operator = await requireConsoleOperator();
  const canDecide = can(operator.role, 'retailers.decide');
  const rows = await listPendingRetailerApplications(getPostgresClient(), LIMIT);

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
          {rows.length === LIMIT ? (
            <p className={styles.partial}>Showing the {LIMIT} most recent — more may be pending.</p>
          ) : null}
        </>
      )}
    </>
  );
}
