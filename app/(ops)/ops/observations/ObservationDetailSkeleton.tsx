import styles from '@/components/ops/inbox/inbox.module.css';

export function ObservationDetailSkeleton() {
  return (
    <div
      className={styles.detailContent}
      data-observation-detail-loading
      role="status"
      aria-label="Loading observation details"
      aria-live="polite"
      aria-busy="true"
    >
      <div className={styles.detailScroll} aria-hidden="true">
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
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className={styles.propertyRow}>
                <span className={`${styles.skeletonPropertyLabel} ${styles.skeletonSurface}`} />
                <span className={`${styles.skeletonPropertyValue} ${styles.skeletonSurface}`} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.decideSection} aria-hidden="true">
        <h3 className={styles.sectionLabel}>Decision</h3>
        <div className={styles.decideField}>
          <span className={styles.decideNoteLabel}>Rationale</span>
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
