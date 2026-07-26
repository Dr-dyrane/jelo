'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import styles from '@/components/ops/inbox/inbox.module.css';
import adaptive from '@/components/ops/inbox/inbox-tablet.module.css';
import './observations-shell.module.css';

type ViewportMode = 'phone' | 'touch' | 'compact' | 'balanced' | 'expanded';

function SkeletonDetailContent() {
  return (
    <div className={styles.detailContent} aria-hidden="true">
      <header className={styles.detailHeader}>
        <div className={`${styles.skeletonEyebrow} ${styles.skeletonSurface}`} />
        <div className={`${styles.skeletonDetailTitle} ${styles.skeletonSurface}`} />
        <div className={styles.detailMeta}>
          <span className={`${styles.skeletonPill} ${styles.skeletonSurface}`} />
          <span className={`${styles.skeletonSubtext} ${styles.skeletonSurface}`} />
        </div>
      </header>

      <section className={styles.productSummary}>
        <div className={`${styles.skeletonProductImage} ${styles.skeletonSurface}`} />
        <div className={styles.productCopy}>
          <div className={`${styles.skeletonProductTitle} ${styles.skeletonSurface}`} />
          <div className={`${styles.skeletonProductMeta} ${styles.skeletonSurface}`} />
        </div>
      </section>

      <section className={styles.detailSection}>
        <h3 className={styles.sectionLabel}>Evidence</h3>
        <div className={styles.propertiesSection}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.propertyRow}>
              <span className={`${styles.skeletonPropertyLabel} ${styles.skeletonSurface}`} />
              <span className={`${styles.skeletonPropertyValue} ${styles.skeletonSurface}`} />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.detailSection}>
        <h3 className={styles.sectionLabel}>Decision</h3>
        <div className={styles.decideField}>
          <label className={styles.decideNoteLabel}>Rationale</label>
          <div className={`${styles.skeletonNote} ${styles.skeletonSurface}`} />
        </div>
        <div className={styles.actionButtons}>
          <div className={`${styles.btn} ${styles.skeletonBtn} ${styles.skeletonSurface}`} />
          <div className={`${styles.btn} ${styles.skeletonBtn} ${styles.skeletonSurface}`} />
        </div>
      </section>
    </div>
  );
}

function DetailSkeleton({ mode }: { mode: ViewportMode }) {
  const detailPortalTarget = typeof document === 'undefined' ? null : document.getElementById('ops-detail-pane');
  if (!detailPortalTarget) return null;

  const usesOverlayInspector = mode === 'phone' || mode === 'touch' || mode === 'compact';

  if (usesOverlayInspector) {
    return createPortal(
      <div className={adaptive.tabletStage} role="dialog" aria-modal="true" aria-label="Loading observation details">
        <span className={adaptive.tabletScrim} aria-hidden="true" />
        <section className={adaptive.tabletInspector}>
          <header className={adaptive.tabletInspectorHeader}>
            <div className={adaptive.tabletClose} aria-hidden="true" />
          </header>
          <div className={adaptive.tabletInspectorBody}>
            <SkeletonDetailContent />
          </div>
        </section>
      </div>,
      detailPortalTarget,
    );
  }

  return createPortal(<SkeletonDetailContent />, detailPortalTarget);
}

// Suspense fallback while the force-dynamic query resolves. Skeleton grid
// mirrors the ready-state collection geometry exactly so there is no reflow.
export default function LoadingObservations() {
  const [viewportMode, setViewportMode] = useState<ViewportMode>('expanded');

  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      setViewportMode(
        width < 430 ? 'phone' : width < 820 ? 'touch' : width < 1180 ? 'compact' : width < 1440 ? 'balanced' : 'expanded',
      );
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <OpsWorkspace title="Observations">
        <div className={styles.cardGrid} data-ops-collection role="status" aria-label="Loading observations">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className={`${styles.card} ${styles.skeletonCard}`} data-ops-collection-item aria-hidden="true">
              <div className={styles.cardInner}>
                <div className={styles.skeletonImage} />
                <div className={styles.cardBody}>
                  <div className={styles.skeletonTitle} />
                  <div className={styles.skeletonSubtext} />
                </div>
                <div className={styles.skeletonCaret} />
              </div>
            </div>
          ))}
        </div>
      </OpsWorkspace>
      <DetailSkeleton mode={viewportMode} />
    </>
  );
}
