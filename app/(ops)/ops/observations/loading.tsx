'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import styles from '@/components/ops/inbox/inbox.module.css';
import observationStyles from './observations.module.css';
import adaptive from '@/components/ops/inbox/inbox-tablet.module.css';
import './observations-shell.module.css';

type ViewportMode = 'phone' | 'touch' | 'compact' | 'balanced' | 'expanded';

function SkeletonDetailContent() {
  return (
    <div className={styles.detailContent} aria-hidden="true">
      <div className={styles.detailScroll}>
        <section className={styles.productSummary}>
          <div className={`${styles.skeletonProductImage} ${styles.skeletonSurface}`} />
          <div className={styles.productCopy}>
            <div className={`${styles.skeletonProductTitle} ${styles.skeletonSurface}`} />
            <div className={`${styles.skeletonProductMeta} ${styles.skeletonSurface}`} />
            <div className={styles.detailMeta}>
              <span className={`${styles.skeletonPill} ${styles.skeletonSurface}`} />
              <span className={`${styles.skeletonSubtext} ${styles.skeletonSurface}`} />
            </div>
          </div>
        </section>

        <section className={styles.detailSection}>
          <h3 className={styles.sectionLabel}>Evidence</h3>
          <div className={styles.propertiesSection}>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className={styles.propertyRow}>
                <span className={`${styles.skeletonPropertyLabel} ${styles.skeletonSurface}`} />
                <span className={`${styles.skeletonPropertyValue} ${styles.skeletonSurface}`} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.decideSection}>
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

function DetailSkeleton({ mode, selectedId }: { mode: ViewportMode; selectedId: string | null }) {
  const detailPortalTarget = typeof document === 'undefined' ? null : document.getElementById('ops-detail-pane');
  if (!detailPortalTarget || !selectedId) return null;

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

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <span className={`${styles.skeletonSurface} ${className}`} />;
}

// Suspense fallback while the force-dynamic query resolves. Each section
// mirrors the ready-state geometry so the workspace does not recompose.
export default function LoadingObservations() {
  const [viewportMode, setViewportMode] = useState<ViewportMode>('expanded');
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('id');

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
      <DetailSkeleton mode={viewportMode} selectedId={selectedId} />
    </>
  );
}
