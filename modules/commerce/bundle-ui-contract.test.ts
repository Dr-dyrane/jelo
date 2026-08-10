import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function source(file: string) {
  return readFile(path.join(process.cwd(), file), "utf8");
}

test("bundle route reuses public product cards and the catalogue search ranker", async () => {
  const [page, client, picker, results] = await Promise.all([
    source("app/(site)/bundle/page.tsx"),
    source("components/commerce/bundle-finder-client.tsx"),
    source("components/commerce/bundle-product-picker.tsx"),
    source("components/commerce/bundle-results.tsx"),
  ]);

  assert.match(page, /normaliseSlugs/);
  assert.match(page, /\.slice\(0, 4\)/);
  assert.match(picker, /rankCatalogueSearchRecords/);
  assert.match(picker, /<ProductCard/);
  assert.match(picker, /Start with a product/);
  assert.match(results, /<ProductCard/);
  assert.match(results, /priceLabel: formatNaira\.format\(offer\.priceNgn\)/);
  assert.match(client, /role="status" aria-live="polite"/);
  assert.match(client, /Clear selection/);
});

test("bundle copy stays within verified product-price evidence", async () => {
  const files = await Promise.all([
    source("app/(site)/bundle/page.tsx"),
    source("components/commerce/bundle-finder-client.tsx"),
    source("components/commerce/bundle-results.tsx"),
  ]);
  const ui = files.join("\n");

  assert.match(ui, /Exact listed prices only/);
  assert.match(ui, /Product totals exclude delivery/);
  assert.match(ui, /Prices may change/);
  assert.doesNotMatch(ui, /save on delivery fees/i);
  assert.doesNotMatch(ui, /one shipment/i);
  assert.doesNotMatch(ui, /cheapest combined/i);
});

test("bundle route styles are locally owned", async () => {
  const [page, picker, results, globalCss] = await Promise.all([
    source("app/(site)/bundle/page.tsx"),
    source("components/commerce/bundle-product-picker.tsx"),
    source("components/commerce/bundle-results.tsx"),
    source("app/globals.css"),
  ]);

  assert.match(page, /bundle-finder\.module\.css/);
  assert.match(picker, /bundle-finder\.module\.css/);
  assert.match(results, /bundle-finder\.module\.css/);
  assert.doesNotMatch(
    globalCss,
    /\.bundle-(?:page|hero|finder|picker|row|empty)/,
  );
});
