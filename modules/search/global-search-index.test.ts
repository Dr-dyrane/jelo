import assert from "node:assert/strict";
import test from "node:test";
import {
  searchGlobalIndex,
  type GlobalSearchEntry,
} from "@/lib/search/global-search-index";

const entries: GlobalSearchEntry[] = [
  {
    id: "product:1",
    type: "product",
    label: "Niacinamide Serum",
    detail: "Acme · 30 ml",
    href: "/products/1",
    keywords: ["tone"],
  },
  {
    id: "ingredient:1",
    type: "ingredient",
    label: "Niacinamide",
    detail: "Vitamin B3 ingredient",
    href: "/ingredients#niacinamide",
    keywords: ["barrier", "tone"],
  },
  {
    id: "guide:1",
    type: "guide",
    label: "Dark spots",
    detail: "Face guide",
    href: "/concerns/dark-spots",
    keywords: ["uneven tone", "niacinamide"],
  },
];

test("global search ranks exact labels before related keyword matches", () => {
  const results = searchGlobalIndex(entries, "niacinamide");
  assert.deepEqual(
    results.map((result) => result.id),
    ["ingredient:1", "product:1", "guide:1"],
  );
});

test("global search applies only the requested result-type filter", () => {
  const results = searchGlobalIndex(entries, "niacinamide", "guide");
  assert.deepEqual(
    results.map((result) => result.type),
    ["guide"],
  );
});

test("global search requires every query token and returns no empty-query results", () => {
  assert.equal(searchGlobalIndex(entries, "").length, 0);
  assert.deepEqual(
    searchGlobalIndex(entries, "dark tone").map((result) => result.id),
    ["guide:1"],
  );
});
