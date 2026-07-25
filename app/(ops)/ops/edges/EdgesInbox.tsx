'use client';

import type { PendingEdge } from '@/lib/moderation/queues';
import type { Product } from '@/data/products';
import { humanizeRef } from '@/lib/humanize/refs';
import { ProductRef } from '@/components/ops/chips/ProductRef';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { InboxContainer } from '@/components/ops/inbox/InboxContainer';
import { decideEdgeAction } from '../actions';
import styles from '@/components/ops/inbox/inbox.module.css';

export interface EnrichedEdge extends PendingEdge {
  subjectProduct?: Product;
  objectProduct?: Product;
}

interface EdgesInboxProps {
  rows: EnrichedEdge[];
  canDecide: boolean;
}

export function EdgesInbox({ rows, canDecide }: EdgesInboxProps) {
  return (
    <InboxContainer
      items={rows}
      itemTypeLabel="knowledge edge"
      renderItemRow={(row) => {
        const subjectRefStr = row.subjectKind ? `${row.subjectKind}:${row.subjectRef}` : row.subjectRef;
        const objectRefStr = row.objectKind ? `${row.objectKind}:${row.objectRef}` : row.objectRef;
        const subject = humanizeRef(subjectRefStr);
        const object = humanizeRef(objectRefStr);
        return (
          <div className={styles.row} style={{ width: '100%', background: 'transparent', borderBottom: 0 }}>
            <div className={styles.subject}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', fontSize: '12px' }}>
                <span style={{ fontWeight: 600 }}>{subject.name}</span>
                <span style={{ color: 'var(--muted)' }}>→</span>
                <span style={{ color: 'var(--wine)', fontWeight: 500 }}>{row.predicate}</span>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Subject Entity details */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                Subject Entity
              </div>
              <ProductRef subject={subject} />
              {row.subjectProduct ? (
                <div style={{
                  display: 'flex',
                  gap: 'var(--space-3)',
                  background: 'var(--card)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-card)',
                  boxShadow: 'var(--elevation-1)',
                  marginTop: '6px'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    position: 'relative',
                    background: 'var(--cream)',
                    borderRadius: 'var(--radius-control)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0
                  }}>
                    <img
                      src={row.subjectProduct.image || '/product-placeholder.svg'}
                      alt={row.subjectProduct.name}
                      style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                    <strong style={{ fontSize: '11px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {row.subjectProduct.brand} {row.subjectProduct.name}
                    </strong>
                    <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                      Category: {row.subjectProduct.category} · Size: {row.subjectProduct.size}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Object Entity details */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                Object Target Entity
              </div>
              <ProductRef subject={object} />
              {row.objectProduct ? (
                <div style={{
                  display: 'flex',
                  gap: 'var(--space-3)',
                  background: 'var(--card)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-card)',
                  boxShadow: 'var(--elevation-1)',
                  marginTop: '6px'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    position: 'relative',
                    background: 'var(--cream)',
                    borderRadius: 'var(--radius-control)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0
                  }}>
                    <img
                      src={row.objectProduct.image || '/product-placeholder.svg'}
                      alt={row.objectProduct.name}
                      style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                    <strong style={{ fontSize: '11px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {row.objectProduct.brand} {row.objectProduct.name}
                    </strong>
                    <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                      Category: {row.objectProduct.category} · Size: {row.objectProduct.size}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Properties Grid */}
            <div className={styles.propertiesSection} style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Relationship</span>
                <span className={styles.propertyValue}><StatusPill tone="info">{row.predicate}</StatusPill></span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Subject Kind</span>
                <span className={styles.propertyValue}>{row.subjectKind}</span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Object Kind</span>
                <span className={styles.propertyValue}>{row.objectKind}</span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Source</span>
                <span className={styles.propertyValue}><IdChip value={row.contributionId} label="source" /></span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Created</span>
                <span className={styles.propertyValue}><RelativeTime iso={row.createdAt} /></span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Edge ID</span>
                <span className={styles.propertyValue}><IdChip value={row.id} label="edge" /></span>
              </div>
            </div>

            {row.metadata && Object.keys(row.metadata).length > 0 ? (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Metadata</div>
                <pre style={{
                  fontSize: '11px',
                  color: 'var(--ink)',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  padding: '8px',
                  borderRadius: 'var(--radius-md)',
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
                className={styles.decideSection}
                action={decideEdgeAction}
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
                You do not have the required permissions to make decisions on knowledge edges.
              </p>
            )}
          </div>
        );
      }}
    />
  );
}
