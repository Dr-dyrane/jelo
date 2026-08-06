'use client';

import { useMemo, useState } from 'react';
import { TrendingDown, TrendingUp, Minus, Package, ShieldCheck } from 'lucide-react';
import type { ProductTrendData, TrendPricePoint } from '@/lib/share/product-trends';
import styles from './product-trends.module.css';

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

type TimeWindow = '7d' | '14d' | '1m' | '3m';

const WINDOWS: { key: TimeWindow; label: string; days: number }[] = [
  { key: '7d', label: '7D', days: 7 },
  { key: '14d', label: '14D', days: 14 },
  { key: '1m', label: '1M', days: 30 },
  { key: '3m', label: '3M', days: 90 },
];

const RETAILER_COLORS = [
  '#8b3a52', // wine
  '#2a8e5c', // green
  '#b86a3a', // amber
  '#4a6b8a', // blue
  '#7a5c8a', // purple
  '#c44a4a', // red
];

function filterPointsByWindow(points: TrendPricePoint[], days: number, now: number) {
  const cutoff = now - days * 86_400_000;
  return points.filter(p => Date.parse(p.observedAt) >= cutoff);
}

function buildSparklinePath(
  points: { x: number; y: number }[],
  width: number,
  height: number,
  padding = 4,
) {
  if (points.length < 2) return '';
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const w = width - padding * 2;
  const h = height - padding * 2;
  return points
    .map((p, i) => {
      const x = padding + ((p.x - xMin) / xRange) * w;
      const y = padding + h - ((p.y - yMin) / yRange) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

type SeriesGroup = {
  retailer: string;
  color: string;
  points: { x: number; y: number; observedAt: string }[];
};

export function ProductTrendsChart({ data }: { data: ProductTrendData }) {
  const [window, setWindow] = useState<TimeWindow>('1m');
  const now = Date.now();
  const days = WINDOWS.find(w => w.key === window)?.days ?? 30;

  const filtered = useMemo(() => filterPointsByWindow(data.points, days, now), [data.points, days, now]);

  // Group by retailer
  const series: SeriesGroup[] = useMemo(() => {
    const byRetailer = new Map<string, TrendPricePoint[]>();
    for (const point of filtered) {
      const key = point.retailer;
      if (!byRetailer.has(key)) byRetailer.set(key, []);
      byRetailer.get(key)!.push(point);
    }
    const retailers = [...byRetailer.keys()].sort();
    return retailers.map((retailer, i) => ({
      retailer,
      color: RETAILER_COLORS[i % RETAILER_COLORS.length],
      points: byRetailer.get(retailer)!
        .map(p => ({ x: Date.parse(p.observedAt), y: p.priceNaira, observedAt: p.observedAt }))
        .sort((a, b) => a.x - b.x),
    }));
  }, [filtered]);

  const hasChart = series.some(s => s.points.length >= 2);
  const { summary } = data;

  return (
    <section className={styles.section} aria-label="Price trends and insights">
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <p className={styles.kicker}>Trends</p>
          <h2 className={styles.title}>Price history.</h2>
        </div>
        <div className={styles.filters} role="tablist" aria-label="Time window">
          {WINDOWS.map(w => (
            <button
              key={w.key}
              className={`${styles.filter} ${window === w.key ? styles.filterActive : ''}`}
              onClick={() => setWindow(w.key)}
              role="tab"
              aria-selected={window === w.key}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat strip — show don't tell */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Lowest</span>
          <span className={styles.statValue}>{naira.format(summary.lowestNaira)}</span>
        </div>
        {summary.medianNaira != null ? (
          <div className={styles.stat}>
            <span className={styles.statLabel}>Median</span>
            <span className={styles.statValue}>{naira.format(summary.medianNaira)}</span>
          </div>
        ) : null}
        {summary.highestNaira != null ? (
          <div className={styles.stat}>
            <span className={styles.statLabel}>Highest</span>
            <span className={styles.statValue}>{naira.format(summary.highestNaira)}</span>
          </div>
        ) : null}
        {summary.spreadNaira != null ? (
          <div className={styles.stat}>
            <span className={styles.statLabel}>Spread</span>
            <span className={styles.statValue}>{naira.format(summary.spreadNaira)}</span>
          </div>
        ) : null}
        <div className={styles.stat}>
          <span className={styles.statLabel}>Stores</span>
          <span className={styles.statValue}>{summary.storeCount}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Trust</span>
          <span className={styles.statValue}>{summary.avgTrust}<small>/100</small></span>
        </div>
        {summary.marketTrendLabel ? (
          <div className={`${styles.stat} ${styles.statTrend}`}>
            <span className={styles.statLabel}>Market</span>
            <span className={`${styles.statValue} ${
              summary.marketTrendDirection === 'down' ? styles.down
              : summary.marketTrendDirection === 'up' ? styles.up
              : ''
            }`}>
              {summary.marketTrendLabel}
            </span>
          </div>
        ) : null}
      </div>

      {/* Chart */}
      <div className={styles.chartWrap}>
        {hasChart ? (
          <svg className={styles.chart} viewBox="0 0 800 240" preserveAspectRatio="none" aria-hidden="true">
            {/* Grid lines */}
            <line x1="0" y1="60" x2="800" y2="60" className={styles.gridLine} />
            <line x1="0" y1="120" x2="800" y2="120" className={styles.gridLine} />
            <line x1="0" y1="180" x2="800" y2="180" className={styles.gridLine} />
            {/* Series */}
            {series.map(s => {
              const path = buildSparklinePath(s.points, 800, 240);
              return (
                <g key={s.retailer}>
                  <path d={path} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  {s.points.map((p, i) => (
                    <circle
                      key={i}
                      cx={4 + ((p.x - Math.min(...s.points.map(sp => sp.x))) / (Math.max(...s.points.map(sp => sp.x)) - Math.min(...s.points.map(sp => sp.x)) || 1)) * (800 - 8)}
                      cy={4 + 232 - ((p.y - Math.min(...s.points.map(sp => sp.y))) / (Math.max(...s.points.map(sp => sp.y)) - Math.min(...s.points.map(sp => sp.y)) || 1)) * 232}
                      r="3"
                      fill={s.color}
                    />
                  ))}
                </g>
              );
            })}
          </svg>
        ) : (
          <div className={styles.noChart}>
            <Minus size={20} strokeWidth={1.5} aria-hidden="true" />
            <span>Not enough history for this window.</span>
          </div>
        )}
        {hasChart ? (
          <div className={styles.legend}>
            {series.map(s => (
              <span key={s.retailer} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: s.color }} />
                {s.retailer}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Store breakdown — compact rows */}
      <div className={styles.stores}>
        <div className={styles.storesHead}>
          <span>Store</span>
          <span>Price</span>
          <span>Stock</span>
          <span>Trust</span>
        </div>
        {data.stores.map(store => (
          <div key={store.retailer} className={styles.storeRow}>
            <span className={styles.storeName}>
              {store.isLowest ? <span className={styles.lowDot} aria-label="Lowest" /> : null}
              {store.retailer}
              {store.trendLabel ? (
                <span className={`${styles.storeTrend} ${
                  store.trendDirection === 'down' ? styles.down
                  : store.trendDirection === 'up' ? styles.up
                  : ''
                }`}>
                  {store.trendDirection === 'down' ? <TrendingDown size={11} strokeWidth={1.5} aria-hidden="true" />
                  : store.trendDirection === 'up' ? <TrendingUp size={11} strokeWidth={1.5} aria-hidden="true" />
                  : null}
                  {store.trendLabel}
                </span>
              ) : null}
            </span>
            <span className={styles.storePrice}>{naira.format(store.priceNaira)}</span>
            <span className={styles.storeStock}>
              {store.stockStatus === 'in-stock' ? <Package size={13} strokeWidth={1.5} aria-hidden="true" className={styles.stockIn} />
              : store.stockStatus === 'low-stock' ? <Package size={13} strokeWidth={1.5} aria-hidden="true" className={styles.stockLow} />
              : store.stockStatus === 'out-of-stock' ? <Package size={13} strokeWidth={1.5} aria-hidden="true" className={styles.stockOut} />
              : null}
              <small>{store.stockStatus === 'in-stock' ? 'In' : store.stockStatus === 'low-stock' ? 'Low' : store.stockStatus === 'out-of-stock' ? 'Out' : '—'}</small>
            </span>
            <span className={styles.storeTrust}>
              <ShieldCheck size={13} strokeWidth={1.5} aria-hidden="true" />
              {store.trustScore}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
