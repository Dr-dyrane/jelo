'use client';

import styles from './state.module.css';

// Calm, recoverable error — says what broke, offers a retry, never a stack.
// Mirrors the voice of app/error.tsx.
export function ErrorState({ title, detail, onRetry }: { title: string; detail?: string; onRetry: () => void }) {
  return (
    <div className={styles.error} role="alert">
      <h2 className={styles.errorTitle}>{title}</h2>
      {detail ? <p className={styles.errorDetail}>{detail}</p> : null}
      <button type="button" className={styles.errorRetry} onClick={onRetry}>Try again</button>
    </div>
  );
}
