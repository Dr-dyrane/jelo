import assert from "node:assert/strict";
import test from "node:test";
import { products as publicProducts } from "@/data/catalogue";
import {
  getPharmacyCareReviewAttestation,
  pharmacyCareReviewAttestationV1,
} from "@/data/product-care-review-attestation";
import { getReviewedProductCare } from "@/data/product-care-review";

test("pharmacy approval is versioned and bound to the exact current 39-product cohort", () => {
  const reviews = publicProducts.map((product) => {
    const review = getReviewedProductCare(product.slug);
    assert.ok(review, `Missing public care cell: ${product.slug}`);
    return review;
  });
  const currentPharmacistReviewSlugs = reviews
    .filter((review) => review.careState === "pharmacist_review")
    .map((review) => review.productSlug)
    .sort();
  const attestedSlugs = [
    ...pharmacyCareReviewAttestationV1.productSlugs,
  ].sort();

  assert.equal(pharmacyCareReviewAttestationV1.productCount, 39);
  assert.equal(new Set(attestedSlugs).size, 39);
  assert.deepEqual(attestedSlugs, currentPharmacistReviewSlugs);
  assert.equal(
    pharmacyCareReviewAttestationV1.version,
    "pharmacy-care-review/2026-08-31/v1",
  );
  assert.equal(
    pharmacyCareReviewAttestationV1.reviewerLabel,
    "JeloCare pharmacist",
  );
  assert.equal(pharmacyCareReviewAttestationV1.approvedAt, "2026-08-31");
  assert.equal(
    pharmacyCareReviewAttestationV1.disposition,
    "reviewed_context_only",
  );
});

test("attestation preserves the public care matrix and excludes every other state", () => {
  const reviews = publicProducts.map((product) => {
    const review = getReviewedProductCare(product.slug);
    assert.ok(review, `Missing public care cell: ${product.slug}`);
    return review;
  });
  const counts = {
    supportive: reviews.filter(
      (review) => review.careState === "supportive_eligible",
    ).length,
    pharmacist: reviews.filter(
      (review) => review.careState === "pharmacist_review",
    ).length,
    insufficient: reviews.filter(
      (review) => review.careState === "insufficient_data",
    ).length,
  };

  assert.deepEqual(counts, {
    supportive: 22,
    pharmacist: 39,
    insufficient: 102,
  });
  assert.equal(reviews.length, 163);

  for (const review of reviews) {
    const attestation = getPharmacyCareReviewAttestation(review.productSlug);
    assert.equal(
      Boolean(attestation),
      review.careState === "pharmacist_review",
      review.productSlug,
    );
  }
  assert.equal(getPharmacyCareReviewAttestation("future-product"), undefined);
});

test("the attested cohort keeps its existing source boundary", () => {
  const reviews = pharmacyCareReviewAttestationV1.productSlugs.map((slug) => {
    const review = getReviewedProductCare(slug);
    assert.ok(review, `Missing attested care cell: ${slug}`);
    return review;
  });

  assert.equal(
    reviews.filter((review) => review.evidenceSourceUrls.length === 0).length,
    4,
  );
  assert.equal(
    reviews.filter((review) => review.evidenceSourceUrls.length > 0).length,
    35,
  );
});
