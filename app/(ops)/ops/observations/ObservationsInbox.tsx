'use client';

import type { PendingObservation } from '@/lib/moderation/queues';
import type { Product } from '@/data/products';
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

export interface EnrichedObservation extends PendingObservation {
  product?: Product;
}

interface ObservationsInboxProps {
  rows: EnrichedObservation[];
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

        // Price comparison details
        let priceComparisonPill = null;
        let averagePriceNgn: number | null = null;
        if (row.kind === 'price' && row.amountNgn != null && row.product?.offers) {
          const prices = row.product.offers
            .map(o => o.priceNgn)
            .filter((p): p is number => p != null && p > 0);
          
          if (prices.length > 0) {
            averagePriceNgn = prices.reduce((sum, p) => sum + p, 0) / prices.length;
            const diff = row.amountNgn - averagePriceNgn;
            const pct = (diff / averagePriceNgn) * 100;

            if (pct <= -20) {
              priceComparisonPill = <StatusPill tone="success">{`Low Price (${Math.round(pct)}%)`}</StatusPill>;
            } else if (pct >= 20) {
              priceComparisonPill = <StatusPill tone="danger">{`High Price (+${Math.round(pct)}%)`}</StatusPill>;
            } else {
              priceComparisonPill = <StatusPill tone="info">Typical Price</StatusPill>;
            }
          }
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Title / Target */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                Observation Target
              </div>
              <ProductRef subject={subject} />
            </div>

            {/* Rich Product Details Block */}
            {row.product ? (
              <div style={{
                display: 'flex',
                gap: 'var(--space-3)',
                background: 'var(--card)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-card)',
                boxShadow: 'var(--elevation-1)',
                marginTop: '4px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  position: 'relative',
                  background: 'var(--cream)',
                  borderRadius: 'var(--radius-control)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0
                }}>
                  <img
                    src={row.product.image || '/product-placeholder.svg'}
                    alt={row.product.name}
                    style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                  <strong style={{ fontSize: '11.5px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {row.product.brand} {row.product.name}
                  </strong>
                  <span style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
                    Category: {row.product.category} · Size: {row.product.size}
                  </span>
                </div>
              </div>
            ) : null}

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
              {priceComparisonPill ? (
                <div className={styles.propertyRow}>
                  <span className={styles.propertyLabel}>Analysis</span>
                  <span className={styles.propertyValue}>{priceComparisonPill}</span>
                </div>
              ) : null}
              {averagePriceNgn ? (
                <div className={styles.propertyRow}>
                  <span className={styles.propertyLabel}>Avg Price</span>
                  <span className={styles.propertyValue}>{money(averagePriceNgn)}</span>
                </div>
              ) : null}
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
