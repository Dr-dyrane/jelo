'use client';

import { useState, useEffect } from 'react';
import styles from './inbox.module.css';

interface InboxContainerProps<T> {
  items: T[];
  renderItemRow: (item: T, isActive: boolean) => React.ReactNode;
  renderItemDetails: (item: T) => React.ReactNode;
  itemTypeLabel?: string;
}

export function InboxContainer<T extends { id: string }>({
  items,
  renderItemRow,
  renderItemDetails,
  itemTypeLabel = 'item',
}: InboxContainerProps<T>) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Sync index to activeId
  const activeItem = items[activeIndex] || null;

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
      // Ignore key events when typing in inputs/textareas
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
        setActiveIndex(prev => Math.min(prev + 1, items.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeItem) {
          setDetailId(activeItem.id);
          // Focus the input inside the active item details form if it exists
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
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setDetailId(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, activeItem, items]);

  // Auto-scroll row into view when navigating
  useEffect(() => {
    if (activeItem) {
      const el = document.getElementById(`row-${activeItem.id}`);
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [activeIndex, activeItem]);

  function handleRowClick(index: number, item: T) {
    setActiveIndex(index);
    setDetailId(item.id);
  }

  return (
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

      {/* Right Desktop/Tablet Detail Pane */}
      {!isMobile ? (
        <div className={styles.detailPane}>
          {activeItem ? (
            <div key={activeItem.id}>
              {renderItemDetails(activeItem)}
            </div>
          ) : (
            <div className={styles.detailPlaceholder}>
              <p>Select a {itemTypeLabel} from the list to view details.</p>
              <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>
                Use <kbd>j</kbd>/<kbd>k</kbd> to traverse, and <kbd>Enter</kbd> to open.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* Mobile Bottom Sheet (slides up on item selection) */}
      {isMobile && detailId && activeItem && (
        <div className={styles.bottomSheet} role="dialog" aria-modal="true">
          <div className={styles.bottomSheetHeader}>
            <strong style={{ fontSize: '1rem' }}>Triage Detail</strong>
            <button
              className={styles.bottomSheetClose}
              onClick={() => setDetailId(null)}
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
  );
}
