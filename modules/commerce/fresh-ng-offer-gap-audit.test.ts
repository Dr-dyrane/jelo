import assert from "node:assert/strict";
import test from "node:test";
import audit from "@/data/retailer-verification/fresh-ng-offer-gap-2026-07-26.json";
import { verifiedRetailOffers } from "@/data/retail-offers";
import { nigeriaRetailers } from "@/data/retailers";

const expectedSlugs = [
  "dove-moroccan-argan-oil-beauty-bar",
  "la-roche-posay-toleriane-double-repair-matte",
  "la-roche-posay-toleriane-double-repair-spf30",
];

test("the fresh Nigerian offer-gap audit covers the three unresolved products", () => {
  assert.equal(audit.method, "direct-retailer-product-page-review");
  assert.ok(!Number.isNaN(Date.parse(audit.observedAt)));
  assert.deepEqual(
    audit.products.map((product) => product.slug).sort(),
    expectedSlugs,
  );

  for (const product of audit.products) {
    const requestedUrl = new URL(product.requestedUrl);
    const finalUrl = new URL(product.finalUrl);

    assert.equal(requestedUrl.protocol, "https:", product.slug);
    assert.equal(finalUrl.protocol, "https:", product.slug);
    assert.notEqual(finalUrl.pathname, "/", product.slug);
    assert.ok(
      product.disposition === "withheld" || product.disposition === "resolved",
      product.slug,
    );
    assert.ok(product.reasons.length > 0, product.slug);
  }
});

test("directory status is explicit and agrees with the retailer registry", () => {
  const registeredRetailers = new Set(
    nigeriaRetailers.map((retailer) => retailer.name),
  );

  for (const product of audit.products) {
    assert.equal(
      product.retailerDirectoryStatus === "directory-listed",
      registeredRetailers.has(product.retailer),
      product.slug,
    );
  }
});

test("identity or landed-cost ambiguity cannot leak into verified offers", () => {
  for (const product of audit.products) {
    if (product.disposition === "withheld") {
      assert.equal(
        verifiedRetailOffers[product.slug],
        undefined,
        `${product.slug} must remain withheld`,
      );
    }
  }
});
