import assert from "node:assert/strict";
import test from "node:test";
import type { Offer, Product } from "@/data/products";
import { findBundleStores, findBuyTogetherSuggestions } from "./bundle-finder";

const now = new Date("2026-08-09T15:00:00Z");

function makeOffer(
  retailer: string,
  priceNgn: number,
  opts: Partial<Offer> = {},
): Offer {
  return {
    retailer,
    url: `https://example.com/${retailer.toLowerCase().replace(/\s+/g, "-")}`,
    trust: 90,
    available: true,
    priceNgn,
    checkedAt: "2026-08-09T12:00:00Z",
    match: "exact",
    listingEvidence: {
      observedAt: "2026-08-09T12:00:00Z",
      sourceUrl: `https://example.com/${retailer.toLowerCase().replace(/\s+/g, "-")}`,
      basis: "retailer-page",
    },
    priceObservation: {
      observedAt: "2026-08-09T12:00:00Z",
      variant: "Test Variant",
      size: "150 ml",
      stock: "in-stock",
      landedCost: "unknown",
    },
    location: ["NG"],
    ...opts,
  };
}

function makeProduct(
  slug: string,
  offers: Offer[],
  overrides: Partial<Product> = {},
): Pick<Product, "slug" | "name" | "brand" | "size" | "offers"> {
  return {
    slug,
    name: `Product ${slug}`,
    brand: "TestBrand",
    size: "150 ml",
    offers,
    ...overrides,
  };
}

test("findBundleStores returns stores that carry all products, sorted by combined total", () => {
  const productA = makeProduct("product-a", [
    makeOffer("Lux Beauty", 9850),
    makeOffer("Beauty Hut Africa", 8500),
    makeOffer("Deoset", 10500),
  ]);
  const productB = makeProduct("product-b", [
    makeOffer("Lux Beauty", 13500),
    makeOffer("Beauty Hut Africa", 15085),
    makeOffer("Nihet Beauty", 39500),
  ]);

  const result = findBundleStores([productA, productB], now);

  assert.equal(result.bundles.length, 2, "should find 2 common retailers");
  assert.equal(result.bundles[0].retailer, "Lux Beauty");
  assert.equal(result.bundles[0].combinedTotal, 23350);
  assert.equal(result.bundles[1].retailer, "Beauty Hut Africa");
  assert.equal(result.bundles[1].combinedTotal, 23585);
  assert.equal(result.unmatchedProducts.length, 0);
});

test("findBundleStores reports products with no common retailer", () => {
  const productA = makeProduct("product-a", [makeOffer("Lux Beauty", 9850)]);
  const productB = makeProduct("product-b", [makeOffer("Nihet Beauty", 39500)]);

  const result = findBundleStores([productA, productB], now);

  assert.equal(result.bundles.length, 0);
  assert.equal(result.unmatchedProducts.length, 2);
  assert.ok(result.unmatchedProducts.includes("product-a"));
  assert.ok(result.unmatchedProducts.includes("product-b"));
});

test("findBundleStores excludes search-match and unpriced offers", () => {
  const productA = makeProduct("product-a", [
    makeOffer("Lux Beauty", 9850),
    makeOffer("Search Store", 5000, { match: "search" }),
  ]);
  const productB = makeProduct("product-b", [
    makeOffer("Lux Beauty", 13500),
    makeOffer("No Price Store", 0, { priceNgn: undefined }),
  ]);

  const result = findBundleStores([productA, productB], now);

  assert.equal(result.bundles.length, 1);
  assert.equal(result.bundles[0].retailer, "Lux Beauty");
});

test("findBundleStores marks allInStock false when any offer is out of stock", () => {
  const productA = makeProduct("product-a", [
    makeOffer("Lux Beauty", 9850),
    makeOffer("Deoset", 10500, {
      available: false,
      priceObservation: {
        observedAt: "2026-08-09T12:00:00Z",
        variant: "Test",
        size: "150 ml",
        stock: "out-of-stock",
        landedCost: "unknown",
      },
    }),
  ]);
  const productB = makeProduct("product-b", [
    makeOffer("Lux Beauty", 13500),
    makeOffer("Deoset", 16500),
  ]);

  const result = findBundleStores([productA, productB], now);

  const luxBundle = result.bundles.find((b) => b.retailer === "Lux Beauty")!;
  assert.equal(luxBundle.allInStock, true);

  const deosetBundle = result.bundles.find((b) => b.retailer === "Deoset")!;
  assert.equal(deosetBundle.allInStock, false);
});

test("findBundleStores returns empty for fewer than 2 products", () => {
  const productA = makeProduct("product-a", [makeOffer("Lux Beauty", 9850)]);

  const result = findBundleStores([productA], now);

  assert.equal(result.bundles.length, 0);
});

test("findBundleStores handles three products", () => {
  const productA = makeProduct("product-a", [
    makeOffer("Lux Beauty", 9850),
    makeOffer("Beauty Hut Africa", 8500),
  ]);
  const productB = makeProduct("product-b", [
    makeOffer("Lux Beauty", 13500),
    makeOffer("Beauty Hut Africa", 15085),
  ]);
  const productC = makeProduct("product-c", [
    makeOffer("Lux Beauty", 5000),
    // Beauty Hut does not carry product C
  ]);

  const result = findBundleStores([productA, productB, productC], now);

  assert.equal(result.bundles.length, 1);
  assert.equal(result.bundles[0].retailer, "Lux Beauty");
  assert.equal(result.bundles[0].combinedTotal, 28350);
  assert.equal(result.bundles[0].offers.length, 3);
});

test("findBuyTogetherSuggestions returns products with shared retailers", () => {
  const target = makeProduct("target-product", [
    makeOffer("Lux Beauty", 9850),
    makeOffer("Beauty Hut Africa", 8500),
  ]);
  const other1 = makeProduct("other-1", [
    makeOffer("Lux Beauty", 13500),
    makeOffer("Beauty Hut Africa", 15085),
  ]);
  const other2 = makeProduct("other-2", [makeOffer("Lux Beauty", 5000)]);
  const other3 = makeProduct("other-3", [makeOffer("Nihet Beauty", 10000)]);

  const suggestions = findBuyTogetherSuggestions(
    target,
    [other1, other2, other3],
    now,
  );

  assert.equal(suggestions.length, 2);
  assert.equal(suggestions[0].product.slug, "other-1");
  assert.equal(suggestions[0].sharedRetailerCount, 2);
  assert.equal(suggestions[1].product.slug, "other-2");
  assert.equal(suggestions[1].sharedRetailerCount, 1);
});

test("findBuyTogetherSuggestions excludes the target product itself", () => {
  const target = makeProduct("target-product", [makeOffer("Lux Beauty", 9850)]);
  const other = makeProduct("other-product", [makeOffer("Lux Beauty", 13500)]);

  const suggestions = findBuyTogetherSuggestions(target, [target, other], now);

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].product.slug, "other-product");
});

test("findBuyTogetherSuggestions returns empty when target has no NG offers", () => {
  const target = makeProduct("target-product", [
    makeOffer("Lux Beauty", 9850, { location: ["INTL"] }),
  ]);
  const other = makeProduct("other-product", [makeOffer("Lux Beauty", 13500)]);

  const suggestions = findBuyTogetherSuggestions(target, [other], now);

  assert.equal(suggestions.length, 0);
});
