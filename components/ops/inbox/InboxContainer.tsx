'use client';

import { useState, useEffect, useOptimistic, useCallback, Fragment } from 'react';
import { createPortal } from 'react-dom';
import styles from './inbox.module.css';

// Canonical inbox container for all /ops queue pages (ADR 0007). Implements:
// - Auto-selection: first item selected when no valid ID is present.
// - Auto-advance: after a decision, the next logical item is selected.
// - URL synchronization: selection is reflected in the `?id=` param.
// - Optimistic removal: decided rows disappear instantly with rollback on failure.
// - Keyboard navigation: j/k/arrows, Enter to focus rationale, e/a to approve, r to reject.

interface InboxContainerProps<T> {
  items: T[];
  renderItemRow: (item: T, isActive: boolean) => React.ReactNode;
  renderItemDetails: (item: T) => React.ReactNode;
  itemTypeLabel?: string;
  selectedId?: string | null;
  onSelect?: (item: T, index: number) => void;
  onDeselect?: () => void;
}

export function InboxContainer<T extends { id: string }>({
  items,
  renderItemRow,
  renderItemDetails,
  itemTypeLabel = 'item',
  selectedId,
  onSelect,
  onDeselect,
}: InboxContainerProps<T>) {
  const [navigationIndex, setNavigationIndex] = useState(0);
  const [internalDetailId, setInternalDetailId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(true);

  // Optimistic queue: allows instant row removal before server confirms.
  const [optimisticItems, removeOptimisticItem] = useOptimistic(
    items,
    (current: T[], settledId: string) => current.filter(item => item.id !== settledId),
  );

  const detailId = selectedId ?? internalDetailId;
  const selectedIndex = detailId ? optimisticItems.findIndex(item => item.id === detailId) : -1;
  const activeItem = selectedIndex >= 0 ? optimisticItems[selectedIndex] : null;
  const navigationItem = optimisticItems[navigationIndex] ?? null;

  // Auto-selection: when items exist but no valid selection, auto-select the first.
  // This runs as an effect to avoid infinite loops with the parent's onSelect → URL update.
  useEffect(() => {
    if (optimisticItems.length === 0) return;

    // If the current selectedId matches a real item, nothing to do.
    if (detailId && optimisticItems.some(item => item.id === detailId)) return;

    // Auto-select first item.
    const first = optimisticItems[0];
    if (selectedId != null) {
      // External (URL-driven) mode: tell the parent to update the URL.
      onSelect?.(first, 0);
    } else {
      setInternalDetailId(first.id);
    }
    setNavigationIndex(0);
  }, [optimisticItems, detailId, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  function syncNavigationIndex(index: number) {
    setNavigationIndex(index);
    const item = optimisticItems[index];
    if (detailId && item) {
      if (selectedId != null) onSelect?.(item, index);
      else setInternalDetailId(item.id);
    }
  }

  function openDetail(item: T, index = optimisticItems.indexOf(item)) {
    setNavigationIndex(index);
    if (selectedId != null) onSelect?.(item, index);
    else setInternalDetailId(item.id);
  }

  function closeDetail() {
    if (selectedId != null) onDeselect?.();
    else setInternalDetailId(null);
  }

  // Auto-advance after a decision: call this from the parent when actionState.ok.
  // Exposed via the render prop context through the items array mutation.
  const handleItemSettled = useCallback((settledId: string) => {
    const settledIndex = optimisticItems.findIndex(item => item.id === settledId);
    if (settledIndex < 0) return;

    // Optimistically remove the item.
    removeOptimisticItem(settledId);

    // Compute the next selection from the post-removal list.
    const remaining = optimisticItems.filter(item => item.id !== settledId);
    if (remaining.length === 0) {
      // Queue complete — clear selection.
      if (selectedId != null) onDeselect?.();
      else setInternalDetailId(null);
      return;
    }

    // Prefer the item that moves into the same index; fall back to i - 1.
    const nextIndex = Math.min(settledIndex, remaining.length - 1);
    const nextItem = remaining[nextIndex];
    setNavigationIndex(nextIndex);
    if (selectedId != null) onSelect?.(nextItem, nextIndex);
    else setInternalDetailId(nextItem.id);
  }, [optimisticItems, selectedId, onSelect, onDeselect, removeOptimisticItem]);

  // Expose handleItemSettled to parent via a DOM data attribute (consumed by action effect).
  // This avoids threading callbacks through render props. The parent reads window.__opsInboxAdvance.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__opsInboxAdvance = handleItemSettled;
    return () => { delete (window as any).__opsInboxAdvance; };
  }, [handleItemSettled]);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (selectedIndex >= 0) setNavigationIndex(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => {
    if (optimisticItems.length === 0) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        if (e.key === 'Escape') (document.activeElement as HTMLElement).blur();
        return;
      }

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        syncNavigationIndex(Math.min(navigationIndex + 1, optimisticItems.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        syncNavigationIndex(Math.max(navigationIndex - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (navigationItem) {
          openDetail(navigationItem, navigationIndex);
          setTimeout(() => {
            const form = document.querySelector(`form[data-item-id="${navigationItem.id}"]`);
            const input = form?.querySelector('input[name="rationale"], textarea') as HTMLInputElement | HTMLTextAreaElement;
            input?.focus();
          }, 100);
        }
      } else if (e.key === 'e' || e.key === 'a') {
        e.preventDefault();
        if (activeItem) {
          const form = document.querySelector(`form[data-item-id="${activeItem.id}"]`);
          const btn = form?.querySelector('button[value="approve"]') as HTMLButtonElement;
          btn?.click();
        }
      } else if (e.key === 'r') {
        e.preventDefault();
        if (activeItem) {
          const form = document.querySelector(`form[data-item-id="${activeItem.id}"]`);
          const btn = form?.querySelector('button[value="reject"]') as HTMLButtonElement;
          btn?.click();
        }
      } else if (e.key === 'm') {
        e.preventDefault();
        if (activeItem) {
          const form = document.querySelector(`form[data-item-id="${activeItem.id}"]`);
          const btn = form?.querySelector('button[value="map"]') as HTMLButtonElement;
          btn?.click();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDetail();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeItem, detailId, optimisticItems, navigationIndex, navigationItem, selectedId]);

  useEffect(() => {
    const item = detailId ? activeItem : navigationItem;
    if (!item) return;
    document.getElementById(`row-${item.id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeItem, detailId, navigationItem]);

  function handleRowClick(index: number, item: T) {
    if (detailId === item.id) closeDetail();
    else openDetail(item, index);
  }

  const detailPortalTarget = typeof document === 'undefined' ? null : document.getElementById('ops-detail-pane');

  return (
    <>
      <div className={styles.cardGrid} role="list" aria-label={`${itemTypeLabel} queue`}>
        {optimisticItems.map((item, idx) => {
          const isActive = detailId === item.id;
          return (
            <div
              key={item.id}
              id={`row-${item.id}`}
              role="listitem"
              tabIndex={0}
              className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
              onFocus={() => setNavigationIndex(idx)}
              onClick={() => handleRowClick(idx, item)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRowClick(idx, item);
                }
              }}
              aria-current={isActive ? 'true' : undefined}
            >
              {renderItemRow(item, isActive)}
            </div>
          );
        })}
      </div>

      {!isMobile && activeItem && detailPortalTarget
        ? createPortal(
            <Fragment key={activeItem.id}>{renderItemDetails(activeItem)}</Fragment>,
            detailPortalTarget,
          )
        : null}

      {isMobile && activeItem && (
        <div className={styles.bottomSheet} role="dialog" aria-modal="true">
          <div className={styles.bottomSheetHeader}>
            <button
              className={styles.bottomSheetClose}
              onClick={closeDetail}
              aria-label="Close details"
            >
              &times;
            </button>
          </div>
          <div className={styles.bottomSheetContent}>{renderItemDetails(activeItem)}</div>
        </div>
      )}
    </>
  );
}
