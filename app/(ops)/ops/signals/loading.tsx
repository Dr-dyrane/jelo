import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import styles from './signals.module.css';

function SkeletonLine({ width }: { width: 'short' | 'medium' | 'full' }) {
  return <span className={styles.skeletonLine} data-width={width} />;
}

export default function LoadingSignals() {
  return (
    <OpsWorkspace title="Signals">
      <div className={styles.surface} role="status" aria-label="Loading signals">
        <section className={styles.featureRail} aria-hidden="true">
          {Array.from({ length: 2 }).map((_, card) => (
            <span className={styles.skeletonCard} key={card}>
              <SkeletonLine width="short" />
              <SkeletonLine width="medium" />
              <span className={styles.skeletonNumber} />
              <SkeletonLine width="full" />
              <SkeletonLine width="medium" />
            </span>
          ))}
        </section>

        <section className={styles.section} aria-hidden="true">
          <span className={styles.skeletonHeading} />
          <div className={styles.skeletonSources}>
            {Array.from({ length: 4 }).map((_, row) => (
              <span className={styles.skeletonRow} key={row} />
            ))}
          </div>
        </section>

        <section className={styles.section} aria-hidden="true">
          <span className={styles.skeletonHeading} />
          <div className={styles.skeletonPositions}>
            {Array.from({ length: 5 }).map((_, item) => (
              <span className={styles.skeletonBar} key={item} />
            ))}
          </div>
        </section>

        <div className={styles.rankedColumns} aria-hidden="true">
          {Array.from({ length: 2 }).map((_, column) => (
            <section className={styles.section} key={column}>
              <span className={styles.skeletonHeading} />
              <div className={styles.skeletonRows}>
                {Array.from({ length: 5 }).map((__, row) => (
                  <span className={styles.skeletonRow} key={row} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className={styles.section} aria-hidden="true">
          <span className={styles.skeletonHeading} />
          <div className={styles.skeletonRecent}>
            {Array.from({ length: 8 }).map((_, row) => (
              <span className={styles.skeletonRecentRow} key={row}>
                <span className={styles.skeletonRecentVisual} />
                <span className={styles.skeletonRecentCopy}>
                  <SkeletonLine width="full" />
                  <SkeletonLine width="medium" />
                  <SkeletonLine width="short" />
                </span>
              </span>
            ))}
          </div>
        </section>

        <div className={styles.boundary} aria-hidden="true">
          <span className={styles.skeletonBoundary} />
          <span className={styles.skeletonBoundary} />
        </div>
      </div>
    </OpsWorkspace>
  );
}
