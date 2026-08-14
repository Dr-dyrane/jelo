'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import styles from '@/components/ops/inbox/inbox.module.css';
import observationStyles from './observations.module.css';
import { ObservationDetailSkeleton } from './ObservationDetailSkeleton';
import shellStyles from './observations-shell.module.css';

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

  return createPortal(<ObservationDetailSkeleton announce={false} />, detailPortalTarget);
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <span className={`${styles.skeletonSurface} ${className}`} />;
}

// Suspense fallback while the force-dynamic query resolves. Each section
// mirrors the ready-state geometry so the workspace does not recompose.
export default function LoadingObservations() {
  return (
    <>
      <span className={shellStyles.scope} hidden />
      <OpsWorkspace title="Observations">
        <div className={styles.sectionCollection} data-ops-collection="sectioned" role="status" aria-label="Loading observations">
          <section className={styles.collectionSection} data-presentation="feature-shelf" aria-hidden="true">
            <header className={styles.collectionSectionHeader}>
              <h2>Up next</h2>
            </header>
            <ul className={styles.sectionItems} data-presentation="feature-shelf">
              {Array.from({ length: 2 }).map((_, index) => (
                <li key={index} className={styles.sectionItem}>
                  <span className={`${styles.sectionItemButton} ${styles.skeletonSectionItemButton}`}>
                    <span className={observationStyles.featureCard}>
                      <span className={observationStyles.featureVisual}>
                        <SkeletonBlock className={observationStyles.skeletonFeatureProduct} />
                      </span>
                      <span className={observationStyles.featureCopy}>
                        <SkeletonBlock className={observationStyles.skeletonFeatureLabel} />
                        <SkeletonBlock className={observationStyles.skeletonFeatureTitle} />
                        <SkeletonBlock className={observationStyles.skeletonFeatureMeta} />
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.collectionSection} data-presentation="compact-rows" aria-hidden="true">
            <header className={styles.collectionSectionHeader}>
              <h2>Price reports</h2>
            </header>
            <ul className={styles.sectionItems} data-presentation="compact-rows">
              {Array.from({ length: 8 }).map((_, index) => (
                <li key={index} className={styles.sectionItem}>
                  <span className={`${styles.sectionItemButton} ${styles.skeletonSectionItemButton}`}>
                    <span className={observationStyles.compactRow}>
                      <SkeletonBlock className={observationStyles.skeletonCompactImage} />
                      <span className={observationStyles.compactCopy}>
                        <SkeletonBlock className={styles.skeletonTitle} />
                        <SkeletonBlock className={styles.skeletonSubtext} />
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.collectionSection} data-presentation="horizontal-rail" aria-hidden="true">
            <header className={styles.collectionSectionHeader}>
              <h2>Experience reports</h2>
            </header>
            <ul className={styles.sectionItems} data-presentation="horizontal-rail">
              {Array.from({ length: 5 }).map((_, index) => (
                <li key={index} className={styles.sectionItem}>
                  <span className={`${styles.sectionItemButton} ${styles.skeletonSectionItemButton}`}>
                    <span className={observationStyles.experienceCard}>
                      <span className={observationStyles.experienceVisual}>
                        <SkeletonBlock className={observationStyles.skeletonExperienceProduct} />
                      </span>
                      <span className={observationStyles.experienceCopy}>
                        <SkeletonBlock className={styles.skeletonTitle} />
                        <SkeletonBlock className={styles.skeletonSubtext} />
                      </span>
                    </span>
                  </span>
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
