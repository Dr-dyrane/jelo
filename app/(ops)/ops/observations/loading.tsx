'use client';

import { createPortal } from 'react-dom';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import styles from '@/components/ops/inbox/inbox.module.css';
import './observations-shell.module.css';

function DetailSkeleton() {
  const detailPortalTarget = typeof document === 'undefined' ? null : document.getElementById('ops-detail-pane');
  if (!detailPortalTarget) return null;

  return createPortal(
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
    </div>,
    detailPortalTarget,
  );
}

// Suspense fallback while the force-dynamic query resolves. Skeleton grid
// mirrors the ready-state collection geometry exactly so there is no reflow.
export default function LoadingObservations() {
  return (
    <>
      <OpsWorkspace title="Observations">
        <div className={styles.cardGrid} role="status" aria-label="Loading observations">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className={`${styles.card} ${styles.skeletonCard}`} aria-hidden="true">
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
      <DetailSkeleton />
    </>
  );
}
