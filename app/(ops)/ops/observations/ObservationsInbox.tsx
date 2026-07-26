'use client';

import { useActionState, useEffect, useMemo, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { PendingObservation } from '@/lib/moderation/queues';
import type { Product } from '@/data/products';
import { humanizeRef } from '@/lib/humanize/refs';
import { money } from '@/lib/format/money';
import { outcomeLabel, outcomeTone } from '@/lib/humanize/outcomes';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import {
  InboxContainer,
  type InboxCollectionSection,
  type OpsInboxController,
} from '@/components/ops/inbox/InboxContainer';
import { decideObservationAction } from '../actions';
import styles from '@/components/ops/inbox/inbox.module.css';
import observationStyles from './observations.module.css';

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

function observationSummary(row: EnrichedObservation) {
  if (row.kind === 'price') return money(row.amountNgn);
  if (row.outcome) return outcomeLabel(row.outcome);
  return 'Community report';
}

export function ObservationsInbox({ rows, canDecide }: ObservationsInboxProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [actionState, formAction, isPending] = useActionState(decideObservationAction, null);
  const pendingDecisionRef = useRef<string | null>(null);
  const inboxControllerRef = useRef<OpsInboxController | null>(null);
  const selectedId = searchParams.get('id');
  const orderedRows = useMemo(() => {
    const upNext = rows.slice(0, 2);
    const remaining = rows.slice(2);
    return [
      ...upNext,
      ...remaining.filter(row => row.kind === 'price'),
      ...remaining.filter(row => row.kind === 'outcome'),
    ];
  }, [rows]);
  const sections = useMemo<InboxCollectionSection<EnrichedObservation>[]>(() => [
    {
      id: 'up-next',
      label: 'Up next',
      presentation: 'feature-shelf',
      itemIds: orderedRows.slice(0, 2).map(row => row.id),
    },
    {
      id: 'price-reports',
      label: 'Price reports',
      presentation: 'compact-rows',
      itemIds: orderedRows.filter((row, index) => index >= 2 && row.kind === 'price').map(row => row.id),
    },
    {
      id: 'experience-reports',
      label: 'Experience reports',
      presentation: 'horizontal-rail',
      itemIds: orderedRows.filter((row, index) => index >= 2 && row.kind === 'outcome').map(row => row.id),
    },
  ], [orderedRows]);

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
    if (actionState?.ok) inboxControllerRef.current?.settleItem(actionState.targetId);
  }, [actionState]);

  return (
    <InboxContainer
      controllerRef={inboxControllerRef}
      items={orderedRows}
      sections={sections}
      itemTypeLabel="observation"
      selectedId={selectedId}
      onSelect={item => setSelectedId(item.id)}
      onDeselect={() => setSelectedId(null)}
      renderItemRow={(row, isActive, context) => {
        const subject = humanizeRef(row.subjectRef);
        const title = observationTitle(row);
        const image = row.product?.image || subject.image || '/product-placeholder.svg';

        if (context?.presentation === 'feature-shelf') {
          return (
            <span className={`${observationStyles.featureCard} ${isActive ? observationStyles.selectedSurface : ''}`}>
              <span className={observationStyles.featureVisual}>
                <SafeProductImage src={image} alt="" className={observationStyles.featureImage} />
              </span>
              <span className={observationStyles.featureCopy}>
                <span className={observationStyles.featureEyebrow}>
                  {row.kind === 'price' ? 'Price report' : 'Experience report'}
                </span>
                <span className={observationStyles.featureTitle}>{title}</span>
                <span className={observationStyles.featureMeta}>
                  <span className={observationStyles.featureValue}>{observationSummary(row)}</span>
                  <span aria-hidden="true">·</span>
                  <RelativeTime iso={row.createdAt} />
                </span>
              </span>
            </span>
          );
        }

        if (context?.presentation === 'horizontal-rail') {
          return (
            <span className={`${observationStyles.experienceCard} ${isActive ? observationStyles.selectedSurface : ''}`}>
              <span className={observationStyles.experienceVisual}>
                <SafeProductImage src={image} alt="" className={observationStyles.experienceImage} />
              </span>
              <span className={observationStyles.experienceCopy}>
                <span className={observationStyles.experienceTitle}>{title}</span>
                <span className={observationStyles.experienceMeta}>
                  {observationSummary(row)} · <RelativeTime iso={row.createdAt} />
                </span>
              </span>
            </span>
          );
        }

        return (
          <span className={observationStyles.compactRow}>
            <span className={observationStyles.compactImageStage}>
              <SafeProductImage src={image} alt="" className={observationStyles.compactImage} />
            </span>
            <span className={observationStyles.compactCopy}>
              <span className={observationStyles.compactTitle}>{title}</span>
              <span className={observationStyles.compactMeta}>
                {observationSummary(row)} · <RelativeTime iso={row.createdAt} />
              </span>
            </span>
            <ChevronRight className={observationStyles.compactCaret} size={16} aria-hidden="true" />
          </span>
        );
      }}
      renderItemDetails={(row) => {
        const subject = humanizeRef(row.subjectRef);
        const title = observationTitle(row);
        const image = row.product?.image || subject.image || '/product-placeholder.svg';
        const feedback = actionState && actionState.targetId === row.id && !actionState.ok
          ? <p className={styles.permissionNote} style={{ color: 'var(--state-danger)' }}>{actionState.error}</p>
          : null;

        return (
          <div className={styles.detailContent}>
            <div className={styles.detailScroll}>
              <section className={styles.productSummary} aria-label="Product summary">
                <SafeProductImage src={image} alt="" className={styles.productImage} />
                <div className={styles.productCopy}>
                  <h2 className={styles.detailTitle}>{title}</h2>
                  <span>{row.product ? `${row.product.category} · ${row.product.size}` : subject.kind || 'Community submission'}</span>
                  <div className={styles.detailMeta}>
                    <StatusPill tone={row.kind === 'price' ? 'success' : 'warning'}>{row.kind}</StatusPill>
                    <RelativeTime iso={row.createdAt} />
                  </div>
                </div>
              </section>

              <section className={styles.detailSection}>
                <h3 className={styles.sectionLabel}>Evidence</h3>
                <div className={styles.propertiesSection}>
                  <div className={styles.propertyRow}>
                    <span className={styles.propertyLabel}>Reported value</span>
                    <span className={styles.propertyValue}>
                      {row.kind === 'price'
                        ? <span className={styles.value}>{money(row.amountNgn)}</span>
                        : row.outcome
                          ? <StatusPill tone={outcomeTone(row.outcome)}>{outcomeLabel(row.outcome)}</StatusPill>
                          : '—'}
                    </span>
                  </div>
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
            </div>

            {canDecide ? (
              <form data-item-id={row.id} className={styles.decideSection} action={formAction}>
                <input type="hidden" name="targetId" value={row.id} />
                <h3 className={styles.sectionLabel}>Decision</h3>
                {feedback}
                <div className={styles.decideField}>
                  <label htmlFor={`rationale-${row.id}`} className={styles.decideNoteLabel}>Rationale</label>
                  <textarea
                    id={`rationale-${row.id}`}
                    className={styles.note}
                    name="rationale"
                    placeholder="Optional note for the audit trail"
                    disabled={isPending}
                  />
                </div>
                <div className={styles.actionButtons}>
                  <button className={`${styles.btn} ${styles.btnReject}`} type="submit" name="decision" value="reject" disabled={isPending} onClick={() => { pendingDecisionRef.current = 'reject'; }}>
                    {isPending && pendingDecisionRef.current === 'reject' ? 'Rejecting…' : 'Reject'}
                  </button>
                  <button className={`${styles.btn} ${styles.btnApprove}`} type="submit" name="decision" value="approve" disabled={isPending} onClick={() => { pendingDecisionRef.current = 'approve'; }}>
                    {isPending && pendingDecisionRef.current === 'approve' ? 'Approving…' : 'Approve'}
                  </button>
                </div>
              </form>
            ) : <p className={styles.permissionNote}>You do not have permission to decide observations.</p>}
          </div>
        );
      }}
    />
  );
}
