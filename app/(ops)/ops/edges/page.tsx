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
import { InboxContainer } from '@/components/ops/inbox/InboxContainer';
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
          <InboxContainer
            items={rows}
            itemTypeLabel="knowledge edge"
            renderItemRow={(row) => {
              const subjectRefStr = row.subjectKind ? `${row.subjectKind}:${row.subjectRef}` : row.subjectRef;
              const objectRefStr = row.objectKind ? `${row.objectKind}:${row.objectRef}` : row.objectRef;
              const subject = humanizeRef(subjectRefStr);
              const object = humanizeRef(objectRefStr);
              return (
                <div className={styles.row} style={{ width: '100%', background: 'transparent' }}>
                  <div className={styles.subject}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600 }}>{subject.name}</span>
                      <span style={{ color: 'var(--muted)' }}>→</span>
                      <span style={{ color: 'var(--wine)' }}>{row.predicate}</span>
                      <span style={{ color: 'var(--muted)' }}>→</span>
                      <span style={{ fontWeight: 600 }}>{object.name}</span>
                    </div>
                    <div className={styles.metaRow}>
                      <RelativeTime iso={row.createdAt} />
                    </div>
                  </div>
                </div>
              );
            }}
            renderItemDetails={(row) => {
              const subjectRefStr = row.subjectKind ? `${row.subjectKind}:${row.subjectRef}` : row.subjectRef;
              const objectRefStr = row.objectKind ? `${row.objectKind}:${row.objectRef}` : row.objectRef;
              const subject = humanizeRef(subjectRefStr);
              const object = humanizeRef(objectRefStr);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 var(--space-2)' }}>
                      Subject Entity
                    </h3>
                    <ProductRef subject={subject} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ color: 'var(--muted)' }}>Relationship Predicate:</span>
                    <StatusPill tone="info">{row.predicate}</StatusPill>
                  </div>

                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 var(--space-2)' }}>
                      Object Target Entity
                    </h3>
                    <ProductRef subject={object} />
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
                    <div><strong>Subject Kind:</strong> {row.subjectKind}</div>
                    <div><strong>Object Kind:</strong> {row.objectKind}</div>
                    <div><strong>Source contribution:</strong> <IdChip value={row.contributionId} label="source" /></div>
                    <div><strong>Created:</strong> <RelativeTime iso={row.createdAt} /></div>
                    <div><strong>Edge ID:</strong> <IdChip value={row.id} label="edge" /></div>
                  </div>

                  {row.metadata && Object.keys(row.metadata).length > 0 ? (
                    <div>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)', margin: '0 0 var(--space-1)' }}>Metadata</h4>
                      <pre style={{
                        fontSize: 'var(--text-mono)',
                        color: 'var(--ink)',
                        background: 'var(--tag-bg)',
                        padding: 'var(--space-2)',
                        borderRadius: 'var(--radius-control)',
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}>
                        {JSON.stringify(row.metadata, null, 2)}
                      </pre>
                    </div>
                  ) : null}

                  {canDecide ? (
                    <form
                      data-item-id={row.id}
                      className={styles.decide}
                      action={decideEdgeAction}
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
                      You do not have the required permissions to make decisions on knowledge edges.
                    </p>
                  )}
                </div>
              );
            }}
          />

          {rows.length === LIMIT ? (
            <p className={styles.partial}>Showing the {LIMIT} most recent — more may be pending.</p>
          ) : null}
        </>
      )}
    </>
  );
}
