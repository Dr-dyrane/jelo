'use client';

import type { PendingContribution } from '@/lib/moderation/queues';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { InboxContainer } from '@/components/ops/inbox/InboxContainer';
import { decideContributionAction } from '../actions';
import styles from '@/components/ops/inbox/inbox.module.css';

interface ContributionsInboxProps {
  rows: PendingContribution[];
  canDecide: boolean;
}

export function ContributionsInbox({ rows, canDecide }: ContributionsInboxProps) {
  return (
    <InboxContainer
      items={rows}
      itemTypeLabel="contribution"
      renderItemRow={(row) => (
        <div className={styles.row} style={{ width: '100%', background: 'transparent', borderBottom: 0 }}>
          <div className={styles.subject}>
            <div className={styles.metaRow}>
              <StatusPill tone="warning">{row.kind}</StatusPill>
              <RelativeTime iso={row.submittedAt} />
            </div>
            <span style={{
              fontSize: '11px',
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
              Contribution Payload
            </div>
            <pre style={{
              fontSize: '11px',
              color: 'var(--ink)',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              padding: '10px',
              borderRadius: 'var(--radius-md)',
              overflow: 'auto',
              maxHeight: '300px',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {JSON.stringify(row.payload, null, 2)}
            </pre>
          </div>

          {/* Properties Grid */}
          <div className={styles.propertiesSection} style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <div className={styles.propertyRow}>
              <span className={styles.propertyLabel}>Kind</span>
              <span className={styles.propertyValue}><StatusPill tone="warning">{row.kind}</StatusPill></span>
            </div>
            <div className={styles.propertyRow}>
              <span className={styles.propertyLabel}>Submitted</span>
              <span className={styles.propertyValue}><RelativeTime iso={row.submittedAt} /></span>
            </div>
            <div className={styles.propertyRow}>
              <span className={styles.propertyLabel}>Retain Until</span>
              <span className={styles.propertyValue}><RelativeTime iso={row.retainUntil} mode="date" /></span>
            </div>
            <div className={styles.propertyRow}>
              <span className={styles.propertyLabel}>Contrib ID</span>
              <span className={styles.propertyValue}><IdChip value={row.id} label="contrib" /></span>
            </div>
          </div>

          {/* Decision form */}
          {canDecide ? (
            <form
              data-item-id={row.id}
              className={styles.decideSection}
              action={decideContributionAction}
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
              You do not have the required permissions to make decisions on contributions.
            </p>
          )}
        </div>
      )}
    />
  );
}
