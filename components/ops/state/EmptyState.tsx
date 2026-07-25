import styles from './state.module.css';

// Guided first-run, not a shrug: a calm title and one reassuring line.
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.empty}>
      <h2 className={styles.emptyTitle}>{title}</h2>
      <p className={styles.emptyBody}>{body}</p>
    </div>
  );
}
