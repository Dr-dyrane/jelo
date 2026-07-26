import styles from './overview.module.css';

export default function LoadingOverview() {
  return (
    <div className={styles.briefing} role="status" aria-label="Loading overview">
      <div className={styles.context} aria-hidden="true">
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonText} />
      </div>
      <div className={`${styles.nextAction} ${styles.skeletonBlock}`} aria-hidden="true">
        <div className={styles.skeletonText} />
        <div className={styles.skeletonButton} />
      </div>
      <div className={styles.skeletonRows} aria-hidden="true">{Array.from({ length: 5 }).map((_, index) => <div key={index} className={styles.skeletonRow} />)}</div>
    </div>
  );
}
