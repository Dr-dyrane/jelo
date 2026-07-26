'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import styles from '@/components/ops/inbox/inbox.module.css';
import vocabularyStyles from './vocabulary.module.css';
import { VocabularyDetailSkeleton } from './VocabularyDetailSkeleton';
import './vocabulary-shell.module.css';

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

  // Loading cannot reliably infer whether a route selection is still pending.
  // On a docked desktop inspector, reserve the real detail plane immediately;
  // at compact and touch widths the ready state opens an inspector only after a
  // person selects a term, so the fallback must not invent an open sheet.
  if (!isDesktop || !detailPortalTarget) return null;
  return createPortal(<VocabularyDetailSkeleton announce={false} />, detailPortalTarget);
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <span className={`${styles.skeletonSurface} ${className}`} />;
}

function SkeletonFeature() {
  return (
    <li className={styles.sectionItem}>
      <span className={`${styles.sectionItemButton} ${styles.skeletonSectionItemButton}`}>
        <span className={vocabularyStyles.featureCard}>
          <span className={vocabularyStyles.featureVisual}>
            <SkeletonBlock className={vocabularyStyles.skeletonIcon} />
          </span>
          <span className={vocabularyStyles.featureCopy}>
            <SkeletonBlock className={styles.skeletonEyebrow} />
            <SkeletonBlock className={styles.skeletonDetailTitle} />
            <SkeletonBlock className={styles.skeletonSubtext} />
          </span>
        </span>
      </span>
    </li>
  );
}

function SkeletonRow() {
  return (
    <li className={styles.sectionItem}>
      <span className={`${styles.sectionItemButton} ${styles.skeletonSectionItemButton}`}>
        <span className={vocabularyStyles.compactRow}>
          <span className={vocabularyStyles.compactMark}>
            <SkeletonBlock className={vocabularyStyles.skeletonIcon} />
          </span>
          <span className={vocabularyStyles.compactCopy}>
            <SkeletonBlock className={styles.skeletonTitle} />
            <SkeletonBlock className={styles.skeletonSubtext} />
          </span>
        </span>
      </span>
    </li>
  );
}

export default function LoadingVocabulary() {
  return (
    <>
      <OpsWorkspace title="Vocabulary">
        <div className={styles.sectionCollection} data-ops-collection="sectioned" role="status" aria-label="Loading vocabulary">
          <section className={styles.collectionSection} data-presentation="feature-shelf" aria-hidden="true">
            <header className={styles.collectionSectionHeader}><h2>Up next</h2></header>
            <ul className={styles.sectionItems} data-presentation="feature-shelf">
              <SkeletonFeature />
              <SkeletonFeature />
            </ul>
          </section>

          {['Products', 'Stores', 'Brands', 'Uses'].map(label => (
            <section
              key={label}
              className={styles.collectionSection}
              data-presentation="compact-rows"
              aria-hidden="true"
            >
              <header className={styles.collectionSectionHeader}><h2>{label}</h2></header>
              <ul className={styles.sectionItems} data-presentation="compact-rows">
                {Array.from({ length: 4 }).map((_, index) => <SkeletonRow key={index} />)}
              </ul>
            </section>
          ))}
        </div>
      </OpsWorkspace>
      <span hidden data-ops-reserve-detail />
      <DetailSkeleton />
    </>
  );
}
