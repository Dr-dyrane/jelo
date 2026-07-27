import styles from './operators.module.css';

function Line({ width }: { width: 'short' | 'medium' | 'full' }) {
  return <span className={styles.skeletonLine} data-width={width} />;
}

export function OperatorDetailSkeleton({
  announce = true,
}: {
  announce?: boolean;
}) {
  return (
    <div
      className={styles.detail}
      role={announce ? 'status' : undefined}
      aria-label={announce ? 'Loading team member' : undefined}
      aria-live={announce ? 'polite' : undefined}
      aria-busy="true"
    >
      <div className={styles.detailScroll} aria-hidden="true">
        <div className={styles.skeletonIdentity}>
          <span className={styles.skeletonAvatar} />
          <span className={styles.skeletonStack}>
            <Line width="medium" />
            <Line width="full" />
          </span>
        </div>
        <span className={styles.skeletonHeading} />
        <span className={styles.skeletonFacts} />
        <span className={styles.skeletonHeading} />
        <span className={styles.skeletonFacts} />
        <span className={styles.skeletonHeading} />
        <span className={styles.skeletonActivity} />
      </div>
      <div className={styles.skeletonDecision} aria-hidden="true">
        <span className={styles.skeletonHeading} />
        <span className={styles.skeletonDecisionActions} />
      </div>
    </div>
  );
}
