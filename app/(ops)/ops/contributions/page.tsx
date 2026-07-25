import { getPostgresClient } from '@/lib/db/postgres';
import { listPendingContributions } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { InboxContainer } from '@/components/ops/inbox/InboxContainer';
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
          <InboxContainer
            items={rows}
            itemTypeLabel="contribution"
            renderItemRow={(row) => (
              <div className={styles.row} style={{ width: '100%', background: 'transparent' }}>
                <div className={styles.subject}>
                  <div className={styles.metaRow}>
                    <StatusPill tone="warning">{row.kind}</StatusPill>
                    <RelativeTime iso={row.submittedAt} />
                  </div>
                  <span style={{
                    fontSize: '0.75rem',
                    color: 'var(--muted)',
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '380px'
                  }}>
                    {JSON.stringify(row.payload)}
                  </span>
                </div>
              </div>
            )}
            renderItemDetails={(row) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 var(--space-2)' }}>
                    Contribution Payload
                  </h3>
                  <pre style={{
                    fontSize: 'var(--text-mono)',
                    color: 'var(--ink)',
                    background: 'var(--tag-bg)',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-control)',
                    overflow: 'auto',
                    maxHeight: '350px',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    border: '0',
                  }}>
                    {JSON.stringify(row.payload, null, 2)}
                  </pre>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--space-3)',
                  fontSize: 'var(--text-cell)',
                  background: 'var(--tag-bg)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-control)',
                }}>
                  <div><strong>Kind:</strong> {row.kind}</div>
                  <div><strong>Submitted:</strong> <RelativeTime iso={row.submittedAt} /></div>
                  <div><strong>Retain Until:</strong> <RelativeTime iso={row.retainUntil} mode="date" /></div>
                  <div><strong>Contribution ID:</strong> <IdChip value={row.id} label="contrib" /></div>
                </div>

                {canDecide ? (
                  <form
                    data-item-id={row.id}
                    className={styles.decide}
                    action={decideContributionAction}
                    style={{
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: 'var(--space-3)',
                      marginTop: 'var(--space-2)',
                      borderTop: '1px solid rgba(112, 71, 61, 0.08)',
                      paddingTop: 'var(--space-4)',
                    }}
                  >
                    <input type="hidden" name="targetId" value={row.id} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                      <label htmlFor={`rationale-${row.id}`} style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)' }}>
                        Decision Rationale
                      </label>
                      <input
                        id={`rationale-${row.id}`}
                        className={styles.note}
                        name="rationale"
                        placeholder="Add explanation..."
                        aria-label="Decision rationale"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                      <button className={`${styles.btn} ${styles.btnReject}`} type="submit" name="decision" value="reject">
                        Reject (R)
                      </button>
                      <button className={`${styles.btn} ${styles.btnApprove}`} type="submit" name="decision" value="approve">
                        Approve (E)
                      </button>
                    </div>
                  </form>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 'var(--space-2) 0 0' }}>
                    You do not have the required permissions to make decisions on contributions.
                  </p>
                )}
              </div>
            )}
          />

          {rows.length === LIMIT ? (
            <p className={styles.partial}>Showing the {LIMIT} most recent — more may be pending.</p>
          ) : null}
        </>
      )}
    </>
  );
}
