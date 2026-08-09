import assert from "node:assert/strict";
import test from "node:test";
import { products as catalogueProducts } from "@/data/catalogue";
import { concernBySlug, concerns } from "@/data/knowledge";
import { getReviewedProductCare } from "@/data/product-care-review";
import {
  isProductMatchConcern,
  productMatchesConcern,
  productReferencesConcern,
  productsLinkedToConcern,
  productsWithReviewedConcernLinks,
  rankProductsForConcerns,
  rankReviewedContextForConcerns,
} from "./product-matching";

function product(slug: string) {
  const match = catalogueProducts.find((item) => item.slug === slug);
  assert.ok(match, `Missing product fixture: ${slug}`);
  return match;
}

function concern(slug: string) {
  const match = concernBySlug(slug);
  assert.ok(match, `Missing concern fixture: ${slug}`);
  return match;
}

test("concern matching uses approved supportive uses, not catalogue concern prose", () => {
  const cleanser = product("cerave-foaming-facial-cleanser");
  assert.equal(
    productMatchesConcern(cleanser, concern("acne-breakouts")),
    false,
  );
  assert.equal(
    productMatchesConcern(cleanser, concern("oily-congested-skin")),
    true,
  );

  const snail = product("cosrx-advanced-snail-96-mucin-power-essence");
  assert.equal(
    productMatchesConcern(snail, concern("sensitive-barrier")),
    false,
  );
});

test("daily sun protection matches only the explicitly reviewed sunscreen", () => {
  const dailySun = concern("daily-sun-protection");
  const references = catalogueProducts.filter((candidate) =>
    productReferencesConcern(candidate, dailySun),
  );
  const matches = catalogueProducts.filter((candidate) =>
    productMatchesConcern(candidate, dailySun),
  );

  assert.equal(dailySun.kind, "concern");
  assert.deepEqual(
    references.map((candidate) => candidate.slug),
    ["eucerin-oil-control-sun-gel-cream-spf50-50ml"],
  );
  assert.deepEqual(
    matches.map((candidate) => candidate.slug),
    ["eucerin-oil-control-sun-gel-cream-spf50-50ml"],
  );
});

test("pharmacist-review products never enter direct concern matches", () => {
  const cleanser = product("cerave-blemish-control-cleanser");
  assert.equal(
    productMatchesConcern(cleanser, concern("acne-breakouts")),
    false,
  );
  assert.equal(
    productReferencesConcern(cleanser, concern("acne-breakouts")),
    true,
  );
});

test("concern links separate supportive products from pharmacist-review context", () => {
  const acne = concern("acne-breakouts");
  const linked = productsLinkedToConcern(catalogueProducts, acne);

  assert.deepEqual(linked.supportive, []);
  assert.ok(linked.reviewedContext.length > 0);
  assert.ok(
    linked.reviewedContext.some(
      (candidate) => candidate.slug === "cerave-blemish-control-cleanser",
    ),
  );
});

test("ordinary concern coverage keeps the audited two-tier catalogue matrix", () => {
  const expected = [
    ["acne-breakouts", 0, 12, 92],
    ["dark-spots", 0, 6, 98],
    ["sensitive-barrier", 3, 0, 101],
    ["dry-dehydrated-skin", 5, 0, 99],
    ["dry-rough-body-skin", 6, 0, 37],
    ["sweat-body-odour", 1, 0, 42],
    ["oily-congested-skin", 3, 2, 99],
    ["daily-sun-protection", 1, 0, 103],
    ["dandruff-itchy-scalp", 0, 1, 10],
    ["dry-frizzy-hair", 5, 0, 6],
  ];

  const actual = concerns.filter(isProductMatchConcern).map((item) => {
    const areaProducts = catalogueProducts.filter((candidate) => {
      if (item.area === "Face") return candidate.category === "Face";
      if (item.area === "Body") return candidate.category === "Body";
      return candidate.category === "Hair";
    });
    const linked = productsLinkedToConcern(areaProducts, item);
    return [
      item.slug,
      linked.supportive.length,
      linked.reviewedContext.length,
      areaProducts.length -
        linked.supportive.length -
        linked.reviewedContext.length,
    ];
  });

  assert.deepEqual(actual, expected);
});

test("server concern payload keeps only exact reviewed ordinary-concern links", () => {
  const linked = productsWithReviewedConcernLinks(catalogueProducts, concerns);

  assert.equal(linked.length, 38);
  assert.equal(
    linked.every((candidate) =>
      concerns.some((item) => productReferencesConcern(candidate, item)),
    ),
    true,
  );
  assert.equal(
    linked.some(
      (candidate) =>
        getReviewedProductCare(candidate.slug)?.careState ===
        "insufficient_data",
    ),
    false,
  );
});

test("multi-concern rankings deduplicate products inside each care tier", () => {
  const linked = productsWithReviewedConcernLinks(catalogueProducts, concerns);
  const careCleared = rankProductsForConcerns(linked, concerns, [
    "oily-congested-skin",
    "daily-sun-protection",
  ]);
  const reviewedContext = rankReviewedContextForConcerns(linked, concerns, [
    "acne-breakouts",
    "dark-spots",
  ]);

  assert.equal(careCleared.length, 3);
  assert.equal(new Set(careCleared.map((item) => item.product.slug)).size, 3);
  assert.deepEqual(
    careCleared.find(
      (item) =>
        item.product.slug === "eucerin-oil-control-sun-gel-cream-spf50-50ml",
    )?.matchedConcernSlugs,
    ["oily-congested-skin", "daily-sun-protection"],
  );

  assert.equal(reviewedContext.length, 16);
  assert.equal(
    new Set(reviewedContext.map((item) => item.product.slug)).size,
    16,
  );
  assert.deepEqual(
    reviewedContext.find(
      (item) => item.product.slug === "dang-azelaic-acid-serum-30ml",
    )?.matchedConcernSlugs,
    ["acne-breakouts", "dark-spots"],
  );
});

test("a zero-direct concern retains pharmacist-reviewed context", () => {
  const linked = productsWithReviewedConcernLinks(catalogueProducts, concerns);
  const selected = ["acne-breakouts"];

  assert.equal(rankProductsForConcerns(linked, concerns, selected).length, 0);
  assert.equal(
    rankReviewedContextForConcerns(linked, concerns, selected).length,
    12,
  );
});

test("condition patterns cannot match products even if an approved slug is reused", () => {
  const cleanser = product("cerave-foaming-facial-cleanser");
  const approvedConcern = concern("oily-congested-skin");
  const adversarialPattern = {
    ...approvedConcern,
    kind: "condition-pattern" as const,
    clinicalPatternIds: ["adversarial-test-pattern"],
    productTerms: [],
  };

  assert.equal(productMatchesConcern(cleanser, adversarialPattern), false);
  assert.equal(productReferencesConcern(cleanser, adversarialPattern), false);
});

test("every published condition pattern is product-ineligible", () => {
  const conditionPatterns = concerns.filter(
    (item) => item.kind === "condition-pattern",
  );

  for (const pattern of conditionPatterns) {
    for (const candidate of catalogueProducts) {
      assert.equal(
        productMatchesConcern(candidate, pattern),
        false,
        `${pattern.slug} matched ${candidate.slug}`,
      );
      assert.equal(
        productReferencesConcern(candidate, pattern),
        false,
        `${pattern.slug} referenced ${candidate.slug}`,
      );
    }
  }
});

test("condition patterns never enter mixed concern ranking", () => {
  const supportiveConcern = concern("oily-congested-skin");
  const conditionPattern = concern("leprosy-pattern");
  const cleanser = product("cerave-foaming-facial-cleanser");

  assert.equal(isProductMatchConcern(supportiveConcern), true);
  assert.equal(isProductMatchConcern(conditionPattern), false);
  assert.deepEqual(
    rankProductsForConcerns([cleanser], concerns, [
      supportiveConcern.slug,
      conditionPattern.slug,
    ]),
    [
      {
        product: cleanser,
        index: 0,
        matchedConcernSlugs: [supportiveConcern.slug],
      },
    ],
  );
  assert.deepEqual(
    rankProductsForConcerns([cleanser], concerns, [conditionPattern.slug]),
    [],
  );
  assert.deepEqual(
    rankReviewedContextForConcerns(catalogueProducts, concerns, [
      conditionPattern.slug,
    ]),
    [],
  );
});
