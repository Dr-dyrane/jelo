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

export function hasRenderableTrendSeries(points: readonly TrendPricePoint[]) {
  const observationsByRetailer = new Map<string, Set<number>>();
  for (const point of points) {
    const observedAt = Date.parse(point.observedAt);
    if (!Number.isFinite(observedAt)) continue;
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
