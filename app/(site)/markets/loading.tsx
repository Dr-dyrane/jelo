import styles from "@/components/markets/market-finder.module.css";

export default function LoadingMarkets() {
  return (
    <main className={`${styles.main} ${styles.routeState}`}>
      <section
        className={styles.routeStatePanel}
        aria-busy="true"
        aria-live="polite"
      >
        <p className={styles.kicker}>Market Finder</p>
        <h1>Checking the exact product and place.</h1>
        <p>
          JeloCare is keeping the product identity, shop evidence and freshness
          boundary together while this page loads.
        </p>
        <div className={styles.routeStateSkeleton} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>
    </main>
  );
}
