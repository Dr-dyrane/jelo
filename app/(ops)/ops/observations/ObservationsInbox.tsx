'use client';

import { useActionState, useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { PendingObservation } from '@/lib/moderation/queues';
import type { Product } from '@/data/products';
import { humanizeRef } from '@/lib/humanize/refs';
import { money } from '@/lib/format/money';
import { outcomeLabel, outcomeTone } from '@/lib/humanize/outcomes';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { InboxContainer, type OpsInboxController } from '@/components/ops/inbox/InboxContainer';
import { decideObservationAction } from '../actions';
import styles from '@/components/ops/inbox/inbox.module.css';

export interface EnrichedObservation extends PendingObservation {
  product?: Product;
}

interface ObservationsInboxProps {
  rows: EnrichedObservation[];
  canDecide: boolean;
}

function observationTitle(row: EnrichedObservation) {
  const subject = humanizeRef(row.subjectRef);
  if (row.product) return `${row.product.brand} ${row.product.name}`;
  return subject.brand ? `${subject.brand} ${subject.name}` : subject.name;
}

export function ObservationsInbox({ rows, canDecide }: ObservationsInboxProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [actionState, formAction, isPending] = useActionState(decideObservationAction, null);
  const pendingDecisionRef = useRef<string | null>(null);
  const inboxControllerRef = useRef<OpsInboxController | null>(null);

  const selectedId = searchParams.get('id');

  function setSelectedId(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set('id', id);
    else params.delete('id');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (!isPending) pendingDecisionRef.current = null;
  }, [isPending]);

  useEffect(() => {
    if (!actionState?.ok) return;
    inboxControllerRef.current?.settleItem(actionState.targetId);
  }, [actionState]);

  return (
    <InboxContainer
      controllerRef={inboxControllerRef}
      items={rows}
      itemTypeLabel="observation"
      selectedId={selectedId}
      onSelect={item => setSelectedId(item.id)}
      onDeselect={() => setSelectedId(null)}
      renderItemRow={(row) => {
        const subject = humanizeRef(row.subjectRef);
        const image = row.product?.image || subject.image || '/product-placeholder.svg';
        const title = observationTitle(row);
        const primaryValue = row.kind === 'price'
          ? money(row.amountNgn)
          : row.outcome
            ? outcomeLabel(row.outcome)
            : 'Awaiting context';

        return (
          <div className={styles.cardInner}>
            <SafeProductImage src={image} alt={title} className={styles.cardImage} />
            <div className={styles.cardBody}>
              <div className={styles.cardTitle}>{title}</div>
              <div className={styles.cardSubtext}>
                {primaryValue} · <RelativeTime iso={row.createdAt} />
              </div>
            </div>
            <ChevronRight size={16} className={styles.cardCaret} aria-hidden="true" strokeWidth={1.75} />
          </div>
        );
      }}
      renderItemDetails={(row) => {
        const subject = humanizeRef(row.subjectRef);
        const title = observationTitle(row);
        const image = row.product?.image || subject.image || '/product-placeholder.svg';

        let priceComparisonPill = null;
        let averagePriceNgn: number | null = null;
        if (row.kind === 'price' && row.amountNgn != null && row.product?.offers) {
          const prices = row.product.offers
            .map(offer => offer.priceNgn)
            .filter((price): price is number => price != null && price > 0);

          if (prices.length > 0) {
            averagePriceNgn = prices.reduce((sum, price) => sum + price, 0) / prices.length;
            const percentage = ((row.amountNgn - averagePriceNgn) / averagePriceNgn) * 100;

            if (percentage <= -20) {
              priceComparisonPill = <StatusPill tone="success">{`${Math.abs(Math.round(percentage))}% below average`}</StatusPill>;
            } else if (percentage >= 20) {
              priceComparisonPill = <StatusPill tone="danger">{`${Math.round(percentage)}% above average`}</StatusPill>;
            } else {
              priceComparisonPill = <StatusPill tone="info">Within normal range</StatusPill>;
            }
          }
        }

        const feedback = (() => {
          if (!actionState) return null;
          if ('targetId' in actionState && actionState.targetId !== row.id) return null;
          if (actionState.ok) return null;
          return <p className={styles.permissionNote} style={{ color: 'var(--state-danger)' }}>{actionState.error}</p>;
        })();

        return (
          <div className={styles.detailContent}>
            <header className={styles.detailHeader}>
              <p className={styles.detailEyebrow}>Observation</p>
              <h2 className={styles.detailTitle}>{title}</h2>
              <div className={styles.detailMeta}>
                <StatusPill tone={row.kind === 'price' ? 'success' : 'warning'}>{row.kind}</StatusPill>
                <RelativeTime iso={row.createdAt} />
              </div>
            </header>

            <section className={styles.productSummary} aria-label="Product summary">
              <SafeProductImage src={image} alt={title} className={styles.productImage} />
              <div className={styles.productCopy}>
                <strong>{title}</strong>
                <span>
                  {row.product
                    ? `${row.product.category} · ${row.product.size}`
                    : subject.kind || 'Community submission'}
                </span>
              </div>
            </section>

            <section className={styles.detailSection}>
              <h3 className={styles.sectionLabel}>Evidence</h3>
              <div className={styles.propertiesSection}>
                <div className={styles.propertyRow}>
                  <span className={styles.propertyLabel}>Observed value</span>
                  <span className={styles.propertyValue}>
                    {row.kind === 'price'
                      ? <span className={styles.value}>{money(row.amountNgn)}</span>
                      : row.outcome
                        ? <StatusPill tone={outcomeTone(row.outcome)}>{outcomeLabel(row.outcome)}</StatusPill>
                        : '—'}
                  </span>
                </div>
                {priceComparisonPill ? (
                  <div className={styles.propertyRow}>
                    <span className={styles.propertyLabel}>Market signal</span>
                    <span className={styles.propertyValue}>{priceComparisonPill}</span>
                  </div>
                ) : null}
                {averagePriceNgn != null ? (
                  <div className={styles.propertyRow}>
                    <span className={styles.propertyLabel}>Average offer</span>
                    <span className={styles.propertyValue}>{money(averagePriceNgn)}</span>
                  </div>
                ) : null}
                <div className={styles.propertyRow}>
                  <span className={styles.propertyLabel}>Reported</span>
                  <span className={styles.propertyValue}><RelativeTime iso={row.createdAt} /></span>
                </div>
              </div>
            </section>

            <details className={styles.metadataDisclosure}>
              <summary>Metadata</summary>
              <div className={styles.metadataBody}>
                <div className={styles.propertyRow}>
                  <span className={styles.propertyLabel}>Contribution ID</span>
                  <span className={styles.propertyValue}><IdChip value={row.contributionId} label="contribution" /></span>
                </div>
                <div className={styles.propertyRow}>
                  <span className={styles.propertyLabel}>Observation ID</span>
                  <span className={styles.propertyValue}><IdChip value={row.id} label="observation" /></span>
                </div>
              </div>
            </details>

            {canDecide ? (
              <form data-item-id={row.id} className={styles.decideSection} action={formAction}>
                <input type="hidden" name="targetId" value={row.id} />
                <h3 className={styles.sectionLabel}>Decision</h3>
                {feedback}
                <div className={styles.decideField}>
                  <label htmlFor={`rationale-${row.id}`} className={styles.decideNoteLabel}>
                    Rationale
                  </label>
                  <textarea
                    id={`rationale-${row.id}`}
                    className={styles.note}
                    name="rationale"
                    placeholder="Optional note for the audit trail"
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
                    {isPending && pendingDecisionRef.current === 'reject' ? 'Rejecting…' : 'Reject'}
                  </button>
                  <button
                    className={`${styles.btn} ${styles.btnApprove}`}
                    type="submit"
                    name="decision"
                    value="approve"
                    disabled={isPending}
                    onClick={() => { pendingDecisionRef.current = 'approve'; }}
                  >
                    {isPending && pendingDecisionRef.current === 'approve' ? 'Approving…' : 'Approve'}
                  </button>
                </div>
              </form>
            ) : (
              <p className={styles.permissionNote}>You do not have permission to decide observations.</p>
            )}
          </div>
        );
      }}
    />
  );
}
