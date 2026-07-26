'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import {
  Activity,
  BookOpen,
  ChevronRight,
  CircleAlert,
  Eye,
  GitFork,
  Inbox,
  PanelTopOpen,
  Store,
  X,
  type LucideIcon,
} from 'lucide-react';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { useContextFab } from '@/components/ops/shell/OpsShellContext';
import { SafeProductImage } from '@/components/products/safe-product-image';
import type { OverviewBriefingReadModel, OverviewQueue } from './overview-briefing';
import styles from './overview.module.css';

const QUEUE_ICONS: Record<OverviewQueue['kind'], LucideIcon> = {
  contributions: Inbox,
  edges: GitFork,
  observations: Eye,
  vocabulary: BookOpen,
  retailers: Store,
};

const QUEUE_ITEM_LABELS: Record<OverviewQueue['kind'], string> = {
  contributions: 'Contribution',
  edges: 'Knowledge edge',
  observations: 'Observation',
  vocabulary: 'Vocabulary',
  retailers: 'Retailer',
};

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
  const recentDecisions = queue.recentDecisions;
  const hasRecentDecisions = !briefing.recentDecisionsUnavailable && recentDecisions.length > 0;

  return (
    <div id="queue-inspector-panel" className={styles.inspectorContent}>
      <div className={styles.inspectorScroll}>
        <header className={styles.inspectorHeader}>
          <div>
            <p className={styles.inspectorKicker}>{queue.label}</p>
            <h2 id="queue-inspector-heading" tabIndex={onClose ? -1 : undefined}>
              {queue.pendingCount === 0
                ? 'Clear'
                : `${queue.pendingCount} ${queue.pendingCount === 1 ? 'item' : 'items'} waiting`}
            </h2>
          </div>
          {onClose ? (
            <button type="button" className={styles.inspectorClose} onClick={onClose} aria-label="Close queue details">
              <X size={18} aria-hidden="true" />
            </button>
          ) : null}
        </header>

        <section className={styles.inspectorSummary} aria-label="Queue state">
          <p><QueueAge queue={queue} /></p>
          {!queue.operatorCanAct && queue.pendingCount > 0 ? <p className={styles.viewOnly}>View only.</p> : null}
        </section>

        <section className={styles.auditSection} aria-labelledby="recent-decisions-heading">
          <div className={styles.auditHeading}>
            <h3 id="recent-decisions-heading">Recent decisions</h3>
            {briefing.recentDecisionsUnavailable ? <p>Couldn’t load activity.</p> : null}
          </div>
          {hasRecentDecisions ? (
            <ol className={styles.decisionList}>
              {recentDecisions.map(decision => (
                <li key={decision.id}>
                  <span className={styles.decisionCopy}>
                    <span>{decision.description}</span>
                    <span>{decision.targetLabel}</span>
                  </span>
                  <span><RelativeTime iso={decision.createdAt} /></span>
                </li>
              ))}
            </ol>
          ) : briefing.recentDecisionsUnavailable ? null : <p className={styles.quietEmpty}>No recent decisions.</p>}
        </section>
      </div>

      <Link className={styles.inspectorLink} href={queue.href}>
        {queueActionLabel(queue)}
        <ChevronRight size={16} aria-hidden="true" />
      </Link>
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
    const focusFrame = requestAnimationFrame(() => overlayInspectorRef.current?.querySelector<HTMLElement>('#queue-inspector-heading')?.focus());
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
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'j', 'k', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'j'
      ? 1
      : event.key === 'ArrowUp' || event.key === 'ArrowLeft' || event.key === 'k'
        ? -1
        : 0;
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
      </header>

      {briefing.attentionItems.length > 0 ? (
        <section className={styles.attentionSection} aria-labelledby="attention-heading">
          <h2 id="attention-heading">Attention</h2>
          <ul className={styles.attentionList}>
            {briefing.attentionItems.map(item => (
              <li key={item.id}>
                <span className={styles.attentionIcon} aria-hidden="true"><CircleAlert size={20} strokeWidth={1.7} /></span>
                <span className={styles.attentionCopy}>
                  <span>{item.title}</span>
                  <span>{item.summary}</span>
                </span>
                <Link href={item.actionHref}>
                  {item.actionLabel}
                  <ChevronRight size={15} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {briefing.upNext.length > 0 || briefing.upNextUnavailable ? (
        <section className={styles.upNextSection} aria-labelledby="up-next-heading">
          <div className={styles.upNextHeading}>
            <h2 id="up-next-heading">Up next</h2>
            {briefing.nextAction ? <p>{briefing.nextAction.label} · oldest waiting</p> : null}
          </div>
          {briefing.upNextUnavailable ? (
            <p className={styles.upNextUnavailable}>Next records couldn’t load.</p>
          ) : (
            <div className={styles.upNextShelf}>
              {briefing.upNext.map(item => {
                const QueueIcon = QUEUE_ICONS[item.queueKind];
                return (
                  <Link
                    key={`${item.queueKind}:${item.id}`}
                    className={styles.upNextCard}
                    href={item.href}
                    aria-label={`Open ${item.title} in ${item.queueLabel.toLowerCase()}`}
                  >
                    <span className={styles.upNextVisual} aria-hidden="true">
                      {item.image ? (
                        <SafeProductImage src={item.image} alt="" className={styles.upNextImage} />
                      ) : (
                        <QueueIcon size={28} strokeWidth={1.55} />
                      )}
                    </span>
                    <span className={styles.upNextCopy}>
                      <span className={styles.upNextEyebrow}>{QUEUE_ITEM_LABELS[item.queueKind]}</span>
                      <span className={styles.upNextTitle}>{item.title}</span>
                      <span className={styles.upNextMeta}>
                        <span>{item.summary}</span>
                        <span aria-hidden="true">·</span>
                        <RelativeTime iso={item.createdAt} />
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      <section className={styles.queueSection} aria-labelledby="queue-topology-heading">
        <div className={styles.sectionHeading}>
          <h2 id="queue-topology-heading">Queues</h2>
        </div>
        <ul className={styles.queueList} aria-label="Review queues">
          {briefing.queues.map((queue, index) => {
            const active = selectedQueue?.kind === queue.kind;
            const QueueIcon = QUEUE_ICONS[queue.kind];
            return (
              <li key={queue.kind}>
                <button
                  ref={element => { queueButtons.current[queue.kind] = element; }}
                  type="button"
                  aria-pressed={active}
                  aria-controls="queue-inspector-panel"
                  className={`${styles.queueRow} ${active ? styles.queueRowActive : ''} ${queue.pendingCount === 0 ? styles.queueQuiet : ''}`}
                  onClick={event => selectQueue(queue, event.currentTarget)}
                  onKeyDown={event => handleQueueKeyDown(event, index)}
                >
                  <span className={styles.queueVisual} aria-hidden="true">
                    <QueueIcon size={20} strokeWidth={1.7} />
                  </span>
                  <span className={styles.queueCopy}>
                    <span className={styles.queueName}>{queue.label}</span>
                    <span className={styles.queueMeta}><QueueAge queue={queue} /></span>
                  </span>
                  <span className={styles.queueCount} aria-label={`${queue.pendingCount} ${queue.pendingCount === 1 ? 'item' : 'items'} awaiting review`}>{queue.pendingCount}</span>
                  <ChevronRight className={styles.queueDisclosure} size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {briefing.recentDecisions.length > 0 || briefing.recentDecisionsUnavailable ? (
        <section className={styles.recentSection} aria-labelledby="overview-recent-heading">
          <div className={styles.sectionHeadingRow}>
            <h2 id="overview-recent-heading">Recent work</h2>
            <Link className={styles.sectionLink} href="/ops/activity">
              View history
              <ChevronRight size={15} aria-hidden="true" />
            </Link>
          </div>
          {briefing.recentDecisionsUnavailable ? (
            <p className={styles.recentUnavailable}>Recent work couldn’t load.</p>
          ) : (
            <ol className={styles.recentList}>
              {briefing.recentDecisions.map(decision => {
                const DecisionIcon = decision.queueKind ? QUEUE_ICONS[decision.queueKind] : Activity;
                return (
                  <li key={decision.id}>
                    <span className={styles.recentVisual} aria-hidden="true">
                      <DecisionIcon size={18} strokeWidth={1.7} />
                    </span>
                    <span className={styles.recentCopy}>
                      <span className={styles.recentDescription}>{decision.description}</span>
                      <span className={styles.recentOperator}>{decision.targetLabel} · {decision.operatorName}</span>
                    </span>
                    <span className={styles.recentTime}><RelativeTime iso={decision.createdAt} /></span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ) : null}

      <p className="sr-only" role="status" aria-live="polite">
        {selectedQueue ? `Showing ${selectedQueue.label} context.` : ''}
      </p>

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
