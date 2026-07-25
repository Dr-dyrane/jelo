'use client';

import { useActionState, useEffect, useRef } from 'react';

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
  const [actionState, formAction, isPending] = useActionState(decideContributionAction, null);
  const pendingDecisionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!actionState?.ok) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const advance = (window as any).__opsInboxAdvance as ((id: string) => void) | undefined;
    if (advance && actionState.targetId) {
      advance(actionState.targetId);
    }
    pendingDecisionRef.current = null;
  }, [actionState]);

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
              border: 0,
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
          <div className={styles.propertiesSection} style={{ paddingTop: '12px' }}>
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
              action={formAction}
            >
              {actionState && !actionState.ok && actionState.targetId === row.id && (
                <div style={{ color: 'var(--red)', fontSize: '11px', background: 'var(--red-light)', padding: '6px', borderRadius: '4px' }}>
                  {actionState.error}
                </div>
              )}
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
                  disabled={isPending}
                />
              </div>
              <div className={styles.actionButtons}>
                <button
                  className={`${styles.btn} ${styles.btnReject}`}
                  type="submit"
                  name="decision"
                  value="reject"
                  disabled={isPending}
                  onClick={() => { pendingDecisionRef.current = 'reject'; }}
                >
                  {isPending && pendingDecisionRef.current === 'reject' ? 'Rejecting…' : 'Reject (R)'}
                </button>
                <button
                  className={`${styles.btn} ${styles.btnApprove}`}
                  type="submit"
                  name="decision"
                  value="approve"
                  disabled={isPending}
                  onClick={() => { pendingDecisionRef.current = 'approve'; }}
                >
                  {isPending && pendingDecisionRef.current === 'approve' ? 'Approving…' : 'Approve (E)'}
                </button>
              </div>
            </form>
          ) : (
            <p style={{ fontSize: '11px', color: 'var(--muted)', paddingTop: '12px', margin: 0 }}>
              You do not have the required permissions to make decisions on contributions.
            </p>
          )}
        </div>
      )}
    />
  );
}
