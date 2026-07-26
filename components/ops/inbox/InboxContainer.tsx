'use client';

import {
  useState,
  useEffect,
  useOptimistic,
  useCallback,
  useSyncExternalStore,
  useRef,
  Fragment,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, PanelTopOpen, X } from 'lucide-react';
import { useContextFab } from '@/components/ops/shell/OpsShellContext';
import styles from './inbox.module.css';
import adaptive from './inbox-tablet.module.css';
import {
  nextInboxPageVisibleCount,
  normalizeInboxSections,
  type InboxCollectionSection,
  type InboxItemRenderContext,
  type ResolvedInboxCollectionSection,
  visibleInboxCountForSelection,
} from './collection-sections';

export {
  normalizeInboxSections,
  type InboxCollectionSection,
  type InboxItemRenderContext,
  type InboxSectionPresentation,
  type ResolvedInboxCollectionSection,
} from './collection-sections';

export interface OpsInboxController {
  settleItem: (id: string) => void;
}

interface InboxContainerProps<T extends { id: string }> {
  items: T[];
  sections?: readonly InboxCollectionSection<T>[];
  renderItemRow: (
    item: T,
    isActive: boolean,
    context?: InboxItemRenderContext,
  ) => React.ReactNode;
  renderItemDetails: (item: T) => React.ReactNode;
  itemTypeLabel?: string;
  getItemLabel?: (item: T) => string;
  selectedId?: string | null;
  pendingSelectionId?: string | null;
  onSelect?: (item: T, index: number) => void;
  onDeselect?: () => void;
  controllerRef?: React.RefObject<OpsInboxController | null>;
}

type ViewportMode = 'phone' | 'touch' | 'compact' | 'balanced' | 'expanded';

function subscribeToDetailPane(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

function getDetailPaneSnapshot() {
  return document.getElementById('ops-detail-pane');
}

function getServerDetailPaneSnapshot() {
  return null;
}

interface ProgressiveInboxSectionProps<T extends { id: string }> {
  section: ResolvedInboxCollectionSection<T>;
  allItems: T[];
  selectedId: string | null;
  renderItem: (
    item: T,
    index: number,
    context: Omit<InboxItemRenderContext, 'isActive' | 'isKeyboardCurrent'>,
  ) => React.ReactNode;
}

function ProgressiveInboxSection<T extends { id: string }>({
  section,
  allItems,
  selectedId,
  renderItem,
}: ProgressiveInboxSectionProps<T>) {
  const initialCount = section.pagination
    ? Math.min(section.items.length, Math.max(1, section.pagination.initialCount))
    : section.items.length;
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef<HTMLUListElement | null>(null);
  const sentinelRef = useRef<HTMLElement | null>(null);
  const loadPendingRef = useRef(false);
  const observerArmedRef = useRef(true);

  const selectedIndex = selectedId
    ? section.items.findIndex(item => item.id === selectedId)
    : -1;
  const pageSize = section.pagination?.pageSize ?? section.items.length;
  const requiredVisibleCount = visibleInboxCountForSelection(
    visibleCount,
    selectedIndex,
    section.items.length,
    pageSize,
  );
  const renderedCount = Math.min(
    section.items.length,
    Math.max(visibleCount, requiredVisibleCount),
  );
  const visibleItems = section.items.slice(0, renderedCount);
  const hasMore = renderedCount < section.items.length;
  const isHorizontal = section.presentation === 'horizontal-rail';
  const statusId = `ops-section-status-${section.id}`;

  const loadMore = useCallback(() => {
    if (!section.pagination || loadPendingRef.current || !hasMore) return;

    loadPendingRef.current = true;
    setIsLoading(true);
    setVisibleCount(current => nextInboxPageVisibleCount(
      Math.max(current, renderedCount),
      section.items.length,
      section.pagination?.pageSize ?? 1,
    ));

    requestAnimationFrame(() => {
      loadPendingRef.current = false;
      setIsLoading(false);
    });
  }, [hasMore, renderedCount, section.items.length, section.pagination]);

  useEffect(() => {
    if (!section.pagination || !hasMore || !sentinelRef.current) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(entries => {
      const entry = entries[0];
      if (!entry?.isIntersecting) {
        observerArmedRef.current = true;
        return;
      }
      if (!observerArmedRef.current) return;
      observerArmedRef.current = false;
      loadMore();
    }, {
      root: isHorizontal ? listRef.current : null,
      rootMargin: isHorizontal ? '0px 160px 0px 0px' : '180px 0px',
      threshold: 0.01,
    });

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isHorizontal, loadMore, section.pagination]);

  useEffect(() => {
    if (selectedIndex < 0 || selectedIndex < visibleCount) return;
    const frame = requestAnimationFrame(() => {
      setVisibleCount(current => Math.max(current, requiredVisibleCount));
    });
    return () => cancelAnimationFrame(frame);
  }, [requiredVisibleCount, selectedIndex, visibleCount]);

  const paginationStatus = isLoading
    ? `Loading more ${section.label.toLowerCase()}.`
    : hasMore
      ? `${renderedCount} ${section.label.toLowerCase()} shown. More available.`
      : `${section.items.length} ${section.label.toLowerCase()} shown.`;

  const loadControl = hasMore ? (
    <button
      type="button"
      className={styles.paginationButton}
      aria-describedby={statusId}
      disabled={isLoading}
      onClick={loadMore}
    >
      {isLoading ? 'Loading…' : 'Load more'}
    </button>
  ) : null;

  return (
    <section
      className={styles.collectionSection}
      data-presentation={section.presentation}
      aria-labelledby={`ops-section-${section.id}`}
    >
      <header className={styles.collectionSectionHeader}>
        <h2 id={`ops-section-${section.id}`}>{section.label}</h2>
        {isHorizontal && section.items.length > 1 ? (
          <div className={styles.railControls} aria-label={`${section.label} controls`}>
            <button
              type="button"
              aria-label={`Scroll ${section.label} left`}
              onClick={() => listRef.current?.scrollBy({
                left: -260,
                behavior: 'smooth',
              })}
            >
              <ChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`Scroll ${section.label} right`}
              onClick={() => listRef.current?.scrollBy({
                left: 260,
                behavior: 'smooth',
              })}
            >
              <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </header>
      <ul
        ref={listRef}
        id={`ops-section-items-${section.id}`}
        className={styles.sectionItems}
        data-presentation={section.presentation}
      >
        {visibleItems.map(item => {
          const idx = allItems.findIndex(candidate => candidate.id === item.id);
          return renderItem(item, idx, {
            sectionId: section.id,
            presentation: section.presentation,
          });
        })}
        {isHorizontal && loadControl ? (
          <li ref={sentinelRef as React.RefObject<HTMLLIElement | null>} className={styles.paginationRailTail}>
            {loadControl}
          </li>
        ) : null}
      </ul>
      {!isHorizontal && loadControl ? (
        <div ref={sentinelRef as React.RefObject<HTMLDivElement | null>} className={styles.paginationFooter}>
          {loadControl}
        </div>
      ) : null}
      {section.pagination ? (
        <span
          id={statusId}
          className={styles.paginationStatus}
          role={isLoading ? 'status' : undefined}
          aria-live={isLoading ? 'polite' : undefined}
          aria-atomic={isLoading ? 'true' : undefined}
        >
          {paginationStatus}
        </span>
      ) : null}
    </section>
  );
}

export function InboxContainer<T extends { id: string }>({
  items,
  sections,
  renderItemRow,
  renderItemDetails,
  itemTypeLabel = 'item',
  getItemLabel,
  selectedId,
  pendingSelectionId,
  onSelect,
  onDeselect,
  controllerRef,
}: InboxContainerProps<T>) {
  const setContextFab = useContextFab();
  const isControlled = onSelect != null;
  const [navigationIndex, setNavigationIndex] = useState(() => {
    const initialIndex = selectedId ? items.findIndex(item => item.id === selectedId) : -1;
    return initialIndex >= 0 ? initialIndex : 0;
  });
  const [internalDetailId, setInternalDetailId] = useState<string | null>(
    () => items[0]?.id ?? null,
  );
  const [viewportMode, setViewportMode] = useState<ViewportMode>('expanded');
  const [overlayInspectorOpen, setOverlayInspectorOpen] = useState(false);
  const overlayInspectorRef = useRef<HTMLElement | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const [optimisticItems, removeOptimisticItem] = useOptimistic(
    items,
    (current: T[], settledId: string) => current.filter(item => item.id !== settledId),
  );

  const requestedDetailId = isControlled ? selectedId : internalDetailId;
  const requestedIndex = requestedDetailId
    ? optimisticItems.findIndex(item => item.id === requestedDetailId)
    : -1;
  const detailId = requestedIndex >= 0
    ? requestedDetailId
    : optimisticItems[0]?.id ?? null;
  const selectedIndex = detailId
    ? optimisticItems.findIndex(item => item.id === detailId)
    : -1;
  const clampedNavigationIndex = Math.min(
    Math.max(navigationIndex, 0),
    Math.max(optimisticItems.length - 1, 0),
  );
  const effectiveNavigationIndex = selectedIndex >= 0
    ? selectedIndex
    : clampedNavigationIndex;
  const activeItem = selectedIndex >= 0 ? optimisticItems[selectedIndex] : null;
  const navigationItem = optimisticItems[effectiveNavigationIndex] ?? null;
  const usesOverlayInspector = viewportMode === 'phone' || viewportMode === 'touch' || viewportMode === 'compact';
  const usesDockedInspector = viewportMode === 'balanced' || viewportMode === 'expanded';

  useEffect(() => {
    if (!isControlled || optimisticItems.length === 0 || requestedIndex >= 0) return;
    onSelect(optimisticItems[0], 0);
  }, [isControlled, optimisticItems, onSelect, requestedIndex]);

  const syncNavigationIndex = useCallback((index: number) => {
    setNavigationIndex(index);
    const item = optimisticItems[index];
    if (detailId && item) {
      if (isControlled) onSelect?.(item, index);
      else setInternalDetailId(item.id);
    }
    if (item) {
      requestAnimationFrame(() => {
        document.getElementById(`row-${item.id}`)?.focus({ preventScroll: true });
      });
    }
  }, [detailId, isControlled, onSelect, optimisticItems]);

  const openDetail = useCallback((item: T, index = optimisticItems.indexOf(item)) => {
    setNavigationIndex(index);
    if (isControlled) onSelect?.(item, index);
    else setInternalDetailId(item.id);
    if (usesOverlayInspector) {
      lastTriggerRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      setOverlayInspectorOpen(true);
    }
  }, [isControlled, onSelect, optimisticItems, usesOverlayInspector]);

  const openCurrentDetail = useCallback(() => {
    const item = activeItem ?? navigationItem;
    if (!item) return;
    openDetail(item, optimisticItems.findIndex(candidate => candidate.id === item.id));
  }, [activeItem, navigationItem, openDetail, optimisticItems]);

  useEffect(() => {
    const item = activeItem ?? navigationItem;
    if (!item) {
      setContextFab(null);
      return;
    }

    setContextFab({
      icon: PanelTopOpen,
      label: `Open current ${itemTypeLabel}`,
      onClick: openCurrentDetail,
    });

    return () => setContextFab(null);
  }, [activeItem, itemTypeLabel, navigationItem, openCurrentDetail, setContextFab]);

  const closeDetail = useCallback(() => {
    if (usesOverlayInspector) {
      setOverlayInspectorOpen(false);
      requestAnimationFrame(() => lastTriggerRef.current?.focus());
      return;
    }
    if (isControlled) onDeselect?.();
    else setInternalDetailId(null);
  }, [isControlled, onDeselect, usesOverlayInspector]);

  useEffect(() => {
    if (!usesOverlayInspector || !overlayInspectorOpen) return;

    const previousOverflow = document.body.style.overflow;
    const workspaceScrollOwner = document.querySelector<HTMLElement>('[data-ops-main]');
    const previousWorkspaceOverflow = workspaceScrollOwner?.style.overflow ?? '';
    const inertTargets = [
      document.querySelector<HTMLElement>('[data-ops-workspace]'),
      document.querySelector<HTMLElement>('[data-ops-sidebar-layer]'),
    ].filter((target): target is HTMLElement => target != null);
    const previousInert = inertTargets.map(target => target.hasAttribute('inert'));

    document.body.style.overflow = 'hidden';
    if (workspaceScrollOwner) workspaceScrollOwner.style.overflow = 'hidden';
    inertTargets.forEach(target => target.setAttribute('inert', ''));

    function handleOverlayKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const eventDialog = event.target instanceof Element
        ? event.target.closest('dialog')
        : null;
      const nestedDialog = document.querySelector<HTMLDialogElement>('dialog[open]');
      if (eventDialog || nestedDialog) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeDetail();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = overlayInspectorRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
    }

    const focusFrame = requestAnimationFrame(() => {
      overlayInspectorRef.current
        ?.querySelector<HTMLElement>('button:not([disabled]):not([tabindex="-1"]), a[href], textarea:not([disabled]), input:not([disabled])')
        ?.focus();
    });
    window.addEventListener('keydown', handleOverlayKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      if (workspaceScrollOwner) workspaceScrollOwner.style.overflow = previousWorkspaceOverflow;
      inertTargets.forEach((target, index) => {
        if (!previousInert[index]) target.removeAttribute('inert');
      });
      window.removeEventListener('keydown', handleOverlayKeyDown);
    };
  }, [closeDetail, overlayInspectorOpen, usesOverlayInspector]);

  const handleItemSettled = useCallback((settledId: string) => {
    const settledIndex = optimisticItems.findIndex(item => item.id === settledId);
    if (settledIndex < 0) return;

    removeOptimisticItem(settledId);

    const remaining = optimisticItems.filter(item => item.id !== settledId);
    if (remaining.length === 0) {
      if (isControlled) onDeselect?.();
      else setInternalDetailId(null);
      setOverlayInspectorOpen(false);
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[data-ops-main]')?.focus({ preventScroll: true });
      });
      return;
    }

    const nextIndex = Math.min(settledIndex, remaining.length - 1);
    const nextItem = remaining[nextIndex];
    setNavigationIndex(nextIndex);
    if (isControlled) onSelect?.(nextItem, nextIndex);
    else setInternalDetailId(nextItem.id);

    if (viewportMode === 'phone' || viewportMode === 'touch' || viewportMode === 'compact') {
      setOverlayInspectorOpen(false);
    }
    requestAnimationFrame(() => {
      document.getElementById(`row-${nextItem.id}`)?.focus({ preventScroll: true });
    });
  }, [optimisticItems, isControlled, onSelect, onDeselect, removeOptimisticItem, viewportMode]);

  useEffect(() => {
    if (!controllerRef) return;
    controllerRef.current = { settleItem: handleItemSettled };
    return () => {
      controllerRef.current = null;
    };
  }, [controllerRef, handleItemSettled]);

  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      const nextMode: ViewportMode = width < 430
        ? 'phone'
        : width < 820
          ? 'touch'
          : width < 1180
            ? 'compact'
            : width < 1440
              ? 'balanced'
              : 'expanded';

      setViewportMode(nextMode);
      if (nextMode === 'balanced' || nextMode === 'expanded') {
        setOverlayInspectorOpen(false);
      }
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (optimisticItems.length === 0) return;

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target instanceof HTMLElement ? e.target : null;
      const eventDialog = target?.closest('dialog');
      const nestedDialog = document.querySelector<HTMLDialogElement>('dialog[open]');
      if (eventDialog || nestedDialog) return;
      const isTyping = target?.closest('input, textarea, select, [contenteditable="true"]');
      const isInteractive = target?.closest('button, a[href]');
      const isCollectionRow = target?.closest('[data-ops-collection-item]');
      if (isTyping || (isInteractive && !isCollectionRow)) {
        if (e.key === 'Escape') (document.activeElement as HTMLElement).blur();
        return;
      }

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        syncNavigationIndex(Math.min(effectiveNavigationIndex + 1, optimisticItems.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        syncNavigationIndex(Math.max(effectiveNavigationIndex - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (navigationItem) {
          openDetail(navigationItem, effectiveNavigationIndex);
          requestAnimationFrame(() => {
            const form = document.querySelector(`form[data-item-id="${navigationItem.id}"]`);
            const input = form?.querySelector('input[name="rationale"], textarea') as HTMLInputElement | HTMLTextAreaElement;
            input?.focus();
          });
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDetail();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeItem,
    closeDetail,
    effectiveNavigationIndex,
    navigationItem,
    openDetail,
    optimisticItems.length,
    syncNavigationIndex,
  ]);

  useEffect(() => {
    const item = detailId ? activeItem : navigationItem;
    if (!item) return;
    document.getElementById(`row-${item.id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeItem, detailId, navigationItem]);

  function handleRowClick(index: number, item: T) {
    if (detailId === item.id && !usesOverlayInspector) return;
    openDetail(item, index);
  }

  function renderQueueItem(
    item: T,
    idx: number,
    context?: Omit<InboxItemRenderContext, 'isActive' | 'isKeyboardCurrent'>,
  ) {
    const isActive = detailId === item.id;
    const isKeyboardCurrent = idx === effectiveNavigationIndex;

    if (context) {
      return (
        <li key={item.id} className={styles.sectionItem}>
          <button
            type="button"
            id={`row-${item.id}`}
            data-ops-collection-item
            aria-current={isActive ? 'true' : undefined}
            aria-busy={pendingSelectionId === item.id ? 'true' : undefined}
            tabIndex={isKeyboardCurrent ? 0 : -1}
            className={`${styles.sectionItemButton} ${isActive ? styles.sectionItemButtonActive : ''}`}
            onFocus={() => setNavigationIndex(idx)}
            onClick={() => handleRowClick(idx, item)}
          >
            {renderItemRow(item, isActive, {
              ...context,
              isActive,
              isKeyboardCurrent,
            })}
          </button>
        </li>
      );
    }

    return (
      <div
        key={item.id}
        id={`row-${item.id}`}
        data-ops-collection-item
        role="option"
        aria-selected={isActive}
        aria-busy={pendingSelectionId === item.id ? 'true' : undefined}
        tabIndex={isKeyboardCurrent ? 0 : -1}
        className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
        onFocus={() => setNavigationIndex(idx)}
        onClick={() => handleRowClick(idx, item)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRowClick(idx, item);
          }
        }}
      >
        {renderItemRow(item, isActive)}
      </div>
    );
  }

  const detailPortalTarget = useSyncExternalStore(
    subscribeToDetailPane,
    getDetailPaneSnapshot,
    getServerDetailPaneSnapshot,
  );
  const resolvedSections = sections
    ? normalizeInboxSections(optimisticItems, sections)
    : null;

  return (
    <>
      {resolvedSections ? (
        <div className={styles.sectionCollection} data-ops-collection="sectioned" aria-label={`${itemTypeLabel} queue`}>
          {resolvedSections.map(section => (
            <ProgressiveInboxSection
              key={section.id}
              section={section}
              allItems={optimisticItems}
              selectedId={detailId ?? null}
              renderItem={renderQueueItem}
            />
          ))}
        </div>
      ) : (
        <div className={styles.cardGrid} data-ops-collection="default" role="listbox" aria-label={`${itemTypeLabel} queue`}>
          {optimisticItems.map((item, idx) => renderQueueItem(item, idx))}
        </div>
      )}

      {usesDockedInspector && activeItem && detailPortalTarget
        ? createPortal(<Fragment key={activeItem.id}>{renderItemDetails(activeItem)}</Fragment>, detailPortalTarget)
        : null}

      {usesOverlayInspector && activeItem && detailPortalTarget && overlayInspectorOpen
        ? createPortal(
            <div className={adaptive.tabletStage} role="dialog" aria-modal="true" aria-label={`${getItemLabel?.(activeItem) ?? itemTypeLabel} details`}>
              <button
                type="button"
                className={adaptive.tabletScrim}
                onClick={closeDetail}
                tabIndex={-1}
                aria-hidden="true"
              />
              <section ref={overlayInspectorRef} className={adaptive.tabletInspector}>
                <header className={adaptive.tabletInspectorHeader}>
                  <button type="button" className={adaptive.tabletClose} onClick={closeDetail} aria-label="Close details">
                    <X size={18} />
                  </button>
                </header>
                <div className={adaptive.tabletInspectorBody}>{renderItemDetails(activeItem)}</div>
              </section>
            </div>,
            detailPortalTarget,
          )
        : null}
    </>
  );
}
