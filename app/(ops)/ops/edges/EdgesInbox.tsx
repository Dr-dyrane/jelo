'use client';

import { useActionState, useEffect, useRef } from 'react';

import type { PendingEdge } from '@/lib/moderation/queues';
import type { Product } from '@/data/products';
import { humanizeRef } from '@/lib/humanize/refs';
import { ProductRef } from '@/components/ops/chips/ProductRef';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { InboxContainer } from '@/components/ops/inbox/InboxContainer';
import { decideEdgeAction } from '../actions';
import styles from '@/components/ops/inbox/inbox.module.css';

export interface EnrichedEdge extends PendingEdge {
  subjectProduct?: Product;
  objectProduct?: Product;
  warnings?: string[];
}

interface EdgesInboxProps {
  rows: EnrichedEdge[];
  canDecide: boolean;
}

export function EdgesInbox({ rows, canDecide }: EdgesInboxProps) {
  const [actionState, formAction, isPending] = useActionState(decideEdgeAction, null);
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
                {row.warnings && row.warnings.length > 0 ? (
                  <span style={{ display: 'inline-flex', padding: '1px 5px', borderRadius: '3px', background: 'var(--state-danger-bg)', color: 'var(--state-danger)', fontSize: '9px', fontWeight: 600 }}>
                    Advisory
                  </span>
                ) : null}
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
            {/* Clinical Safety Advisories */}
            {row.warnings && row.warnings.length > 0 ? (
              <div style={{
                background: 'var(--state-danger-bg)',
                color: 'var(--state-danger)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-card)',
                fontSize: '11px',
                lineHeight: '1.4',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                boxShadow: 'var(--elevation-1)'
              }}>
                <strong style={{ fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ⚠️ Clinical Safety Advisory
                </strong>
                {row.warnings.map((w, idx) => (
                  <span key={idx}>• {w}</span>
                ))}
              </div>
            ) : null}

            {/* Subject Entity details */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
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
                    <SafeProductImage
                      src={row.subjectProduct.image || '/product-placeholder.svg'}
                      alt={row.subjectProduct.name}
                      className=""
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
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
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
                    <SafeProductImage
                      src={row.objectProduct.image || '/product-placeholder.svg'}
                      alt={row.objectProduct.name}
                      className=""
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
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>Metadata</div>
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
