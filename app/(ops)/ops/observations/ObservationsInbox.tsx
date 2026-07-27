'use client';

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  ChevronRight,
  MessageSquareText,
  PackageSearch,
} from 'lucide-react';
import type { ObservationReviewItem } from '@/lib/moderation/observation-presentation';
import { money } from '@/lib/format/money';
import { outcomeLabel, outcomeTone } from '@/lib/humanize/outcomes';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import {
  InboxContainer,
  type InboxCollectionSection,
  type OpsInboxController,
} from '@/components/ops/inbox/InboxContainer';
import { useUrlInboxSelection } from '@/components/ops/inbox/use-url-inbox-selection';
import {
  decideObservationAction,
  fetchMoreObservationsAction,
} from '../actions';
import styles from '@/components/ops/inbox/inbox.module.css';
import observationStyles from './observations.module.css';
import { ObservationDetailSkeleton } from './ObservationDetailSkeleton';

interface ObservationsInboxProps {
  rows: ObservationReviewItem[];
  canDecide: boolean;
  initialHasMore: boolean;
  initialCursor: ObservationCursor | null;
}

type ObservationCursor = {
  createdAt: string;
  id: string;
};

type QueueRuntimeState = {
  extraRows: ObservationReviewItem[];
  settledIds: string[];
  cursor: ObservationCursor | null;
  hasMore: boolean;
  isLoading: boolean;
  loadError: string | null;
};

type QueueRuntimeAction =
  | { type: 'load-start' }
  | {
      type: 'load-success';
      rows: ObservationReviewItem[];
      cursor: ObservationCursor | null;
      hasMore: boolean;
    }
  | { type: 'load-error' }
  | { type: 'settled'; id: string };

function queueRuntimeReducer(
  state: QueueRuntimeState,
  action: QueueRuntimeAction,
): QueueRuntimeState {
  if (action.type === 'load-start') {
    return { ...state, isLoading: true, loadError: null };
  }
  if (action.type === 'load-error') {
    return {
      ...state,
      isLoading: false,
      loadError: 'Couldn’t load more. Try again.',
    };
  }
  if (action.type === 'settled') {
    return {
      ...state,
      extraRows: state.extraRows.filter(row => row.id !== action.id),
      settledIds: state.settledIds.includes(action.id)
        ? state.settledIds
        : [...state.settledIds, action.id],
    };
  }

  const settled = new Set(state.settledIds);
  const knownIds = new Set(state.extraRows.map(row => row.id));
  const newRows = action.rows.filter(row => {
    if (settled.has(row.id) || knownIds.has(row.id)) return false;
    knownIds.add(row.id);
    return true;
  });
  return {
    ...state,
    extraRows: [...state.extraRows, ...newRows],
    cursor: action.cursor,
    hasMore: action.hasMore,
    isLoading: false,
    loadError: null,
  };
}

function observationRows(
  initialRows: ObservationReviewItem[],
  state: QueueRuntimeState,
) {
  const settled = new Set(state.settledIds);
  const byId = new Map<string, ObservationReviewItem>();
  [...initialRows, ...state.extraRows].forEach(row => {
    if (!settled.has(row.id)) byId.set(row.id, row);
  });
  return [...byId.values()].sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return left.createdAt < right.createdAt ? -1 : 1;
    }
    if (left.id === right.id) return 0;
    return left.id < right.id ? -1 : 1;
  });
}

function ObservationVisual({
  row,
  className,
  imageClassName,
  iconSize = 22,
  alt = '',
}: {
  row: ObservationReviewItem;
  className: string;
  imageClassName: string;
  iconSize?: number;
  alt?: string;
}) {
  const Icon = row.identity.state === 'unresolved_product'
    ? PackageSearch
    : MessageSquareText;

  return (
    <span className={className} aria-hidden={alt ? undefined : 'true'}>
      {row.identity.image ? (
        <SafeProductImage
          src={row.identity.image}
          alt={alt}
          className={imageClassName}
        />
      ) : (
        <Icon
          className={observationStyles.visualPlaceholder}
          size={iconSize}
          strokeWidth={1.65}
          aria-hidden="true"
        />
      )}
    </span>
  );
}

function reportedDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.valueOf())) return null;
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function ObservationsInbox({
  rows,
  canDecide,
  initialHasMore,
  initialCursor,
}: ObservationsInboxProps) {
  const selection = useUrlInboxSelection();
  const [actionState, formAction, isDecisionPending] = useActionState(
    decideObservationAction,
    null,
  );
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null);
  const [queueState, dispatchQueue] = useReducer(queueRuntimeReducer, {
    extraRows: [],
    settledIds: [],
    cursor: initialCursor,
    hasMore: initialHasMore,
    isLoading: false,
    loadError: null,
  });
  const pendingDecisionRef = useRef<string | null>(null);
  const loadPendingRef = useRef(false);
  const loadSentinelRef = useRef<HTMLDivElement | null>(null);
  const inboxControllerRef = useRef<OpsInboxController | null>(null);
  const loadedRows = useMemo(
    () => observationRows(rows, queueState),
    [queueState, rows],
  );
  const orderedRows = useMemo(() => {
    const upNext = loadedRows.slice(0, 2);
    const remaining = loadedRows.slice(2);
    return [
      ...upNext,
      ...remaining.filter(row => row.kind === 'price'),
      ...remaining.filter(row => row.kind === 'outcome'),
    ];
  }, [loadedRows]);
  const sections = useMemo<InboxCollectionSection<ObservationReviewItem>[]>(() => [
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
      itemIds: orderedRows
        .filter((row, index) => index >= 2 && row.kind === 'price')
        .map(row => row.id),
      pagination: {
        initialCount: 8,
        pageSize: 8,
      },
    },
    {
      id: 'experience-reports',
      label: 'Experience reports',
      presentation: 'horizontal-rail',
      itemIds: orderedRows
        .filter((row, index) => index >= 2 && row.kind === 'outcome')
        .map(row => row.id),
      pagination: {
        initialCount: 5,
        pageSize: 5,
      },
    },
  ], [orderedRows]);

  const loadMore = useCallback(async () => {
    if (
      loadPendingRef.current
      || queueState.isLoading
      || !queueState.hasMore
      || !queueState.cursor
    ) {
      return;
    }

    loadPendingRef.current = true;
    dispatchQueue({ type: 'load-start' });
    try {
      const result = await fetchMoreObservationsAction(
        queueState.cursor.createdAt,
        queueState.cursor.id,
      );
      dispatchQueue({
        type: 'load-success',
        rows: result.items,
        cursor: result.nextCursor,
        hasMore: result.hasMore,
      });
    } catch (error) {
      console.error('Could not load more observations.', error);
      dispatchQueue({ type: 'load-error' });
    } finally {
      loadPendingRef.current = false;
    }
  }, [
    queueState.cursor,
    queueState.hasMore,
    queueState.isLoading,
  ]);

  useEffect(() => {
    if (!queueState.hasMore || !loadSentinelRef.current) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) void loadMore();
    }, {
      rootMargin: '240px 0px',
      threshold: 0.01,
    });
    observer.observe(loadSentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore, queueState.hasMore]);

  useEffect(() => {
    if (!isDecisionPending) pendingDecisionRef.current = null;
  }, [isDecisionPending]);

  useEffect(() => {
    if (!actionState?.ok) return;
    inboxControllerRef.current?.settleItem(actionState.targetId);
    dispatchQueue({ type: 'settled', id: actionState.targetId });
  }, [actionState]);

  const actionAnnouncement = actionState?.ok
    ? `Report ${actionState.decision === 'approve' ? 'approved' : 'rejected'}.`
    : '';

  if (orderedRows.length === 0 && !queueState.hasMore) {
    return (
      <EmptyState
        title="You’re caught up."
        body="There’s nothing waiting."
        action={{ href: '/ops/activity', label: 'View insights' }}
      />
    );
  }

  return (
    <>
      <InboxContainer
        controllerRef={inboxControllerRef}
        items={orderedRows}
        sections={sections}
        itemTypeLabel="observation"
        getItemLabel={item => item.title}
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
              <span className={observationStyles.featureCard}>
                <ObservationVisual
                  row={row}
                  className={observationStyles.featureVisual}
                  imageClassName={observationStyles.featureImage}
                  iconSize={30}
                />
                <span className={observationStyles.featureCopy}>
                  <span className={observationStyles.featureEyebrow}>
                    {row.kind === 'price' ? 'Price report' : 'Experience report'}
                  </span>
                  <span className={observationStyles.featureTitle}>{row.title}</span>
                  <span className={observationStyles.featureMeta}>
                    <span className={observationStyles.featureValue}>{row.summary}</span>
                    <span aria-hidden="true">·</span>
                    <RelativeTime iso={row.createdAt} />
                  </span>
                </span>
              </span>
            );
          }

          if (context?.presentation === 'horizontal-rail') {
            return (
              <span className={observationStyles.experienceCard}>
                <ObservationVisual
                  row={row}
                  className={observationStyles.experienceVisual}
                  imageClassName={observationStyles.experienceImage}
                />
                <span className={observationStyles.experienceCopy}>
                  <span className={observationStyles.experienceTitle}>{row.title}</span>
                  <span className={observationStyles.experienceMeta}>
                    {row.summary} · <RelativeTime iso={row.createdAt} />
                  </span>
                </span>
              </span>
            );
          }

          return (
            <span className={observationStyles.compactRow}>
              <ObservationVisual
                row={row}
                className={observationStyles.compactImageStage}
                imageClassName={observationStyles.compactImage}
              />
              <span className={observationStyles.compactCopy}>
                <span className={observationStyles.compactTitle}>{row.title}</span>
                <span className={observationStyles.compactMeta}>
                  {row.summary} · <RelativeTime iso={row.createdAt} />
                </span>
              </span>
              <ChevronRight
                className={observationStyles.compactCaret}
                size={16}
                aria-hidden="true"
              />
            </span>
          );
        }}
        renderItemDetails={row => {
          if (selection.pendingSelectionId === row.id) {
            return <ObservationDetailSkeleton />;
          }

          const confirmationId = `reject-observation-${row.id}`;
          const date = reportedDate(row.observedOn);
          const feedback = actionState
            && actionState.targetId === row.id
            && !actionState.ok
            ? (
                <p
                  role="alert"
                  className={`${styles.permissionNote} ${observationStyles.errorNote}`}
                >
                  {actionState.error}
                </p>
              )
            : null;

          return (
            <div className={styles.detailContent}>
              <div className={styles.detailScroll}>
                <section className={styles.productSummary} aria-label="Selected report">
                  <ObservationVisual
                    row={row}
                    className={observationStyles.detailVisual}
                    imageClassName={observationStyles.detailImage}
                    iconSize={28}
                    alt={row.identity.image ? row.title : ''}
                  />
                  <div className={styles.productCopy}>
                    <h2 className={styles.detailTitle}>{row.title}</h2>
                    <span>{row.identity.detail}</span>
                    <div className={styles.detailMeta}>
                      <StatusPill tone={row.kind === 'price' ? 'success' : 'warning'}>
                        {row.kind === 'price' ? 'Price' : 'Experience'}
                      </StatusPill>
                      <RelativeTime iso={row.createdAt} />
                    </div>
                  </div>
                </section>

                <section className={styles.detailSection}>
                  <h3 className={styles.sectionLabel}>Evidence</h3>
                  <div className={styles.propertiesSection}>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>
                        {row.kind === 'price' ? 'Price' : 'Experience'}
                      </span>
                      <span className={styles.propertyValue}>
                        {row.kind === 'price'
                          ? <span className={styles.value}>{money(row.amountNgn)}</span>
                          : row.outcome
                            ? (
                                <StatusPill tone={outcomeTone(row.outcome)}>
                                  {outcomeLabel(row.outcome)}
                                </StatusPill>
                              )
                            : 'Needs review'}
                      </span>
                    </div>
                    {date ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>Bought</span>
                        <span className={styles.propertyValue}>{date}</span>
                      </div>
                    ) : null}
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Reported</span>
                      <span className={styles.propertyValue}>
                        <RelativeTime iso={row.createdAt} />
                      </span>
                    </div>
                  </div>
                </section>

                <details className={styles.metadataDisclosure}>
                  <summary>Record details</summary>
                  <div className={styles.metadataBody}>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Contribution</span>
                      <span className={styles.propertyValue}>
                        <IdChip value={row.contributionId} label="contribution" />
                      </span>
                    </div>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Report</span>
                      <span className={styles.propertyValue}>
                        <IdChip value={row.id} label="observation" />
                      </span>
                    </div>
                  </div>
                </details>
              </div>

              {canDecide ? (
                <form
                  data-item-id={row.id}
                  className={styles.decideSection}
                  action={formAction}
                >
                  <h3 className={styles.sectionLabel}>Decision</h3>
                  {feedback}
                  <p className={observationStyles.decisionBoundary}>
                    This accepts the community report only.
                  </p>
                  <input type="hidden" name="targetId" value={row.id} />
                  <div className={styles.decideField}>
                    <label
                      htmlFor={`rationale-${row.id}`}
                      className={styles.decideNoteLabel}
                    >
                      Note
                    </label>
                    <textarea
                      id={`rationale-${row.id}`}
                      className={styles.note}
                      name="rationale"
                      placeholder="Optional note"
                      disabled={isDecisionPending}
                    />
                  </div>
                  {rejectConfirmId === row.id ? (
                    <div
                      className={observationStyles.rejectConfirmation}
                      id={confirmationId}
                    >
                      <div>
                        <strong>Reject this report?</strong>
                        <span>This removes only this report from the review queue.</span>
                      </div>
                      <div className={styles.actionButtons} data-ops-decision-actions>
                        <button
                          className={styles.btn}
                          type="button"
                          disabled={isDecisionPending}
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
                          disabled={isDecisionPending}
                          onClick={() => {
                            pendingDecisionRef.current = 'reject';
                          }}
                        >
                          {isDecisionPending && pendingDecisionRef.current === 'reject'
                            ? 'Rejecting…'
                            : 'Reject'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.actionButtons} data-ops-decision-actions>
                      <button
                        className={`${styles.btn} ${styles.btnReject}`}
                        type="button"
                        disabled={isDecisionPending}
                        onClick={() => setRejectConfirmId(row.id)}
                      >
                        Reject
                      </button>
                      <button
                        className={`${styles.btn} ${styles.btnApprove}`}
                        type="submit"
                        name="decision"
                        value="approve"
                        disabled={isDecisionPending}
                        onClick={() => {
                          pendingDecisionRef.current = 'approve';
                        }}
                      >
                        {isDecisionPending && pendingDecisionRef.current === 'approve'
                          ? 'Approving…'
                          : 'Approve'}
                      </button>
                    </div>
                  )}
                </form>
              ) : (
                <p className={`${styles.decideSection} ${styles.permissionNote}`}>
                  You cannot make decisions on observations.
                </p>
              )}
            </div>
          );
        }}
      />
      {queueState.hasMore ? (
        <div ref={loadSentinelRef} className={observationStyles.loadMore}>
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={queueState.isLoading}
          >
            {queueState.isLoading
              ? 'Loading…'
              : queueState.loadError
                ? 'Try again'
                : 'Load more'}
          </button>
          {queueState.loadError ? (
            <span role="alert">{queueState.loadError}</span>
          ) : queueState.isLoading ? (
            <span role="status" aria-live="polite">
              Loading more observations.
            </span>
          ) : null}
        </div>
      ) : null}
      <span
        className={observationStyles.liveStatus}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {actionAnnouncement}
      </span>
    </>
  );
}
