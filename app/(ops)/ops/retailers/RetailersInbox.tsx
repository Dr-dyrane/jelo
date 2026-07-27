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
import { ChevronRight, Store } from 'lucide-react';
import type { RetailerApplicationReviewItem } from '@/lib/moderation/retailer-presentation';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { InboxContainer, type OpsInboxController } from '@/components/ops/inbox/InboxContainer';
import { useUrlInboxSelection } from '@/components/ops/inbox/use-url-inbox-selection';
import { decideRetailerApplicationAction } from '../actions';
import { fetchMoreRetailerApplicationsAction } from './actions';
import styles from '@/components/ops/inbox/inbox.module.css';
import retailerStyles from './retailers.module.css';

interface RetailersInboxProps {
  rows: RetailerApplicationReviewItem[];
  canDecide: boolean;
  initialHasMore: boolean;
  initialCursor: RetailerApplicationCursor | null;
}

type RetailerApplicationCursor = {
  submittedAt: string;
  id: string;
};

type QueueRuntimeState = {
  extraRows: RetailerApplicationReviewItem[];
  settledIds: string[];
  cursor: RetailerApplicationCursor | null;
  hasMore: boolean;
  isLoading: boolean;
  loadError: string | null;
};

type QueueRuntimeAction =
  | { type: 'load-start' }
  | {
      type: 'load-success';
      rows: RetailerApplicationReviewItem[];
      cursor: RetailerApplicationCursor | null;
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

function retailerApplicationRows(
  initialRows: RetailerApplicationReviewItem[],
  state: QueueRuntimeState,
) {
  const settled = new Set(state.settledIds);
  const byId = new Map<string, RetailerApplicationReviewItem>();
  [...initialRows, ...state.extraRows].forEach(row => {
    if (!settled.has(row.id)) byId.set(row.id, row);
  });
  return [...byId.values()].sort((left, right) => {
    if (left.submittedAt !== right.submittedAt) {
      return left.submittedAt < right.submittedAt ? -1 : 1;
    }
    if (left.id === right.id) return 0;
    return left.id < right.id ? -1 : 1;
  });
}

function ContactLink({ display, href }: { display: string | null; href: string | null }) {
  if (!display) return '—';
  if (!href) return display;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={retailerStyles.link}>
      {display}
    </a>
  );
}

function JoinedValues({ values }: { values: string[] }) {
  if (values.length === 0) return '—';
  return <span title={values.join(', ')}>{values.join(', ')}</span>;
}

export function RetailersInbox({
  rows,
  canDecide,
  initialHasMore,
  initialCursor,
}: RetailersInboxProps) {
  const selection = useUrlInboxSelection();
  const [actionState, formAction, isPending] = useActionState(decideRetailerApplicationAction, null);
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
    () => retailerApplicationRows(rows, queueState),
    [queueState, rows],
  );

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
      const result = await fetchMoreRetailerApplicationsAction(
        queueState.cursor.submittedAt,
        queueState.cursor.id,
      );
      dispatchQueue({
        type: 'load-success',
        rows: result.items,
        cursor: result.nextCursor,
        hasMore: result.hasMore,
      });
    } catch (error) {
      console.error('Could not load more retailer applications.', error);
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
      root: document.querySelector<HTMLElement>('[data-ops-main]'),
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
    ? `Retailer application ${actionState.decision === 'approve' ? 'approved' : 'rejected'}.`
    : '';

  if (loadedRows.length === 0 && !queueState.hasMore) {
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
        items={loadedRows}
        itemTypeLabel="retailer application"
        getItemLabel={row => row.storeName}
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
        renderItemRow={(row) => (
          <span className={retailerStyles.retailerRow}>
            <span className={retailerStyles.retailerVisual} aria-hidden="true">
              <Store size={22} strokeWidth={1.65} />
            </span>
            <span className={retailerStyles.retailerCopy}>
              <span className={retailerStyles.retailerTitle}>{row.storeName}</span>
              <span className={retailerStyles.retailerMeta}>
                <StatusPill tone={row.emailVerifiedAt ? 'success' : 'danger'}>
                  {row.emailStatusLabel}
                </StatusPill>
                <RelativeTime iso={row.submittedAt} />
              </span>
            </span>
            <ChevronRight size={16} className={retailerStyles.retailerCaret} aria-hidden="true" />
          </span>
        )}
        renderItemDetails={(row) => {
          const confirmationId = `reject-retailer-${row.id}`;

          return (
            <div className={styles.detailContent}>
              <div className={styles.detailScroll}>
                <section className={retailerStyles.identitySummary} aria-label="Selected retailer application">
                  <span className={retailerStyles.identityVisual} aria-hidden="true">
                    <Store size={28} strokeWidth={1.65} />
                  </span>
                  <div className={retailerStyles.identityCopy}>
                    <h2>{row.storeName}</h2>
                    <p className={retailerStyles.identityEmail}>
                      Primary email: <a href={`mailto:${row.email}`} className={retailerStyles.link}>{row.email}</a>
                    </p>
                    <div className={retailerStyles.identityMeta}>
                      <StatusPill tone={row.emailVerifiedAt ? 'success' : 'danger'}>
                        {row.emailStatusLabel}
                      </StatusPill>
                      <RelativeTime iso={row.submittedAt} />
                    </div>
                  </div>
                </section>

                <section className={styles.detailSection}>
                  <h3 className={styles.sectionLabel}>Details</h3>
                  <div className={styles.propertiesSection}>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Location</span>
                      <span className={`${styles.propertyValue} ${retailerStyles.multilineValue}`} title={row.location.display}>
                        {row.location.display}
                      </span>
                    </div>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Phone</span>
                      <span className={styles.propertyValue}>
                        <ContactLink {...row.phone} />
                      </span>
                    </div>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>WhatsApp</span>
                      <span className={styles.propertyValue}>
                        <ContactLink {...row.whatsapp} />
                      </span>
                    </div>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Website</span>
                      <span className={styles.propertyValue}>
                        <ContactLink {...row.website} />
                      </span>
                    </div>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Instagram</span>
                      <span className={styles.propertyValue}>
                        <ContactLink {...row.instagram} />
                      </span>
                    </div>
                    {row.facebook.display ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>Facebook</span>
                        <span className={styles.propertyValue}>
                          <ContactLink {...row.facebook} />
                        </span>
                      </div>
                    ) : null}
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Channels</span>
                      <span className={styles.propertyValue}>
                        <JoinedValues values={row.channels} />
                      </span>
                    </div>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Brands</span>
                      <span className={styles.propertyValue}>
                        <JoinedValues values={row.brands} />
                      </span>
                    </div>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Services</span>
                      <span className={styles.propertyValue}>
                        <JoinedValues values={row.services} />
                      </span>
                    </div>
                    {row.sample.product ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>Sample</span>
                        <span className={`${styles.propertyValue} ${retailerStyles.multilineValue}`}>
                          {row.sample.product} {row.sample.priceDisplay}
                        </span>
                      </div>
                    ) : null}
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Submitted</span>
                      <span className={styles.propertyValue}>
                        <RelativeTime iso={row.submittedAt} />
                      </span>
                    </div>
                  </div>
                </section>

                <details className={styles.metadataDisclosure}>
                  <summary>Metadata</summary>
                  <div className={styles.metadataBody}>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Application ID</span>
                      <span className={styles.propertyValue}>
                        <IdChip value={row.metadata.applicationId} label="application" />
                      </span>
                    </div>
                  </div>
                </details>
              </div>

              {canDecide ? (
                <form data-item-id={row.id} className={styles.decideSection} action={formAction}>
                  {actionState && !actionState.ok && actionState.targetId === row.id && (
                    <p role="alert" className={`${styles.permissionNote} ${retailerStyles.errorNote}`}>
                      {actionState.error}
                    </p>
                  )}
                  <input type="hidden" name="targetId" value={row.id} />
                  <div className={styles.decideField}>
                    <label htmlFor={`rationale-${row.id}`} className={styles.decideNoteLabel}>Note</label>
                    <textarea id={`rationale-${row.id}`} className={styles.note} name="rationale" placeholder="Optional note" aria-label="Decision note" disabled={isPending} />
                  </div>
                  {rejectConfirmId === row.id ? (
                    <div className={retailerStyles.rejectConfirmation} id={confirmationId}>
                      <div>
                        <strong>Reject this application?</strong>
                        <span>This removes the application from the review queue. It does not publish a retailer.</span>
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
                          {isPending && pendingDecisionRef.current === 'reject' ? 'Rejecting…' : 'Reject'}
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
                        {isPending && pendingDecisionRef.current === 'approve' ? 'Approving…' : 'Approve'}
                      </button>
                    </div>
                  )}
                </form>
              ) : (
                <p className={styles.permissionNote}>
                  You cannot make decisions on retailer applications.
                </p>
              )}
            </div>
          );
        }}
      />
      {queueState.hasMore ? (
        <div ref={loadSentinelRef} className={retailerStyles.loadMore}>
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
              Loading more retailer applications.
            </span>
          ) : null}
        </div>
      ) : null}
      <span className={retailerStyles.liveStatus} role="status" aria-live="polite" aria-atomic="true">
        {actionAnnouncement}
      </span>
    </>
  );
}
