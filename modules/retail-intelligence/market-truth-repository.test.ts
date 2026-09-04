import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { comparisonExcludedOfferIdentities } from "@/lib/market-truth/comparison-eligibility";

const source = readFileSync(
  new URL("../../lib/market-truth/repository.ts", import.meta.url),
  "utf8",
);

test("current offer coverage uses actionable exact-offer evidence", () => {
  assert.match(source, /offer\.match_kind = 'exact'/);
  assert.match(source, /offer\.market_code = 'NG'/);
  assert.match(source, /offer\.url ~\* '\^https:\/\/'/);
  assert.match(
    source,
    /offer\.verification_expires_at > database_clock\.observed_at/,
  );
  assert.match(source, /offer\.available = true/);
  assert.match(
    source,
    /offer\.inventory_status in \('in_stock', 'low_stock'\)/,
  );
  assert.match(source, /offer\.price_minor > 0/);
  assert.match(source, /offer\.currency_code = 'NGN'/);
  assert.match(
    source,
    /offer\.verification_method in \('manual', 'retailer_page', 'api'\)/,
  );
  assert.match(
    source,
    /nullif\(btrim\(offer\.observed_title\), ''\) is not null/,
  );
  assert.match(
    source,
    /nullif\(btrim\(offer\.observed_size\), ''\) is not null/,
  );
  assert.match(
    source,
    /offer\.last_verified_at <= database_clock\.observed_at/,
  );
  assert.match(source, /comparison_exclusion\.product_slug is null/);

  const inventoryStart = source.indexOf(
    "export async function readInventoryMarketTruthFacts",
  );
  const discoveryStart = source.indexOf(
    "export async function readRetailerDiscoveryMarketTruthFacts",
  );
  const inventoryQuery = source.slice(inventoryStart, discoveryStart);
  assert.match(inventoryQuery, /\) as is_current/);
  assert.equal(
    inventoryQuery.match(/where exact_offer\.is_current/g)?.length,
    4,
    "every inventory current aggregate must share one governed predicate",
  );

  const discoveryQuery = source.slice(discoveryStart);
  assert.match(discoveryQuery, /current_exact_offers as \(/);
  assert.match(
    discoveryQuery,
    /from current_exact_offers current_offer[\s\S]*current_offer\.product_id = product\.id/,
  );
  assert.match(
    discoveryQuery,
    /count\(distinct current_offer\.retailer_id\)[\s\S]*from current_exact_offers current_offer/,
  );
});

test("comparison exclusions bind the full static product-retailer-URL identity", () => {
  const exclusions = comparisonExcludedOfferIdentities({
    "example-product": [
      {
        retailer: "Example Store",
        url: "https://store.example/product/#details",
        priceComparison: "exclude",
      },
      {
        retailer: "Other Store",
        url: "https://other.example/product/",
        priceComparison: "include",
      },
    ],
  });

  assert.deepEqual(exclusions, [
    {
      product_slug: "example-product",
      retailer: "Example Store",
      url: "https://store.example/product/#details",
      normalized_url: "https://store.example/product",
    },
  ]);
  assert.match(
    source,
    /comparison_exclusion\.product_slug = product\.slug[\s\S]*comparison_exclusion\.retailer = retailer\.name[\s\S]*comparison_exclusion\.normalized_url = rtrim\(split_part\(offer\.url, '#', 1\), '\/'\)/,
  );

  assert.ok(
    comparisonExcludedOfferIdentities().some(
      (identity) =>
        identity.product_slug ===
          "cosrx-advanced-snail-92-all-in-one-cream-100g-jar" &&
        identity.retailer === "CSi Grocery" &&
        identity.url ===
          "https://www.csigrocery.com/shop/skincare/skin-moisturizers-oils/cosrx-advanced-snail-all-in-one/",
    ),
    "a checked-in non-comparable offer must reach the SQL exclusion set",
  );
});

test("history coverage must match the current price observation", () => {
  assert.match(source, /history\.offer_id = exact_offer\.id/);
  assert.match(source, /history\.currency_code = exact_offer\.currency_code/);
  assert.match(source, /history\.price_minor = exact_offer\.price_minor/);
  assert.match(source, /history\.observed_at = exact_offer\.last_verified_at/);
  assert.match(source, /history\.source = exact_offer\.verification_method/);
});

test("stale-offer attention excludes work already owned by the refresh queue", () => {
  assert.match(
    source,
    /from inventory_refresh_jobs pending_job[\s\S]*pending_job\.offer_id = exact_offer\.id[\s\S]*pending_job\.status in \('queued', 'processing'\)/,
  );
});
