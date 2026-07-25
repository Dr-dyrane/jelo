'use client';

import { useState, useEffect, Fragment } from 'react';
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
  const [internalIndex, setInternalIndex] = useState(0);
  const [internalDetailId, setInternalDetailId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const controlledIndex = selectedId != null ? items.findIndex(item => item.id === selectedId) : null;
  const activeIndex = controlledIndex != null && controlledIndex >= 0 ? controlledIndex : internalIndex;
  const detailId = selectedId != null ? selectedId : internalDetailId;

  // Sync active item
  const activeItem = items[activeIndex] || null;

  function syncActiveIndex(index: number) {
    if (selectedId != null) {
      const item = items[index];
      if (item) onSelect?.(item, index);
    } else {
      setInternalIndex(index);
    }
  }

  function openDetail(item: T) {
    if (selectedId != null) {
      onSelect?.(item, items.indexOf(item));
    } else {
      setInternalDetailId(item.id);
      setInternalIndex(items.indexOf(item));
    }
  }

  function closeDetail() {
    if (selectedId != null) {
      onDeselect?.();
    } else {
      setInternalDetailId(null);
    }
  }

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    if (items.length === 0) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement).blur();
        }
        return;
      }

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = Math.min((selectedId != null ? activeIndex : internalIndex) + 1, items.length - 1);
        syncActiveIndex(nextIndex);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const nextIndex = Math.max((selectedId != null ? activeIndex : internalIndex) - 1, 0);
        syncActiveIndex(nextIndex);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeItem) {
          openDetail(activeItem);
          setTimeout(() => {
            const form = document.querySelector(`form[data-item-id="${activeItem.id}"]`);
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
  }, [activeIndex, activeItem, items]);

  // Auto-scroll selected row into view
  useEffect(() => {
    if (activeItem) {
      const el = document.getElementById(`row-${activeItem.id}`);
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [activeIndex, activeItem]);

  function handleRowClick(index: number, item: T) {
    if (selectedId != null) {
      onSelect?.(item, index);
    } else {
      setInternalIndex(index);
      setInternalDetailId(item.id);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Main Inbox split view */}
      <div className={styles.inboxLayout}>
        {/* Left List Pane */}
        <div className={styles.listPane} role="list" aria-label={`${itemTypeLabel} queue`}>
          {items.map((item, idx) => {
            const isActive = activeItem?.id === item.id;
            return (
              <div
                key={item.id}
                id={`row-${item.id}`}
                role="listitem"
                tabIndex={0}
                className={`${styles.interactiveRow} ${isActive ? styles.interactiveRowActive : ''}`}
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

        {/* Right Desktop/Tablet Detail Pane (Linear Properties Panel) */}
        {!isMobile ? (
          <div className={styles.detailPane}>
            {activeItem ? (
              <Fragment key={activeItem.id}>{renderItemDetails(activeItem)}</Fragment>
            ) : null}
          </div>
        ) : null}

        {/* Mobile Bottom Sheet (slides up on item selection) */}
        {isMobile && detailId && activeItem && (
          <div className={styles.bottomSheet} role="dialog" aria-modal="true">
            <div className={styles.bottomSheetHeader}>
              <button
                className={styles.bottomSheetClose}
                onClick={() => closeDetail()}
                aria-label="Close details"
              >
                &times;
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {renderItemDetails(activeItem)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
