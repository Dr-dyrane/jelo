import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("My JeloCare carries the device basket without creating a second store", async () => {
  const [layout, pill, pillStyles] = await Promise.all([
    source("app/(customer)/me/layout.tsx"),
    source("components/commerce/public-basket-pill.tsx"),
    source("components/commerce/public-basket-pill.module.css"),
  ]);

  assert.match(layout, /<BasketProvider>/);
  assert.match(
    layout,
    /<PublicBasketPill products=\{basketProducts\} surface="workspace" \/>/,
  );
  assert.doesNotMatch(layout, /BASKET_STORAGE_KEY|localStorage/);
  assert.match(pill, /surface\?: "public" \| "workspace"/);
  assert.match(pill, /data-surface=\{surface\}/);
  assert.match(
    pillStyles,
    /\.positioner\[data-surface="workspace"\][\s\S]*8\.5rem/,
  );
});

test("exact Shelf products add to the existing retailer-scoped basket", async () => {
  const [shelf, product] = await Promise.all([
    source("components/me/shelf/shelf-view.tsx"),
    source("components/me/product/member-product-view.tsx"),
  ]);

  assert.match(shelf, /item\.product\.freshExactRetailerNames\.length/);
  assert.match(shelf, /<AddToBasketButton/);
  assert.match(shelf, /iconOnly/);
  assert.match(product, /product\.freshExactRetailerNames\.map/);
  assert.match(product, /<AddToBasketButton/);
  assert.match(product, /retailerShoppingSlug\(name\)/);
  assert.match(
    await source("components/commerce/add-to-basket-button.tsx"),
    /Review basket store/,
  );
});
