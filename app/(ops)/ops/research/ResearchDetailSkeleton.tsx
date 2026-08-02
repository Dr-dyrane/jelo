import styles from '@/components/ops/inbox/inbox.module.css';

function Block({ className = '' }: { className?: string }) {
  return <span className={`${styles.skeletonSurface} ${className}`} />;
}

export function ResearchDetailSkeleton({ announce = true }: { announce?: boolean }) {
  return (
    <div className={styles.detailContent} role={announce ? 'status' : undefined} aria-label={announce ? 'Loading research details' : undefined}>
      <div className={styles.detailScroll} aria-hidden="true">
        <header className={styles.detailHeader}>
          <Block className={styles.skeletonDetailTitle} />
          <Block className={styles.skeletonPill} />
        </header>
        <section className={styles.detailSection}>
          <Block className={styles.skeletonTitle} />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className={styles.propertyRow}>
              <Block className={styles.skeletonPropertyLabel} />
              <Block className={styles.skeletonPropertyValue} />
            </div>
          ))}
        </section>
        <section className={styles.detailSection}>
          <Block className={styles.skeletonNote} />
          <Block className={styles.skeletonNote} />
        </section>
      </div>
      <div className={styles.decideSection} aria-hidden="true">
        <Block className={styles.skeletonBtn} />
      </div>
    </div>
  );
}
