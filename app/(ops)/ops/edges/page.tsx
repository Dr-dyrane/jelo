import { getPostgresClient } from '@/lib/db/postgres';
import { listPendingEdges } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { humanizeRef } from '@/lib/humanize/refs';
import { ProductRef } from '@/components/ops/chips/ProductRef';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { decideEdgeAction } from '../actions';
import opsStyles from '../../ops.module.css';
import styles from '@/components/ops/inbox/inbox.module.css';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

export default async function EdgesQueue() {
  const operator = await requireConsoleOperator();
  const canDecide = can(operator.role, 'edges.decide');
  const rows = await listPendingEdges(getPostgresClient(), LIMIT);

  return (
    <>
      <h1 className={opsStyles.h1}>Knowledge edges</h1>
      <p className={opsStyles.lede}>Typed triples derived from contributions, pending review. Community-reported until an operator approves.</p>

      {rows.length === 0 ? (
        <EmptyState
          title="No pending edges"
          body="Triples connecting products, ingredients, concerns, or brands will appear here."
        />
      ) : (
        <>
          <div className={styles.card}>
            {rows.map(row => {
              const subjectRefStr = row.subjectKind ? `${row.subjectKind}:${row.subjectRef}` : row.subjectRef;
              const objectRefStr = row.objectKind ? `${row.objectKind}:${row.objectRef}` : row.objectRef;
              const subject = humanizeRef(subjectRefStr);
              const object = humanizeRef(objectRefStr);

              return (
                <div key={row.id} className={styles.row}>
                  <div className={styles.subject}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                      <ProductRef subject={subject} />
                      <span style={{ color: 'var(--muted)', fontSize: 'var(--text-mono)' }}>→</span>
                      <StatusPill tone="info">{row.predicate}</StatusPill>
                      <span style={{ color: 'var(--muted)', fontSize: 'var(--text-mono)' }}>→</span>
                      <ProductRef subject={object} />
                    </div>
                    <div className={styles.metaRow} style={{ marginTop: 'var(--space-2)' }}>
                      <RelativeTime iso={row.createdAt} />
                      <IdChip value={row.contributionId} label="source" />
                      {row.metadata && Object.keys(row.metadata).length > 0 ? (
                        <span style={{ fontSize: 'var(--text-cell)', color: 'var(--muted)', fontFamily: 'var(--font-sans)' }}>
                          ({JSON.stringify(row.metadata)})
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {canDecide ? (
                    <form className={styles.decide} action={decideEdgeAction}>
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
