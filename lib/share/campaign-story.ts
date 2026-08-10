import type { ProductTrendData, TrendPricePoint } from "./product-trends";
import {
  DEFAULT_TREND_WINDOW,
  selectTrendWindowMovement,
  type TrendWindowKey,
} from "./trend-window";

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

/**
 * Select one real retailer series for the requested story window. We never merge prices
 * from different stores into an invented market line. When no exact retailer
 * has two time-distinct observations, the story intentionally becomes a
 * current-market snapshot instead of drawing a curve.
 */
export function buildCampaignTrendStory(
  data: ProductTrendData,
  now = Date.now(),
  windowKey: TrendWindowKey = DEFAULT_TREND_WINDOW,
): CampaignTrendStory {
  const movement = selectTrendWindowMovement(
    data.points,
    windowKey,
    now,
    data.stores.map((store) => store.retailer),
  );
  if (!movement) {
    return {
      mode: "snapshot",
      observedAt: data.summary.observedAt,
    };
  }

  return {
    mode: "history",
    ...movement,
  };
}
