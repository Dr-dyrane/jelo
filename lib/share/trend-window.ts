import type { TrendPricePoint } from "./product-trends";

const DAY_MS = 86_400_000;

export type TrendWindowKey = "7d" | "14d" | "1m" | "3m";

export const TREND_WINDOWS = [
  { key: "7d", label: "7D", days: 7 },
  { key: "14d", label: "14D", days: 14 },
  { key: "1m", label: "1M", days: 30 },
  { key: "3m", label: "3M", days: 90 },
] as const satisfies readonly {
  key: TrendWindowKey;
  label: string;
  days: number;
}[];

export const DEFAULT_TREND_WINDOW: TrendWindowKey = "1m";

const retailerKey = (value: string) => value.trim().toLocaleLowerCase("en-NG");

export function isTrendWindowKey(
  value: string | null,
): value is TrendWindowKey {
  return TREND_WINDOWS.some((window) => window.key === value);
}

export function trendWindowDefinition(key: TrendWindowKey) {
  return TREND_WINDOWS.find((window) => window.key === key)!;
}

export function trendStoryHref(href: string, windowKey: TrendWindowKey) {
  const url = new URL(href, "https://jelocare.local");
  url.searchParams.set("window", windowKey);
  return /^https?:\/\//i.test(href)
    ? url.toString()
    : `${url.pathname}${url.search}${url.hash}`;
}

export function filterTrendPointsByWindow<T extends TrendPricePoint>(
  points: readonly T[],
  windowKey: TrendWindowKey,
  now: number,
) {
  const cutoff = now - trendWindowDefinition(windowKey).days * DAY_MS;
  const futureLimit = now + DAY_MS;
  return points.filter((point) => {
    const observedAt = Date.parse(point.observedAt);
    return (
      Number.isFinite(observedAt) &&
      observedAt >= cutoff &&
      observedAt <= futureLimit
    );
  });
}

export type TrendWindowMovement = {
  retailer: string;
  points: TrendPricePoint[];
  startPriceNaira: number;
  endPriceNaira: number;
  startObservedAt: string;
  endObservedAt: string;
  percent: number;
  direction: "down" | "up" | "flat";
};

/**
 * Selects one evidence-backed retailer series inside the requested window.
 * Different stores are never merged into a temporal line or percentage.
 */
export function selectTrendWindowMovement(
  points: readonly TrendPricePoint[],
  windowKey: TrendWindowKey,
  now: number,
  currentRetailers?: readonly string[],
): TrendWindowMovement | null {
  const allowedRetailers = currentRetailers
    ? new Set(currentRetailers.map(retailerKey))
    : null;
  const grouped = new Map<string, TrendPricePoint[]>();

  for (const point of filterTrendPointsByWindow(points, windowKey, now)) {
    const key = retailerKey(point.retailer);
    if (
      !key ||
      (allowedRetailers && !allowedRetailers.has(key)) ||
      !Number.isFinite(point.priceNaira) ||
      point.priceNaira <= 0
    ) {
      continue;
    }
    grouped.set(key, [...(grouped.get(key) ?? []), point]);
  }

  const candidates = [...grouped.values()]
    .map((series) => {
      const byObservedAt = new Map<number, TrendPricePoint>();
      for (const point of series) {
        byObservedAt.set(Date.parse(point.observedAt), point);
      }
      const ordered = [...byObservedAt.entries()]
        .sort(([left], [right]) => left - right)
        .map(([, point]) => point);
      const span =
        ordered.length >= 2
          ? Date.parse(ordered.at(-1)!.observedAt) -
            Date.parse(ordered[0].observedAt)
          : 0;
      return { points: ordered, span };
    })
    .filter((candidate) => candidate.points.length >= 2 && candidate.span > 0)
    .sort(
      (left, right) =>
        right.points.length - left.points.length ||
        right.span - left.span ||
        left.points[0].retailer.localeCompare(right.points[0].retailer),
    );

  const selected = candidates[0]?.points;
  if (!selected) return null;

  const first = selected[0];
  const last = selected.at(-1)!;
  const percent =
    ((last.priceNaira - first.priceNaira) / first.priceNaira) * 100;
  const direction =
    Math.abs(percent) < 0.5 ? "flat" : percent < 0 ? "down" : "up";

  return {
    retailer: first.retailer,
    points: selected,
    startPriceNaira: first.priceNaira,
    endPriceNaira: last.priceNaira,
    startObservedAt: first.observedAt,
    endObservedAt: last.observedAt,
    percent: Math.round(percent * 10) / 10,
    direction,
  };
}

export type TrendPlotPoint = { x: number; y: number };

/**
 * Joins dated price observations with a bounded easing curve. Every segment
 * stays inside the rectangle formed by its two endpoints, so the line cannot
 * overshoot the observed date or price range and is not a regression.
 */
export function buildObservedTrendPath(points: readonly TrendPlotPoint[]) {
  if (points.length < 2) return "";
  let path = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const controlOffset = (point.x - previous.x) * 0.34;
    path +=
      ` C${(previous.x + controlOffset).toFixed(1)},${previous.y.toFixed(1)}` +
      ` ${(point.x - controlOffset).toFixed(1)},${point.y.toFixed(1)}` +
      ` ${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }
  return path;
}

export function hasRenderableTrendSeries(points: readonly TrendPricePoint[]) {
  const observationsByRetailer = new Map<string, Set<number>>();
  for (const point of points) {
    const observedAt = Date.parse(point.observedAt);
    if (
      !Number.isFinite(observedAt) ||
      !Number.isFinite(point.priceNaira) ||
      point.priceNaira <= 0
    ) {
      continue;
    }
    const key = retailerKey(point.retailer);
    const observations = observationsByRetailer.get(key) ?? new Set<number>();
    observations.add(observedAt);
    observationsByRetailer.set(key, observations);
  }
  return [...observationsByRetailer.values()].some(
    (observations) => observations.size >= 2,
  );
}

/** Selects the shortest window that can draw one real retailer series. */
export function selectInitialTrendWindow(
  points: readonly TrendPricePoint[],
  now: number,
): TrendWindowKey {
  return (
    TREND_WINDOWS.find((window) =>
      hasRenderableTrendSeries(
        filterTrendPointsByWindow(points, window.key, now),
      ),
    )?.key ?? DEFAULT_TREND_WINDOW
  );
}
