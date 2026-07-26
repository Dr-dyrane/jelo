'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import styles from './overview.module.css';

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

export function OverviewLoadingInspector() {
  const detailPortalTarget = useSyncExternalStore(subscribeToDetailPane, getDetailPaneSnapshot, () => null);
  const isDesktop = useSyncExternalStore(subscribeToDesktopViewport, getDesktopViewportSnapshot, () => false);

  if (!isDesktop || !detailPortalTarget) return null;

  return createPortal(
    <div className={styles.inspectorLoading} aria-hidden="true">
      <div className={styles.skeletonInspectorTitle} />
      <div className={styles.skeletonInspectorSummary}>
        <div className={styles.skeletonInspectorLabel} />
        <div className={styles.skeletonInspectorLine} />
      </div>
      <div className={styles.skeletonInspectorSection}>
        <div className={styles.skeletonInspectorLabel} />
        <div className={styles.skeletonInspectorRow} />
        <div className={styles.skeletonInspectorRow} />
      </div>
      <div className={styles.skeletonInspectorAction} />
    </div>,
    detailPortalTarget,
  );
}
