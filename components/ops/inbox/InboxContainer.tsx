'use client';

import { useState, useEffect, Fragment } from 'react';
import { createPortal } from 'react-dom';
import styles from './inbox.module.css';

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

  const detailId = selectedId ?? internalDetailId;
  const selectedIndex = detailId ? items.findIndex(item => item.id === detailId) : -1;
  const activeItem = selectedIndex >= 0 ? items[selectedIndex] : null;
  const navigationItem = items[navigationIndex] ?? null;

  function syncNavigationIndex(index: number) {
    setNavigationIndex(index);
    const item = items[index];
    if (detailId && item) {
      if (selectedId != null) onSelect?.(item, index);
      else setInternalDetailId(item.id);
    }
  }

  function openDetail(item: T, index = items.indexOf(item)) {
    setNavigationIndex(index);
    if (selectedId != null) onSelect?.(item, index);
    else setInternalDetailId(item.id);
  }

  function closeDetail() {
    if (selectedId != null) onDeselect?.();
    else setInternalDetailId(null);
  }

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
    if (items.length === 0) return;

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
        syncNavigationIndex(Math.min(navigationIndex + 1, items.length - 1));
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
  }, [activeItem, detailId, items, navigationIndex, navigationItem, selectedId]);

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
        {items.map((item, idx) => {
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
