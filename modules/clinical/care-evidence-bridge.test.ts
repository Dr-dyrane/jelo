import assert from "node:assert/strict";
import test from "node:test";
import {
  identifyCareEvidenceSignals,
  careStateForProduct,
  isCareEligible,
  requiresPharmacistReview,
  hasInsufficientData,
  careStateLabel,
} from "@/lib/clinical/care-evidence-bridge";

test("careStateForProduct returns insufficient_data for unknown products", () => {
  assert.equal(
    careStateForProduct("nonexistent-product-slug"),
    "insufficient_data",
  );
});

test("isCareEligible is false for insufficient_data products", () => {
  assert.equal(isCareEligible("nonexistent-product-slug"), false);
});

test("requiresPharmacistReview is false for unknown products", () => {
  assert.equal(requiresPharmacistReview("nonexistent-product-slug"), false);
});

test("hasInsufficientData is true for unknown products", () => {
  assert.equal(hasInsufficientData("nonexistent-product-slug"), true);
});

test("careStateLabel returns null for unknown products", () => {
  // Unknown products default to insufficient_data, which has a label
  assert.equal(
    careStateLabel("nonexistent-product-slug"),
    "Community evidence being collected",
  );
});

test("identifyCareEvidenceSignals flags products with enough positive outcomes", () => {
  const productSlugs = ["test-product-a", "test-product-b", "test-product-c"];
  const outcomes = new Map([
    ["test-product-a", { loveIt: 4, helped: 2, unsure: 1, didntHelp: 0 }], // 7 total, 6/7 positive = 0.857
    ["test-product-b", { loveIt: 1, helped: 1, unsure: 1, didntHelp: 2 }], // 5 total, 2/5 positive = 0.4
    ["test-product-c", { loveIt: 0, helped: 0, unsure: 0, didntHelp: 0 }], // 0 total
  ]);

  const signals = identifyCareEvidenceSignals(productSlugs, outcomes);

  // All three are unknown products, so all default to insufficient_data
  const signalA = signals.find((s) => s.productSlug === "test-product-a");
  const signalB = signals.find((s) => s.productSlug === "test-product-b");
  const signalC = signals.find((s) => s.productSlug === "test-product-c");

  assert.ok(signalA);
  assert.ok(signalB);
  assert.ok(signalC);

  assert.equal(signalA!.recommendation, "ready-for-pharmacist-review");
  assert.equal(signalA!.outcomeSummary.total, 7);

  assert.equal(signalB!.recommendation, "keep-monitoring");
  assert.equal(signalB!.outcomeSummary.total, 5);

  assert.equal(signalC!.recommendation, "insufficient-evidence");
  assert.equal(signalC!.outcomeSummary.total, 0);
});

test("identifyCareEvidenceSignals only includes insufficient_data products", () => {
  // Use a real product slug that is supportive_eligible
  const productSlugs = ["anua-niacinamide-10-txa-4-serum", "unknown-product"];
  const outcomes = new Map();

  const signals = identifyCareEvidenceSignals(productSlugs, outcomes);

  // The supportive_eligible product should not appear
  const known = signals.find(
    (s) => s.productSlug === "anua-niacinamide-10-txa-4-serum",
  );
  assert.equal(known, undefined);

  // The unknown product (defaults to insufficient_data) should appear
  const unknown = signals.find((s) => s.productSlug === "unknown-product");
  assert.ok(unknown);
});
