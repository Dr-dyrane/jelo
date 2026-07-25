import { getPostgresClient } from '@/lib/db/postgres';
import { listPendingContributions } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { decideContributionAction } from '../actions';
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
          <div className={styles.card}>
            {rows.map(row => (
              <div key={row.id} className={styles.row}>
                <div className={styles.subject}>
                  <div className={styles.metaRow}>
                    <StatusPill tone="warning">{row.kind}</StatusPill>
                    <RelativeTime iso={row.submittedAt} />
                    <IdChip value={row.id} label="id" />
                  </div>
                  <pre style={{
                    fontSize: 'var(--text-mono)',
                    color: 'var(--ink)',
                    background: 'var(--tag-bg)',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-control)',
                    overflow: 'auto',
                    margin: 'var(--space-2) 0 0 0',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    border: '0',
                  }}>
                    {JSON.stringify(row.payload, null, 2)}
                  </pre>
                </div>

                {canDecide ? (
                  <form className={styles.decide} action={decideContributionAction}>
                    <input type="hidden" name="targetId" value={row.id} />
                    <input className={styles.note} name="rationale" placeholder="Note" aria-label="Decision note" />
                    <button className={`${styles.btn} ${styles.btnApprove}`} type="submit" name="decision" value="approve">Approve</button>
                    <button className={`${styles.btn} ${styles.btnReject}`} type="submit" name="decision" value="reject">Reject</button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>

          {rows.length === LIMIT ? (
            <p className={styles.partial}>Showing the {LIMIT} most recent — more may be pending.</p>
          ) : null}
        </>
      )}
    </>
  );
}
