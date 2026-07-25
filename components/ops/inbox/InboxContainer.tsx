'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
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
  const pathname = usePathname();

  // Sync active item
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
    setActiveIndex(index);
    setDetailId(item.id);
  }

  // Generate Linear-style breadcrumbs
  function getBreadcrumbs() {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return 'System / Overview';
    
    return segments
      .map((segment, idx) => {
        if (idx === 0) return 'Ops';
        if (segment === 'contributions') return 'Queues / Contributions';
        if (segment === 'edges') return 'Queues / Edges';
        if (segment === 'observations') return 'Queues / Observations';
        if (segment === 'vocabulary') return 'Queues / Vocabulary';
        if (segment === 'retailers') return 'Queues / Retailers';
        if (segment === 'signals') return 'System / Signals';
        return segment.charAt(0).toUpperCase() + segment.slice(1);
      })
      .join(' / ');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Linear top bar breadcrumbs & keyboard hints */}
      <header style={{
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-4)',
        background: 'var(--card)',
        fontSize: '11px',
        userSelect: 'none',
        flexShrink: 0,
        boxShadow: 'var(--elevation-1)',
        zIndex: 10,
      }}>
        <div style={{ fontWeight: 500, color: 'var(--muted)' }}>
          {getBreadcrumbs()}
        </div>
        {!isMobile ? (
          <div style={{ color: 'var(--muted)', display: 'flex', gap: '12px' }}>
            <span><kbd style={{ background: 'var(--cream)', border: '1px solid var(--border)', padding: '1px 3px', borderRadius: '3px' }}>j</kbd>/<kbd style={{ background: 'var(--cream)', border: '1px solid var(--border)', padding: '1px 3px', borderRadius: '3px' }}>k</kbd> Navigate</span>
            <span><kbd style={{ background: 'var(--cream)', border: '1px solid var(--border)', padding: '1px 3px', borderRadius: '3px' }}>Enter</kbd> Focus</span>
            <span><kbd style={{ background: 'var(--cream)', border: '1px solid var(--border)', padding: '1px 3px', borderRadius: '3px' }}>E</kbd> Approve</span>
            <span><kbd style={{ background: 'var(--cream)', border: '1px solid var(--border)', padding: '1px 3px', borderRadius: '3px' }}>R</kbd> Reject</span>
          </div>
        ) : null}
      </header>

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
              <div key={activeItem.id}>
                {renderItemDetails(activeItem)}
              </div>
            ) : (
              <div className={styles.detailPlaceholder}>
                <p>Select a {itemTypeLabel} from the list to view details.</p>
              </div>
            )}
          </div>
        ) : null}

        {/* Mobile Bottom Sheet (slides up on item selection) */}
        {isMobile && detailId && activeItem && (
          <div className={styles.bottomSheet} role="dialog" aria-modal="true">
            <div className={styles.bottomSheetHeader}>
              <strong style={{ fontSize: '12px', fontWeight: 600 }}>Triage Detail</strong>
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
    </div>
  );
}
