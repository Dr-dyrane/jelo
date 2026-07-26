'use client';

import { useEffect } from 'react';
import styles from './overview.module.css';

export default function OverviewError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Could not load the operations overview.', error);
  }, [error]);

  return (
    <div className={styles.briefing}>
      <header className={styles.context}>
        <h1>Overview</h1>
        <p>Couldn’t load this view.</p>
      </header>
      <section className={styles.errorState} aria-labelledby="overview-error-heading">
        <h2 id="overview-error-heading">Try again</h2>
        <p>Something interrupted the queue read. No review decisions were made.</p>
        <button type="button" className={styles.retryButton} onClick={reset}>Try again</button>
      </section>
    </div>
  );
}
