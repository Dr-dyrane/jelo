import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, PackageX } from 'lucide-react';
import { concerns } from '@/data/knowledge';
import { isProductMatchConcern } from '@/modules/concerns/product-matching';
import { getWorthSharingReadModel } from '@/lib/share/worth-sharing';
import { getMarketTrendsReadModel } from '@/lib/share/market-trends';
import { publicSocialMetadata, staticSocialCard } from '@/lib/og/social-card';
import styles from './share-index.module.css';

export const revalidate = 3600;

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export const metadata: Metadata = publicSocialMetadata(staticSocialCard('share-index'), '/share');

export default async function ShareIndex() {
  const [signals, marketTrends] = await Promise.all([
    getWorthSharingReadModel(),
    getMarketTrendsReadModel(),
  ]);
  const { priceGaps: gaps } = signals;
  const { priceDrops, outOfStockAlerts } = marketTrends;
  const topics = concerns.filter(isProductMatchConcern);

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.kicker}>Worth sharing</p>
        <h1>Prices that help.</h1>
        <p className={styles.deck}>Observed prices worth passing on. And a few guides.</p>
      </header>

      {priceDrops.length > 0 ? (
        <section className={styles.lane}>
          <div className={styles.laneHead}>
            <p className={styles.kicker}>Price drops</p>
            <h2>Lower than before.</h2>
          </div>
          <div className={styles.grid}>
            {priceDrops.map(signal => (
              <Link key={signal.slug} href={`/share/${signal.slug}`} className={styles.card}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.shot} src={signal.image} alt={`${signal.brand} ${signal.name}`} loading="lazy" decoding="async" />
                <span className={styles.body}>
                  <span className={styles.brand}>{signal.brand}</span>
                  <strong className={styles.name}>{signal.name}</strong>
                  <span className={styles.micro}>{signal.microtag}</span>
                  <span className={`${styles.stat} ${styles.down}`}>{signal.trendLabel}</span>
                  <span className={styles.sub}>{naira.format(signal.amountNaira)} lower · {signal.comparableStoreCount} stores</span>
                </span>
                <ArrowUpRight size={16} aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {outOfStockAlerts.length > 0 ? (
        <section className={styles.lane}>
          <div className={styles.laneHead}>
            <p className={styles.kicker}>Out of stock</p>
            <h2>Gone for now.</h2>
          </div>
          <div className={styles.oosGrid}>
            {outOfStockAlerts.map((alert, index) => (
              <Link
                key={`${alert.slug}-${alert.retailer}-${index}`}
                href={`/share/${alert.slug}`}
                className={styles.oosCard}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.shot} src={alert.image} alt={`${alert.brand} ${alert.name}`} loading="lazy" decoding="async" />
                <span className={styles.body}>
                  <span className={styles.brand}>{alert.brand}</span>
                  <strong className={styles.name}>{alert.name}</strong>
                  <span className={styles.micro}>{alert.retailer}</span>
                </span>
                <PackageX size={16} strokeWidth={1.5} aria-hidden="true" className={styles.iconOos} />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {gaps.length > 0 ? (
        <section className={styles.lane}>
          <div className={styles.laneHead}>
            <p className={styles.kicker}>Same product</p>
            <h2>Cheaper somewhere.</h2>
          </div>
          <div className={styles.grid}>
            {gaps.map(signal => (
              <Link key={signal.slug} href={`/share/${signal.slug}`} className={styles.card}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.shot} src={signal.image} alt={`${signal.brand} ${signal.name}`} loading="lazy" decoding="async" />
                <span className={styles.body}>
                  <span className={styles.brand}>{signal.brand}</span>
                  <strong className={styles.name}>{signal.name}</strong>
                  <span className={styles.micro}>{signal.microtag}</span>
                  <span className={styles.stat}>{naira.format(signal.gap.spreadNaira)} apart</span>
                  <span className={styles.sub}>Lowest observed {naira.format(signal.gap.lowestNaira)} · {signal.gap.storeCount} stores</span>
                </span>
                <ArrowUpRight size={16} aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.lane}>
        <div className={styles.laneHead}>
          <p className={styles.kicker}>Guides</p>
          <h2>Worth passing on.</h2>
        </div>
        <div className={styles.topics}>
          {topics.map(topic => (
            <Link key={topic.slug} href={`/concerns/${topic.slug}`} className={styles.topic}>
              <span className={styles.topicArea}>{topic.area}</span>
              <strong>{topic.name}</strong>
              <small>{topic.summary}</small>
            </Link>
          ))}
        </div>
      </section>

      <p className={styles.fine}>Prices change. A listing is not proof it is genuine. Guides are education, not a diagnosis.</p>
    </main>
  );
}
