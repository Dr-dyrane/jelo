'use client';

import type { PendingObservation } from '@/lib/moderation/queues';
import { humanizeRef } from '@/lib/humanize/refs';
import { money } from '@/lib/format/money';
import { outcomeLabel, outcomeTone } from '@/lib/humanize/outcomes';
import { ProductRef } from '@/components/ops/chips/ProductRef';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { InboxContainer } from '@/components/ops/inbox/InboxContainer';
import { decideObservationAction } from '../actions';
import styles from '@/components/ops/inbox/inbox.module.css';

interface ObservationsInboxProps {
  rows: PendingObservation[];
  canDecide: boolean;
}

export function ObservationsInbox({ rows, canDecide }: ObservationsInboxProps) {
  return (
    <InboxContainer
      items={rows}
      itemTypeLabel="observation"
      renderItemRow={(row) => {
        const subject = humanizeRef(row.subjectRef);
        return (
          <div className={styles.row} style={{ width: '100%', background: 'transparent' }}>
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
              </div>
            </div>
          </div>
        );
      }}
      renderItemDetails={(row) => {
        const subject = humanizeRef(row.subjectRef);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 var(--space-2)' }}>
                Observation Target
              </h3>
              <ProductRef subject={subject} />
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
              <div>
                <strong>Value:</strong>{' '}
                {row.kind === 'price' ? (
                  <span className={styles.value}>{money(row.amountNgn)}</span>
                ) : row.outcome ? (
                  <StatusPill tone={outcomeTone(row.outcome)}>{outcomeLabel(row.outcome)}</StatusPill>
                ) : (
                  '—'
                )}
              </div>
              <div><strong>Reported:</strong> <RelativeTime iso={row.createdAt} /></div>
              <div><strong>Source contribution:</strong> <IdChip value={row.contributionId} label="source" /></div>
              <div><strong>Observation ID:</strong> <IdChip value={row.id} label="obs" /></div>
            </div>

            {canDecide ? (
              <form
                data-item-id={row.id}
                className={styles.decide}
                action={decideObservationAction}
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
                You do not have the required permissions to make decisions on observations.
              </p>
            )}
          </div>
        );
      }}
    />
  );
}
