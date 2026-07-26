import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import styles from './signals.module.css';

function SkeletonLine({ width = 'full' }: { width?: 'short' | 'medium' | 'full' }) {
  return <span className={styles.skeletonLine} data-width={width} />;
}

export default function LoadingSignals() {
  return (
    <OpsWorkspace title="Signals">
      <div className={styles.monitor} role="status" aria-label="Loading signals">
        <section className={styles.summary} aria-hidden="true">
          <div className={styles.skeletonStack}>
            <SkeletonLine width="short" />
            <SkeletonLine width="medium" />
            <span className={styles.skeletonTotal} />
          </div>
          <div className={`${styles.skeletonStack} ${styles.skeletonComparison}`}>
            <SkeletonLine width="medium" />
            <SkeletonLine width="full" />
            <SkeletonLine width="short" />
          </div>
        </section>
        <section className={styles.section} aria-hidden="true">
          <div className={styles.skeletonHeading}>
            <div className={styles.skeletonStack}>
              <SkeletonLine width="medium" />
              <SkeletonLine width="full" />
            </div>
            <SkeletonLine width="short" />
          </div>
          <div className={styles.skeletonCampaigns}>
            {Array.from({ length: 4 }).map((_, row) => (
              <span className={styles.skeletonRow} key={row} />
            ))}
          </div>
        </section>
        <section className={styles.summary} aria-hidden="true">
          <div className={styles.skeletonStack}>
            <SkeletonLine width="short" />
            <SkeletonLine width="medium" />
            <span className={styles.skeletonTotal} />
          </div>
          <div className={`${styles.skeletonStack} ${styles.skeletonComparison}`}>
            <SkeletonLine width="medium" />
            <SkeletonLine width="full" />
            <SkeletonLine width="short" />
          </div>
        </section>
        <section className={styles.section} aria-hidden="true">
          <div className={styles.skeletonHeading}>
            <div className={styles.skeletonStack}>
              <SkeletonLine width="medium" />
              <SkeletonLine width="full" />
            </div>
            <SkeletonLine width="short" />
          </div>
          <div className={styles.choiceList}>
            {Array.from({ length: 5 }).map((_, index) => (
              <div className={styles.skeletonStack} key={index}>
                <SkeletonLine width="full" />
                <SkeletonLine width="short" />
                <span className={styles.skeletonBar} />
              </div>
            ))}
          </div>
        </section>
        <div className={styles.rankedColumns} aria-hidden="true">
          {Array.from({ length: 2 }).map((_, column) => (
            <section className={styles.section} key={column}>
              <div className={styles.skeletonStack}>
                <SkeletonLine width="medium" />
                <SkeletonLine width="full" />
              </div>
              <div className={styles.skeletonRows}>
                {Array.from({ length: 5 }).map((_, row) => (
                  <span className={styles.skeletonRow} key={row} />
                ))}
              </div>
            </section>
          ))}
        </div>
        <section className={styles.section} aria-hidden="true">
          <div className={styles.skeletonHeading}>
            <div className={styles.skeletonStack}>
              <SkeletonLine width="medium" />
              <SkeletonLine width="full" />
            </div>
            <SkeletonLine width="short" />
          </div>
          <div className={styles.skeletonRows}>
            {Array.from({ length: 5 }).map((_, row) => (
              <span className={styles.skeletonRow} key={row} />
            ))}
          </div>
        </section>
      </div>
    </OpsWorkspace>
  );
}
