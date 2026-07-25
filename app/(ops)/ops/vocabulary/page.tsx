import { getPostgresClient } from '@/lib/db/postgres';
import { listPendingModerationValues } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { EmptyState } from '@/components/ops/state/EmptyState';
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
          <div className={styles.card}>
            {rows.map(row => (
              <div key={row.id} className={styles.row}>
                <div className={styles.subject}>
                  <div className={styles.value} style={{ fontSize: '1.15rem' }}>{row.rawValue}</div>
                  <div className={styles.metaRow}>
                    <StatusPill tone="info">{row.valueKind}</StatusPill>
                    <span style={{ fontSize: 'var(--text-cell)', color: 'var(--muted)' }}>
                      normalized:{' '}
                      <code style={{
                        fontSize: 'var(--text-mono)',
                        background: 'var(--tag-bg)',
                        padding: 'var(--space-1) var(--space-2)',
                        borderRadius: 'var(--radius-control)',
                        color: 'var(--ink)'
                      }}>
                        {row.normalizedValue}
                      </code>
                    </span>
                    <span style={{ fontSize: 'var(--text-cell)', color: 'var(--muted)' }}>
                      Seen <strong>{row.occurrenceCount}</strong> {row.occurrenceCount === 1 ? 'time' : 'times'}
                    </span>
                    <RelativeTime iso={row.lastSeenAt} />
                    <IdChip value={row.id} label="value" />
                  </div>
                </div>

                {canDecide ? (
                  <form className={styles.decide} action={decideModerationValueAction}>
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
