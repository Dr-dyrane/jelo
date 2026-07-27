'use client';

import { useId, useTransition } from 'react';
import styles from './state.module.css';

// Calm, recoverable error — says what broke, offers a retry, never a stack.
// Mirrors the voice of app/error.tsx.
export function ErrorState({ title, detail, onRetry }: { title: string; detail?: string; onRetry: () => void }) {
  const titleId = useId();
  const detailId = useId();
  const [isRetrying, startRetry] = useTransition();

  return (
    <section
      className={styles.error}
      role="alert"
      aria-labelledby={titleId}
      aria-describedby={detail ? detailId : undefined}
      data-ops-error-surface
    >
      <div className={styles.errorCopy}>
        <h2 id={titleId} className={styles.errorTitle}>{title}</h2>
        {detail ? <p id={detailId} className={styles.errorDetail}>{detail}</p> : null}
        <button
          type="button"
          className={styles.errorRetry}
          disabled={isRetrying}
          aria-busy={isRetrying}
          onClick={() => startRetry(onRetry)}
        >
          {isRetrying ? 'Trying again…' : 'Try again'}
        </button>
      </div>
    </section>
  );
}
