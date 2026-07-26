import styles from '@/components/ops/inbox/inbox.module.css';
import vocabularyStyles from './vocabulary.module.css';

export function VocabularyDetailSkeleton({ announce = true }: { announce?: boolean }) {
  return (
    <div
      className={styles.detailContent}
      role={announce ? 'status' : undefined}
      aria-label={announce ? 'Loading term details' : undefined}
      aria-live={announce ? 'polite' : undefined}
      aria-busy="true"
    >
      <div className={styles.detailScroll} aria-hidden="true">
        <section className={vocabularyStyles.identitySummary}>
          <div className={vocabularyStyles.identityCopy}>
            <div className={`${styles.skeletonProductTitle} ${styles.skeletonSurface}`} />
            <div className={`${styles.skeletonProductMeta} ${styles.skeletonSurface}`} />
          </div>
        </section>

        <section className={styles.detailSection}>
          <h3 className={styles.sectionLabel}>Where it appeared</h3>
          <ol className={vocabularyStyles.reportList}>
            {Array.from({ length: 3 }).map((_, index) => (
              <li key={index}>
                <div>
                  <span className={`${styles.skeletonTitle} ${styles.skeletonSurface}`} />
                  <span className={`${styles.skeletonSubtext} ${styles.skeletonSurface}`} />
                </div>
                <span className={`${styles.skeletonPropertyLabel} ${styles.skeletonSurface}`} />
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.detailSection}>
          <h3 className={styles.sectionLabel}>Seen</h3>
          <div className={styles.propertiesSection}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className={styles.propertyRow}>
                <span className={`${styles.skeletonPropertyLabel} ${styles.skeletonSurface}`} />
                <span className={`${styles.skeletonPropertyValue} ${styles.skeletonSurface}`} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.decideSection} aria-hidden="true">
        <h3 className={styles.sectionLabel}>Choose what it means</h3>
        <div className={`${vocabularyStyles.detailChoiceSkeleton} ${styles.skeletonSurface}`} />
        <span className={styles.decideNoteLabel}>Add note</span>
        <div className={vocabularyStyles.decisionActions}>
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className={`${styles.btn} ${styles.skeletonBtn} ${styles.skeletonSurface} ${index === 0 ? vocabularyStyles.skeletonPrimaryAction : ''}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
