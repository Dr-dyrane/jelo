'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/navigation/theme-toggle';
import styles from './boundary.module.css';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Recorded for observability; the reader sees a calm message, never a stack.
    console.error(error);
  }, [error]);

  return (
    <div className={styles.shell}>
      <main className={styles.body}>
        <p className={styles.eyebrow}>JeloCare</p>
        <h1 className={styles.h1}>Something slipped.</h1>
        <p className={styles.lede}>Part of the page did not load. Try again — it usually clears.</p>
        <div className={styles.row}>
          <button type="button" onClick={reset} className={styles.action}>Try again</button>
          <Link href="/" className={styles.ghost}>Back to JeloCare</Link>
        </div>
        {error.digest ? <p className={styles.ref}>Reference {error.digest}</p> : null}
      </main>
      <footer className={styles.foot}>
        <ThemeToggle />
        <span>© {new Date().getFullYear()} Dyrane · Guidance, not diagnosis.</span>
      </footer>
    </div>
  );
}
