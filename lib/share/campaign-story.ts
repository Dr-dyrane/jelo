import type { ProductTrendData, TrendPricePoint } from "./product-trends";

const DAY_MS = 86_400_000;

export const CAMPAIGN_STORY_SIZE = {
  width: 1080,
  height: 1920,
} as const;

export type CampaignTrendHistory = {
  mode: "history";
  retailer: string;
  points: TrendPricePoint[];
  startPriceNaira: number;
  endPriceNaira: number;
  startObservedAt: string;
  endObservedAt: string;
  percent: number;
  direction: "down" | "up" | "flat";
};

export type CampaignTrendSnapshot = {
  mode: "snapshot";
  observedAt: string | null;
};

export type CampaignTrendStory = CampaignTrendHistory | CampaignTrendSnapshot;

/**
 * Some legacy catalogue rows retained a URL-handle size such as `1-75oz`.
 * Campaign copy must be human-readable, so only that unmistakable handle shape
 * is normalised. When the canonical slug carries the exact metric size, prefer
 * it for the compact story label.
 */
export function formatCampaignProductSize(slug: string, size: string) {
  const trimmed = size.trim();
  const handleOunces = trimmed.match(/^(\d+)-(\d+)\s*oz$/i);
  if (!handleOunces) return trimmed;

  const metricFromSlug = slug.match(/-(\d+)ml$/i);
  if (metricFromSlug) return `${metricFromSlug[1]} ml`;

  return `${handleOunces[1]}.${handleOunces[2]} fl oz`;
}

const retailerKey = (value: string) => value.trim().toLocaleLowerCase("en-NG");

/**
 * Select one real retailer series for the 30-day story. We never merge prices
 * from different stores into an invented market line. When no exact retailer
 * has two time-distinct observations, the story intentionally becomes a
 * current-market snapshot instead of drawing a curve.
 */
export function buildCampaignTrendStory(
  data: ProductTrendData,
  now = Date.now(),
): CampaignTrendStory {
  const cutoff = now - 30 * DAY_MS;
  const currentRetailers = new Set(
    data.stores.map((store) => retailerKey(store.retailer)),
  );
  const grouped = new Map<string, TrendPricePoint[]>();

  for (const point of data.points) {
    const observedAt = Date.parse(point.observedAt);
    const key = retailerKey(point.retailer);
    if (
      !currentRetailers.has(key) ||
      !Number.isFinite(observedAt) ||
      observedAt < cutoff ||
      observedAt > now + DAY_MS ||
      !Number.isFinite(point.priceNaira) ||
      point.priceNaira <= 0
    ) {
      continue;
    }
    const series = grouped.get(key);
    if (series) series.push(point);
    else grouped.set(key, [point]);
  }

  const candidates = [...grouped.values()]
    .map((series) => {
      const byObservedAt = new Map<number, TrendPricePoint>();
      for (const point of series) {
        byObservedAt.set(Date.parse(point.observedAt), point);
      }
      const points = [...byObservedAt.entries()]
        .sort(([left], [right]) => left - right)
        .map(([, point]) => point);
      const span =
        points.length >= 2
          ? Date.parse(points.at(-1)!.observedAt) -
            Date.parse(points[0].observedAt)
          : 0;
      return { points, span };
    })
    .filter((candidate) => candidate.points.length >= 2 && candidate.span > 0)
    .sort(
      (left, right) =>
        right.points.length - left.points.length ||
        right.span - left.span ||
        left.points[0].retailer.localeCompare(right.points[0].retailer),
    );

  const selected = candidates[0]?.points;
  if (!selected) {
    return {
      mode: "snapshot",
      observedAt: data.summary.observedAt,
    };
  }

  const first = selected[0];
  const last = selected.at(-1)!;
  const percent =
    ((last.priceNaira - first.priceNaira) / first.priceNaira) * 100;
  const direction =
    Math.abs(percent) < 0.5 ? "flat" : percent < 0 ? "down" : "up";

  return {
    mode: "history",
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

export type CampaignCurvePoint = { x: number; y: number };

/** A monotone cubic path keeps the luminous curve smooth without overshooting. */
export function buildMonotoneCampaignPath(points: CampaignCurvePoint[]) {
  if (points.length < 2) return "";
  if (points.length === 2) {
    const [first, last] = points;
    const third = (last.x - first.x) / 3;
    return [
      `M${first.x.toFixed(1)},${first.y.toFixed(1)}`,
      `C${(first.x + third).toFixed(1)},${first.y.toFixed(1)}`,
      `${(last.x - third).toFixed(1)},${last.y.toFixed(1)}`,
      `${last.x.toFixed(1)},${last.y.toFixed(1)}`,
    ].join(" ");
  }

  const slopes = points.slice(0, -1).map((point, index) => {
    const next = points[index + 1];
    return (next.y - point.y) / Math.max(next.x - point.x, 0.0001);
  });
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === points.length - 1) return slopes.at(-1)!;
    const before = slopes[index - 1];
    const after = slopes[index];
    if (before === 0 || after === 0 || before * after < 0) return 0;
    return (2 * before * after) / (before + after);
  });

  for (let index = 0; index < slopes.length; index += 1) {
    const slope = slopes[index];
    if (slope === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }
    const left = tangents[index] / slope;
    const right = tangents[index + 1] / slope;
    const magnitude = left * left + right * right;
    if (magnitude > 9) {
      const scale = 3 / Math.sqrt(magnitude);
      tangents[index] = scale * left * slope;
      tangents[index + 1] = scale * right * slope;
    }
  }

  let path = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const width = next.x - current.x;
    path += [
      " C",
      `${(current.x + width / 3).toFixed(1)},${(
        current.y +
        (tangents[index] * width) / 3
      ).toFixed(1)}`,
      ` ${(next.x - width / 3).toFixed(1)},${(
        next.y -
        (tangents[index + 1] * width) / 3
      ).toFixed(1)}`,
      ` ${next.x.toFixed(1)},${next.y.toFixed(1)}`,
    ].join("");
  }
  return path;
}
