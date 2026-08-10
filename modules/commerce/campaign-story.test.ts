import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCampaignTrendStory,
  formatCampaignProductSize,
} from "@/lib/share/campaign-story";
import type { ProductTrendData } from "@/lib/share/product-trends";

const now = Date.parse("2026-08-08T12:00:00Z");

function trendData(
  points: ProductTrendData["points"],
  retailers = ["Exact store"],
): ProductTrendData {
  return {
    slug: "product-50ml",
    brand: "Brand",
    name: "Product",
    image: "/product.png",
    category: "Face",
    size: "50 ml",
    points,
    stores: retailers.map((retailer, index) => ({
      retailer,
      priceNaira: 12_000 + index * 1_000,
      trustScore: 90,
      stockStatus: "in-stock",
      lastVerifiedAt: "2026-08-08T10:00:00Z",
      isLowest: index === 0,
      isMarketplace: false,
    })),
    summary: {
      lowestNaira: 12_000,
      medianNaira: 12_500,
      highestNaira: 13_000,
      spreadNaira: 1_000,
      storeCount: retailers.length,
      avgTrust: 90,
      confidence: 90,
      observedDate: "8 Aug",
      observedAt: "2026-08-08T10:00:00Z",
    },
  };
}

test("campaign size copy repairs only the unmistakable legacy handle shape", () => {
  assert.equal(
    formatCampaignProductSize(
      "advanced-clinicals-vitamin-c-face-serum-52ml",
      "1-75oz",
    ),
    "52 ml",
  );
  assert.equal(
    formatCampaignProductSize("ordinary-product", "1-75oz"),
    "1.75 fl oz",
  );
  assert.equal(
    formatCampaignProductSize("ordinary-product-50ml", "50 ml"),
    "50 ml",
  );
});

test("trend story selects one current exact retailer instead of merging stores", () => {
  const story = buildCampaignTrendStory(
    trendData(
      [
        {
          retailer: "Exact store",
          priceNaira: 15_000,
          observedAt: "2026-07-20T10:00:00Z",
        },
        {
          retailer: "Other store",
          priceNaira: 19_000,
          observedAt: "2026-07-22T10:00:00Z",
        },
        {
          retailer: "Exact store",
          priceNaira: 12_000,
          observedAt: "2026-08-08T10:00:00Z",
        },
        {
          retailer: "No longer rendered",
          priceNaira: 8_000,
          observedAt: "2026-08-08T10:00:00Z",
        },
      ],
      ["Exact store", "Other store"],
    ),
    now,
  );

  assert.equal(story.mode, "history");
  if (story.mode !== "history") return;
  assert.equal(story.retailer, "Exact store");
  assert.deepEqual(
    story.points.map((point) => point.retailer),
    ["Exact store", "Exact store"],
  );
  assert.equal(story.direction, "down");
  assert.equal(story.percent, -20);
});

test("trend story becomes an honest snapshot without two dated observations", () => {
  const story = buildCampaignTrendStory(
    trendData([
      {
        retailer: "Exact store",
        priceNaira: 12_000,
        observedAt: "2026-08-08T10:00:00Z",
      },
    ]),
    now,
  );
  assert.deepEqual(story, {
    mode: "snapshot",
    observedAt: "2026-08-08T10:00:00Z",
  });
});

test("trend story uses the selected 3M download window", () => {
  const data = trendData([
    {
      retailer: "Exact store",
      priceNaira: 15_000,
      observedAt: "2026-07-08T12:00:00Z",
    },
    {
      retailer: "Exact store",
      priceNaira: 12_000,
      observedAt: "2026-08-08T10:00:00Z",
    },
  ]);

  assert.equal(buildCampaignTrendStory(data, now).mode, "snapshot");
  const story = buildCampaignTrendStory(data, now, "3m");
  assert.equal(story.mode, "history");
  if (story.mode !== "history") return;
  assert.equal(story.percent, -20);
  assert.equal(story.startObservedAt, "2026-07-08T12:00:00Z");
  assert.equal(story.endObservedAt, "2026-08-08T10:00:00Z");
});
