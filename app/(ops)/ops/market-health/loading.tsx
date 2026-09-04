import { OpsWorkspace } from "@/components/ops/workspace/OpsWorkspace";
import styles from "./market-health.module.css";

export default function LoadingMarketHealth() {
  return (
    <OpsWorkspace title="Market health">
      <div
        className={styles.surface}
        role="status"
        aria-label="Loading market health"
      >
        <section className={styles.chainSection} aria-hidden="true">
          <span className={styles.skeletonHeading} />
          <div className={styles.skeletonStack}>
            {Array.from({ length: 7 }, (_, index) => (
              <span className={styles.skeletonRow} key={index} />
            ))}
          </div>
        </section>
        <section className={styles.exceptionSection} aria-hidden="true">
          <span className={styles.skeletonHeading} />
          <div className={styles.skeletonStack}>
            {Array.from({ length: 3 }, (_, index) => (
              <span className={styles.skeletonCompactRow} key={index} />
            ))}
          </div>
        </section>
      </div>
    </OpsWorkspace>
  );
}
