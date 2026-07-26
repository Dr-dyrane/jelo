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
  BookOpenText,
  ChevronRight,
  Package,
  Store,
  Tag,
} from 'lucide-react';
import type {
  VocabularyReviewItem,
  VocabularyTarget,
  VocabularyValueKind,
} from '@/lib/moderation/vocabulary-presentation';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import {
  InboxContainer,
  type InboxCollectionSection,
  type OpsInboxController,
} from '@/components/ops/inbox/InboxContainer';
import { useUrlInboxSelection } from '@/components/ops/inbox/use-url-inbox-selection';
import {
  decideModerationValueAction,
  fetchMoreVocabularyAction,
  mapModerationValueAction,
} from '../actions';
import { VocabularyDetailSkeleton } from './VocabularyDetailSkeleton';
import { VocabularyTargetPicker } from './VocabularyTargetPicker';
import styles from '@/components/ops/inbox/inbox.module.css';
import vocabularyStyles from './vocabulary.module.css';

interface VocabularyInboxProps {
  rows: VocabularyReviewItem[];
  targets: VocabularyTarget[];
  canDecide: boolean;
  canMap: boolean;
  initialHasMore: boolean;
  initialCursor: VocabularyCursor | null;
}

type VocabularyCursor = {
  activeMentionCount: number;
  firstSeenAt: string;
  id: string;
};

type QueueRuntimeState = {
  extraRows: VocabularyReviewItem[];
  settledIds: string[];
  cursor: VocabularyCursor | null;
  hasMore: boolean;
  isLoading: boolean;
  loadError: string | null;
};

type QueueRuntimeAction =
  | { type: 'load-start' }
  | {
      type: 'load-success';
      rows: VocabularyReviewItem[];
      cursor: VocabularyCursor | null;
      hasMore: boolean;
    }
  | { type: 'load-error' }
  | { type: 'settled'; id: string };

function queueRuntimeReducer(
  state: QueueRuntimeState,
  action: QueueRuntimeAction,
): QueueRuntimeState {
  if (action.type === 'load-start') return { ...state, isLoading: true, loadError: null };
  if (action.type === 'load-error') {
    return { ...state, isLoading: false, loadError: 'Couldn’t load more. Try again.' };
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

function vocabularyRows(initialRows: VocabularyReviewItem[], state: QueueRuntimeState) {
  const settled = new Set(state.settledIds);
  const byId = new Map<string, VocabularyReviewItem>();
  [...initialRows, ...state.extraRows].forEach(row => {
    if (!settled.has(row.id)) byId.set(row.id, row);
  });
  return [...byId.values()];
}

const groupedKinds: VocabularyValueKind[] = ['product', 'retailer', 'brand', 'purpose'];

const groupLabels: Record<VocabularyValueKind, string> = {
  product: 'Products',
  retailer: 'Stores',
  brand: 'Brands',
  purpose: 'Uses',
};

function VocabularyMark({
  kind,
  size = 22,
}: {
  kind: VocabularyValueKind;
  size?: number;
}) {
  const Icon = kind === 'product'
    ? Package
    : kind === 'retailer'
      ? Store
      : kind === 'brand'
        ? Tag
        : BookOpenText;
  return <Icon size={size} strokeWidth={1.65} aria-hidden="true" />;
}

export function VocabularyInbox({
  rows,
  targets,
  canDecide,
  canMap,
  initialHasMore,
  initialCursor,
}: VocabularyInboxProps) {
  const selection = useUrlInboxSelection();
  const [decideState, decideAction, isDecidePending] = useActionState(decideModerationValueAction, null);
  const [mapState, mapAction, isMapPending] = useActionState(mapModerationValueAction, null);
  const [submittedAction, setSubmittedAction] = useState<string | null>(null);
  const [submittedTitle, setSubmittedTitle] = useState('Term');
  const [selectedTarget, setSelectedTarget] = useState<{
    rowId: string;
    target: VocabularyTarget;
  } | null>(null);
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null);
  const [queueState, dispatchQueue] = useReducer(queueRuntimeReducer, {
    extraRows: [],
    settledIds: [],
    cursor: initialCursor,
    hasMore: initialHasMore,
    isLoading: false,
    loadError: null,
  });
  const loadPendingRef = useRef(false);
  const loadSentinelRef = useRef<HTMLDivElement | null>(null);
  const inboxControllerRef = useRef<OpsInboxController | null>(null);
  const loadedRows = useMemo(() => vocabularyRows(rows, queueState), [queueState, rows]);
  const orderedRows = useMemo(() => {
    const upNext = loadedRows.slice(0, 2);
    const remaining = loadedRows.slice(2);
    return [
      ...upNext,
      ...groupedKinds.flatMap(kind => remaining.filter(row => row.valueKind === kind)),
    ];
  }, [loadedRows]);
  const sections = useMemo<InboxCollectionSection<VocabularyReviewItem>[]>(() => {
    const upNextIds = orderedRows.slice(0, 2).map(row => row.id);
    const remaining = orderedRows.slice(2);
    return [
      {
        id: 'up-next',
        label: 'Up next',
        presentation: 'feature-shelf',
        itemIds: upNextIds,
      },
      ...groupedKinds.map(kind => ({
        id: `${kind}-terms`,
        label: groupLabels[kind],
        presentation: 'compact-rows' as const,
        itemIds: remaining.filter(row => row.valueKind === kind).map(row => row.id),
        pagination: { initialCount: 8, pageSize: 8 },
      })),
    ];
  }, [orderedRows]);
  const isPending = isDecidePending || isMapPending;
  const errorState = submittedAction === null
    ? null
    : submittedAction === 'map'
      ? mapState && !mapState.ok ? mapState : null
      : decideState && !decideState.ok ? decideState : null;

  const loadMore = useCallback(async () => {
    if (
      loadPendingRef.current
      || queueState.isLoading
      || !queueState.hasMore
      || !queueState.cursor
    ) return;

    loadPendingRef.current = true;
    dispatchQueue({ type: 'load-start' });
    try {
      const result = await fetchMoreVocabularyAction(
        queueState.cursor.activeMentionCount,
        queueState.cursor.firstSeenAt,
        queueState.cursor.id,
      );
      dispatchQueue({
        type: 'load-success',
        rows: result.items,
        cursor: result.nextCursor,
        hasMore: result.hasMore,
      });
    } catch (error) {
      console.error('Could not load more vocabulary.', error);
      dispatchQueue({ type: 'load-error' });
    } finally {
      loadPendingRef.current = false;
    }
  }, [queueState.cursor, queueState.hasMore, queueState.isLoading]);

  useEffect(() => {
    if (!queueState.hasMore || !loadSentinelRef.current) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) void loadMore();
    }, {
      root: document.querySelector<HTMLElement>('[data-ops-main]'),
      rootMargin: '240px 0px',
      threshold: 0.01,
    });
    observer.observe(loadSentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore, queueState.hasMore]);

  useEffect(() => {
    if (!decideState?.ok) return;
    dispatchQueue({ type: 'settled', id: decideState.targetId });
    inboxControllerRef.current?.settleItem(decideState.targetId);
  }, [decideState]);

  useEffect(() => {
    if (!mapState?.ok) return;
    dispatchQueue({ type: 'settled', id: mapState.targetId });
    inboxControllerRef.current?.settleItem(mapState.targetId);
  }, [mapState]);

  const successfulState = submittedAction === null
    ? null
    : submittedAction === 'map'
      ? mapState?.ok ? mapState : null
      : decideState?.ok ? decideState : null;
  const settledTitle = successfulState ? submittedTitle : null;
  const actionAnnouncement = successfulState
    ? successfulState.decision === 'map'
      ? `${settledTitle} linked.`
      : successfulState.decision === 'approve'
        ? `${settledTitle} kept.`
        : `${settledTitle} marked not useful.`
    : '';
  const appendedAnnouncement = queueState.isLoading
    ? 'Loading more terms.'
    : queueState.extraRows.length > 0
      ? `${queueState.extraRows.length} more terms loaded.`
      : '';

  return (
    <>
      <InboxContainer
        controllerRef={inboxControllerRef}
        items={orderedRows}
        sections={sections}
        itemTypeLabel="term"
        getItemLabel={row => row.title}
        selectedId={selection.selectedId}
        pendingSelectionId={selection.pendingSelectionId}
        onSelect={item => {
          setSubmittedAction(null);
          setSelectedTarget(null);
          setRejectConfirmId(null);
          selection.onSelect(item);
        }}
        onDeselect={() => {
          setSubmittedAction(null);
          setSelectedTarget(null);
          setRejectConfirmId(null);
          selection.onDeselect();
        }}
        renderItemRow={(row, _isActive, context) => {
          if (context?.presentation === 'feature-shelf') {
            return (
              <span className={vocabularyStyles.featureCard}>
                <span className={vocabularyStyles.featureVisual}>
                  <VocabularyMark kind={row.valueKind} size={34} />
                </span>
                <span className={vocabularyStyles.featureCopy}>
                  <span className={vocabularyStyles.featureEyebrow}>{row.kindLabel}</span>
                  <span className={vocabularyStyles.featureTitle}>{row.title}</span>
                  <span className={vocabularyStyles.featureMeta}>
                    <span>{row.summary}</span>
                    <span aria-hidden="true">·</span>
                    <RelativeTime iso={row.lastSeenAt} />
                  </span>
                </span>
              </span>
            );
          }

          return (
            <span className={vocabularyStyles.compactRow}>
              <span className={vocabularyStyles.compactMark}>
                <VocabularyMark kind={row.valueKind} />
              </span>
              <span className={vocabularyStyles.compactCopy}>
                <span className={vocabularyStyles.compactTitle}>{row.title}</span>
                <span className={vocabularyStyles.compactMeta}>
                  <span>{row.summary}</span>
                  <span aria-hidden="true">·</span>
                  <RelativeTime iso={row.lastSeenAt} />
                </span>
              </span>
              <ChevronRight size={16} className={vocabularyStyles.compactCaret} aria-hidden="true" />
            </span>
          );
        }}
        renderItemDetails={row => {
          if (selection.pendingSelectionId === row.id) return <VocabularyDetailSkeleton />;
          const rowTarget = selectedTarget?.rowId === row.id ? selectedTarget.target : null;
          const confirmationId = `reject-term-${row.id}`;
          return (
            <div className={styles.detailContent}>
              <div className={styles.detailScroll}>
                <section className={vocabularyStyles.identitySummary} aria-label="Community term">
                  <div className={vocabularyStyles.identityCopy}>
                    <h2>{row.title}</h2>
                    <span>{row.kindLabel} · {row.summary}</span>
                  </div>
                </section>

                <section className={styles.detailSection}>
                  <h3 className={styles.sectionLabel}>Where it appeared</h3>
                  <ol className={vocabularyStyles.reportList}>
                    {row.recentContexts.map(context => (
                      <li key={`${context.submittedAt}:${context.title}`}>
                        <div>
                          <strong>{context.title}</strong>
                          {context.detail ? <span>{context.detail}</span> : null}
                        </div>
                        <RelativeTime iso={context.submittedAt} />
                      </li>
                    ))}
                  </ol>
                </section>

                <section className={styles.detailSection}>
                  <h3 className={styles.sectionLabel}>Seen</h3>
                  <div className={styles.propertiesSection}>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Reports</span>
                      <span className={styles.propertyValue}>{row.activeMentionCount}</span>
                    </div>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Shared in</span>
                      <span className={`${styles.propertyValue} ${vocabularyStyles.contextValue}`}>
                        {row.contextLabels.join(', ')}
                      </span>
                    </div>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>First</span>
                      <span className={styles.propertyValue}><RelativeTime iso={row.firstSeenAt} /></span>
                    </div>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Latest</span>
                      <span className={styles.propertyValue}><RelativeTime iso={row.lastSeenAt} /></span>
                    </div>
                  </div>
                </section>

                <details className={styles.metadataDisclosure}>
                  <summary>Metadata</summary>
                  <div className={styles.metadataBody}>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Term ID</span>
                      <span className={styles.propertyValue}><IdChip value={row.id} label="term" /></span>
                    </div>
                  </div>
                </details>
              </div>

              {canDecide || canMap ? (
                <form data-item-id={row.id} className={styles.decideSection} action={decideAction}>
                  <h3 className={styles.sectionLabel}>Choose what it means</h3>
                  {errorState && errorState.targetId === row.id ? (
                    <p role="alert" className={`${styles.permissionNote} ${vocabularyStyles.errorNote}`}>
                      {errorState.error}
                    </p>
                  ) : null}
                  <input type="hidden" name="targetId" value={row.id} />

                  {canMap ? (
                    <VocabularyTargetPicker
                      term={row.title}
                      valueKind={row.valueKind}
                      targets={targets}
                      selected={rowTarget}
                      disabled={isPending}
                      onSelect={target => setSelectedTarget(target ? { rowId: row.id, target } : null)}
                    />
                  ) : null}

                  <details className={vocabularyStyles.noteDisclosure}>
                    <summary>Add note</summary>
                    <div className={styles.decideField}>
                      <label htmlFor={`rationale-${row.id}`} className="sr-only">Note</label>
                      <textarea
                        id={`rationale-${row.id}`}
                        className={styles.note}
                        name="rationale"
                        placeholder="Optional"
                        disabled={isPending}
                      />
                    </div>
                  </details>

                  {rejectConfirmId === row.id ? (
                    <div className={vocabularyStyles.rejectConfirmation} id={confirmationId}>
                      <div>
                        <strong>Mark this as not useful?</strong>
                        <span>The original reports stay unchanged.</span>
                      </div>
                      <div className={styles.actionButtons}>
                        <button
                          className={styles.btn}
                          type="button"
                          disabled={isPending}
                          onClick={() => setRejectConfirmId(null)}
                        >
                          Keep reviewing
                        </button>
                        <button
                          className={`${styles.btn} ${styles.btnReject}`}
                          type="submit"
                          name="decision"
                          value="reject"
                          formNoValidate
                          disabled={isPending}
                          onClick={() => {
                            setSubmittedTitle(row.title);
                            setSubmittedAction('reject');
                          }}
                        >
                          {isDecidePending && submittedAction === 'reject' ? 'Saving…' : 'Not useful'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={vocabularyStyles.decisionActions}>
                      {canMap ? (
                        <button
                          className={`${styles.btn} ${vocabularyStyles.matchButton}`}
                          type="submit"
                          formAction={mapAction}
                          disabled={isPending || !rowTarget}
                          onClick={() => {
                            setSubmittedTitle(row.title);
                            setSubmittedAction('map');
                          }}
                        >
                          {isMapPending && submittedAction === 'map' ? 'Saving…' : 'Same as known'}
                        </button>
                      ) : null}
                      {canDecide ? (
                        <button
                          className={`${styles.btn} ${vocabularyStyles.researchButton}`}
                          type="submit"
                          name="decision"
                          value="approve"
                          formNoValidate
                          disabled={isPending}
                          onClick={() => {
                            setSubmittedTitle(row.title);
                            setSubmittedAction('approve');
                          }}
                        >
                          {isDecidePending && submittedAction === 'approve' ? 'Saving…' : 'Keep as new'}
                        </button>
                      ) : null}
                      {canDecide ? (
                        <button
                          className={`${styles.btn} ${vocabularyStyles.notUsefulButton}`}
                          type="button"
                          disabled={isPending}
                          aria-controls={confirmationId}
                          aria-expanded="false"
                          onClick={() => setRejectConfirmId(row.id)}
                        >
                          Not useful
                        </button>
                      ) : null}
                    </div>
                  )}
                </form>
              ) : (
                <p className={styles.permissionNote}>Vocabulary is view only for this role.</p>
              )}
            </div>
          );
        }}
      />
      {queueState.hasMore ? (
        <div ref={loadSentinelRef} className={vocabularyStyles.loadMore}>
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
          {queueState.loadError ? <span role="alert">{queueState.loadError}</span> : null}
        </div>
      ) : null}
      <span className={vocabularyStyles.liveStatus} role="status" aria-live="polite" aria-atomic="true">
        {actionAnnouncement || appendedAnnouncement}
      </span>
    </>
  );
}
