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
          <div className={styles.row} style={{ width: '100%', background: 'transparent', borderBottom: 0 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Title / Target */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                Observation Target
              </div>
              <ProductRef subject={subject} />
            </div>

            {/* Linear Properties Grid */}
            <div className={styles.propertiesSection} style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Kind</span>
                <span className={styles.propertyValue}>{row.kind}</span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Value</span>
                <span className={styles.propertyValue}>
                  {row.kind === 'price' ? (
                    <span className={styles.value}>{money(row.amountNgn)}</span>
                  ) : row.outcome ? (
                    <StatusPill tone={outcomeTone(row.outcome)}>{outcomeLabel(row.outcome)}</StatusPill>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Reported</span>
                <span className={styles.propertyValue}><RelativeTime iso={row.createdAt} /></span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Source</span>
                <span className={styles.propertyValue}><IdChip value={row.contributionId} label="source" /></span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Obs ID</span>
                <span className={styles.propertyValue}><IdChip value={row.id} label="obs" /></span>
              </div>
            </div>

            {/* Decisions Section */}
            {canDecide ? (
              <form
                data-item-id={row.id}
                className={styles.decideSection}
                action={decideObservationAction}
              >
                <input type="hidden" name="targetId" value={row.id} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor={`rationale-${row.id}`} className={styles.decideNoteLabel}>
                    Decision Rationale
                  </label>
                  <textarea
                    id={`rationale-${row.id}`}
                    className={styles.note}
                    name="rationale"
                    placeholder="Add explanation (optional)..."
                    aria-label="Decision rationale"
                  />
                </div>
                <div className={styles.actionButtons}>
                  <button className={`${styles.btn} ${styles.btnReject}`} type="submit" name="decision" value="reject">
                    Reject (R)
                  </button>
                  <button className={`${styles.btn} ${styles.btnApprove}`} type="submit" name="decision" value="approve">
                    Approve (E)
                  </button>
                </div>
              </form>
            ) : (
              <p style={{ fontSize: '11px', color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: '12px', margin: 0 }}>
                You do not have the required permissions to make decisions on observations.
              </p>
            )}
          </div>
        );
      }}
    />
  );
}
