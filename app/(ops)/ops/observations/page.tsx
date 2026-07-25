import { getPostgresClient } from '@/lib/db/postgres';
import { listPendingObservations } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { humanizeRef } from '@/lib/humanize/refs';
import { money } from '@/lib/format/money';
import { outcomeLabel, outcomeTone } from '@/lib/humanize/outcomes';
import { ProductRef } from '@/components/ops/chips/ProductRef';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { decideObservationAction } from '../actions';
import opsStyles from '../../ops.module.css';
import styles from '@/components/ops/inbox/inbox.module.css';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

// The Observations triage inbox (reference flow, v1 — humanized rows + the five
// states + capability-gated decisions, server-rendered). The keyboard-first
// list⇄detail-sheet and optimistic-undo layer wraps this next.
export default async function ObservationsQueue() {
  const operator = await requireConsoleOperator();
  const canDecide = can(operator.role, 'observations.decide');
  const rows = await listPendingObservations(getPostgresClient(), LIMIT);

  return (
    <>
      <h1 className={opsStyles.h1}>Community observations</h1>
      <p className={opsStyles.lede}>Reported prices and outcomes awaiting review. Nothing here writes to the catalogue; every decision is logged.</p>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing awaiting review"
          body="Reported prices and outcomes will appear here as contributors submit them."
        />
      ) : (
        <>
          <div className={styles.card}>
            {rows.map(row => {
              const subject = humanizeRef(row.subjectRef);
              return (
                <div key={row.id} className={styles.row}>
                  <div className={styles.subject}>
                    <ProductRef subject={subject} />
                    <div className={styles.metaRow}>
                      <StatusPill tone={row.kind === 'price' ? 'success' : 'warning'}>{row.kind}</StatusPill>
                      {row.kind === 'price' ? (
                        <span className={styles.value}>{money(row.amountNgn)}</span>
                      ) : row.outcome ? (
                        <StatusPill tone={outcomeTone(row.outcome)}>{outcomeLabel(row.outcome)}</StatusPill>
                      ) : (
                        <span className={styles.value}>—</span>
                      )}
                      <RelativeTime iso={row.createdAt} />
                      <IdChip value={row.contributionId} label="source" />
                    </div>
                  </div>

                  {canDecide ? (
                    <form className={styles.decide} action={decideObservationAction}>
                      <input type="hidden" name="targetId" value={row.id} />
                      <input className={styles.note} name="rationale" placeholder="Note" aria-label="Decision note" />
                      <button className={`${styles.btn} ${styles.btnApprove}`} type="submit" name="decision" value="approve">Approve</button>
                      <button className={`${styles.btn} ${styles.btnReject}`} type="submit" name="decision" value="reject">Reject</button>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>

          {rows.length === LIMIT ? (
            <p className={styles.partial}>Showing the {LIMIT} most recent — more may be pending.</p>
          ) : null}
        </>
      )}
    </>
  );
}
