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
import { InboxContainer, type OpsInboxController } from '@/components/ops/inbox/InboxContainer';
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

function ProductSummary({ product }: { product?: Product }) {
  if (!product) return null;
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', background: 'var(--ops-surface-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-card)', marginTop: '6px' }}>
      <div style={{ width: '32px', height: '32px', position: 'relative', background: 'var(--cream)', borderRadius: 'var(--radius-control)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <SafeProductImage src={product.image || '/product-placeholder.svg'} alt={product.name} className="" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
        <strong style={{ fontSize: '11px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{product.brand} {product.name}</strong>
        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{product.category} · {product.size}</span>
      </div>
    </div>
  );
}

export function EdgesInbox({ rows, canDecide }: EdgesInboxProps) {
  const [actionState, formAction, isPending] = useActionState(decideEdgeAction, null);
  const pendingDecisionRef = useRef<string | null>(null);
  const inboxControllerRef = useRef<OpsInboxController | null>(null);

  useEffect(() => {
    if (!actionState?.ok) return;
    inboxControllerRef.current?.settleItem(actionState.targetId);
    pendingDecisionRef.current = null;
  }, [actionState]);

  return (
    <InboxContainer
      controllerRef={inboxControllerRef}
      items={rows}
      itemTypeLabel="knowledge edge"
      renderItemRow={(row) => {
        const subject = humanizeRef(row.subjectKind ? `${row.subjectKind}:${row.subjectRef}` : row.subjectRef);
        const object = humanizeRef(row.objectKind ? `${row.objectKind}:${row.objectRef}` : row.objectRef);
        return (
          <div className={styles.row} style={{ width: '100%', background: 'transparent', borderBottom: 0 }}>
            <div className={styles.subject}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', fontSize: '12px' }}>
                <span style={{ fontWeight: 600 }}>{subject.name}</span><span style={{ color: 'var(--muted)' }}>→</span><span style={{ color: 'var(--wine)', fontWeight: 500 }}>{row.predicate}</span><span style={{ color: 'var(--muted)' }}>→</span><span style={{ fontWeight: 600 }}>{object.name}</span>
              </div>
              <div className={styles.metaRow}>
                {row.warnings?.length ? <span style={{ display: 'inline-flex', padding: '1px 5px', borderRadius: '3px', background: 'var(--state-danger-bg)', color: 'var(--state-danger)', fontSize: '9px', fontWeight: 600 }}>Advisory</span> : null}
                <RelativeTime iso={row.createdAt} />
              </div>
            </div>
          </div>
        );
      }}
      renderItemDetails={(row) => {
        const subject = humanizeRef(row.subjectKind ? `${row.subjectKind}:${row.subjectRef}` : row.subjectRef);
        const object = humanizeRef(row.objectKind ? `${row.objectKind}:${row.objectRef}` : row.objectRef);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {row.warnings?.length ? (
              <div style={{ background: 'var(--state-danger-bg)', color: 'var(--state-danger)', padding: 'var(--space-3)', borderRadius: 'var(--radius-card)', fontSize: '11px', lineHeight: '1.4', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <strong style={{ fontSize: '11.5px' }}>Clinical safety advisory</strong>
                {row.warnings.map((warning, index) => <span key={index}>• {warning}</span>)}
              </div>
            ) : null}

            <section className={styles.detailSection}>
              <h3 className={styles.sectionLabel}>Subject</h3>
              <ProductRef subject={subject} />
              <ProductSummary product={row.subjectProduct} />
            </section>

            <section className={styles.detailSection}>
              <h3 className={styles.sectionLabel}>Object</h3>
              <ProductRef subject={object} />
              <ProductSummary product={row.objectProduct} />
            </section>

            <section className={styles.detailSection}>
              <h3 className={styles.sectionLabel}>Evidence</h3>
              <div className={styles.propertiesSection}>
                <div className={styles.propertyRow}><span className={styles.propertyLabel}>Relationship</span><span className={styles.propertyValue}><StatusPill tone="info">{row.predicate}</StatusPill></span></div>
                <div className={styles.propertyRow}><span className={styles.propertyLabel}>Subject kind</span><span className={styles.propertyValue}>{row.subjectKind}</span></div>
                <div className={styles.propertyRow}><span className={styles.propertyLabel}>Object kind</span><span className={styles.propertyValue}>{row.objectKind}</span></div>
                <div className={styles.propertyRow}><span className={styles.propertyLabel}>Created</span><span className={styles.propertyValue}><RelativeTime iso={row.createdAt} /></span></div>
              </div>
            </section>

            <details className={styles.metadataDisclosure}>
              <summary>Metadata</summary>
              <div className={styles.metadataBody}>
                <div className={styles.propertyRow}><span className={styles.propertyLabel}>Contribution ID</span><span className={styles.propertyValue}><IdChip value={row.contributionId} label="contribution" /></span></div>
                <div className={styles.propertyRow}><span className={styles.propertyLabel}>Edge ID</span><span className={styles.propertyValue}><IdChip value={row.id} label="edge" /></span></div>
                {row.metadata && Object.keys(row.metadata).length > 0 ? <pre style={{ fontSize: '11px', color: 'var(--ink)', background: 'var(--ops-surface-subtle)', border: 0, padding: '8px', borderRadius: 'var(--radius-md)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(row.metadata, null, 2)}</pre> : null}
              </div>
            </details>

            {canDecide ? (
              <form data-item-id={row.id} className={styles.decideSection} action={formAction}>
                {actionState && !actionState.ok && actionState.targetId === row.id ? <div style={{ color: 'var(--state-danger)', fontSize: '11px', background: 'var(--state-danger-bg)', padding: '6px', borderRadius: 'var(--ops-control-radius)' }}>{actionState.error}</div> : null}
                <input type="hidden" name="targetId" value={row.id} />
                <div className={styles.decideField}>
                  <label htmlFor={`rationale-${row.id}`} className={styles.decideNoteLabel}>Rationale</label>
                  <textarea id={`rationale-${row.id}`} className={styles.note} name="rationale" placeholder="Optional note for the audit trail" aria-label="Decision rationale" disabled={isPending} />
                </div>
                <div className={styles.actionButtons}>
                  <button className={`${styles.btn} ${styles.btnReject}`} type="submit" name="decision" value="reject" disabled={isPending} onClick={() => { pendingDecisionRef.current = 'reject'; }}>
                    <span>{isPending && pendingDecisionRef.current === 'reject' ? 'Rejecting…' : 'Reject'}</span>
                    <kbd className={styles.kbdBadge}>R</kbd>
                  </button>
                  <button className={`${styles.btn} ${styles.btnApprove}`} type="submit" name="decision" value="approve" disabled={isPending} onClick={() => { pendingDecisionRef.current = 'approve'; }}>
                    <span>{isPending && pendingDecisionRef.current === 'approve' ? 'Approving…' : 'Approve'}</span>
                    <kbd className={styles.kbdBadge}>E</kbd>
                  </button>
                </div>
              </form>
            ) : (
              <p style={{ fontSize: '11px', color: 'var(--muted)', paddingTop: '12px', margin: 0 }}>You do not have the required permissions to make decisions on knowledge edges.</p>
            )}
          </div>
        );
      }}
    />
  );
}
