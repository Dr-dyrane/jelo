'use client';

import { useActionState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { PendingObservation } from '@/lib/moderation/queues';
import type { Product } from '@/data/products';
import { humanizeRef } from '@/lib/humanize/refs';
import { money } from '@/lib/format/money';
import { outcomeLabel, outcomeTone } from '@/lib/humanize/outcomes';
import { ProductRef } from '@/components/ops/chips/ProductRef';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { InboxContainer } from '@/components/ops/inbox/InboxContainer';
import { decideObservationAction, type ObservationActionResult } from '../actions';
import styles from '@/components/ops/inbox/inbox.module.css';

export interface EnrichedObservation extends PendingObservation {
  product?: Product;
}

interface ObservationsInboxProps {
  rows: EnrichedObservation[];
  canDecide: boolean;
}

function detailFeedback(state: ObservationActionResult | null, rowId: string): ReactNode {
  if (!state) return null;
  if ('targetId' in state && state.targetId !== rowId) return null;
  if (state.ok) {
    return <p style={{ margin: 0, fontSize: '11px', color: 'var(--state-success)' }}>Recorded {state.decision}.</p>;
  }
  return <p style={{ margin: 0, fontSize: '11px', color: 'var(--state-danger)' }}>{state.error}</p>;
}

export function ObservationsInbox({ rows, canDecide }: ObservationsInboxProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [actionState, formAction, isPending] = useActionState(decideObservationAction, null);

  const selectedId = searchParams.get('id');

  function setSelectedId(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) {
      params.set('id', id);
    } else {
      params.delete('id');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <InboxContainer
      items={rows}
      itemTypeLabel="observation"
      selectedId={selectedId}
      onSelect={item => setSelectedId(item.id)}
      onDeselect={() => setSelectedId(null)}
      renderItemRow={(row, isActive) => {
        const subject = humanizeRef(row.subjectRef);
        const image = row.product?.image || subject.image || '/product-placeholder.svg';
        const title = row.product
          ? `${row.product.brand} ${row.product.name}`
          : subject.brand
            ? `${subject.brand} ${subject.name}`
            : subject.name;
        return (
          <div className={styles.cardInner}>
            <div className={styles.cardMedia}>
              <SafeProductImage src={image} alt={title} />
            </div>
            <div className={styles.cardBody}>
              <div className={styles.cardTitle}>{title}</div>
              <div className={styles.cardSubtext}>
                {row.kind === 'price' ? money(row.amountNgn) : row.outcome ? outcomeLabel(row.outcome) : '—'}
                {' · '}
                <RelativeTime iso={row.createdAt} />
              </div>
            </div>
            <ChevronRight
              size={16}
              className={`${styles.cardCaret} ${isActive ? styles.cardCaretActive : ''}`}
              aria-hidden="true"
            />
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
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
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
                  <SafeProductImage
                    src={row.product.image || '/product-placeholder.svg'}
                    alt={row.product.name}
                    className=""
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
                action={formAction}
              >
                <input type="hidden" name="targetId" value={row.id} />
                {detailFeedback(actionState, row.id)}
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
                  <button className={`${styles.btn} ${styles.btnReject}`} type="submit" name="decision" value="reject" disabled={isPending}>
                    {isPending ? 'Working…' : 'Reject (R)'}
                  </button>
                  <button className={`${styles.btn} ${styles.btnApprove}`} type="submit" name="decision" value="approve" disabled={isPending}>
                    {isPending ? 'Working…' : 'Approve (E)'}
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
