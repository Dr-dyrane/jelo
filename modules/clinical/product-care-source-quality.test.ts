import assert from "node:assert/strict";
import test from "node:test";
import { products } from "@/data/catalogue";
import {
  publishedProductCareManifest,
  reviewedProductCareManifest,
} from "@/data/product-care-review";
import {
  buildProductCareSourceProfile,
  classifyProductCareSource,
  formatProductCareSourceLabel,
} from "@/lib/clinical/product-care-source-quality";

const publicProductSlugs = new Set(products.map((product) => product.slug));
const reviews = Object.values({
  ...reviewedProductCareManifest,
  ...publishedProductCareManifest,
}).filter((review) => publicProductSlugs.has(review.productSlug));

test("every public care source is valid HTTPS and has one explicit role", () => {
  const sources = reviews.flatMap((review) => review.evidenceSourceUrls);

  assert.equal(sources.length, 267);
  for (const value of sources) {
    const source = classifyProductCareSource(value);
    assert.ok(source, value);
    assert.equal(source.url.startsWith("https://"), true, value);
    assert.ok(source.hostname, value);
    assert.ok(source.label, value);
  }
});

test("the full care matrix keeps product evidence separate from claim context", () => {
  const profiles = reviews.map((review) => ({
    productSlug: review.productSlug,
    profile: buildProductCareSourceProfile(review.evidenceSourceUrls),
  }));

  assert.equal(reviews.length, 163);
  assert.equal(
    profiles.filter(({ profile }) => profile.status === "claim_scoped_pair")
      .length,
    113,
  );
  assert.equal(
    profiles.filter(({ profile }) => profile.status === "single_role").length,
    41,
  );
  assert.equal(
    profiles.filter(({ profile }) => profile.status === "missing").length,
    9,
  );
  assert.equal(
    profiles.filter(({ profile }) => profile.invalidUrls.length > 0).length,
    0,
  );
  assert.equal(
    profiles.filter(({ profile }) => profile.unclassifiedUrls.length > 0)
      .length,
    0,
  );
  assert.equal(
    profiles.filter(
      ({ profile }) =>
        profile.status === "claim_scoped_pair" && profile.distinctHostCount < 2,
    ).length,
    0,
  );
});

test("public labels explain source purpose without implying product approval", () => {
  assert.equal(
    formatProductCareSourceLabel(
      "https://www.aad.org/public/diseases/acne/diy/types-breakouts",
    ),
    "Dermatology guidance · aad.org",
  );
  assert.equal(
    formatProductCareSourceLabel(
      "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=example",
    ),
    "Drug label · dailymed.nlm.nih.gov",
  );
  assert.equal(
    formatProductCareSourceLabel("https://example-brand.test/product"),
    "Source pending review · example-brand.test",
  );
});

test("unknown and discovery-only hosts cannot satisfy the evidence-pair gate", () => {
  const unknown = classifyProductCareSource(
    "https://example-brand.test/product",
  );
  assert.equal(unknown?.role, "unclassified");

  const profile = buildProductCareSourceProfile([
    "https://www.sephora.com/product/example",
    "https://www.aad.org/public/diseases/acne/diy/types-breakouts",
  ]);

  assert.equal(profile.status, "needs_review");
  assert.equal(profile.hasProductEvidence, false);
  assert.equal(profile.hasClaimContext, true);
  assert.equal(profile.unclassifiedUrls.length, 1);
});
