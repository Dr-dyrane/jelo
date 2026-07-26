'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import type { InboxSectionPresentation } from '@/components/ops/inbox/InboxContainer';
import styles from '@/components/ops/inbox/inbox.module.css';
import edgeStyles from './edges.module.css';
import { RelationshipDetailSkeleton } from './RelationshipDetailSkeleton';

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

function DetailSkeleton() {
  const detailPortalTarget = useSyncExternalStore(
    subscribeToDetailPane,
    getDetailPaneSnapshot,
    () => null,
  );
  const isDesktop = useSyncExternalStore(
    subscribeToDesktopViewport,
    getDesktopViewportSnapshot,
    () => false,
  );

  if (!isDesktop || !detailPortalTarget) return null;
  return createPortal(<RelationshipDetailSkeleton announce={false} />, detailPortalTarget);
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <span className={`${styles.skeletonSurface} ${className}`} />;
}

function SkeletonRow({
  presentation,
}: {
  presentation: InboxSectionPresentation;
}) {
  return (
    <span className={`${styles.sectionItemButton} ${styles.skeletonSectionItemButton}`}>
      <span
        className={`${edgeStyles.relationshipRow} ${edgeStyles.skeletonRow}`}
        data-presentation={presentation}
      >
        <span className={edgeStyles.relationshipVisual}>
          <SkeletonBlock className={edgeStyles.skeletonVisual} />
        </span>
        <span className={edgeStyles.relationshipCopy}>
          <SkeletonBlock className={styles.skeletonEyebrow} />
          <SkeletonBlock className={styles.skeletonTitle} />
          <SkeletonBlock className={styles.skeletonSubtext} />
        </span>
      </span>
    </span>
  );
}

const loadingSections: {
  id: string;
  label: string;
  presentation: InboxSectionPresentation;
  count: number;
}[] = [
  { id: 'up-next', label: 'Up next', presentation: 'feature-shelf', count: 2 },
  {
    id: 'product-context',
    label: 'Product context',
    presentation: 'compact-rows',
    count: 8,
  },
  { id: 'stores', label: 'Stores', presentation: 'horizontal-rail', count: 5 },
  {
    id: 'reports',
    label: 'Results and prices',
    presentation: 'compact-rows',
    count: 6,
  },
];

export default function LoadingEdges() {
  return (
    <>
      <OpsWorkspace title="Relationships">
        <div
          className={styles.sectionCollection}
          data-ops-collection="sectioned"
          role="status"
          aria-label="Loading relationships"
        >
          {loadingSections.map(section => (
            <section
              key={section.id}
              className={styles.collectionSection}
              data-presentation={section.presentation}
              aria-hidden="true"
            >
              <header className={styles.collectionSectionHeader}>
                <h2>{section.label}</h2>
              </header>
              <ul
                className={styles.sectionItems}
                data-presentation={section.presentation}
              >
                {Array.from({ length: section.count }).map((_, index) => (
                  <li key={index} className={styles.sectionItem}>
                    <SkeletonRow presentation={section.presentation} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </OpsWorkspace>
      <DetailSkeleton />
    </>
  );
}
