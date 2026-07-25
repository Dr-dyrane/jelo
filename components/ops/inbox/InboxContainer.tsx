'use client';

import {
  useState,
  useEffect,
  useOptimistic,
  useCallback,
  Fragment,
  type MutableRefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './inbox.module.css';
import tablet from './inbox-tablet.module.css';

export interface OpsInboxController {
  settleItem: (id: string) => void;
}

interface InboxContainerProps<T> {
  items: T[];
  renderItemRow: (item: T, isActive: boolean) => React.ReactNode;
  renderItemDetails: (item: T) => React.ReactNode;
  itemTypeLabel?: string;
  selectedId?: string | null;
  onSelect?: (item: T, index: number) => void;
  onDeselect?: () => void;
  controllerRef?: MutableRefObject<OpsInboxController | null>;
}

type ViewportMode = 'phone' | 'touch' | 'compact' | 'expanded';

export function InboxContainer<T extends { id: string }>({
  items,
  renderItemRow,
  renderItemDetails,
  itemTypeLabel = 'item',
  selectedId,
  onSelect,
  onDeselect,
  controllerRef,
}: InboxContainerProps<T>) {
  const [navigationIndex, setNavigationIndex] = useState(0);
  const [internalDetailId, setInternalDetailId] = useState<string | null>(null);
  const [viewportMode, setViewportMode] = useState<ViewportMode>('phone');
  const [touchInspectorOpen, setTouchInspectorOpen] = useState(false);

  const [optimisticItems, removeOptimisticItem] = useOptimistic(
    items,
    (current: T[], settledId: string) => current.filter(item => item.id !== settledId),
  );

  const detailId = selectedId ?? internalDetailId;
  const selectedIndex = detailId ? optimisticItems.findIndex(item => item.id === detailId) : -1;
  const activeItem = selectedIndex >= 0 ? optimisticItems[selectedIndex] : null;
  const navigationItem = optimisticItems[navigationIndex] ?? null;

  useEffect(() => {
    if (optimisticItems.length === 0) return;
    if (detailId && optimisticItems.some(item => item.id === detailId)) return;

    const first = optimisticItems[0];
    if (selectedId != null) onSelect?.(first, 0);
    else setInternalDetailId(first.id);
    setNavigationIndex(0);
  }, [optimisticItems, detailId, selectedId, onSelect]);

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
    if (viewportMode === 'touch') setTouchInspectorOpen(true);
  }

  function closeDetail() {
    if (viewportMode === 'touch') {
      setTouchInspectorOpen(false);
      return;
    }
    if (selectedId != null) onDeselect?.();
    else setInternalDetailId(null);
  }

  const handleItemSettled = useCallback((settledId: string) => {
    const settledIndex = optimisticItems.findIndex(item => item.id === settledId);
    if (settledIndex < 0) return;

    removeOptimisticItem(settledId);

    const remaining = optimisticItems.filter(item => item.id !== settledId);
    if (remaining.length === 0) {
      if (selectedId != null) onDeselect?.();
      else setInternalDetailId(null);
      setTouchInspectorOpen(false);
      return;
    }

    const nextIndex = Math.min(settledIndex, remaining.length - 1);
    const nextItem = remaining[nextIndex];
    setNavigationIndex(nextIndex);
    if (selectedId != null) onSelect?.(nextItem, nextIndex);
    else setInternalDetailId(nextItem.id);

    if (viewportMode === 'touch') setTouchInspectorOpen(false);
  }, [optimisticItems, selectedId, onSelect, onDeselect, removeOptimisticItem, viewportMode]);

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
        : width <= 768
          ? 'touch'
          : width < 1280
            ? 'compact'
            : 'expanded';
      setViewportMode(nextMode);
      if (nextMode !== 'touch') setTouchInspectorOpen(false);
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
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
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
          requestAnimationFrame(() => {
            const form = document.querySelector(`form[data-item-id="${navigationItem.id}"]`);
            const input = form?.querySelector('input[name="rationale"], textarea') as HTMLInputElement | HTMLTextAreaElement;
            input?.focus();
          });
        }
      } else if (e.key === 'e' || e.key === 'a') {
        e.preventDefault();
        if (activeItem) {
          const form = document.querySelector(`form[data-item-id="${activeItem.id}"]`);
          (form?.querySelector('button[value="approve"]') as HTMLButtonElement)?.click();
        }
      } else if (e.key === 'r') {
        e.preventDefault();
        if (activeItem) {
          const form = document.querySelector(`form[data-item-id="${activeItem.id}"]`);
          (form?.querySelector('button[value="reject"]') as HTMLButtonElement)?.click();
        }
      } else if (e.key === 'm') {
        e.preventDefault();
        if (activeItem) {
          const form = document.querySelector(`form[data-item-id="${activeItem.id}"]`);
          (form?.querySelector('button[value="map"]') as HTMLButtonElement)?.click();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDetail();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeItem, detailId, optimisticItems, navigationIndex, navigationItem, selectedId, viewportMode]);

  useEffect(() => {
    const item = detailId ? activeItem : navigationItem;
    if (!item) return;
    document.getElementById(`row-${item.id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeItem, detailId, navigationItem]);

  function handleRowClick(index: number, item: T) {
    if (detailId === item.id && viewportMode !== 'touch') return;
    openDetail(item, index);
  }

  const detailPortalTarget = typeof document === 'undefined' ? null : document.getElementById('ops-detail-pane');

  return (
    <>
      <div className={styles.cardGrid} data-ops-collection role="listbox" aria-label={`${itemTypeLabel} queue`}>
        {optimisticItems.map((item, idx) => {
          const isActive = detailId === item.id;
          return (
            <div
              key={item.id}
              id={`row-${item.id}`}
              data-ops-collection-item
              role="option"
              aria-selected={isActive}
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
            >
              {renderItemRow(item, isActive)}
            </div>
          );
        })}
      </div>

      {viewportMode === 'expanded' && activeItem && detailPortalTarget
        ? createPortal(<Fragment key={activeItem.id}>{renderItemDetails(activeItem)}</Fragment>, detailPortalTarget)
        : null}

      {viewportMode === 'touch' && activeItem && detailPortalTarget && touchInspectorOpen
        ? createPortal(
            <div className={tablet.tabletStage} role="dialog" aria-modal="true" aria-label={`${itemTypeLabel} details`}>
              <button type="button" className={tablet.tabletScrim} onClick={closeDetail} aria-label="Close details" />
              <section className={tablet.tabletInspector}>
                <header className={tablet.tabletInspectorHeader}>
                  <span>{itemTypeLabel}</span>
                  <button type="button" className={tablet.tabletClose} onClick={closeDetail} aria-label="Close details">
                    <X size={18} />
                  </button>
                </header>
                <div className={tablet.tabletInspectorBody}>{renderItemDetails(activeItem)}</div>
              </section>
            </div>,
            detailPortalTarget,
          )
        : null}

      {viewportMode === 'phone' && activeItem && (
        <div className={styles.bottomSheet} role="dialog" aria-modal="true">
          <div className={styles.bottomSheetHeader}>
            <button className={styles.bottomSheetClose} onClick={closeDetail} aria-label="Close details">&times;</button>
          </div>
          <div className={styles.bottomSheetContent}>{renderItemDetails(activeItem)}</div>
        </div>
      )}
    </>
  );
}
