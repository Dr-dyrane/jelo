import Link from 'next/link';
import { ArrowRight, TrendingDown, TrendingUp, PackageX } from 'lucide-react';
import type { MarketTrendsReadModel } from '@/modules/commerce/market-trends';
import styles from './market-trends.module.css';

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export function MarketTrendsSection({ trends, hrefBase = '/share' }: {
  trends: MarketTrendsReadModel;
  hrefBase?: string;
}) {
  const { summary, priceDrops, priceIncreases, outOfStockAlerts } = trends;
  if (summary.productCount === 0) return null;

  const topDrops = priceDrops.slice(0, 3);
  const topIncreases = priceIncreases.slice(0, 3);
  const topOos = outOfStockAlerts.slice(0, 4);

  return (
    <section className={styles.section} aria-label="Skincare market trends">
      <div className={styles.canvas}>
        <div className={styles.header}>
          <div>
            <p className={styles.kicker}>Market trends</p>
            <h2>The skincare ticker.</h2>
            <p className={styles.deck}>
              {summary.productCount} products · {summary.offerCount} listings · {summary.storeCount} stores
            </p>
          </div>
          <Link className={styles.viewAll} href="/products">
            Browse all <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className={styles.columns}>
          {topDrops.length > 0 ? (
            <div className={styles.lane}>
              <div className={styles.laneHead}>
                <TrendingDown size={16} strokeWidth={1.5} aria-hidden="true" className={styles.iconDown} />
                <h3>Price drops</h3>
              </div>
              <div className={styles.list}>
                {topDrops.map(signal => (
                  <Link key={signal.slug} href={`${hrefBase}/${signal.slug}`} className={styles.card}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className={styles.shot} src={signal.image} alt={`${signal.brand} ${signal.name}`} loading="lazy" decoding="async" />
                    <span className={styles.body}>
                      <span className={styles.brand}>{signal.brand}</span>
                      <strong className={styles.name}>{signal.name}</strong>
                      <span className={styles.statDown}>{signal.trendLabel}</span>
                    </span>
                    <span className={styles.sub}>{naira.format(signal.amountNaira)} lower</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {topIncreases.length > 0 ? (
            <div className={styles.lane}>
              <div className={styles.laneHead}>
                <TrendingUp size={16} strokeWidth={1.5} aria-hidden="true" className={styles.iconUp} />
                <h3>Price increases</h3>
              </div>
              <div className={styles.list}>
                {topIncreases.map(signal => (
                  <Link key={signal.slug} href={`${hrefBase}/${signal.slug}`} className={styles.card}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className={styles.shot} src={signal.image} alt={`${signal.brand} ${signal.name}`} loading="lazy" decoding="async" />
                    <span className={styles.body}>
                      <span className={styles.brand}>{signal.brand}</span>
                      <strong className={styles.name}>{signal.name}</strong>
                      <span className={styles.statUp}>{signal.trendLabel}</span>
                    </span>
                    <span className={styles.sub}>{naira.format(signal.amountNaira)} higher</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {topOos.length > 0 ? (
          <div className={styles.oosLane}>
            <div className={styles.laneHead}>
              <PackageX size={16} strokeWidth={1.5} aria-hidden="true" className={styles.iconOos} />
              <h3>Out of stock</h3>
            </div>
            <div className={styles.oosChips}>
              {topOos.map((alert, index) => (
                <Link
                  key={`${alert.slug}-${alert.retailer}-${index}`}
                  href={`${hrefBase}/${alert.slug}`}
                  className={styles.oosChip}
                >
                  <span className={styles.oosName}>{alert.brand} {alert.name}</span>
                  <small>{alert.retailer}</small>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
