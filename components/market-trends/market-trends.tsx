import Link from 'next/link';
import { ArrowUpRight, TrendingDown, TrendingUp, PackageX } from 'lucide-react';
import type { MarketTrendsReadModel } from '@/modules/commerce/market-trends';
import styles from './market-trends.module.css';

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export function MarketTrendsSection({ trends, hrefBase = '/share' }: {
  trends: MarketTrendsReadModel;
  hrefBase?: string;
}) {
  const { summary, priceDrops, priceIncreases, outOfStockAlerts } = trends;
  if (summary.productCount === 0) return null;

  return (
    <section className={styles.section} aria-label="Skincare market trends">
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Market trends</p>
          <h2>The skincare ticker.</h2>
        </div>
        <div className={styles.ticker}>
          <span className={styles.tickerItem}>
            <strong>{summary.productCount}</strong> products
          </span>
          <span className={styles.tickerDivider} aria-hidden="true">·</span>
          <span className={styles.tickerItem}>
            <strong>{summary.offerCount}</strong> listings
          </span>
          <span className={styles.tickerDivider} aria-hidden="true">·</span>
          <span className={styles.tickerItem}>
            <strong>{summary.storeCount}</strong> stores
          </span>
        </div>
      </div>

      {priceDrops.length > 0 ? (
        <div className={styles.lane}>
          <div className={styles.laneHead}>
            <TrendingDown size={18} strokeWidth={1.5} aria-hidden="true" className={styles.iconDown} />
            <h3>Price drops</h3>
          </div>
          <div className={styles.grid}>
            {priceDrops.map(signal => (
              <Link key={signal.slug} href={`${hrefBase}/${signal.slug}`} className={styles.card}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.shot} src={signal.image} alt={`${signal.brand} ${signal.name}`} loading="lazy" decoding="async" />
                <span className={styles.body}>
                  <span className={styles.brand}>{signal.brand}</span>
                  <strong className={styles.name}>{signal.name}</strong>
                  <span className={styles.statDown}>{signal.trendLabel}</span>
                  <span className={styles.sub}>
                    {naira.format(signal.amountNaira)} lower · {signal.comparableStoreCount} stores
                  </span>
                </span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {priceIncreases.length > 0 ? (
        <div className={styles.lane}>
          <div className={styles.laneHead}>
            <TrendingUp size={18} strokeWidth={1.5} aria-hidden="true" className={styles.iconUp} />
            <h3>Price increases</h3>
          </div>
          <div className={styles.grid}>
            {priceIncreases.map(signal => (
              <Link key={signal.slug} href={`${hrefBase}/${signal.slug}`} className={styles.card}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.shot} src={signal.image} alt={`${signal.brand} ${signal.name}`} loading="lazy" decoding="async" />
                <span className={styles.body}>
                  <span className={styles.brand}>{signal.brand}</span>
                  <strong className={styles.name}>{signal.name}</strong>
                  <span className={styles.statUp}>{signal.trendLabel}</span>
                  <span className={styles.sub}>
                    {naira.format(signal.amountNaira)} higher · {signal.comparableStoreCount} stores
                  </span>
                </span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {outOfStockAlerts.length > 0 ? (
        <div className={styles.lane}>
          <div className={styles.laneHead}>
            <PackageX size={18} strokeWidth={1.5} aria-hidden="true" className={styles.iconOos} />
            <h3>Out of stock</h3>
          </div>
          <div className={styles.oosList}>
            {outOfStockAlerts.map((alert, index) => (
              <Link
                key={`${alert.slug}-${alert.retailer}-${index}`}
                href={`${hrefBase}/${alert.slug}`}
                className={styles.oosItem}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.oosShot} src={alert.image} alt={`${alert.brand} ${alert.name}`} loading="lazy" decoding="async" />
                <span className={styles.oosBody}>
                  <strong>{alert.brand} {alert.name}</strong>
                  <small>{alert.retailer}</small>
                </span>
                <ArrowUpRight size={14} aria-hidden="true" className={styles.oosArrow} />
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
