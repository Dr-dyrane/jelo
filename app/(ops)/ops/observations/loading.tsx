import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import styles from '@/components/ops/inbox/inbox.module.css';
import './observations-shell.module.css';

// Suspense fallback while the force-dynamic query resolves. Skeleton grid
// mirrors the ready-state collection geometry exactly so there is no reflow.
export default function LoadingObservations() {
  return (
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
  );
}
