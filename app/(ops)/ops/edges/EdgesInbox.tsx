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
import { ChevronRight, Waypoints } from 'lucide-react';
import type {
  EdgeReviewItem,
  RelationshipFamily,
  RelationshipMatchState,
} from '@/lib/moderation/edge-presentation';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { StatusPill, type PillTone } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import {
  InboxContainer,
  type InboxCollectionSection,
  type InboxItemRenderContext,
  type OpsInboxController,
} from '@/components/ops/inbox/InboxContainer';
import { useUrlInboxSelection } from '@/components/ops/inbox/use-url-inbox-selection';
import {
  decideEdgeAction,
  fetchMoreRelationshipsAction,
} from '../actions';
import { RelationshipDetailSkeleton } from './RelationshipDetailSkeleton';
import styles from '@/components/ops/inbox/inbox.module.css';
import edgeStyles from './edges.module.css';

interface EdgesInboxProps {
  rows: EdgeReviewItem[];
  canDecide: boolean;
  initialHasMore: boolean;
  initialCursor: RelationshipCursor | null;
}

type RelationshipCursor = {
  createdAt: string;
  id: string;
};

type QueueRuntimeState = {
  extraRows: EdgeReviewItem[];
  settledIds: string[];
  cursor: RelationshipCursor | null;
  hasMore: boolean;
  isLoading: boolean;
  loadError: string | null;
};

type QueueRuntimeAction =
  | { type: 'load-start' }
  | {
      type: 'load-success';
      rows: EdgeReviewItem[];
      cursor: RelationshipCursor | null;
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

  const existingIds = new Set(state.extraRows.map(row => row.id));
  return {
    ...state,
    extraRows: [
      ...state.extraRows,
      ...action.rows.filter(row => !existingIds.has(row.id)),
    ],
    cursor: action.cursor,
    hasMore: action.hasMore,
    isLoading: false,
    loadError: null,
  };
}

function relationshipRows(
  initialRows: EdgeReviewItem[],
  state: QueueRuntimeState,
) {
  const settled = new Set(state.settledIds);
  const byId = new Map<string, EdgeReviewItem>();
  [...initialRows, ...state.extraRows].forEach(row => {
    if (!settled.has(row.id)) byId.set(row.id, row);
  });
  return [...byId.values()];
}

function matchTone(state: RelationshipMatchState): PillTone {
  return state === 'unresolved' ? 'warning' : 'info';
}

function displayValue(value: EdgeReviewItem['subject']) {
  return value.detail ? `${value.detail} · ${value.label}` : value.label;
}

function kindLabel(value: EdgeReviewItem['subject']) {
  return value.kindLabel.replace(/\s+contribution$/i, '');
}

function supportingValue(row: EdgeReviewItem) {
  return row.title.localeCompare(row.object.label, 'en-NG', {
    sensitivity: 'base',
  }) === 0
    ? null
    : row.object.label;
}

function RelationshipVisual({
  row,
  className,
  imageClassName,
  iconSize = 22,
}: {
  row: EdgeReviewItem;
  className: string;
  imageClassName: string;
  iconSize?: number;
}) {
  return (
    <span className={className} aria-hidden="true">
      {row.image ? (
        <SafeProductImage src={row.image} alt="" className={imageClassName} />
      ) : (
        <Waypoints size={iconSize} strokeWidth={1.65} />
      )}
    </span>
  );
}

function hasFamily(row: EdgeReviewItem, families: RelationshipFamily[]) {
  return families.includes(row.family);
}

export function EdgesInbox({
  rows,
  canDecide,
  initialHasMore,
  initialCursor,
}: EdgesInboxProps) {
  const selection = useUrlInboxSelection();
  const [actionState, formAction, isPending] = useActionState(decideEdgeAction, null);
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
    () => relationshipRows(rows, queueState),
    [queueState, rows],
  );
  const sections = useMemo<InboxCollectionSection<EdgeReviewItem>[]>(() => {
    const upNext = loadedRows.slice(0, 2);
    const remaining = loadedRows.slice(2);
    return [
      {
        id: 'up-next',
        label: 'Up next',
        presentation: 'feature-shelf',
        itemIds: upNext.map(row => row.id),
      },
      {
        id: 'product-context',
        label: 'Product context',
        presentation: 'compact-rows',
        itemIds: remaining
          .filter(row => hasFamily(row, ['uses', 'products', 'brands']))
          .map(row => row.id),
        pagination: {
          initialCount: 12,
          pageSize: 12,
        },
      },
      {
        id: 'stores',
        label: 'Stores',
        presentation: 'horizontal-rail',
        itemIds: remaining
          .filter(row => row.family === 'stores')
          .map(row => row.id),
        pagination: {
          initialCount: 5,
          pageSize: 5,
        },
      },
      {
        id: 'reports',
        label: 'Results and prices',
        presentation: 'compact-rows',
        itemIds: remaining
          .filter(row => hasFamily(row, ['experiences', 'prices', 'other']))
          .map(row => row.id),
        pagination: {
          initialCount: 12,
          pageSize: 12,
        },
      },
    ];
  }, [loadedRows]);

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
      const result = await fetchMoreRelationshipsAction(
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
      console.error('Could not load more relationships.', error);
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
    if (!actionState?.ok) return;
    inboxControllerRef.current?.settleItem(actionState.targetId);
    dispatchQueue({ type: 'settled', id: actionState.targetId });
    pendingDecisionRef.current = null;
  }, [actionState]);

  const actionAnnouncement = actionState?.ok
    ? `Relationship ${actionState.decision === 'approve' ? 'approved' : 'rejected'}.`
    : '';

  return (
    <>
      <InboxContainer
        controllerRef={inboxControllerRef}
        items={loadedRows}
        sections={sections}
        itemTypeLabel="relationship"
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
        renderItemRow={(row, _isActive, context?: InboxItemRenderContext) => {
          const supportingText = supportingValue(row);
          const presentation = context?.presentation ?? 'compact-rows';

          return (
            <span
              className={edgeStyles.relationshipRow}
              data-presentation={presentation}
            >
              <RelationshipVisual
                row={row}
                className={edgeStyles.relationshipVisual}
                imageClassName={edgeStyles.relationshipImage}
              />
              <span className={edgeStyles.relationshipCopy}>
                <span className={edgeStyles.relationshipKicker}>{row.relationshipLabel}</span>
                <span className={edgeStyles.relationshipTitle}>{row.title}</span>
                {supportingText ? (
                  <span className={edgeStyles.relationshipSentence}>{supportingText}</span>
                ) : null}
                <span className={edgeStyles.relationshipMeta}>
                  <RelativeTime iso={row.createdAt} />
                </span>
              </span>
              <ChevronRight
                size={16}
                className={edgeStyles.relationshipCaret}
                aria-hidden="true"
              />
            </span>
          );
        }}
        renderItemDetails={row => {
          if (selection.pendingSelectionId === row.id) {
            return <RelationshipDetailSkeleton />;
          }

          const confirmationId = `reject-relationship-${row.id}`;
          const matchingNeedsAttention = row.matchingState === 'needs_matching'
            || row.matchingState === 'unresolved';

          return (
            <div className={styles.detailContent}>
              <div className={styles.detailScroll}>
                <section
                  className={edgeStyles.identitySummary}
                  aria-label="Selected relationship"
                >
                  <RelationshipVisual
                    row={row}
                    className={edgeStyles.identityVisual}
                    imageClassName={edgeStyles.identityImage}
                    iconSize={28}
                  />
                  <div className={edgeStyles.identityCopy}>
                    <h2>{row.title}</h2>
                    <p>{row.summary}</p>
                    <div className={edgeStyles.identityMeta}>
                      {matchingNeedsAttention && row.matchingLabel ? (
                        <StatusPill tone={matchTone(row.matchingState)}>
                          {row.matchingLabel}
                        </StatusPill>
                      ) : null}
                      <RelativeTime iso={row.createdAt} />
                    </div>
                  </div>
                </section>

                <section className={styles.detailSection}>
                  <h3 className={styles.sectionLabel}>Details</h3>
                  <div className={styles.propertiesSection}>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>{kindLabel(row.subject)}</span>
                      <span className={`${styles.propertyValue} ${edgeStyles.multilineValue}`}>
                        {displayValue(row.subject)}
                      </span>
                    </div>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Connection</span>
                      <span className={`${styles.propertyValue} ${edgeStyles.multilineValue}`}>
                        {row.relationshipLabel}
                      </span>
                    </div>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>{kindLabel(row.object)}</span>
                      <span className={`${styles.propertyValue} ${edgeStyles.multilineValue}`}>
                        {displayValue(row.object)}
                      </span>
                    </div>
                    {row.reportedDate ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>Bought</span>
                        <span className={styles.propertyValue}>{row.reportedDate}</span>
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

                {row.linkedConsequences.length > 0 ? (
                  <section className={styles.detailSection}>
                    <h3 className={styles.sectionLabel}>Separate review</h3>
                    <ul className={edgeStyles.consequenceList}>
                      {row.linkedConsequences.map(consequence => (
                        <li key={consequence.kind}>
                          <strong>{consequence.label}</strong>
                          <span>{consequence.detail}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <details className={styles.metadataDisclosure}>
                  <summary>Metadata</summary>
                  <div className={styles.metadataBody}>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Relationship</span>
                      <span className={styles.propertyValue}>
                        <IdChip value={row.metadata.relationshipId} label="relationship" />
                      </span>
                    </div>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Contribution</span>
                      <span className={styles.propertyValue}>
                        <IdChip value={row.metadata.contributionId} label="contribution" />
                      </span>
                    </div>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Stored connection</span>
                      <span className={`${styles.propertyValue} ${edgeStyles.multilineValue}`}>
                        {row.metadata.raw.relationship}
                      </span>
                    </div>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>From reference</span>
                      <span className={`${styles.propertyValue} ${edgeStyles.multilineValue}`}>
                        {row.metadata.raw.subjectRef}
                      </span>
                    </div>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>To reference</span>
                      <span className={`${styles.propertyValue} ${edgeStyles.multilineValue}`}>
                        {row.metadata.raw.objectRef}
                      </span>
                    </div>
                  </div>
                </details>
              </div>

              {canDecide ? (
                <form data-item-id={row.id} className={styles.decideSection} action={formAction}>
                  <h3 className={styles.sectionLabel}>Decision</h3>
                  {actionState && !actionState.ok && actionState.targetId === row.id ? (
                    <p role="alert" className={`${styles.permissionNote} ${edgeStyles.errorNote}`}>
                      {actionState.error}
                    </p>
                  ) : null}
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
                      disabled={isPending}
                    />
                  </div>
                  {rejectConfirmId === row.id ? (
                    <div className={edgeStyles.rejectConfirmation} id={confirmationId}>
                      <div>
                        <strong>Reject this relationship?</strong>
                        <span>This removes only this relationship from the review queue.</span>
                      </div>
                      <div className={styles.actionButtons} data-ops-decision-actions>
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
                          {isPending && pendingDecisionRef.current === 'reject'
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
                        {isPending && pendingDecisionRef.current === 'approve'
                          ? 'Approving…'
                          : 'Approve'}
                      </button>
                    </div>
                  )}
                </form>
              ) : (
                <p className={styles.permissionNote}>
                  You cannot make decisions on relationships.
                </p>
              )}
            </div>
          );
        }}
      />
      {queueState.hasMore ? (
        <div ref={loadSentinelRef} className={edgeStyles.loadMore}>
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
            <span role="status" aria-live="polite">Loading more relationships.</span>
          ) : null}
        </div>
      ) : null}
      <span
        className={edgeStyles.liveStatus}
        role="status" aria-live="polite"
        aria-atomic="true"
      >
        {actionAnnouncement}
      </span>
    </>
  );
}
