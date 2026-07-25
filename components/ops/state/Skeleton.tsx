import styles from './state.module.css';

// Loading placeholder — a shimmer tone-block, never a spinner. The row variant
// matches inbox-row geometry so loading → ready doesn't reflow.
export function Skeleton({ variant = 'row', count = 1 }: { variant?: 'row' | 'card' | 'text'; count?: number }) {
  const shape = variant === 'card' ? styles.skCard : variant === 'text' ? styles.skText : styles.skRow;
  return (
    <div className={styles.stack} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={`${styles.skeleton} ${shape}`} />
      ))}
    </div>
  );
}
