import { getPostgresClient } from '@/lib/db/postgres';
import { listPendingContributions } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { ContributionsInbox } from './ContributionsInbox';
import opsStyles from '../../ops.module.css';
import styles from '@/components/ops/inbox/inbox.module.css';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

export default async function ContributionsQueue() {
  const operator = await requireConsoleOperator();
  const canDecide = can(operator.role, 'contributions.decide');
  const rows = await listPendingContributions(getPostgresClient(), LIMIT);

  return (
    <>
      <h1 className={opsStyles.h1}>Community contributions</h1>
      <p className={opsStyles.lede}>Anonymous submissions, preserved immutably. A decision marks them reviewed; it never writes a canonical record.</p>

      {rows.length === 0 ? (
        <EmptyState
          title="No pending contributions"
          body="New community submissions will appear here for verification review."
        />
      ) : (
        <>
          <ContributionsInbox rows={rows} canDecide={canDecide} />
          {rows.length === LIMIT ? (
            <p className={styles.partial}>Showing the {LIMIT} most recent — more may be pending.</p>
          ) : null}
        </>
      )}
    </>
  );
}
