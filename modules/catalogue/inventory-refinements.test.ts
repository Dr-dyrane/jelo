import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { InventoryResult } from "@/lib/catalogue/inventory-query";
import {
  inventoryRefinementPlan,
  withActiveCompanyFacet,
} from "@/lib/catalogue/inventory-refinements";

function context(
  filterOverrides: Partial<InventoryResult["filters"]> = {},
  browse = "category",
) {
  const filters: InventoryResult["filters"] = {
    q: "",
    category: "All",
    review: "all",
    sort: "featured",
    concern: "",
    step: "",
    brand: "",
    availability: "all",
    price: "all",
    market: "NG",
    ...filterOverrides,
  };
  const facets: InventoryResult["facets"] = {
    categories: [
      { value: "Face care", count: 6 },
      { value: "Hair & scalp", count: 0 },
      { value: "Body care", count: 4 },
    ],
    brands: [
      { value: "Alpha", count: 4 },
      { value: "Beta", count: 6 },
    ],
    steps: [
      { value: "Cleanse", count: 5 },
      { value: "Moisturise", count: 3 },
    ],
    concerns: [
      {
        value: "acne-breakouts",
        label: "Acne & breakouts",
        count: 2,
        total: 4,
      },
      {
        value: "atopic-eczema-pattern",
        label: "Eczema-like pattern",
        count: 0,
        total: 0,
      },
    ],
    reviewed: 10,
    supportive: 2,
    community: 0,
    priced: 6,
    priceScope: 10,
    priceBands: { low: 2, mid: 2, high: 2 },
  };
  return { filters, facets, browse, total: 10 };
}

test("orders only useful groups for each explicit browse context", () => {
  assert.deepEqual(inventoryRefinementPlan(context()).primary, [
    "category",
    "company",
    "availability",
    "price",
  ]);
  assert.deepEqual(inventoryRefinementPlan(context({}, "routine")).primary, [
    "routine",
    "category",
    "company",
    "availability",
  ]);
  assert.deepEqual(inventoryRefinementPlan(context({}, "concern")).primary, [
    "concern",
    "category",
    "company",
    "availability",
  ]);
  assert.deepEqual(inventoryRefinementPlan(context()).secondary, [
    "routine",
    "concern",
    "source",
    "order",
  ]);
});

test("query context stays deterministic and never promotes concern language into product matching", () => {
  const eczema = inventoryRefinementPlan(context({ q: "eczema" }, "category"));
  const moisturiser = inventoryRefinementPlan(
    context({ q: "moisturiser" }, "category"),
  );

  assert.deepEqual(eczema, moisturiser);
  assert.deepEqual(eczema.primary, [
    "company",
    "category",
    "availability",
    "price",
  ]);
  assert.ok(!eczema.primary.includes("concern"));
  assert.ok(eczema.secondary.includes("concern"));
});

test("keeps every active group visible even when its current count is zero", () => {
  const current = context({
    q: "no current match",
    category: "Hair & scalp",
    review: "community",
    sort: "newest",
    concern: "acne-breakouts",
    step: "Protect",
    brand: "Selected company",
    availability: "priced",
    price: "high",
  });
  current.total = 0;
  current.facets.categories = current.facets.categories.map((facet) => ({
    ...facet,
    count: 0,
  }));
  current.facets.brands = [];
  current.facets.steps = current.facets.steps.map((facet) => ({
    ...facet,
    count: 0,
  }));
  current.facets.concerns = current.facets.concerns.map((facet) => ({
    ...facet,
    count: 0,
  }));
  current.facets.reviewed = 0;
  current.facets.supportive = 0;
  current.facets.community = 0;
  current.facets.priced = 0;
  current.facets.priceScope = 0;
  current.facets.priceBands = { low: 0, mid: 0, high: 0 };

  const plan = inventoryRefinementPlan(current);
  assert.deepEqual(
    new Set(plan.primary),
    new Set([
      "category",
      "routine",
      "company",
      "concern",
      "source",
      "availability",
      "price",
      "order",
    ]),
  );
  assert.deepEqual(plan.secondary, []);
  assert.deepEqual(withActiveCompanyFacet([], "Selected company"), [
    { value: "Selected company", count: 0 },
  ]);
});

test("the disclosure and nested choices preserve keyboard and focus affordances", async () => {
  const source = await readFile(
    path.join(process.cwd(), "components/products/inventory-filter-sheet.tsx"),
    "utf8",
  );

  assert.match(source, /aria-expanded=\{showAllRefinements\}/);
  assert.match(source, /aria-controls="catalogue-all-refinements"/);
  assert.match(
    source,
    /id="catalogue-all-refinements"[\s\S]*hidden=\{!showAllRefinements\}/,
  );
  assert.ok(
    source.indexOf('aria-controls="catalogue-all-refinements"') <
      source.indexOf('id="catalogue-all-refinements"'),
  );
  assert.ok(
    (source.match(/setShowAllRefinements\(false\)/g) ?? []).length >= 2,
  );
  assert.match(source, /companySearchRef\.current\?\.focus\(\)/);
  assert.match(
    source,
    /previous === "concerns"[\s\S]*\? concernButtonRef\.current\?\.focus\(\)[\s\S]*: companyButtonRef\.current\?\.focus\(\)/,
  );
  assert.match(source, /aria-modal="true"/);
});
