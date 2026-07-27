'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import inboxStyles from '@/components/ops/inbox/inbox.module.css';
import { OperatorDetailSkeleton } from './OperatorDetailSkeleton';
import styles from './operators.module.css';

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
  return createPortal(<OperatorDetailSkeleton announce={false} />, detailPortalTarget);
}

function Line({ width = 'full' }: { width?: 'short' | 'medium' | 'full' }) {
  return <span className={styles.skeletonLine} data-width={width} />;
}

export default function LoadingOperators() {
  return (
    <>
      <OpsWorkspace title="Operators">
        <div
          className={inboxStyles.sectionCollection}
          data-ops-collection="sectioned"
          role="status"
          aria-label="Loading team access"
        >
          <section
            className={inboxStyles.collectionSection}
            data-presentation="feature-shelf"
            aria-hidden="true"
          >
            <header className={inboxStyles.collectionSectionHeader}>
              <h2>Team</h2>
            </header>
            <ul className={inboxStyles.sectionItems} data-presentation="feature-shelf">
              {Array.from({ length: 2 }).map((_, index) => (
                <li className={inboxStyles.sectionItem} key={index}>
                  <span
                    className={`${inboxStyles.sectionItemButton} ${inboxStyles.skeletonSectionItemButton}`}
                  >
                    <span className={styles.loadingFeature}>
                      <span className={styles.skeletonFeatureAvatar} />
                      <span className={styles.loadingCopy}>
                        <Line width="short" />
                        <Line width="medium" />
                        <Line />
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section
            className={inboxStyles.collectionSection}
            data-presentation="compact-rows"
            aria-hidden="true"
          >
            <header className={inboxStyles.collectionSectionHeader}>
              <h2>Invitations</h2>
            </header>
            <ul className={inboxStyles.sectionItems} data-presentation="compact-rows">
              {Array.from({ length: 3 }).map((_, index) => (
                <li className={inboxStyles.sectionItem} key={index}>
                  <span
                    className={`${inboxStyles.sectionItemButton} ${inboxStyles.skeletonSectionItemButton}`}
                  >
                    <span className={styles.loadingCompact}>
                      <span className={styles.skeletonCompactAvatar} />
                      <span className={styles.loadingCopy}>
                        <Line width="medium" />
                        <Line />
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
