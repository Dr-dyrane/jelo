import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_TREND_WINDOW,
  filterTrendPointsByWindow,
  hasRenderableTrendSeries,
  isTrendWindowKey,
  selectInitialTrendWindow,
  trendStoryHref,
} from "@/lib/share/trend-window";
import type { TrendPricePoint } from "@/lib/share/product-trends";

const now = Date.parse("2026-08-09T12:00:00Z");

function point(
  retailer: string,
  observedAt: string,
  priceNaira = 12_000,
): TrendPricePoint {
  return { retailer, observedAt, priceNaira };
}

test("trend view selects the shortest window with a renderable retailer series", () => {
  const points = [
    point("Exact store", "2026-08-04T12:00:00Z", 13_000),
    point("Exact store", "2026-08-09T10:00:00Z", 12_000),
  ];

  assert.equal(selectInitialTrendWindow(points, now), "7d");
});

test("trend view widens to 3M when the same-retailer anchor is outside 1M", () => {
  const points = [
    point("BuyBetter", "2026-07-08T12:00:00Z", 14_592),
    point("BuyBetter", "2026-08-08T13:15:00Z", 11_288),
    point("CSi Grocery", "2026-07-08T12:00:00Z", 14_170),
    point("CSi Grocery", "2026-08-08T04:23:18Z", 13_000),
  ];

  assert.equal(selectInitialTrendWindow(points, now), "3m");
  assert.equal(
    hasRenderableTrendSeries(filterTrendPointsByWindow(points, "1m", now)),
    false,
  );
  assert.equal(
    hasRenderableTrendSeries(filterTrendPointsByWindow(points, "3m", now)),
    true,
  );
});

test("observations from different retailers do not invent a renderable series", () => {
  const points = [
    point("First store", "2026-08-08T12:00:00Z"),
    point("Second store", "2026-08-09T10:00:00Z"),
  ];

  assert.equal(selectInitialTrendWindow(points, now), DEFAULT_TREND_WINDOW);
});

test("duplicate timestamps do not count as two dated observations", () => {
  const points = [
    point("Exact store", "2026-08-08T12:00:00Z", 12_000),
    point("exact STORE", "2026-08-08T12:00:00Z", 11_500),
  ];

  assert.equal(hasRenderableTrendSeries(points), false);
  assert.equal(selectInitialTrendWindow(points, now), DEFAULT_TREND_WINDOW);
});

test("the requested trend window is allowlisted", () => {
  assert.equal(isTrendWindowKey("3m"), true);
  assert.equal(isTrendWindowKey("365d"), false);
  assert.equal(isTrendWindowKey(null), false);
});

test("the selected window is passed to the server-rendered trend download", () => {
  assert.equal(
    trendStoryHref("/share/product/story?kind=trend", "3m"),
    "/share/product/story?kind=trend&window=3m",
  );
  assert.equal(
    trendStoryHref("/share/product/story?kind=trend&window=1m", "7d"),
    "/share/product/story?kind=trend&window=7d",
  );
});

test("a point exactly on the selected window cutoff is retained", () => {
  const points = [
    point("Exact store", "2026-07-10T12:00:00Z", 13_000),
    point("Exact store", "2026-08-09T10:00:00Z", 12_000),
  ];

  assert.equal(selectInitialTrendWindow(points, now), "1m");
});
