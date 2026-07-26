'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { ChevronRight, PanelTopOpen, X } from 'lucide-react';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { useContextFab } from '@/components/ops/shell/OpsShellContext';
import type { OverviewBriefingReadModel, OverviewQueue } from './overview-briefing';
import styles from './overview.module.css';

function subscribeToDetailPane(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

function getDetailPaneSnapshot() {
  return document.getElementById('ops-detail-pane');
}

function subscribeToDesktopViewport(onStoreChange: () => void) {
  const query = window.matchMedia('(min-width: 1180px)');
  query.addEventListener('change', onStoreChange);
  return () => query.removeEventListener('change', onStoreChange);
}

function getDesktopViewportSnapshot() {
  return window.matchMedia('(min-width: 1180px)').matches;
}

function QueueAge({ queue }: { queue: OverviewQueue }) {
  if (queue.pendingCount === 0) return <>Nothing awaiting review</>;
  if (!queue.oldestPendingAt) return <>Waiting time unavailable</>;
  return <>Oldest <RelativeTime iso={queue.oldestPendingAt} /></>;
}

function queueActionLabel(queue: OverviewQueue) {
  return queue.operatorCanAct ? `Review ${queue.label.toLowerCase()}` : `View ${queue.label.toLowerCase()}`;
}

function QueueInspector({
  briefing,
  queue,
  onClose,
}: {
  briefing: OverviewBriefingReadModel;
  queue: OverviewQueue;
  onClose?: () => void;
}) {
  const isRecommended = briefing.nextAction?.queueKind === queue.kind;
  const recentDecisions = briefing.recentDecisions.filter(decision => decision.queueKind === queue.kind);
  const hasRecentDecisions = !briefing.recentDecisionsUnavailable && recentDecisions.length > 0;

  return (
    <div className={styles.inspectorContent}>
      <header className={styles.inspectorHeader}>
        <div>
          <p className={styles.inspectorEyebrow}>Queue</p>
          <h2 id="queue-inspector-heading">{queue.label}</h2>
        </div>
        {onClose ? (
          <button type="button" className={styles.inspectorClose} onClick={onClose} aria-label="Close queue details">
            <X size={18} aria-hidden="true" />
          </button>
        ) : null}
      </header>

      <section className={styles.inspectorSummary} aria-labelledby="queue-state-heading">
        <p id="queue-state-heading" className={styles.inspectorKicker}>
          {queue.pendingCount === 0 ? 'Clear' : `${queue.pendingCount} ${queue.pendingCount === 1 ? 'item' : 'items'} waiting`}
        </p>
        <p><QueueAge queue={queue} /></p>
        {isRecommended ? <p className={styles.recommendationNote}>{briefing.nextAction?.reasonText}.</p> : null}
        {!queue.operatorCanAct && queue.pendingCount > 0 ? <p className={styles.viewOnly}>You can view this queue, but cannot decide these items.</p> : null}
      </section>

      <Link className={styles.inspectorLink} href={queue.href}>
        {queueActionLabel(queue)}
        <ChevronRight size={16} aria-hidden="true" />
      </Link>

      <section className={styles.auditSection} aria-labelledby="recent-decisions-heading">
        <div className={styles.auditHeading}>
          <h3 id="recent-decisions-heading">Recent decisions</h3>
          {briefing.recentDecisionsUnavailable ? <p>Couldn’t load activity.</p> : null}
        </div>
        {hasRecentDecisions ? (
          <ol className={styles.decisionList}>
            {recentDecisions.map(decision => (
              <li key={decision.id}>
                <span>{decision.description}</span>
                <span><RelativeTime iso={decision.createdAt} /></span>
              </li>
            ))}
          </ol>
        ) : briefing.recentDecisionsUnavailable ? null : <p className={styles.quietEmpty}>No recent decisions.</p>}
      </section>
    </div>
  );
}

export function OverviewBriefing({ briefing }: { briefing: OverviewBriefingReadModel }) {
  const setContextFab = useContextFab();
  const initialKind = briefing.nextAction?.queueKind ?? briefing.queues[0]?.kind ?? null;
  const [selectedKind, setSelectedKind] = useState(initialKind);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const queueButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const overlayInspectorRef = useRef<HTMLElement | null>(null);
  const detailPortalTarget = useSyncExternalStore(subscribeToDetailPane, getDetailPaneSnapshot, () => null);
  const isDesktop = useSyncExternalStore(subscribeToDesktopViewport, getDesktopViewportSnapshot, () => true);
  const selectedQueue = briefing.queues.find(queue => queue.kind === selectedKind) ?? briefing.queues[0] ?? null;
  const nextQueue = briefing.queues.find(queue => queue.kind === briefing.nextAction?.queueKind) ?? null;
  const hasPendingWork = briefing.pendingTotal > 0;

  const closeInspector = useCallback(() => {
    setOverlayOpen(false);
    requestAnimationFrame(() => lastTrigger.current?.focus());
  }, []);

  const openSelectedQueueContext = useCallback(() => {
    if (!selectedQueue) return;
    lastTrigger.current = document.activeElement instanceof HTMLButtonElement
      ? document.activeElement
      : queueButtons.current[selectedQueue.kind];
    if (!isDesktop) setOverlayOpen(true);
  }, [isDesktop, selectedQueue]);

  useEffect(() => {
    if (!selectedQueue) {
      setContextFab(null);
      return;
    }

    setContextFab({
      icon: PanelTopOpen,
      label: `Open ${selectedQueue.label.toLowerCase()} context`,
      onClick: openSelectedQueueContext,
    });

    return () => setContextFab(null);
  }, [openSelectedQueueContext, selectedQueue, setContextFab]);

  useEffect(() => {
    if (isDesktop || !overlayOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeInspector();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = overlayInspectorRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const focusFrame = requestAnimationFrame(() => overlayInspectorRef.current?.querySelector<HTMLElement>('button, a[href]')?.focus());
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [closeInspector, isDesktop, overlayOpen]);

  function selectQueue(queue: OverviewQueue, trigger?: HTMLButtonElement) {
    setSelectedKind(queue.kind);
    if (trigger) lastTrigger.current = trigger;
    if (!isDesktop) setOverlayOpen(true);
    queueButtons.current[queue.kind]?.focus();
  }

  function handleQueueKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowDown', 'ArrowUp', 'j', 'k', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowDown' || event.key === 'j' ? 1 : event.key === 'ArrowUp' || event.key === 'k' ? -1 : 0;
    const nextIndex = direction === 0
      ? index
      : Math.min(Math.max(index + direction, 0), briefing.queues.length - 1);
    const nextQueue = briefing.queues[nextIndex];
    if (!nextQueue) return;
    selectQueue(nextQueue, event.currentTarget);
  }

  const inspector = selectedQueue ? <QueueInspector briefing={briefing} queue={selectedQueue} /> : null;
  const mobileInspector = selectedQueue ? <QueueInspector briefing={briefing} queue={selectedQueue} onClose={closeInspector} /> : null;

  return (
    <div className={styles.briefing} onKeyDown={event => {
      if (event.key === 'Escape' && overlayOpen) closeInspector();
    }}>
      <header className={styles.context}>
        <h1 id="overview-heading">Overview</h1>
        <p aria-live="polite">
          {hasPendingWork
            ? `${briefing.pendingTotal} ${briefing.pendingTotal === 1 ? 'item needs' : 'items need'} attention.`
            : 'Nothing awaiting review.'}
        </p>
      </header>

      {briefing.nextAction && nextQueue ? (
        <button
          type="button"
          className={styles.nextAction}
          aria-label={`Show ${briefing.nextAction.label}`}
          onClick={event => selectQueue(nextQueue, event.currentTarget)}
        >
          <span className={styles.nextActionCopy}>
            <span className={styles.sectionKicker}>Next</span>
            <span className={styles.nextActionTitle}>{briefing.nextAction.label}</span>
            <span className={styles.nextActionReason}>{briefing.nextAction.reasonText}.</span>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      ) : null}

      <section className={styles.queueSection} aria-labelledby="queue-topology-heading">
        <div className={styles.sectionHeading}>
          <h2 id="queue-topology-heading">Review queues</h2>
          <p>Select a queue to see its context.</p>
        </div>
        <div className={styles.queueList} role="listbox" aria-label="Review queues">
          {briefing.queues.map((queue, index) => {
            const active = selectedQueue?.kind === queue.kind;
            return (
              <button
                key={queue.kind}
                ref={element => { queueButtons.current[queue.kind] = element; }}
                type="button"
                role="option"
                aria-selected={active}
                className={`${styles.queueRow} ${active ? styles.queueRowActive : ''} ${queue.pendingCount === 0 ? styles.queueQuiet : ''}`}
                onClick={event => selectQueue(queue, event.currentTarget)}
                onKeyDown={event => handleQueueKeyDown(event, index)}
              >
                <span className={styles.queueName}>{queue.label}</span>
                <span className={styles.queueMeta}><QueueAge queue={queue} /></span>
                <span className={styles.queueCount} aria-label={`${queue.pendingCount} ${queue.pendingCount === 1 ? 'item' : 'items'} awaiting review`}>{queue.pendingCount}</span>
              </button>
            );
          })}
        </div>
      </section>

      {isDesktop && inspector && detailPortalTarget
        ? createPortal(inspector, detailPortalTarget)
        : null}

      {!isDesktop && overlayOpen && mobileInspector && detailPortalTarget
        ? createPortal(
            <div className={styles.overlayStage} role="dialog" aria-modal="true" aria-labelledby="queue-inspector-heading">
              <button type="button" className={styles.overlayScrim} onClick={closeInspector} aria-label="Close queue details" />
              <section ref={overlayInspectorRef} className={styles.overlayInspector}>{mobileInspector}</section>
            </div>,
            detailPortalTarget,
          )
        : null}
    </div>
  );
}
