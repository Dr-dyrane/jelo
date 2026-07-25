import { getPostgresClient } from '@/lib/db/postgres';
import { listPendingModerationValues } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { InboxContainer } from '@/components/ops/inbox/InboxContainer';
import { decideModerationValueAction } from '../actions';
import opsStyles from '../../ops.module.css';
import styles from '@/components/ops/inbox/inbox.module.css';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

export default async function VocabularyQueue() {
  const operator = await requireConsoleOperator();
  const canDecide = can(operator.role, 'vocabulary.decide');
  const rows = await listPendingModerationValues(getPostgresClient(), LIMIT);

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
          <InboxContainer
            items={rows}
            itemTypeLabel="vocabulary term"
            renderItemRow={(row) => (
              <div className={styles.row} style={{ width: '100%', background: 'transparent' }}>
                <div className={styles.subject}>
                  <div className={styles.value} style={{ fontSize: '1.05rem' }}>{row.rawValue}</div>
                  <div className={styles.metaRow}>
                    <StatusPill tone="info">{row.valueKind}</StatusPill>
                    <span style={{ fontSize: 'var(--text-cell)', color: 'var(--muted)' }}>
                      ×{row.occurrenceCount}
                    </span>
                    <RelativeTime iso={row.lastSeenAt} />
                  </div>
                </div>
              </div>
            )}
            renderItemDetails={(row) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--ink)', margin: '0 0 var(--space-1)' }}>
                    {row.rawValue}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Normalized representation:</span>
                    <code style={{
                      fontSize: 'var(--text-mono)',
                      background: 'var(--tag-bg)',
                      padding: 'var(--space-1) var(--space-2)',
                      borderRadius: 'var(--radius-control)',
                      color: 'var(--ink)',
                      fontWeight: 600
                    }}>
                      {row.normalizedValue}
                    </code>
                  </div>
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
                  <div><strong>Kind:</strong> {row.valueKind}</div>
                  <div><strong>Occurrences:</strong> {row.occurrenceCount} {row.occurrenceCount === 1 ? 'time' : 'times'}</div>
                  <div><strong>First Seen:</strong> <RelativeTime iso={row.firstSeenAt} /></div>
                  <div><strong>Last Seen:</strong> <RelativeTime iso={row.lastSeenAt} /></div>
                  {row.canonicalEntityKind ? (
                    <div><strong>Canonical Kind:</strong> {row.canonicalEntityKind}</div>
                  ) : null}
                  {row.canonicalEntityRef ? (
                    <div><strong>Canonical Ref:</strong> {row.canonicalEntityRef}</div>
                  ) : null}
                  <div style={{ gridColumn: 'span 2' }}>
                    <strong>Vocabulary ID:</strong> <IdChip value={row.id} label="vocab" />
                  </div>
                </div>

                {canDecide ? (
                  <form
                    data-item-id={row.id}
                    className={styles.decide}
                    action={decideModerationValueAction}
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
                    You do not have the required permissions to make decisions on vocabulary.
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
