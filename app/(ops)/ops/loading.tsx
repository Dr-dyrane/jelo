import styles from './overview.module.css';
import { OverviewLoadingInspector } from './OverviewLoadingInspector';

export default function LoadingOverview() {
  return (
    <>
      <div className={styles.briefing} role="status" aria-label="Loading overview">
        <div className={styles.context} aria-hidden="true">
          <div className={styles.skeletonTitle} />
        </div>
        <div className={styles.upNextSection} aria-hidden="true">
          <div className={styles.skeletonHeading} />
          <div className={styles.skeletonFeatureShelf}>
            <div className={styles.skeletonFeatureCard} />
            <div className={styles.skeletonFeatureCard} />
          </div>
        </div>
        <div className={styles.queueSection} aria-hidden="true">
          <div className={styles.skeletonHeading} />
          <div className={styles.skeletonRows}>
            {Array.from({ length: 5 }).map((_, index) => <div key={index} className={styles.skeletonRow} />)}
          </div>
        </div>
        <div className={styles.recentSection} aria-hidden="true">
          <div className={styles.skeletonHeading} />
          <div className={styles.skeletonRecentRows}>
            {Array.from({ length: 2 }).map((_, index) => <div key={index} className={styles.skeletonRecentRow} />)}
          </div>
        </div>
      </div>
      <OverviewLoadingInspector />
    </>
  );
}
