'use client';

import { createPortal } from 'react-dom';
import { useSyncExternalStore } from 'react';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import styles from '@/components/ops/inbox/inbox.module.css';
import { ResearchDetailSkeleton } from './ResearchDetailSkeleton';

function subscribeToDetailPane(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

function getDetailPaneSnapshot() {
  return document.getElementById('ops-detail-pane');
}

function subscribeToDesktop(onStoreChange: () => void) {
  const query = window.matchMedia('(min-width: 1180px)');
  query.addEventListener('change', onStoreChange);
  return () => query.removeEventListener('change', onStoreChange);
}

function getDesktopSnapshot() {
  return window.matchMedia('(min-width: 1180px)').matches;
}

function DetailSkeleton() {
  const target = useSyncExternalStore(subscribeToDetailPane, getDetailPaneSnapshot, () => null);
  const desktop = useSyncExternalStore(subscribeToDesktop, getDesktopSnapshot, () => false);
  return desktop && target ? createPortal(<ResearchDetailSkeleton announce={false} />, target) : null;
}

export default function ResearchLoading() {
  return (
    <>
      <OpsWorkspace title="Research">
        <div className={styles.cardGrid} role="status" aria-label="Loading research work">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className={styles.skeletonCard} aria-hidden="true">
              <span className={styles.cardInner}>
                <span className={styles.skeletonImage} />
                <span className={styles.cardBody}>
                  <span className={styles.skeletonTitle} />
                  <span className={styles.skeletonSubtext} />
                </span>
                <span className={styles.skeletonCaret} />
              </span>
            </div>
          ))}
        </div>
      </OpsWorkspace>
      <span hidden data-ops-reserve-detail />
      <DetailSkeleton />
    </>
  );
}
