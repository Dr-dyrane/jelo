import Link from "next/link";
import { ArrowRight, PackageSearch } from "lucide-react";
import styles from "@/components/markets/market-finder.module.css";

export default function MarketFinderNotFound() {
  return (
    <main className={`${styles.main} ${styles.routeState}`}>
      <section className={styles.routeStatePanel}>
        <PackageSearch size={28} aria-hidden="true" />
        <p className={styles.kicker}>Market Finder</p>
        <h1>No reviewed result.</h1>
        <p>This exact product or market is not ready to show.</p>
        <div className={styles.routeStateActions}>
          <Link href="/products">
            Browse products <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link href="/contribute">Share a product</Link>
        </div>
      </section>
    </main>
  );
}
