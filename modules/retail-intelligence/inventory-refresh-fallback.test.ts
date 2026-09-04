import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  INVENTORY_REFRESH_EXTRACTION_BUDGET_MS,
  combineRetailerObservations,
  inventoryExtractionDeadlineAt,
  inventoryObservationEvidenceGaps,
  inventoryObservationScopeGap,
  inventoryRequestTimeoutMs,
  type InventoryObservationScope,
  type RetailerObservation,
} from "@/lib/inventory/refresh-worker";
import { InventoryRefreshFailure } from "@/lib/inventory/refresh-policy";

const worker = readFileSync(
  resolve(process.cwd(), "lib/inventory/refresh-worker.ts"),
  "utf8",
);

test("an empty direct fetch remains inside the bounded fallback pipeline", () => {
  assert.match(
    worker,
    /const directObservation = await fetchRetailerPage\(\s*job\.url,\s*extractionDeadlineAt,?\s*\);\s*if \(directObservation\) \{[\s\S]*?observation\s*=\s*acceptObservation\(["']http-fetch["'], directObservation\) \?\? observation;[\s\S]*?\} else \{[\s\S]*?layer: ["']http-fetch["'][\s\S]*?outcome: ["']no extraction["']/,
  );

  const directFetch = worker.indexOf(
    "const directObservation = await fetchRetailerPage(",
  );
  const browserFallback = worker.indexOf(
    "fetchRetailerPageWithBrowser(job.url)",
    directFetch,
  );
  const aiFallback = worker.indexOf(
    "extractRetailerPageWithAi({",
    browserFallback,
  );

  assert.ok(directFetch >= 0, "direct retailer fetch must remain present");
  assert.ok(
    browserFallback > directFetch,
    "browser fallback must remain reachable after a direct-fetch failure",
  );
  assert.ok(
    aiFallback > browserFallback,
    "AI extraction must remain the final bounded fallback",
  );
});

test("a thrown direct fetch is classified without escaping the fallback pipeline", () => {
  assert.match(
    worker,
    /try\s*\{[\s\S]*?const directObservation = await fetchRetailerPage\(\s*job\.url,\s*extractionDeadlineAt,?\s*\);[\s\S]*?\}\s*catch \(error\) \{[\s\S]*?layer: ["']http-fetch["'][\s\S]*?outcome: directFetchFailureOutcome\(error\)/,
  );

  const directFetch = worker.indexOf(
    "const directObservation = await fetchRetailerPage(",
  );
  const caughtFailure = worker.indexOf(
    "outcome: directFetchFailureOutcome(error)",
    directFetch,
  );
  const browserFallback = worker.indexOf(
    "fetchRetailerPageWithBrowser(job.url)",
    caughtFailure,
  );

  assert.ok(
    caughtFailure > directFetch,
    "the direct-fetch error must be caught",
  );
  assert.ok(
    browserFallback > caughtFailure,
    "the browser fallback must remain reachable after a thrown direct fetch",
  );
});

test("direct-fetch diagnostics stay bounded and do not weaken scope checks", () => {
  assert.match(worker, /error\.name === ["']AbortError["']/);
  assert.match(worker, /return ["']non-HTML response["']/);
  assert.match(worker, /return ["']response exceeded size limit["']/);
  assert.match(worker, /return ["']request failed["']/);

  assert.match(worker, /assertRetailerResponseScope\(\{/);
  assert.match(
    worker,
    /expectedTitle: `\$\{job\.brand_name\} \$\{job\.product_name\}`/,
  );
  assert.match(worker, /expectedSize: job\.product_size/);
  assert.match(worker, /marketCode: job\.market_code/);
  assert.match(worker, /currencyCode: observation\.currencyCode/);
});

const scope: InventoryObservationScope = {
  requestedUrl: "https://buybetter.ng/product/example-cream-50ml/",
  expectedTitle: "Example Cream",
  expectedSize: "50 ml",
  marketCode: "NG",
};

function observation(
  overrides: Partial<RetailerObservation> = {},
): RetailerObservation {
  return {
    inventoryStatus: "unknown",
    priceMinor: null,
    currencyCode: null,
    evidence: [],
    confidence: 20,
    adapterKey: "buybetter",
    responseUrl: scope.requestedUrl,
    verificationMethod: "retailer_page",
    ...overrides,
  };
}

test("incomplete Woo commerce evidence combines with exact page identity", () => {
  const woo = observation({
    inventoryStatus: "in_stock",
    priceMinor: 12_500,
    currencyCode: "NGN",
    productTitle: "Example Cream",
    evidence: ["Woo Store API price", "Woo Store API stock: in_stock"],
    confidence: 80,
    adapterKey: "woo-store-api",
  });
  assert.deepEqual(inventoryObservationEvidenceGaps(woo), [
    "measurable product size",
  ]);
  assert.equal(inventoryObservationScopeGap(scope, woo), undefined);

  const page = observation({
    productTitle: "Example Cream",
    productSize: "50 ml",
    canonicalUrl: scope.requestedUrl,
    evidence: ["Product title", "Product title size"],
  });
  const combined = combineRetailerObservations(woo, page);

  assert.deepEqual(inventoryObservationEvidenceGaps(combined), []);
  assert.equal(inventoryObservationScopeGap(scope, combined), undefined);
  assert.equal(combined.priceMinor, 12_500);
  assert.equal(combined.inventoryStatus, "in_stock");
  assert.equal(combined.productSize, "50 ml");
  assert.equal(combined.canonicalUrl, scope.requestedUrl);
  assert.deepEqual(combined.evidence, [
    "Woo Store API price",
    "Woo Store API stock: in_stock",
    "Product title",
    "Product title size",
  ]);
});

test("an allocated but incomplete HTML observation can be completed by a later layer", () => {
  const incompleteHtml = observation({
    productTitle: "Example Cream",
    evidence: ["Product title"],
  });
  assert.deepEqual(inventoryObservationEvidenceGaps(incompleteHtml), [
    "measurable product size",
    "price or stock evidence",
  ]);

  const renderedPage = observation({
    priceMinor: 12_500,
    currencyCode: "NGN",
    productTitle: "Example Cream",
    productSize: "50ml",
    evidence: ["Product price metadata", "Product title size"],
    adapterKey: "buybetter-browser",
  });
  const combined = combineRetailerObservations(incompleteHtml, renderedPage);

  assert.deepEqual(inventoryObservationEvidenceGaps(combined), []);
  assert.equal(inventoryObservationScopeGap(scope, combined), undefined);
});

test("an unpaired price is discarded while genuine stock-only evidence remains usable", () => {
  const unpairedPrice = observation({
    inventoryStatus: "in_stock",
    priceMinor: 12_500,
    productTitle: "Example Cream",
    productSize: "50 ml",
    evidence: ["Product price metadata", "Product stock marker"],
  });
  assert.deepEqual(inventoryObservationEvidenceGaps(unpairedPrice), [
    "price currency",
  ]);

  const stockOnly = combineRetailerObservations(undefined, unpairedPrice);
  assert.equal(stockOnly.priceMinor, null);
  assert.equal(stockOnly.currencyCode, null);
  assert.equal(stockOnly.inventoryStatus, "in_stock");
  assert.deepEqual(inventoryObservationEvidenceGaps(stockOnly), []);
});

test("every network layer shares a deterministic per-job extraction deadline", () => {
  const now = 1_000_000;
  assert.equal(INVENTORY_REFRESH_EXTRACTION_BUDGET_MS, 25_000);
  assert.equal(inventoryExtractionDeadlineAt(undefined, now), now + 25_000);
  assert.equal(inventoryExtractionDeadlineAt(now + 5_000, now), now + 5_000);
  assert.equal(inventoryRequestTimeoutMs(now + 20_000, now), 12_000);
  assert.equal(inventoryRequestTimeoutMs(now + 5_000, now), 5_000);
  assert.equal(inventoryRequestTimeoutMs(now, now), undefined);

  assert.match(
    worker,
    /fetchWooStoreApi\(\s*job\.url,\s*extractionDeadlineAt,?\s*\)/,
  );
  assert.match(
    worker,
    /fetchRetailerPage\(\s*job\.url,\s*extractionDeadlineAt,?\s*\)/,
  );
  assert.match(
    worker,
    /runBeforeInventoryExtractionDeadline\(\s*extractionDeadlineAt,\s*\(\) => fetchRetailerPageWithBrowser\(job\.url\)/,
  );
  assert.match(worker, /fetchPageHtml\(job\.url, extractionDeadlineAt\)/);
  assert.match(
    worker,
    /runBeforeInventoryExtractionDeadline\(\s*extractionDeadlineAt,\s*\(\) =>\s*extractRetailerPageWithAi/,
  );
});

test("later layers cannot mask a proven route, title, package, or currency contradiction", () => {
  const contradictions: Array<
    [Partial<RetailerObservation>, InventoryRefreshFailure["reason"]]
  > = [
    [
      { responseUrl: "https://buybetter.ng/product/another-product/" },
      "route_scope",
    ],
    [
      { productTitle: "Different Lotion", productSize: "50 ml" },
      "product_identity",
    ],
    [{ productTitle: "Example Cream", productSize: "100 ml" }, "package_size"],
    [
      {
        productTitle: "Example Cream",
        productSize: "50 ml",
        priceMinor: 100,
        currencyCode: "USD",
      },
      "market_currency",
    ],
  ];

  for (const [candidate, reason] of contradictions) {
    assert.throws(
      () => inventoryObservationScopeGap(scope, observation(candidate)),
      (error) =>
        error instanceof InventoryRefreshFailure && error.reason === reason,
      `${reason} must remain terminal`,
    );
  }
});
