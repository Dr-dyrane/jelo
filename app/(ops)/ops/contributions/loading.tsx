'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import styles from '@/components/ops/inbox/inbox.module.css';
import contributionStyles from './contributions.module.css';
import { ContributionDetailSkeleton } from './ContributionDetailSkeleton';

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
  const detailPortalTarget = useSyncExternalStore(subscribeToDetailPane, getDetailPaneSnapshot, () => null);
  const isDesktop = useSyncExternalStore(subscribeToDesktopViewport, getDesktopViewportSnapshot, () => false);

  if (!isDesktop || !detailPortalTarget) return null;
  return createPortal(<ContributionDetailSkeleton announce={false} />, detailPortalTarget);
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <span className={`${styles.skeletonSurface} ${className}`} />;
}

function SkeletonItem({ presentation }: { presentation: 'feature' | 'compact' | 'routine' }) {
  if (presentation === 'feature') {
    return (
      <span className={`${styles.sectionItemButton} ${styles.skeletonSectionItemButton}`}>
        <span className={contributionStyles.featureCard}>
          <span className={contributionStyles.featureVisual}>
            <SkeletonBlock className={contributionStyles.skeletonVisual} />
          </span>
          <span className={contributionStyles.featureCopy}>
            <SkeletonBlock className={styles.skeletonEyebrow} />
            <SkeletonBlock className={styles.skeletonDetailTitle} />
            <SkeletonBlock className={styles.skeletonSubtext} />
          </span>
        </span>
      </span>
    );
  }

  if (presentation === 'routine') {
    return (
      <span className={`${styles.sectionItemButton} ${styles.skeletonSectionItemButton}`}>
        <span className={contributionStyles.routineCard}>
          <SkeletonBlock className={contributionStyles.routineVisual} />
          <span className={contributionStyles.routineCopy}>
            <SkeletonBlock className={styles.skeletonTitle} />
            <SkeletonBlock className={styles.skeletonSubtext} />
          </span>
        </span>
      </span>
    );
  }

  return (
    <span className={`${styles.sectionItemButton} ${styles.skeletonSectionItemButton}`}>
      <span className={contributionStyles.compactRow}>
        <SkeletonBlock className={contributionStyles.compactVisual} />
        <span className={contributionStyles.compactCopy}>
          <SkeletonBlock className={styles.skeletonTitle} />
          <SkeletonBlock className={styles.skeletonSubtext} />
        </span>
        <SkeletonBlock className={styles.skeletonCaret} />
      </span>
    </span>
  );
}

export default function LoadingContributions() {
  return (
    <>
      <OpsWorkspace title="Contributions">
        <div className={styles.sectionCollection} data-ops-collection="sectioned" role="status" aria-label="Loading contributions">
          <section className={styles.collectionSection} data-presentation="feature-shelf" aria-hidden="true">
            <header className={styles.collectionSectionHeader}><h2>Up next</h2></header>
            <ul className={styles.sectionItems} data-presentation="feature-shelf">
              {Array.from({ length: 2 }).map((_, index) => <li key={index} className={styles.sectionItem}><SkeletonItem presentation="feature" /></li>)}
            </ul>
          </section>

          <section className={styles.collectionSection} data-presentation="compact-rows" aria-hidden="true">
            <header className={styles.collectionSectionHeader}><h2>Product submissions</h2></header>
            <ul className={styles.sectionItems} data-presentation="compact-rows">
              {Array.from({ length: 8 }).map((_, index) => <li key={index} className={styles.sectionItem}><SkeletonItem presentation="compact" /></li>)}
            </ul>
          </section>

          <section className={styles.collectionSection} data-presentation="horizontal-rail" aria-hidden="true">
            <header className={styles.collectionSectionHeader}><h2>Routine submissions</h2></header>
            <ul className={styles.sectionItems} data-presentation="horizontal-rail">
              {Array.from({ length: 5 }).map((_, index) => <li key={index} className={styles.sectionItem}><SkeletonItem presentation="routine" /></li>)}
            </ul>
          </section>

          <section className={styles.collectionSection} data-presentation="compact-rows" aria-hidden="true">
            <header className={styles.collectionSectionHeader}><h2>Store submissions</h2></header>
            <ul className={styles.sectionItems} data-presentation="compact-rows">
              {Array.from({ length: 8 }).map((_, index) => <li key={index} className={styles.sectionItem}><SkeletonItem presentation="compact" /></li>)}
            </ul>
          </section>
        </div>
      </OpsWorkspace>
      <span hidden data-ops-reserve-detail />
      <DetailSkeleton />
    </>
  );
}
