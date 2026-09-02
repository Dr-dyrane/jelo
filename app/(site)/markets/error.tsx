"use client";

import Link from "next/link";
import styles from "@/components/markets/market-finder.module.css";

export default function MarketFinderError({ reset }: { reset: () => void }) {
  return (
    <main className={`${styles.main} ${styles.routeState}`}>
      <section className={styles.routeStatePanel} role="alert">
        <p className={styles.kicker}>Market Finder paused</p>
        <h1>We could not check this place safely.</h1>
        <p>
          Try the same exact-product request again. No shop or stock guidance
          has been guessed while the check is unavailable.
        </p>
        <div className={styles.routeStateActions}>
          <button type="button" onClick={reset}>
            Try again
          </button>
          <Link href="/markets">Choose another product</Link>
        </div>
      </section>
    </main>
  );
}
