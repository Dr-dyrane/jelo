'use client';

import { useActionState, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Microscope } from 'lucide-react';
import type {
  PendingResearchTask,
  ResearchAssignmentOption,
  ResearchCanonicalOptions,
  ResearchTaskCursor,
} from '@/lib/moderation/research-tasks';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { IdChip } from '@/components/ops/chips/IdChip';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { InboxContainer, type OpsInboxController } from '@/components/ops/inbox/InboxContainer';
import { useUrlInboxSelection } from '@/components/ops/inbox/use-url-inbox-selection';
import {
  assignResearchTaskAction,
  fetchMoreResearchTasksAction,
  resolveResearchTaskAction,
} from './actions';
import styles from '@/components/ops/inbox/inbox.module.css';
import researchStyles from './research.module.css';

function taskLabel(kind: PendingResearchTask['taskKind']) {
  if (kind === 'product-identity') return 'Product identity';
  if (kind === 'product-retail-refresh') return 'Product availability';
  if (kind === 'retailer-identity') return 'Store identity';
  return 'Store availability';
}

function outcomeOptions(row: PendingResearchTask) {
  if (row.entityKind === 'product') {
    const options = [
      ['existing-canonical-product', 'Match to known product'],
      ['deliberate-intake-candidate', 'Send to product review'],
      ['ambiguous-family', 'Not one exact product'],
      ['bundle', 'Product set'],
      ['dismissed-duplicate', 'Duplicate report'],
    ] as const;
    return row.entitySource === 'canonical'
      ? [options[0]]
      : [options[2], options[3], options[0], options[1], options[4]];
  }
  const options = [
    ['existing-canonical-retailer', 'Match to known store'],
    ['ambiguous-retailer', 'Store is not clear'],
    ['dismissed-duplicate', 'Duplicate report'],
  ] as const;
  return row.entitySource === 'canonical' ? [options[0]] : [options[1], options[0], options[2]];
}

function outcomeNeedsTarget(outcome: string) {
  return outcome === 'existing-canonical-product'
    || outcome === 'deliberate-intake-candidate'
    || outcome === 'existing-canonical-retailer';
}

type QueueState = {
  extraRows: PendingResearchTask[];
  settledIds: string[];
  cursor: ResearchTaskCursor | null;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
};

type QueueAction =
  | { type: 'loading' }
  | { type: 'failed' }
  | { type: 'settled'; id: string }
  | { type: 'loaded'; rows: PendingResearchTask[]; cursor: ResearchTaskCursor | null; hasMore: boolean };

function queueReducer(state: QueueState, action: QueueAction): QueueState {
  if (action.type === 'loading') return { ...state, loading: true, error: null };
  if (action.type === 'failed') return { ...state, loading: false, error: 'Couldn’t load more. Try again.' };
  if (action.type === 'settled') {
    return {
      ...state,
      extraRows: state.extraRows.filter(row => row.id !== action.id),
      settledIds: state.settledIds.includes(action.id) ? state.settledIds : [...state.settledIds, action.id],
    };
  }
  const known = new Set(state.extraRows.map(row => row.id));
  return {
    ...state,
    extraRows: [...state.extraRows, ...action.rows.filter(row => !known.has(row.id))],
    cursor: action.cursor,
    hasMore: action.hasMore,
    loading: false,
    error: null,
  };
}

function orderedRows(initialRows: PendingResearchTask[], state: QueueState) {
  const settled = new Set(state.settledIds);
  const byId = new Map<string, PendingResearchTask>();
  [...state.extraRows, ...initialRows].forEach(row => {
    if (!settled.has(row.id)) byId.set(row.id, row);
  });
  return [...byId.values()].sort((left, right) => (
    left.workRank - right.workRank
    || right.signalCount - left.signalCount
    || left.firstSeenAt.localeCompare(right.firstSeenAt)
    || left.id.localeCompare(right.id)
  ));
}

function ResearchForms({
  row,
  assignmentFormId,
  resolutionFormId,
  assignAction,
  resolveAction,
  pending,
  unreleasedCandidates,
  canAssign,
  assignmentOptions,
  canonicalOptions,
  submittedAction,
}: {
  row: PendingResearchTask;
  assignmentFormId: string;
  resolutionFormId: string;
  assignAction: (payload: FormData) => void;
  resolveAction: (payload: FormData) => void;
  pending: boolean;
  unreleasedCandidates: { id: string; label: string }[];
  canAssign: boolean;
  assignmentOptions: ResearchAssignmentOption[];
  canonicalOptions: ResearchCanonicalOptions;
  submittedAction: string | null;
}) {
  const options = outcomeOptions(row);
  const [outcome, setOutcome] = useState<string>(options[0][0]);
  const [ownerId, setOwnerId] = useState(row.assignedOperatorId ?? '');
  const targetRequired = outcomeNeedsTarget(outcome);
  const canonicalRecords = row.entityKind === 'product'
    ? canonicalOptions.products
    : canonicalOptions.retailers;
  const targetRecords = row.entitySource === 'canonical'
    ? canonicalRecords.filter(record => record.id === row.canonicalTargetRef)
    : canonicalRecords;
  const defaultTarget = targetRecords.some(record => record.id === row.canonicalTargetRef)
    ? row.canonicalTargetRef ?? ''
    : '';

  return (
    <section className={researchStyles.formSection} aria-label="Research decision">
      <form id={assignmentFormId} action={assignAction} aria-busy={pending}>
        <input type="hidden" name="targetId" value={row.id} />
        <div className={styles.decideField}>
          <label className={styles.decideNoteLabel} htmlFor={`next-${row.id}`}>Next evidence step</label>
          <textarea
            id={`next-${row.id}`}
            className={styles.note}
            name="rationale"
            required
            maxLength={2000}
            defaultValue={row.nextAction ?? ''}
            placeholder="What must be checked next?"
            disabled={pending}
          />
        </div>
        {canAssign ? (
          <div className={researchStyles.assignmentEditor}>
            <div className={styles.decideField}>
              <label className={styles.decideNoteLabel} htmlFor={`owner-${row.id}`}>Owner</label>
              <select
                id={`owner-${row.id}`}
                name="targetOperatorId"
                className={researchStyles.select}
                value={ownerId}
                onChange={event => setOwnerId(event.target.value)}
                disabled={pending}
              >
                <option value="">Choose an operator</option>
                {assignmentOptions.map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className={researchStyles.assignmentActions}>
              <button
                className={styles.btn}
                type="submit"
                name="action"
                value="assign"
                disabled={pending || ownerId === '' || ownerId === row.assignedOperatorId}
                aria-busy={pending && submittedAction === 'assign'}
              >
                {pending && submittedAction === 'assign'
                  ? 'Assigning…'
                  : row.assignedOperatorId ? 'Reassign' : 'Assign'}
              </button>
              {row.assignedOperatorId ? (
                <button
                  className={`${styles.btn} ${styles.btnReject}`}
                  type="submit"
                  name="action"
                  value="unassign"
                  disabled={pending}
                  aria-busy={pending && submittedAction === 'unassign'}
                >
                  {pending && submittedAction === 'unassign' ? 'Unassigning…' : 'Unassign'}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </form>

      {row.isOwnedByCurrentOperator ? (
        <form id={resolutionFormId} action={resolveAction} aria-busy={pending}>
          <input type="hidden" name="targetId" value={row.id} />
          <input type="hidden" name="entityKind" value={row.entityKind} />
          <div className={styles.decideField}>
            <label className={styles.decideNoteLabel} htmlFor={`outcome-${row.id}`}>Outcome</label>
            <select
              id={`outcome-${row.id}`}
              name="outcome"
              className={researchStyles.select}
              value={outcome}
              onChange={event => setOutcome(event.target.value)}
              disabled={pending}
            >
              {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          {outcome === 'deliberate-intake-candidate' ? (
            <div className={styles.decideField}>
              <label className={styles.decideNoteLabel} htmlFor={`target-${row.id}`}>Product review record</label>
              <select
                id={`target-${row.id}`}
                name="targetRef"
                className={researchStyles.select}
                required
                defaultValue=""
                disabled={pending}
              >
                <option value="" disabled>Choose an unreleased product</option>
                {unreleasedCandidates.map(candidate => (
                  <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
                ))}
              </select>
            </div>
          ) : targetRequired ? (
            <div className={styles.decideField}>
              <label className={styles.decideNoteLabel} htmlFor={`target-${row.id}`}>Matched record</label>
              <select
                id={`target-${row.id}`}
                name="targetRef"
                className={researchStyles.select}
                defaultValue={defaultTarget}
                required
                disabled={pending}
              >
                {row.entitySource === 'custom' ? <option value="">Choose a reviewed record</option> : null}
                {row.entitySource === 'canonical' && targetRecords.length === 0
                  ? <option value="">No reviewed record available</option>
                  : null}
                {targetRecords.map(record => (
                  <option key={record.id} value={record.id}>{record.label}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className={styles.decideField}>
            <label className={styles.decideNoteLabel} htmlFor={`rationale-${row.id}`}>Decision reason</label>
            <textarea
              id={`rationale-${row.id}`}
              className={styles.note}
              name="rationale"
              required
              maxLength={2000}
              placeholder="Evidence supporting this outcome"
              disabled={pending}
            />
          </div>
        </form>
      ) : null}
    </section>
  );
}

export function ResearchInbox({
  rows,
  canManage,
  canAssign,
  assignmentOptions,
  canonicalOptions,
  initialHasMore,
  initialCursor,
  unreleasedCandidates,
}: {
  rows: PendingResearchTask[];
  canManage: boolean;
  canAssign: boolean;
  assignmentOptions: ResearchAssignmentOption[];
  canonicalOptions: ResearchCanonicalOptions;
  initialHasMore: boolean;
  initialCursor: ResearchTaskCursor | null;
  unreleasedCandidates: { id: string; label: string }[];
}) {
  const router = useRouter();
  const selection = useUrlInboxSelection();
  const controllerRef = useRef<OpsInboxController | null>(null);
  const loadPendingRef = useRef(false);
  const loadSentinelRef = useRef<HTMLDivElement | null>(null);
  const [submittedAction, setSubmittedAction] = useState<string | null>(null);
  const [latestSubmission, setLatestSubmission] = useState<{
    requestId: string;
    targetId: string;
    channel: 'assignment' | 'resolution';
    action: string;
  } | null>(null);
  const [paginationStatus, setPaginationStatus] = useState('');
  const [assignState, dispatchAssignAction, assigning] = useActionState(assignResearchTaskAction, null);
  const [resolveState, dispatchResolveAction, resolving] = useActionState(resolveResearchTaskAction, null);
  const [queueState, dispatch] = useReducer(queueReducer, {
    extraRows: [],
    settledIds: [],
    cursor: initialCursor,
    hasMore: initialHasMore,
    loading: false,
    error: null,
  });
  const loadedRows = useMemo(() => orderedRows(rows, queueState), [rows, queueState]);
  const pending = assigning || resolving;
  const visibleAssignState = latestSubmission?.channel === 'assignment'
    && assignState?.requestId === latestSubmission.requestId
    && assignState.targetId === latestSubmission.targetId
    && assignState.action === latestSubmission.action
    ? assignState
    : null;
  const visibleResolveState = latestSubmission?.channel === 'resolution'
    && resolveState?.requestId === latestSubmission.requestId
    && resolveState.targetId === latestSubmission.targetId
    && resolveState.action === latestSubmission.action
    ? resolveState
    : null;

  const submitAssignment = useCallback((payload: FormData) => {
    const requestId = globalThis.crypto.randomUUID();
    const targetId = payload.get('targetId')?.toString() ?? '';
    const action = payload.get('action')?.toString() ?? '';
    payload.set('requestId', requestId);
    setSubmittedAction(action);
    setLatestSubmission({ requestId, targetId, channel: 'assignment', action });
    dispatchAssignAction(payload);
  }, [dispatchAssignAction]);

  const submitResolution = useCallback((payload: FormData) => {
    const requestId = globalThis.crypto.randomUUID();
    const targetId = payload.get('targetId')?.toString() ?? '';
    const action = payload.get('outcome')?.toString() ?? '';
    payload.set('requestId', requestId);
    setSubmittedAction('resolve');
    setLatestSubmission({ requestId, targetId, channel: 'resolution', action });
    dispatchResolveAction(payload);
  }, [dispatchResolveAction]);

  useEffect(() => {
    if (!visibleAssignState?.ok) return;
    router.refresh();
  }, [visibleAssignState, router]);

  useEffect(() => {
    if (!visibleResolveState?.ok || !visibleResolveState.terminal) return;
    controllerRef.current?.settleItem(visibleResolveState.targetId);
    dispatch({ type: 'settled', id: visibleResolveState.targetId });
  }, [visibleResolveState]);

  useEffect(() => {
    const successful = visibleResolveState?.ok
      ? visibleResolveState
      : visibleAssignState?.ok
        ? visibleAssignState
        : null;
    if (!successful) return;
    const timeout = window.setTimeout(() => {
      setLatestSubmission(current => (
        current?.requestId === successful.requestId ? null : current
      ));
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [visibleAssignState, visibleResolveState]);

  const loadMore = useCallback(async () => {
    if (loadPendingRef.current || queueState.loading || !queueState.hasMore || !queueState.cursor) return;
    loadPendingRef.current = true;
    setLatestSubmission(null);
    dispatch({ type: 'loading' });
    try {
      const result = await fetchMoreResearchTasksAction(
        queueState.cursor.workRank,
        queueState.cursor.signalCount,
        queueState.cursor.firstSeenAt,
        queueState.cursor.id,
      );
      dispatch({ type: 'loaded', rows: result.items, cursor: result.nextCursor, hasMore: result.hasMore });
      setPaginationStatus(result.hasMore
        ? `${result.items.length} more research items loaded.`
        : result.items.length > 0
          ? `${result.items.length} more research items loaded. End of the queue.`
          : 'End of the research queue.');
    } catch (error) {
      console.error('Could not load more research work.', error);
      dispatch({ type: 'failed' });
    } finally {
      loadPendingRef.current = false;
    }
  }, [queueState.cursor, queueState.hasMore, queueState.loading]);

  useEffect(() => {
    if (!queueState.hasMore || !loadSentinelRef.current || typeof IntersectionObserver === 'undefined') return;
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

  return (
    <>
      <InboxContainer
        controllerRef={controllerRef}
        items={loadedRows}
        itemTypeLabel="research item"
        getItemLabel={row => row.entityLabel}
        selectedId={selection.selectedId}
        pendingSelectionId={selection.pendingSelectionId}
        onSelect={item => {
          setSubmittedAction(null);
          setLatestSubmission(null);
          selection.onSelect(item);
        }}
        onDeselect={() => {
          setSubmittedAction(null);
          setLatestSubmission(null);
          selection.onDeselect();
        }}
        renderItemRow={row => (
          <span className={styles.cardInner}>
            <span className={researchStyles.mark} aria-hidden="true">
              {row.image ? (
                <SafeProductImage src={row.image} alt="" className={researchStyles.packshot} />
              ) : <Microscope size={24} strokeWidth={1.6} />}
            </span>
            <span className={styles.cardBody}>
              <span className={styles.cardTitle}>{row.entityLabel}</span>
              <span className={styles.cardSubtext}>{taskLabel(row.taskKind)} · {row.signalCount} report{row.signalCount === 1 ? '' : 's'}</span>
            </span>
            <ChevronRight size={16} className={styles.cardCaret} aria-hidden="true" />
          </span>
        )}
        renderItemDetails={row => {
          const assignmentFormId = `research-assignment-${row.id}`;
          const resolutionFormId = `research-resolution-${row.id}`;
          const ownedByAnother = row.assignedOperatorId != null && !row.isOwnedByCurrentOperator;
          const rowError = visibleAssignState && !visibleAssignState.ok && visibleAssignState.targetId === row.id
            ? visibleAssignState.error
            : visibleResolveState && !visibleResolveState.ok && visibleResolveState.targetId === row.id
              ? visibleResolveState.error
              : null;

          return (
            <div className={styles.detailContent} aria-busy={pending}>
              <div className={styles.detailScroll}>
                <header className={styles.detailHeader}>
                  <div className={researchStyles.identityHeading}>
                    {row.image ? <SafeProductImage src={row.image} alt="" className={researchStyles.detailPackshot} /> : null}
                    <div>
                      <h2 className={styles.detailTitle}>{row.entityLabel}</h2>
                      <div className={styles.detailMeta}>
                        <StatusPill tone={row.workState === 'blocked' ? 'danger' : 'info'}>{row.workState === 'ready' ? 'Ready' : row.workState === 'assigned' ? 'Assigned' : row.workState === 'blocked' ? 'Blocked' : 'Needs another attempt'}</StatusPill>
                        <RelativeTime iso={row.lastSeenAt} />
                      </div>
                    </div>
                  </div>
                </header>
                <section className={styles.detailSection}>
                  <h3 className={styles.sectionLabel}>Work</h3>
                  <div className={styles.propertiesSection}>
                    <div className={styles.propertyRow}><span className={styles.propertyLabel}>Task</span><span className={styles.propertyValue}>{taskLabel(row.taskKind)}</span></div>
                    <div className={styles.propertyRow}><span className={styles.propertyLabel}>Reports</span><span className={styles.propertyValue}>{row.signalCount}</span></div>
                    <div className={styles.propertyRow}><span className={styles.propertyLabel}>Source</span><span className={styles.propertyValue}>{row.entitySource === 'canonical' ? 'Known record' : 'Needs identity review'}</span></div>
                    <div className={styles.propertyRow}><span className={styles.propertyLabel}>Owner</span><span className={styles.propertyValue}>{row.assigneeName ?? 'Unassigned'}</span></div>
                    {row.nextAction ? <div className={styles.propertyRow}><span className={styles.propertyLabel}>Next step</span><span className={`${styles.propertyValue} ${researchStyles.nextAction}`}>{row.nextAction}</span></div> : null}
                  </div>
                </section>
                {canManage && (
                  row.assignedOperatorId === null
                  || row.isOwnedByCurrentOperator
                  || canAssign
                ) ? (
                  <ResearchForms
                    key={`${row.id}:${row.updatedAt}`}
                    row={row}
                    assignmentFormId={assignmentFormId}
                    resolutionFormId={resolutionFormId}
                    assignAction={submitAssignment}
                    resolveAction={submitResolution}
                    pending={pending}
                    unreleasedCandidates={unreleasedCandidates}
                    canAssign={canAssign}
                    assignmentOptions={assignmentOptions}
                    canonicalOptions={canonicalOptions}
                    submittedAction={submittedAction}
                  />
                ) : null}
                <details className={styles.metadataDisclosure}>
                  <summary>Metadata</summary>
                  <div className={styles.metadataBody}>
                    <div className={styles.propertyRow}><span className={styles.propertyLabel}>Task ID</span><span className={styles.propertyValue}><IdChip value={row.id} label="research task" /></span></div>
                    <div className={styles.propertyRow}><span className={styles.propertyLabel}>Reference</span><span className={`${styles.propertyValue} ${researchStyles.nextAction}`}>{row.entityRef}</span></div>
                    <div className={styles.propertyRow}><span className={styles.propertyLabel}>First seen</span><span className={styles.propertyValue}><RelativeTime iso={row.firstSeenAt} /></span></div>
                  </div>
                </details>
              </div>

              <div className={`${styles.decideSection} ${researchStyles.decisionBar}`} data-ops-decision-actions>
                {rowError ? <p role="alert" className={researchStyles.errorNote}>{rowError}</p> : null}
                {!canManage ? <p className={styles.permissionNote}>You cannot manage research work.</p> : ownedByAnother ? (
                  canAssign ? (
                    <button
                      className={styles.btn}
                      type="submit"
                      form={assignmentFormId}
                      name="action"
                      value="takeover"
                      disabled={pending}
                      aria-busy={pending && submittedAction === 'takeover'}
                      onClick={() => setSubmittedAction('takeover')}
                    >
                      {pending && submittedAction === 'takeover' ? 'Taking over…' : 'Take over'}
                    </button>
                  ) : <p className={styles.permissionNote}>This work is assigned to another operator.</p>
                ) : row.isOwnedByCurrentOperator ? (
                  <div className={researchStyles.compactActions}>
                    <button
                      className={`${styles.btn} ${styles.btnReject}`}
                      type="submit"
                      form={assignmentFormId}
                      name="action"
                      value={row.workState === 'blocked' ? 'retry' : 'defer'}
                      disabled={pending}
                      aria-busy={pending && submittedAction === (row.workState === 'blocked' ? 'retry' : 'defer')}
                      onClick={() => setSubmittedAction(row.workState === 'blocked' ? 'retry' : 'defer')}
                    >
                      {pending && submittedAction === (row.workState === 'blocked' ? 'retry' : 'defer')
                        ? 'Saving…'
                        : row.workState === 'blocked' ? 'Try again' : 'Block with reason'}
                    </button>
                    <button
                      className={`${styles.btn} ${styles.btnApprove}`}
                      type="submit"
                      form={resolutionFormId}
                      disabled={pending}
                      aria-busy={pending && submittedAction === 'resolve'}
                      onClick={() => setSubmittedAction('resolve')}
                    >
                      {pending && submittedAction === 'resolve' ? 'Saving…' : 'Record outcome'}
                    </button>
                  </div>
                ) : (
                  <button
                    className={`${styles.btn} ${styles.btnApprove}`}
                    type="submit"
                    form={assignmentFormId}
                    name="action"
                    value="claim"
                    disabled={pending}
                    aria-busy={pending && submittedAction === 'claim'}
                    onClick={() => setSubmittedAction('claim')}
                  >
                    {pending && submittedAction === 'claim' ? 'Assigning…' : 'Assign to me'}
                  </button>
                )}
              </div>
            </div>
          );
        }}
      />
      {visibleAssignState?.ok || visibleResolveState?.ok ? (
        <p className={researchStyles.feedback} role="status">
          {visibleResolveState?.ok ? 'Research outcome recorded.' : 'Research work updated.'}
        </p>
      ) : null}
      {queueState.hasMore ? (
        <div ref={loadSentinelRef} className={researchStyles.loadMore}>
          <button type="button" onClick={() => void loadMore()} disabled={queueState.loading} aria-busy={queueState.loading}>
            {queueState.loading ? 'Loading…' : queueState.error ? 'Try again' : 'Load more'}
          </button>
          {queueState.error ? <span role="alert">{queueState.error}</span> : null}
        </div>
      ) : null}
      <span className={researchStyles.liveStatus} role="status" aria-live="polite" aria-atomic="true">
        {visibleResolveState?.ok
          ? 'Research outcome recorded.'
          : visibleAssignState?.ok
            ? 'Research work updated.'
            : queueState.loading
              ? 'Loading more research work.'
              : paginationStatus}
      </span>
    </>
  );
}
