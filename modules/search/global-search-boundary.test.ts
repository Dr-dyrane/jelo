import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import publicCatalogueSearchArtifact from "@/data/public-catalogue-search.json";
import { buildGlobalSearchRepository } from "@/lib/search/global-search-repository";

test("global search exposes the exact public product projection and canonical categories", () => {
  const repository = buildGlobalSearchRepository();
  assert.equal(
    repository.entries.filter((entry) => entry.type === "product").length,
    publicCatalogueSearchArtifact.products.length,
  );
  assert.equal(
    repository.entries
      .filter((entry) => entry.type === "product")
      .every((entry) => Boolean(entry.image)),
    true,
  );
  assert.deepEqual(
    repository.categories.map((category) => category.label),
    ["Face care", "Body care", "Hair & scalp"],
  );
  assert.deepEqual(
    repository.categories.map((category) => category.href),
    [
      "/products?category=Face+care#all-products",
      "/products?category=Body+care#all-products",
      "/products?category=Hair+%26+scalp#all-products",
    ],
  );
});

test("retailer results use truthful source labels", () => {
  const repository = buildGlobalSearchRepository();
  for (const retailer of repository.entries.filter(
    (entry) => entry.type === "retailer",
  )) {
    assert.match(
      retailer.detail,
      /^(Direct retailer|Marketplace|Provisional source)$/,
    );
  }
});

test("company results open dedicated brand profiles", () => {
  const repository = buildGlobalSearchRepository();
  for (const company of repository.entries.filter(
    (entry) => entry.type === "company",
  )) {
    assert.match(company.href, /^\/brands\/[a-z0-9-]+$/);
  }
});

test("header routes every search entry point to the global search page and the old overlay is retired", () => {
  const root = process.cwd();
  const header = readFileSync(
    path.join(root, "components/navigation/site-header.tsx"),
    "utf8",
  );
  assert.match(header, /router\.push\("\/search"\)/);
  assert.match(header, /event\.key === "\/"/);
  assert.match(header, /event\.metaKey \|\| event\.ctrlKey/);
  assert.doesNotMatch(header, /MobileSearchOverlay|mobile-search-overlay/);
});
