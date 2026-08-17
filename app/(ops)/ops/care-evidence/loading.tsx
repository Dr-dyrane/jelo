import { OpsWorkspace } from "@/components/ops/workspace/OpsWorkspace";
import styles from "./care-evidence.module.css";

function SkeletonLine({ width }: { width: "short" | "medium" | "full" }) {
  return <span className={styles.skeletonLine} data-width={width} />;
}

export default function LoadingCareEvidence() {
  return (
    <OpsWorkspace title="Care evidence">
      <div
        className={styles.surface}
        role="status"
        aria-label="Loading care evidence"
      >
        <div className={styles.skeletonTabs} aria-hidden="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <span className={styles.skeletonTab} key={index} />
          ))}
        </div>

        <section className={styles.section} aria-hidden="true">
          <span className={styles.skeletonHeading} />
          <div className={styles.skeletonStack}>
            {Array.from({ length: 4 }).map((_, row) => (
              <span className={styles.skeletonRow} key={row} />
            ))}
          </div>
        </section>

        <section className={styles.section} aria-hidden="true">
          <span className={styles.skeletonHeading} />
          <span className={styles.skeletonCard} />
        </section>
      </div>
    </OpsWorkspace>
  );
}
