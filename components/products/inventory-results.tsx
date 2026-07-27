'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Market } from '@/data/prices';
import {
  appendUniqueInventoryItems,
  inventoryAutoLoadPageLimit,
  inventoryContinuationHref,
  type InventoryContinuationQuery,
} from '@/lib/catalogue/inventory-continuation';
import type { InventoryItem } from '@/lib/catalogue/inventory-repository';
import { loadInventoryContinuation } from './inventory-continuation-action';
import { InventoryCard } from './inventory-card';
import styles from './inventory-results.module.css';

type LoadReason = 'automatic' | 'manual' | 'restore';

type LoadFailure = {
  targetPage: number;
};

type Props = {
  initialItems: InventoryItem[];
  market: Market;
  pageCount: number;
  query: InventoryContinuationQuery;
  requestedPage: number;
  total: number;
  url: string;
  gridClassName: string;
};

function replaceContinuationUrl(url: string, page: number) {
  const href = inventoryContinuationHref(url, page);
  window.history.replaceState({ ...window.history.state }, '', href);
}

export function InventoryResults({
  initialItems,
  market,
  pageCount,
  query,
  requestedPage,
  total,
  url,
  gridClassName,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [availablePageCount, setAvailablePageCount] = useState(pageCount);
  const [availableTotal, setAvailableTotal] = useState(total);
  const [loadedPage, setLoadedPage] = useState(1);
  const [isLoading, setIsLoading] = useState(requestedPage > 1);
  const [failure, setFailure] = useState<LoadFailure | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const itemsRef = useRef(initialItems);
  const loadedPageRef = useRef(1);
  const pageCountRef = useRef(pageCount);
  const totalRef = useRef(total);
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);
  const restoreStartedRef = useRef(false);
  const autoLoadCountRef = useRef(0);
  const observerArmedRef = useRef(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const statusId = 'catalogue-continuation-status';
  const hasMore = loadedPage < availablePageCount;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadThrough = useCallback(async (targetPage: number, reason: LoadReason) => {
    if (pendingRef.current || targetPage <= loadedPageRef.current) return;

    pendingRef.current = true;
    setIsLoading(true);
    setFailure(null);
    let nextPage = loadedPageRef.current + 1;
    let safeTarget = Math.max(nextPage, targetPage);
    let addedCount = 0;

    try {
      while (nextPage <= safeTarget) {
        const response = await loadInventoryContinuation({
          query,
          fromPage: nextPage,
          toPage: safeTarget,
        });
        if (!mountedRef.current) return;

        pageCountRef.current = response.pageCount;
        totalRef.current = response.total;
        setAvailablePageCount(response.pageCount);
        setAvailableTotal(response.total);
        safeTarget = Math.min(safeTarget, response.pageCount);

        if (response.throughPage < nextPage || !response.items.length) {
          if (nextPage <= safeTarget) throw new Error('Inventory continuation made no progress.');
          break;
        }

        const merged = appendUniqueInventoryItems(itemsRef.current, response.items);
        addedCount += merged.length - itemsRef.current.length;
        itemsRef.current = merged;
        loadedPageRef.current = response.throughPage;
        setItems(merged);
        setLoadedPage(response.throughPage);
        replaceContinuationUrl(url, response.throughPage);
        nextPage = response.throughPage + 1;
      }

      if (!mountedRef.current) return;
      replaceContinuationUrl(url, loadedPageRef.current);
      const visibleCount = Math.min(totalRef.current, itemsRef.current.length);
      setAnnouncement(
        reason === 'restore'
          ? `Showing ${visibleCount} of ${totalRef.current} products.`
          : addedCount > 0
            ? `${addedCount} more ${addedCount === 1 ? 'product' : 'products'} shown.`
            : 'All products shown.',
      );
    } catch (error) {
      if (!mountedRef.current) return;
      console.error('Could not load more catalogue products.', error);
      setFailure({ targetPage: safeTarget });
      setAnnouncement('Couldn’t load more products. Try again.');
    } finally {
      if (mountedRef.current) {
        pendingRef.current = false;
        setIsLoading(false);
      }
    }
  }, [query, url]);

  useEffect(() => {
    if (requestedPage <= 1 || restoreStartedRef.current) return;
    restoreStartedRef.current = true;
    void loadThrough(requestedPage, 'restore');
  }, [loadThrough, requestedPage]);

  const loadNext = useCallback((reason: Exclude<LoadReason, 'restore'>) => {
    if (pendingRef.current || loadedPageRef.current >= pageCountRef.current) return;
    void loadThrough(loadedPageRef.current + 1, reason);
  }, [loadThrough]);

  useEffect(() => {
    if (!hasMore || isLoading || failure || !sentinelRef.current) return;
    if (autoLoadCountRef.current >= inventoryAutoLoadPageLimit) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(entries => {
      const entry = entries[0];
      if (!entry?.isIntersecting) {
        observerArmedRef.current = true;
        return;
      }
      if (
        !observerArmedRef.current
        || pendingRef.current
        || autoLoadCountRef.current >= inventoryAutoLoadPageLimit
      ) return;

      observerArmedRef.current = false;
      autoLoadCountRef.current += 1;
      loadNext('automatic');
    }, {
      root: null,
      rootMargin: '240px 0px',
      threshold: 0.01,
    });

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [failure, hasMore, isLoading, loadNext]);

  const retryTarget = failure?.targetPage ?? loadedPage + 1;

  return (
    <>
      <div
        id="catalogue-product-grid"
        className={gridClassName}
        aria-busy={isLoading}
        aria-labelledby="catalogue-results-heading"
      >
        {items.map(item => (
          <InventoryCard item={item} market={market} key={item.id} />
        ))}
        {isLoading ? Array.from({ length: 2 }, (_, index) => (
          <article className={styles.skeletonCard} aria-hidden="true" key={`loading-${index}`}>
            <div className={styles.skeletonVisual} />
            <div className={styles.skeletonCopy}>
              <span />
              <span />
              <span />
            </div>
          </article>
        )) : null}
      </div>

      {availablePageCount > 1 ? (
        <div
          className={styles.continuation}
          ref={sentinelRef}
          data-auto-load-limit={inventoryAutoLoadPageLimit}
        >
          {failure ? <p className={styles.error}>Couldn’t load more.</p> : null}
          {hasMore ? (
            <button
              type="button"
              aria-controls="catalogue-product-grid"
              aria-describedby={statusId}
              disabled={isLoading}
              onClick={() => (
                failure
                  ? void loadThrough(retryTarget, 'manual')
                  : loadNext('manual')
              )}
            >
              {isLoading ? 'Loading…' : failure ? 'Try again' : 'Load more'}
            </button>
          ) : (
            <p className={styles.complete}>All {availableTotal.toLocaleString()} shown.</p>
          )}
          <p
            id={statusId}
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {announcement}
          </p>
        </div>
      ) : null}
    </>
  );
}
