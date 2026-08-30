import assert from "node:assert/strict";
import test from "node:test";
import audit from "@/data/retailer-verification/catalogue-store-coverage-batch-1-2026-08-03.json";
import { verifiedRetailOffers } from "@/data/retail-offers";
import { nigeriaRetailers } from "@/data/retailers";

const selectedSlugs = [
  "sheamoisture-jamaican-black-castor-oil-shampoo-384ml",
  "sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml",
  "anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml",
  "dove-melanin-even-tone-body-wash-18-5oz",
];

test("batch 1 deterministically records the retailer grouping and accepted score reasons", () => {
  assert.equal(audit.method, "rendered-browser-page-review");
  assert.equal(audit.selection.retailerGrouping, "Beauty by Daz");
  assert.deepEqual(audit.selection.selectedSlugs, selectedSlugs);
  assert.deepEqual(
    audit.selection.rankedReasons.map((product) => product.slug),
    selectedSlugs,
  );
  assert.ok(!Number.isNaN(Date.parse(audit.observedAt)));

  for (const product of audit.selection.rankedReasons) {
    assert.equal(product.score, 56, product.slug);
    assert.deepEqual(
      {
        exactStoreGap: product.exactStoreGap,
        freshPriceGap: product.freshPriceGap,
        staleOrUnverifiedOffers: product.staleOrUnverifiedOffers,
        blockedExactOffers: product.blockedExactOffers,
      },
      {
        exactStoreGap: 3,
        freshPriceGap: 3,
        staleOrUnverifiedOffers: 2,
        blockedExactOffers: 1,
      },
      product.slug,
    );
  }

  assert.deepEqual(audit.coverageImpact.admittedDelta, {
    freshExactStores: 2,
    freshPrices: 1,
    freshExactStoreGap: -2,
    freshPriceGap: -1,
  });
  assert.deepEqual(audit.coverageImpact.releaseIsolatedAfter, {
    publicProducts: 63,
    productsMeetingStoreTarget: 5,
    productsMeetingFreshPriceTarget: 2,
    freshExactStoreGap: 123,
    freshPriceGap: 140,
  });
});

test("only evidence-qualified Batch 1 observations are admitted", () => {
  const registered = new Set(nigeriaRetailers.map((retailer) => retailer.name));

  for (const product of audit.products) {
    assert.equal(
      product.retailer,
      audit.selection.retailerGrouping,
      product.slug,
    );
    assert.equal(
      product.retailerDirectoryStatus,
      "directory-listed",
      product.slug,
    );
    assert.ok(registered.has(product.retailer), product.slug);
    assert.equal(
      new URL(product.requestedUrl).protocol,
      "https:",
      product.slug,
    );
    assert.equal(new URL(product.finalUrl).protocol, "https:", product.slug);

    const offer = verifiedRetailOffers[product.slug]?.find(
      (candidate) => candidate.retailer === product.retailer,
    );
    if (product.disposition === "verified-exact-offer") {
      assert.ok(offer, product.slug);
      assert.equal(product.requestedUrl, product.finalUrl, product.slug);
      assert.equal(offer.url, product.finalUrl, product.slug);
      assert.equal(offer.priceNgn, product.priceNgn, product.slug);
      if (offer.priceObservation?.stock !== product.stock) {
        assert.equal(
          offer.available,
          false,
          `${product.slug}: fail-closed availability`,
        );
        assert.equal(
          offer.priceObservation?.stock,
          "unknown",
          `${product.slug}: fail-closed stock`,
        );
      }
      assert.ok(product.observedTitle, product.slug);
      assert.ok(product.observedSize, product.slug);
      assert.ok(product.evidence.length >= 3, product.slug);
      continue;
    }

    assert.equal(offer, undefined, `${product.slug} must remain withheld`);
    assert.ok(product.reasons?.length, product.slug);
  }
});
