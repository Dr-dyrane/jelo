'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import styles from '@/components/ops/inbox/inbox.module.css';
import retailerStyles from './retailers.module.css';

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

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <span className={`${styles.skeletonSurface} ${className}`} />;
}

function SkeletonRow() {
  return (
    <span className={`${styles.sectionItemButton} ${styles.skeletonSectionItemButton}`}>
      <span className={retailerStyles.retailerRow}>
        <SkeletonBlock className={retailerStyles.retailerVisual} />
        <span className={retailerStyles.retailerCopy}>
          <SkeletonBlock className={styles.skeletonTitle} />
          <SkeletonBlock className={styles.skeletonSubtext} />
        </span>
        <SkeletonBlock className={styles.skeletonCaret} />
      </span>
    </span>
  );
}

function DetailSkeleton() {
  const detailPortalTarget = useSyncExternalStore(subscribeToDetailPane, getDetailPaneSnapshot, () => null);
  const isDesktop = useSyncExternalStore(subscribeToDesktopViewport, getDesktopViewportSnapshot, () => false);

  if (!isDesktop || !detailPortalTarget) return null;
  return createPortal(
    <div className={styles.detailContent}>
      <div className={styles.detailScroll}>
        <section className={retailerStyles.identitySummary}>
          <SkeletonBlock className={retailerStyles.identityVisual} />
          <div className={retailerStyles.identityCopy}>
            <SkeletonBlock className={styles.skeletonTitle} />
            <SkeletonBlock className={styles.skeletonSubtext} />
          </div>
        </section>
        <section className={styles.detailSection}>
          <SkeletonBlock className={styles.skeletonEyebrow} />
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className={styles.propertyRow}>
              <SkeletonBlock className={styles.skeletonSubtext} />
              <SkeletonBlock className={styles.skeletonSubtext} />
            </div>
          ))}
        </section>
      </div>
      <div className={styles.decideSection}>
        <div className={styles.actionButtons}>
          <SkeletonBlock className={styles.skeletonSubtext} />
          <SkeletonBlock className={styles.skeletonSubtext} />
        </div>
      </div>
    </div>,
    detailPortalTarget,
  );
}

export default function LoadingRetailerApplications() {
  return (
    <>
      <OpsWorkspace title="Retailer applications">
        <div className={styles.sectionCollection} data-ops-collection="sectioned" role="status" aria-label="Loading retailer applications">
          <section className={styles.collectionSection} data-presentation="compact-rows" aria-hidden="true">
            <ul className={styles.sectionItems} data-presentation="compact-rows">
              {Array.from({ length: 8 }).map((_, index) => (
                <li key={index} className={styles.sectionItem}>
                  <SkeletonRow />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </OpsWorkspace>
      <span hidden data-ops-reserve-detail />
      <DetailSkeleton />
    </>
  );
}
