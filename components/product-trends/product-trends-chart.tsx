'use client';

import { useMemo, useRef, useState } from 'react';
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

const CHART_W = 800;
const CHART_H = 240;
const PAD = 12;

function filterPointsByWindow(points: TrendPricePoint[], days: number, now: number) {
  const cutoff = now - days * 86_400_000;
  return points.filter(p => Date.parse(p.observedAt) >= cutoff);
}

type FlatPoint = { x: number; y: number; retailer: string; observedAt: string; priceNaira: number };

/**
 * Catmull-Rom spline → cubic bezier conversion for smooth curved lines.
 * Returns an SVG path string that passes through all points smoothly.
 */
function buildCurvedPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const tension = 0.18;
    const c1x = p1.x + (p2.x - p0.x) * tension;
    const c1y = p1.y + (p2.y - p0.y) * tension;
    const c2x = p2.x - (p3.x - p1.x) * tension;
    const c2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function buildAreaPath(pts: { x: number; y: number }[], height: number) {
  if (pts.length < 2) return '';
  const line = buildCurvedPath(pts);
  return `${line} L${pts.at(-1)!.x.toFixed(1)},${height} L${pts[0].x.toFixed(1)},${height} Z`;
}

type SeriesGroup = {
  retailer: string;
  color: string;
  points: FlatPoint[];
  globalX: number;
  globalY: number;
};

export function ProductTrendsChart({ data }: { data: ProductTrendData }) {
  const [windowKey, setWindowKey] = useState<TimeWindow>('1m');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const now = Date.now();
  const days = WINDOWS.find(w => w.key === windowKey)?.days ?? 30;

  const filtered = useMemo(() => filterPointsByWindow(data.points, days, now), [data.points, days, now]);

  // Compute global min/max across all series for shared axes
  const { allPoints, xMin, xMax, yMin, yMax } = useMemo(() => {
    const byRetailer = new Map<string, TrendPricePoint[]>();
    for (const point of filtered) {
      if (!byRetailer.has(point.retailer)) byRetailer.set(point.retailer, []);
      byRetailer.get(point.retailer)!.push(point);
    }
    const flat: FlatPoint[] = [];
    for (const point of filtered) {
      flat.push({
        x: Date.parse(point.observedAt),
        y: point.priceNaira,
        retailer: point.retailer,
        observedAt: point.observedAt,
        priceNaira: point.priceNaira,
      });
    }
    const xs = flat.map(p => p.x);
    const ys = flat.map(p => p.y);
    return {
      allPoints: flat,
      xMin: Math.min(...xs),
      xMax: Math.max(...xs),
      yMin: Math.min(...ys),
      yMax: Math.max(...ys),
    };
  }, [filtered]);

  const series: SeriesGroup[] = useMemo(() => {
    const byRetailer = new Map<string, FlatPoint[]>();
    for (const p of allPoints) {
      if (!byRetailer.has(p.retailer)) byRetailer.set(p.retailer, []);
      byRetailer.get(p.retailer)!.push(p);
    }
    const retailers = [...byRetailer.keys()].sort();
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    const w = CHART_W - PAD * 2;
    const h = CHART_H - PAD * 2;
    return retailers.map((retailer, i) => {
      const pts = byRetailer.get(retailer)!
        .map(p => ({
          ...p,
          x: PAD + ((p.x - xMin) / xRange) * w,
          y: PAD + h - ((p.y - yMin) / yRange) * h,
        }))
        .sort((a, b) => a.x - b.x);
      return {
        retailer,
        color: RETAILER_COLORS[i % RETAILER_COLORS.length],
        points: pts,
        globalX: 0,
        globalY: 0,
      };
    });
  }, [allPoints, xMin, xMax, yMin, yMax]);

  const hasChart = series.some(s => s.points.length >= 2);
  const { summary } = data;

  // Hover interaction — find nearest point across all series
  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!hasChart || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * CHART_W;
    // Find the closest x across all series points
    let bestIdx: number | null = null;
    let bestDist = Infinity;
    series.forEach((s, si) => {
      s.points.forEach((p, pi) => {
        const dist = Math.abs(p.x - px);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = si * 1000 + pi;
        }
      });
    });
    setHoverIdx(bestIdx);
  }

  const hoverSeriesIdx = hoverIdx != null ? Math.floor(hoverIdx / 1000) : null;
  const hoverPointIdx = hoverIdx != null ? hoverIdx % 1000 : null;
  const hoverPoint = hoverSeriesIdx != null && hoverPointIdx != null
    ? series[hoverSeriesIdx]?.points[hoverPointIdx]
    : null;

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
              className={`${styles.filter} ${windowKey === w.key ? styles.filterActive : ''}`}
              onClick={() => setWindowKey(w.key)}
              role="tab"
              aria-selected={windowKey === w.key}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat strip */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Lowest</span>
          <span className={styles.statValue}>{naira.format(summary.lowestNaira)}</span>
        </div>
        {summary.medianNaira != null ? (
          <div className={styles.stat}>
            <span className={styles.statLabel}>Typical</span>
            <span className={styles.statValue}>{naira.format(summary.medianNaira)}</span>
          </div>
        ) : null}
        {summary.highestNaira != null ? (
          <div className={styles.stat}>
            <span className={styles.statLabel}>Highest</span>
            <span className={styles.statValue}>{naira.format(summary.highestNaira)}</span>
          </div>
        ) : null}
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
          <svg
            ref={svgRef}
            className={styles.chart}
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            preserveAspectRatio="none"
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIdx(null)}
            aria-hidden="true"
          >
            <defs>
              {series.map(s => (
                <linearGradient key={s.retailer} id={`grad-${s.retailer.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>
            {/* Grid lines */}
            <line x1="0" y1={CHART_H * 0.25} x2={CHART_W} y2={CHART_H * 0.25} className={styles.gridLine} />
            <line x1="0" y1={CHART_H * 0.5} x2={CHART_W} y2={CHART_H * 0.5} className={styles.gridLine} />
            <line x1="0" y1={CHART_H * 0.75} x2={CHART_W} y2={CHART_H * 0.75} className={styles.gridLine} />
            {/* Series with gradient fill + curved line */}
            {series.map(s => {
              const linePath = buildCurvedPath(s.points);
              const areaPath = buildAreaPath(s.points, CHART_H);
              const gradId = `grad-${s.retailer.replace(/[^a-z0-9]/gi, '')}`;
              const isHovered = hoverSeriesIdx === series.indexOf(s);
              return (
                <g key={s.retailer}>
                  <path d={areaPath} fill={`url(#${gradId})`} opacity={isHovered ? 0.3 : 1} />
                  <path
                    d={linePath}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={isHovered ? 2.5 : 1.8}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={hoverSeriesIdx == null || isHovered ? 1 : 0.4}
                    style={{ transition: 'opacity 160ms ease, stroke-width 160ms ease' }}
                  />
                  {/* Points — only show on hover */}
                  {s.points.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={hoverPointIdx === i && isHovered ? 5 : 3}
                      fill={s.color}
                      opacity={hoverSeriesIdx == null || isHovered ? 0.7 : 0.2}
                      style={{ transition: 'r 160ms ease, opacity 160ms ease' }}
                    />
                  ))}
                </g>
              );
            })}
            {/* Hover tooltip */}
            {hoverPoint ? (
              <g pointerEvents="none">
                <line
                  x1={hoverPoint.x}
                  y1={PAD}
                  x2={hoverPoint.x}
                  y2={CHART_H - PAD}
                  stroke={series[hoverSeriesIdx!].color}
                  strokeWidth="1"
                  strokeDasharray="3 4"
                  opacity="0.5"
                />
              </g>
            ) : null}
          </svg>
        ) : (
          <div className={styles.noChart}>
            <Minus size={20} strokeWidth={1.5} aria-hidden="true" />
            <span>Not enough history for this window.</span>
          </div>
        )}
        {/* Hover readout + legend */}
        {hasChart ? (
          <div className={styles.chartFooter}>
            {hoverPoint ? (
              <span className={styles.hoverReadout}>
                <span className={styles.hoverDot} style={{ background: series[hoverSeriesIdx!].color }} />
                <strong>{series[hoverSeriesIdx!].retailer}</strong>
                <span className={styles.hoverPrice}>{naira.format(hoverPoint.priceNaira)}</span>
                <small>{shortDate.format(new Date(hoverPoint.observedAt))}</small>
              </span>
            ) : (
              <div className={styles.legend}>
                {series.map(s => (
                  <span key={s.retailer} className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: s.color }} />
                    {s.retailer}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Store breakdown */}
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
