'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Layers3, PackageOpen, Store } from 'lucide-react';
import type { ContributionReviewItem } from '@/lib/moderation/contribution-presentation';
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
import { useUrlInboxSelection } from '@/components/ops/inbox/use-url-inbox-selection';
import { decideContributionAction } from '../actions';
import { ContributionDetailSkeleton } from './ContributionDetailSkeleton';
import styles from '@/components/ops/inbox/inbox.module.css';
import contributionStyles from './contributions.module.css';

interface ContributionsInboxProps {
  rows: ContributionReviewItem[];
  canDecide: boolean;
}

function ContributionVisual({
  kind,
  image,
  className,
  imageClassName,
  iconSize = 22,
}: {
  kind: ContributionReviewItem['kind'];
  image: string | null;
  className: string;
  imageClassName: string;
  iconSize?: number;
}) {
  const Icon = kind === 'routine' ? Layers3 : kind === 'store' ? Store : PackageOpen;
  return (
    <span className={className} aria-hidden="true">
      {image ? <SafeProductImage src={image} alt="" className={imageClassName} /> : <Icon size={iconSize} strokeWidth={1.65} />}
    </span>
  );
}

function joined(values: string[]) {
  return values.join(', ');
}

export function ContributionsInbox({ rows, canDecide }: ContributionsInboxProps) {
  const selection = useUrlInboxSelection();
  const [actionState, formAction, isPending] = useActionState(decideContributionAction, null);
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null);
  const pendingDecisionRef = useRef<string | null>(null);
  const inboxControllerRef = useRef<OpsInboxController | null>(null);
  const orderedRows = useMemo(() => {
    const chronological = [...rows].sort(
      (left, right) => new Date(left.submittedAt).getTime() - new Date(right.submittedAt).getTime(),
    );
    const upNext = chronological.slice(0, 2);
    const remaining = chronological.slice(2);
    return [
      ...upNext,
      ...remaining.filter(row => row.kind === 'product'),
      ...remaining.filter(row => row.kind === 'routine'),
      ...remaining.filter(row => row.kind === 'store'),
    ];
  }, [rows]);
  const sections = useMemo<InboxCollectionSection<ContributionReviewItem>[]>(() => [
    {
      id: 'up-next',
      label: 'Up next',
      presentation: 'feature-shelf',
      itemIds: orderedRows.slice(0, 2).map(row => row.id),
    },
    {
      id: 'product-submissions',
      label: 'Product submissions',
      presentation: 'compact-rows',
      itemIds: orderedRows.filter((row, index) => index >= 2 && row.kind === 'product').map(row => row.id),
      pagination: { initialCount: 8, pageSize: 8 },
    },
    {
      id: 'routine-submissions',
      label: 'Routine submissions',
      presentation: 'horizontal-rail',
      itemIds: orderedRows.filter((row, index) => index >= 2 && row.kind === 'routine').map(row => row.id),
      pagination: { initialCount: 5, pageSize: 5 },
    },
    {
      id: 'store-submissions',
      label: 'Store submissions',
      presentation: 'compact-rows',
      itemIds: orderedRows.filter((row, index) => index >= 2 && row.kind === 'store').map(row => row.id),
      pagination: { initialCount: 8, pageSize: 8 },
    },
  ], [orderedRows]);

  useEffect(() => {
    if (!actionState?.ok) return;
    inboxControllerRef.current?.settleItem(actionState.targetId);
    pendingDecisionRef.current = null;
  }, [actionState]);

  const actionAnnouncement = actionState?.ok
    ? `Contribution ${actionState.decision === 'approve' ? 'approved' : 'rejected'}.`
    : '';

  return (
    <>
      <InboxContainer
        controllerRef={inboxControllerRef}
        items={orderedRows}
        sections={sections}
        itemTypeLabel="contribution"
        selectedId={selection.selectedId}
        pendingSelectionId={selection.pendingSelectionId}
        onSelect={item => {
          setRejectConfirmId(null);
          selection.onSelect(item);
        }}
        onDeselect={() => {
          setRejectConfirmId(null);
          selection.onDeselect();
        }}
        renderItemRow={(row, _isActive, context) => {
          if (context?.presentation === 'feature-shelf') {
            return (
              <span className={contributionStyles.featureCard}>
                <ContributionVisual
                  kind={row.kind}
                  image={row.image}
                  className={contributionStyles.featureVisual}
                  imageClassName={contributionStyles.featureImage}
                  iconSize={28}
                />
                <span className={contributionStyles.featureCopy}>
                  <span className={contributionStyles.featureEyebrow}>{row.kindLabel}</span>
                  <span className={contributionStyles.featureTitle}>{row.title}</span>
                  <span className={contributionStyles.featureMeta}>
                    <span>{row.summary}</span>
                    <span aria-hidden="true">·</span>
                    <RelativeTime iso={row.submittedAt} />
                  </span>
                </span>
              </span>
            );
          }

          if (context?.presentation === 'horizontal-rail') {
            return (
              <span className={contributionStyles.routineCard}>
                <ContributionVisual
                  kind={row.kind}
                  image={row.image}
                  className={contributionStyles.routineVisual}
                  imageClassName={contributionStyles.routineImage}
                />
                <span className={contributionStyles.routineCopy}>
                  <span className={contributionStyles.routineTitle}>{row.title}</span>
                  <span className={contributionStyles.routineMeta}>
                    {row.summary} · <RelativeTime iso={row.submittedAt} />
                  </span>
                </span>
              </span>
            );
          }

          return (
            <span className={contributionStyles.compactRow}>
              <ContributionVisual
                kind={row.kind}
                image={row.image}
                className={contributionStyles.compactVisual}
                imageClassName={contributionStyles.compactImage}
              />
              <span className={contributionStyles.compactCopy}>
                <span className={contributionStyles.compactTitle}>{row.title}</span>
                <span className={contributionStyles.compactMeta}>
                  {row.summary} · <RelativeTime iso={row.submittedAt} />
                </span>
              </span>
              <ChevronRight size={16} className={contributionStyles.compactCaret} aria-hidden="true" />
            </span>
          );
        }}
        renderItemDetails={(row) => {
          if (selection.pendingSelectionId === row.id) return <ContributionDetailSkeleton />;

          const confirmationId = `reject-contribution-${row.id}`;
          const linkedReportCopy = `${row.pendingLinkedReportCount} ${
            row.pendingLinkedReportCount === 1 ? 'report' : 'reports'
          } waiting`;

          return (
            <div className={styles.detailContent}>
              <div className={styles.detailScroll}>
                <section className={contributionStyles.identitySummary} aria-label="Contribution subject">
                  <ContributionVisual
                    kind={row.kind}
                    image={row.image}
                    className={contributionStyles.identityVisual}
                    imageClassName={contributionStyles.identityImage}
                    iconSize={26}
                  />
                  <div className={contributionStyles.identityCopy}>
                    <h2>{row.title}</h2>
                    <span>{row.kindLabel}</span>
                    <div className={contributionStyles.identityMeta}>
                      {row.needsMatching ? <StatusPill tone="info">Needs matching</StatusPill> : null}
                      <RelativeTime iso={row.submittedAt} />
                    </div>
                  </div>
                </section>

                <section className={styles.detailSection}>
                  <h3 className={styles.sectionLabel}>Submitted details</h3>
                  <div className={styles.propertiesSection}>
                    {row.brandNames.length > 0 ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>Brand</span>
                        <span className={`${styles.propertyValue} ${contributionStyles.multilineValue}`}>
                          {joined(row.brandNames)}
                        </span>
                      </div>
                    ) : null}
                    {row.productNames.length > 0 ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>{row.kind === 'routine' ? 'Products' : 'Product'}</span>
                        <span className={`${styles.propertyValue} ${contributionStyles.multilineValue}`}>
                          {joined(row.productNames)}
                        </span>
                      </div>
                    ) : null}
                    {row.storeNames.length > 0 ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>Store</span>
                        <span className={`${styles.propertyValue} ${contributionStyles.multilineValue}`}>
                          {joined(row.storeNames)}
                        </span>
                      </div>
                    ) : null}
                    {row.purposeNames.length > 0 ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>Used for</span>
                        <span className={`${styles.propertyValue} ${contributionStyles.multilineValue}`}>
                          {joined(row.purposeNames)}
                        </span>
                      </div>
                    ) : null}
                    {row.priceNgn != null ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>Price</span>
                        <span className={styles.propertyValue}><span className={styles.value}>{money(row.priceNgn)}</span></span>
                      </div>
                    ) : null}
                    {row.outcome ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>How it went</span>
                        <span className={styles.propertyValue}>
                          <StatusPill tone={outcomeTone(row.outcome)}>{outcomeLabel(row.outcome)}</StatusPill>
                        </span>
                      </div>
                    ) : null}
                    {row.purchaseDate ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>Bought</span>
                        <span className={styles.propertyValue}><RelativeTime iso={row.purchaseDate} mode="date" /></span>
                      </div>
                    ) : null}
                    {row.pendingLinkedReportCount > 0 ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>Linked reports</span>
                        <span className={styles.propertyValue}>{linkedReportCopy}</span>
                      </div>
                    ) : null}
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Submitted</span>
                      <span className={styles.propertyValue}><RelativeTime iso={row.submittedAt} /></span>
                    </div>
                  </div>
                </section>

                <details className={styles.metadataDisclosure}>
                  <summary>Metadata</summary>
                  <div className={styles.metadataBody}>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Source</span>
                      <span className={styles.propertyValue}>{row.sourceLabel}</span>
                    </div>
                    {row.campaignLabel ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>Campaign</span>
                        <span className={`${styles.propertyValue} ${contributionStyles.multilineValue}`}>
                          {row.campaignLabel}
                        </span>
                      </div>
                    ) : null}
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Keep until</span>
                      <span className={styles.propertyValue}><RelativeTime iso={row.retainUntil} mode="date" /></span>
                    </div>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Contribution ID</span>
                      <span className={styles.propertyValue}><IdChip value={row.id} label="contribution" /></span>
                    </div>
                  </div>
                </details>
              </div>

              {canDecide ? (
                <form data-item-id={row.id} className={styles.decideSection} action={formAction}>
                  <h3 className={styles.sectionLabel}>Decision</h3>
                  {actionState && !actionState.ok && actionState.targetId === row.id ? (
                    <p role="alert" className={`${styles.permissionNote} ${contributionStyles.errorNote}`}>
                      {actionState.error}
                    </p>
                  ) : null}
                  <input type="hidden" name="targetId" value={row.id} />
                  <div className={styles.decideField}>
                    <label htmlFor={`rationale-${row.id}`} className={styles.decideNoteLabel}>Note</label>
                    <textarea
                      id={`rationale-${row.id}`}
                      className={styles.note}
                      name="rationale"
                      placeholder="Optional note"
                      disabled={isPending}
                    />
                  </div>
                  {rejectConfirmId === row.id ? (
                    <div className={contributionStyles.rejectConfirmation} id={confirmationId}>
                      <div>
                        <strong>Reject this submission?</strong>
                        {row.pendingLinkedReportCount > 0 ? (
                          <span>
                            {row.pendingLinkedReportCount} linked {
                              row.pendingLinkedReportCount === 1 ? 'report' : 'reports'
                            } will also be rejected.
                          </span>
                        ) : null}
                      </div>
                      <div className={styles.actionButtons}>
                        <button
                          className={styles.btn}
                          type="button"
                          disabled={isPending}
                          onClick={() => setRejectConfirmId(null)}
                        >
                          Keep
                        </button>
                        <button
                          className={`${styles.btn} ${styles.btnReject}`}
                          type="submit"
                          name="decision"
                          value="reject"
                          aria-describedby={confirmationId}
                          disabled={isPending}
                          onClick={() => { pendingDecisionRef.current = 'reject'; }}
                        >
                          {isPending && pendingDecisionRef.current === 'reject' ? 'Rejecting…' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.actionButtons}>
                      <button
                        className={`${styles.btn} ${styles.btnReject}`}
                        type="button"
                        disabled={isPending}
                        onClick={() => setRejectConfirmId(row.id)}
                      >
                        Reject
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
                  )}
                </form>
              ) : (
                <p className={styles.permissionNote}>You cannot make decisions on contributions.</p>
              )}
            </div>
          );
        }}
      />
      <span className={contributionStyles.liveStatus} role="status" aria-live="polite" aria-atomic="true">
        {actionAnnouncement}
      </span>
    </>
  );
}
