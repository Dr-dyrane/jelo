import assert from "node:assert/strict";
import test from "node:test";
import { concerns } from "@/data/knowledge";
import {
  catalogueGuideSearchSuggestions,
  matchingCatalogueSearchSuggestions,
  type CatalogueSearchSuggestion,
} from "@/components/products/catalogue-search-suggestions";

const suggestions: CatalogueSearchSuggestion[] = [
  {
    kind: "category",
    label: "Face care",
    detail: "8 products",
    href: "/products?category=Face+care",
  },
  {
    kind: "guide",
    label: "Oily and congested skin",
    detail: "Concern guide",
    href: "/concerns/oily-congested-skin",
    keywords: ["oiliness", "acne"],
  },
  {
    kind: "company",
    label: "CeraVe",
    detail: "4 products",
    href: "/products?brand=CeraVe",
  },
  {
    kind: "product",
    label: "Hydrating Cleanser",
    detail: "CeraVe",
    href: "/products/cerave-hydrating-cleanser",
    keywords: ["473 ml"],
  },
  {
    kind: "product",
    label: "Niacinamide 10% + TXA 4% Serum",
    detail: "Anua",
    href: "/products/anua-niacinamide",
    keywords: ["30 ml"],
  },
];

test("catalogue search suggestions rank exact labels before related products", () => {
  const matches = matchingCatalogueSearchSuggestions(suggestions, "cerave");
  assert.deepEqual(
    matches.map((item) => item.kind),
    ["company", "product"],
  );
  assert.equal(matches[0]?.label, "CeraVe");
});

test("catalogue search suggestions normalize punctuation and use reviewed guide terms", () => {
  assert.equal(
    matchingCatalogueSearchSuggestions(suggestions, "niacinamide txa")[0]
      ?.label,
    "Niacinamide 10% + TXA 4% Serum",
  );
  assert.equal(
    matchingCatalogueSearchSuggestions(suggestions, "oiliness")[0]?.href,
    "/concerns/oily-congested-skin",
  );
  assert.deepEqual(
    matchingCatalogueSearchSuggestions(suggestions, "eczema"),
    [],
  );
});

test("short brand prefixes do not leak through unrelated substrings", () => {
  const ulcerGuide: CatalogueSearchSuggestion = {
    kind: "guide",
    label: "Painless swelling or ulcer",
    detail: "Body guide",
    href: "/concerns/painless-ulcer-pattern",
    keywords: ["ulcer"],
  };
  const matches = matchingCatalogueSearchSuggestions(
    [...suggestions, ulcerGuide],
    "cer",
  );

  assert.deepEqual(
    matches.map((item) => item.label),
    ["CeraVe", "Hydrating Cleanser"],
  );
  assert.equal(
    matches.some((item) => item.href === ulcerGuide.href),
    false,
  );
});

test("catalogue search suggestions stay compact and deduplicate destinations", () => {
  const repeated = [...suggestions, suggestions[0]];
  assert.deepEqual(
    matchingCatalogueSearchSuggestions(repeated, "", 3).map(
      (item) => item.href,
    ),
    suggestions.slice(0, 3).map((item) => item.href),
  );
});

test("every public guide stays eligible for local typeahead", () => {
  const guideSuggestions = catalogueGuideSearchSuggestions(concerns);
  const lateGuide = concerns.at(-1);

  assert.ok(concerns.length >= 58);
  assert.equal(guideSuggestions.length, concerns.length);
  assert.ok(lateGuide);
  assert.equal(
    matchingCatalogueSearchSuggestions(guideSuggestions, lateGuide.name)[0]
      ?.href,
    `/concerns/${lateGuide.slug}`,
  );
});

test("an exact guide alias ranks before products and stays explicitly neutral", () => {
  const guideSuggestions = catalogueGuideSearchSuggestions(concerns);
  const product: CatalogueSearchSuggestion = {
    kind: "product",
    label: "Acne",
    detail: "Example treatment",
    href: "/products/example-acne",
  };
  const matches = matchingCatalogueSearchSuggestions(
    [product, ...guideSuggestions],
    "acne",
  );

  assert.equal(matches[0]?.href, "/concerns/acne-breakouts");
  assert.match(matches[0]?.detail ?? "", /Not a recommendation/);
  assert.equal(matches[1]?.href, product.href);
});
