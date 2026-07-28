'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import styles from './products-error.module.css';

export default function ProductsError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Could not open the product catalogue.', error);
  }, [error]);

  return (
    <main className={styles.page}>
      <section className={styles.state} aria-labelledby="products-error-title">
        <p>Products</p>
        <h1 id="products-error-title">The shelf paused.</h1>
        <span>Try once more, or start again with all products.</span>
        <div className={styles.actions}>
          <button type="button" onClick={reset}>Try again</button>
          <Link href="/products">Browse products</Link>
        </div>
      </section>
    </main>
  );
}
