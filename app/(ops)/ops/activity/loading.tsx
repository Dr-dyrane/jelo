'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import styles from './activity.module.css';

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

function SkeletonLine({ width }: { width: 'short' | 'medium' | 'full' }) {
  return <span className={styles.skeletonLine} data-width={width} />;
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
  return createPortal(
    <div className={styles.detail} aria-hidden="true">
      <div className={`${styles.detailScroll} ${styles.skeletonDetail}`}>
        <div className={styles.skeletonDetailIdentity}>
          <span className={styles.skeletonDetailVisual} />
          <span className={styles.skeletonStack}>
            <SkeletonLine width="full" />
            <SkeletonLine width="medium" />
          </span>
        </div>
        <span className={styles.skeletonDetailLabel} />
        <span className={styles.skeletonDetailCopy} />
        <span className={styles.skeletonDetailLabel} />
        <span className={styles.skeletonDetailFacts} />
      </div>
    </div>,
    detailPortalTarget,
  );
}

export default function LoadingInsights() {
  return (
    <>
      <OpsWorkspace title="Insights">
        <div className={styles.surface} role="status" aria-label="Loading insights">
          <section className={styles.snapshotRail} aria-hidden="true">
            {Array.from({ length: 2 }).map((_, card) => (
              <span className={styles.skeletonCard} key={card}>
                <SkeletonLine width="short" />
                <span className={styles.skeletonNumber} />
                <SkeletonLine width="medium" />
                <span className={styles.skeletonBar} />
                <SkeletonLine width="full" />
              </span>
            ))}
          </section>
          <section className={styles.patterns} aria-hidden="true">
            <span className={styles.skeletonHeading} />
            <div className={styles.patternColumns}>
              {Array.from({ length: 2 }).map((_, column) => (
                <div className={styles.skeletonStack} key={column}>
                  <SkeletonLine width="medium" />
                  {Array.from({ length: 3 }).map((__, row) => (
                    <span className={styles.skeletonRow} key={row} />
                  ))}
                </div>
              ))}
            </div>
          </section>
          <section className={styles.evidence} aria-hidden="true">
            <span className={styles.skeletonHeading} />
            <div className={styles.evidenceRows}>
              {Array.from({ length: 4 }).map((_, item) => (
                <span className={styles.skeletonEvidence} key={item} />
              ))}
            </div>
          </section>
          <section className={styles.history} aria-hidden="true">
            <span className={styles.skeletonHeading} />
            <div className={styles.skeletonLedger}>
              {Array.from({ length: 8 }).map((_, item) => (
                <span className={styles.skeletonDecision} key={item}>
                  <span className={styles.skeletonDecisionVisual} />
                  <span className={styles.skeletonDecisionCopy}>
                    <SkeletonLine width="short" />
                    <SkeletonLine width="full" />
                    <SkeletonLine width="medium" />
                  </span>
                </span>
              ))}
            </div>
          </section>
        </div>
      </OpsWorkspace>
      <span hidden data-ops-reserve-detail />
      <DetailSkeleton />
    </>
  );
}
