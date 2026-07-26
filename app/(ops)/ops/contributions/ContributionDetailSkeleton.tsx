import styles from '@/components/ops/inbox/inbox.module.css';
import contributionStyles from './contributions.module.css';

export function ContributionDetailSkeleton({ announce = true }: { announce?: boolean }) {
  return (
    <div
      className={styles.detailContent}
      role={announce ? 'status' : undefined}
      aria-label={announce ? 'Loading contribution details' : undefined}
      aria-live={announce ? 'polite' : undefined}
      aria-busy="true"
    >
      <div className={styles.detailScroll} aria-hidden="true">
        <section className={contributionStyles.identitySummary}>
          <div className={`${contributionStyles.identityVisual} ${styles.skeletonSurface}`} />
          <div className={contributionStyles.identityCopy}>
            <div className={`${styles.skeletonProductTitle} ${styles.skeletonSurface}`} />
            <div className={`${styles.skeletonProductMeta} ${styles.skeletonSurface}`} />
            <div className={contributionStyles.identityMeta}>
              <span className={`${styles.skeletonPill} ${styles.skeletonSurface}`} />
              <span className={`${styles.skeletonSubtext} ${styles.skeletonSurface}`} />
            </div>
          </div>
        </section>

        <section className={styles.detailSection}>
          <h3 className={styles.sectionLabel}>Submitted details</h3>
          <div className={styles.propertiesSection}>
            {Array.from({ length: 5 }).map((_, index) => (
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
          <span className={styles.decideNoteLabel}>Note</span>
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
