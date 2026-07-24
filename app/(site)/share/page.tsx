import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { concerns } from '@/data/knowledge';
import { isProductMatchConcern } from '@/modules/concerns/product-matching';
import { listRecentDrops, listShareGaps } from '@/lib/share/worth-sharing';
import styles from './share-index.module.css';

export const revalidate = 3600;

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export const metadata: Metadata = {
  title: 'Worth sharing',
  description: 'Observed Nigerian prices worth passing on. And a few guides.',
};

export default async function ShareIndex() {
  // Drops first (most timely), then gaps. Drops is empty unless Neon price
  // history is enabled; the page stays useful on gaps + guides regardless.
  const [drops, gaps] = await Promise.all([listRecentDrops(), listShareGaps()]);
  const topics = concerns.filter(isProductMatchConcern);

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.kicker}>Worth sharing</p>
        <h1>Prices that help.</h1>
        <p className={styles.deck}>Observed prices worth passing on. And a few guides.</p>
      </header>

      {drops.length > 0 ? (
        <section className={styles.lane}>
          <div className={styles.laneHead}>
            <p className={styles.kicker}>Recent drops</p>
            <h2>Lower than before.</h2>
          </div>
          <div className={styles.grid}>
            {drops.map(drop => (
              <Link key={drop.slug} href={`/share/${drop.slug}`} className={styles.card}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.shot} src={drop.image} alt={`${drop.brand} ${drop.name}`} loading="lazy" decoding="async" />
                <span className={styles.body}>
                  <span className={styles.brand}>{drop.brand}</span>
                  <strong className={styles.name}>{drop.name}</strong>
                  <span className={styles.micro}>{drop.microtag}</span>
                  <span className={styles.stat}>Down {naira.format(drop.amountNaira)} in {drop.days} days</span>
                </span>
                <ArrowUpRight size={16} aria-hidden />
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
            {gaps.map(gap => (
              <Link key={gap.slug} href={`/share/${gap.slug}`} className={styles.card}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.shot} src={gap.image} alt={`${gap.brand} ${gap.name}`} loading="lazy" decoding="async" />
                <span className={styles.body}>
                  <span className={styles.brand}>{gap.brand}</span>
                  <strong className={styles.name}>{gap.name}</strong>
                  <span className={styles.micro}>{gap.microtag}</span>
                  <span className={styles.stat}>{naira.format(gap.spreadNaira)} apart</span>
                  <span className={styles.sub}>Lowest observed {naira.format(gap.lowestNaira)} · {gap.storeCount} stores</span>
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
