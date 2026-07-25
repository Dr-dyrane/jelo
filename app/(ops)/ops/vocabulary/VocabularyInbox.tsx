'use client';

import type { PendingModerationValue } from '@/lib/moderation/queues';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { InboxContainer } from '@/components/ops/inbox/InboxContainer';
import { decideModerationValueAction } from '../actions';
import styles from '@/components/ops/inbox/inbox.module.css';

interface VocabularyInboxProps {
  rows: PendingModerationValue[];
  canDecide: boolean;
}

export function VocabularyInbox({ rows, canDecide }: VocabularyInboxProps) {
  return (
    <InboxContainer
      items={rows}
      itemTypeLabel="vocabulary term"
      renderItemRow={(row) => (
        <div className={styles.row} style={{ width: '100%', background: 'transparent', borderBottom: 0 }}>
          <div className={styles.subject}>
            <div className={styles.value} style={{ fontSize: '1.05rem' }}>{row.rawValue}</div>
            <div className={styles.metaRow}>
              <StatusPill tone="info">{row.valueKind}</StatusPill>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                ×{row.occurrenceCount}
              </span>
              <RelativeTime iso={row.lastSeenAt} />
            </div>
          </div>
        </div>
      )}
      renderItemDetails={(row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--ink)', margin: '0 0 4px' }}>
              {row.rawValue}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--muted)', fontSize: '11px' }}>Normalized:</span>
              <code style={{
                fontSize: '11px',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                padding: '2px 6px',
                borderRadius: '4px',
                color: 'var(--ink)',
                fontWeight: 600
              }}>
                {row.normalizedValue}
              </code>
            </div>
          </div>

          {/* Properties Grid */}
          <div className={styles.propertiesSection} style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <div className={styles.propertyRow}>
              <span className={styles.propertyLabel}>Kind</span>
              <span className={styles.propertyValue}><StatusPill tone="info">{row.valueKind}</StatusPill></span>
            </div>
            <div className={styles.propertyRow}>
              <span className={styles.propertyLabel}>Occurrences</span>
              <span className={styles.propertyValue} style={{ fontWeight: 600 }}>{row.occurrenceCount}</span>
            </div>
            <div className={styles.propertyRow}>
              <span className={styles.propertyLabel}>First Seen</span>
              <span className={styles.propertyValue}><RelativeTime iso={row.firstSeenAt} /></span>
            </div>
            <div className={styles.propertyRow}>
              <span className={styles.propertyLabel}>Last Seen</span>
              <span className={styles.propertyValue}><RelativeTime iso={row.lastSeenAt} /></span>
            </div>
            {row.canonicalEntityKind ? (
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Canonical Kind</span>
                <span className={styles.propertyValue}>{row.canonicalEntityKind}</span>
              </div>
            ) : null}
            {row.canonicalEntityRef ? (
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Canonical Ref</span>
                <span className={styles.propertyValue}><IdChip value={row.canonicalEntityRef} label="ref" /></span>
              </div>
            ) : null}
            <div className={styles.propertyRow}>
              <span className={styles.propertyLabel}>Vocab ID</span>
              <span className={styles.propertyValue}><IdChip value={row.id} label="vocab" /></span>
            </div>
          </div>

          {/* Decision form */}
          {canDecide ? (
            <form
              data-item-id={row.id}
              className={styles.decideSection}
              action={decideModerationValueAction}
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
              You do not have the required permissions to make decisions on vocabulary.
            </p>
          )}
        </div>
      )}
    />
  );
}
