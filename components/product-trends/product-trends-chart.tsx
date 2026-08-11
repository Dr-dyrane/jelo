"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Minus, Package, ShieldCheck } from "lucide-react";
import type {
  ProductTrendData,
  TrendPricePoint,
} from "@/lib/share/product-trends";
import {
  filterTrendPointsByWindow,
  buildStepTrendPath,
  hasRenderableTrendSeries,
  selectInitialTrendWindow,
  selectTrendWindowMovement,
  TREND_WINDOWS,
  trendStoryHref,
  trendWindowDefinition,
  type TrendWindowKey,
} from "@/lib/share/trend-window";
import { ScreenshotButton } from "@/components/share/screenshot-button";
import styles from "./product-trends.module.css";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});
const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

const RETAILER_COLORS = [
  "#8b3a52", // wine
  "#2a8e5c", // green
  "#b86a3a", // amber
  "#4a6b8a", // blue
  "#7a5c8a", // purple
  "#c44a4a", // red
];

const CHART_W = 800;
const CHART_H = 240;
const PAD = 12;

const retailerKey = (value: string) => value.trim().toLocaleLowerCase("en-NG");

type FlatPoint = {
  x: number;
  y: number;
  retailer: string;
  observedAt: string;
  priceNaira: number;
};

type SeriesGroup = {
  retailer: string;
  color: string;
  points: FlatPoint[];
};

export function ProductTrendsChart({
  data,
  storyHref,
}: {
  data: ProductTrendData;
  storyHref: string;
}) {
  const [now] = useState(() => {
    const observedAt = Date.parse(data.summary.observedAt ?? "");
    return Number.isFinite(observedAt) ? observedAt : Date.now();
  });
  const [windowKey, setWindowKey] = useState<TrendWindowKey>(() =>
    selectInitialTrendWindow(data.points, now),
  );
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const selectedWindow = trendWindowDefinition(windowKey);
  const retailerVisuals = useMemo(
    () =>
      new Map(
        data.stores.map((store, index) => [
          retailerKey(store.retailer),
          {
            color: RETAILER_COLORS[index % RETAILER_COLORS.length],
            order: index,
          },
        ]),
      ),
    [data.stores],
  );

  const filtered = useMemo(
    () => filterTrendPointsByWindow(data.points, windowKey, now),
    [data.points, windowKey, now],
  );

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
    const xs = flat.map((p) => p.x);
    const ys = flat.map((p) => p.y);
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
    const retailers = [...byRetailer.keys()].sort((left, right) => {
      const leftOrder = retailerVisuals.get(retailerKey(left))?.order;
      const rightOrder = retailerVisuals.get(retailerKey(right))?.order;
      return (
        (leftOrder ?? Number.MAX_SAFE_INTEGER) -
          (rightOrder ?? Number.MAX_SAFE_INTEGER) || left.localeCompare(right)
      );
    });
    const xRange = xMax - xMin;
    const yRange = yMax - yMin;
    const w = CHART_W - PAD * 2;
    const h = CHART_H - PAD * 2;
    return retailers.map((retailer, i) => {
      const eventsByTime = new Map<number, FlatPoint>();
      for (const point of byRetailer.get(retailer)!) {
        eventsByTime.set(point.x, point);
      }
      const pts = [...eventsByTime.values()]
        .map((p) => ({
          ...p,
          x: xRange === 0 ? CHART_W / 2 : PAD + ((p.x - xMin) / xRange) * w,
          y: yRange === 0 ? CHART_H / 2 : PAD + h - ((p.y - yMin) / yRange) * h,
        }))
        .sort((a, b) => a.x - b.x);
      return {
        retailer,
        color:
          retailerVisuals.get(retailerKey(retailer))?.color ??
          RETAILER_COLORS[i % RETAILER_COLORS.length],
        points: pts,
      };
    });
  }, [allPoints, retailerVisuals, xMin, xMax, yMin, yMax]);

  const hasChart = hasRenderableTrendSeries(filtered);
  const { summary } = data;
  const selectedStoryHref = trendStoryHref(storyHref, windowKey);
  const selectedMovement = useMemo(
    () =>
      selectTrendWindowMovement(
        data.points,
        windowKey,
        now,
        data.stores.map((store) => store.retailer),
      ),
    [data.points, data.stores, now, windowKey],
  );
  const movementLabel = (() => {
    if (!selectedMovement) return null;
    if (selectedMovement.direction === "flat") return "No change";
    const movementPercent = Math.abs(selectedMovement.percent);
    const formattedPercent = Number.isInteger(movementPercent)
      ? movementPercent.toFixed(0)
      : movementPercent.toFixed(1);
    return `${selectedMovement.direction === "down" ? "↓" : "↑"} ${formattedPercent}%`;
  })();

  function handleWindowKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const current = TREND_WINDOWS.findIndex(
      (window) => window.key === windowKey,
    );
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? TREND_WINDOWS.length - 1
          : event.key === "ArrowLeft"
            ? (current - 1 + TREND_WINDOWS.length) % TREND_WINDOWS.length
            : (current + 1) % TREND_WINDOWS.length;
    setWindowKey(TREND_WINDOWS[next].key);
    document.getElementById(`trend-window-${TREND_WINDOWS[next].key}`)?.focus();
  }

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
  const hoverPoint =
    hoverSeriesIdx != null && hoverPointIdx != null
      ? series[hoverSeriesIdx]?.points[hoverPointIdx]
      : null;

  return (
    <section className={styles.section} aria-label="Price trends and insights">
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <p className={styles.kicker}>Trends</p>
          <h2 className={styles.title}>Price history.</h2>
        </div>
        <div className={styles.headActions}>
          <div
            className={styles.filters}
            role="tablist"
            aria-label="Time window"
          >
            {TREND_WINDOWS.map((w) => (
              <button
                key={w.key}
                id={`trend-window-${w.key}`}
                type="button"
                className={`${styles.filter} ${windowKey === w.key ? styles.filterActive : ""}`}
                onClick={() => setWindowKey(w.key)}
                onKeyDown={handleWindowKeyDown}
                role="tab"
                aria-selected={windowKey === w.key}
                aria-controls="price-trend-panel"
                tabIndex={windowKey === w.key ? 0 : -1}
              >
                {w.label}
              </button>
            ))}
          </div>
          <ScreenshotButton
            href={selectedStoryHref}
            fileName={`${data.slug}-${windowKey}-trend-story`}
            label="Save trend story"
          />
        </div>
      </div>

      {/* Stat strip */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Lowest</span>
          <span className={styles.statValue}>
            {naira.format(summary.lowestNaira)}
          </span>
        </div>
        {summary.medianNaira != null ? (
          <div className={styles.stat}>
            <span className={styles.statLabel}>Typical</span>
            <span className={styles.statValue}>
              {naira.format(summary.medianNaira)}
            </span>
          </div>
        ) : null}
        {summary.highestNaira != null ? (
          <div className={styles.stat}>
            <span className={styles.statLabel}>Highest</span>
            <span className={styles.statValue}>
              {naira.format(summary.highestNaira)}
            </span>
          </div>
        ) : null}
        {selectedMovement && movementLabel ? (
          <div className={`${styles.stat} ${styles.statTrend}`}>
            <span className={styles.statLabel}>
              {selectedWindow.label} · {selectedMovement.retailer}
            </span>
            <span
              className={`${styles.statValue} ${
                selectedMovement.direction === "down"
                  ? styles.down
                  : selectedMovement.direction === "up"
                    ? styles.up
                    : ""
              }`}
            >
              {movementLabel}
            </span>
          </div>
        ) : null}
      </div>

      {/* Chart */}
      <div
        id="price-trend-panel"
        className={styles.chartWrap}
        role="tabpanel"
        aria-labelledby={`trend-window-${windowKey}`}
      >
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
            {/* Dated events joined by discrete price steps. */}
            {series.map((s) => {
              const linePath = buildStepTrendPath(s.points);
              const isHovered = hoverSeriesIdx === series.indexOf(s);
              return (
                <g key={s.retailer}>
                  <path
                    d={linePath}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="9"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={isHovered ? 0.2 : 0.11}
                    className={styles.curveGlow}
                  />
                  <path
                    d={linePath}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={isHovered ? 2.5 : 1.8}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={hoverSeriesIdx == null || isHovered ? 1 : 0.4}
                    style={{
                      transition: "opacity 160ms ease, stroke-width 160ms ease",
                    }}
                  />
                  {/* Every circle is a dated observation event. */}
                  {s.points.map((p, i) => (
                    <circle
                      key={`${p.observedAt}-${i}`}
                      cx={p.x}
                      cy={p.y}
                      r={hoverPointIdx === i && isHovered ? 5 : 3}
                      fill={s.color}
                      opacity={
                        hoverSeriesIdx == null || isHovered
                          ? hoverPointIdx === i && isHovered
                            ? 1
                            : 0.82
                          : 0.35
                      }
                      style={{ transition: "r 160ms ease, opacity 160ms ease" }}
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
            <span>
              No two dated observations fall within the selected{" "}
              {selectedWindow.label} window.
            </span>
          </div>
        )}
        {/* Hover readout + legend */}
        {hasChart ? (
          <div className={styles.chartFooter}>
            {hoverPoint ? (
              <span className={styles.hoverReadout}>
                <span
                  className={styles.hoverDot}
                  style={{ background: series[hoverSeriesIdx!].color }}
                />
                <strong>{series[hoverSeriesIdx!].retailer}</strong>
                <span className={styles.hoverPrice}>
                  {naira.format(hoverPoint.priceNaira)}
                </span>
                <small>
                  {shortDate.format(new Date(hoverPoint.observedAt))}
                </small>
              </span>
            ) : (
              <div className={styles.legend}>
                {series.map((s) => (
                  <span key={s.retailer} className={styles.legendItem}>
                    <span
                      className={styles.legendDot}
                      style={{ background: s.color }}
                    />
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
        {data.stores.map((store) => (
          <div key={store.retailer} className={styles.storeRow}>
            <span className={styles.storeName}>
              <span
                className={`${styles.storeDot} ${store.isLowest ? styles.lowDot : ""}`}
                style={{
                  background: retailerVisuals.get(retailerKey(store.retailer))
                    ?.color,
                }}
                aria-label={store.isLowest ? "Lowest" : undefined}
              />
              {store.retailer}
            </span>
            <span className={styles.storePrice}>
              {naira.format(store.priceNaira)}
            </span>
            <span className={styles.storeStock}>
              {store.stockStatus === "in-stock" ? (
                <Package
                  size={13}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className={styles.stockIn}
                />
              ) : store.stockStatus === "low-stock" ? (
                <Package
                  size={13}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className={styles.stockLow}
                />
              ) : store.stockStatus === "out-of-stock" ? (
                <Package
                  size={13}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className={styles.stockOut}
                />
              ) : null}
              <small>
                {store.stockStatus === "in-stock"
                  ? "In"
                  : store.stockStatus === "low-stock"
                    ? "Low"
                    : store.stockStatus === "out-of-stock"
                      ? "Out"
                      : "—"}
              </small>
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
