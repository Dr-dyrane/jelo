import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function source(file: string) {
  return readFile(path.join(process.cwd(), file), "utf8");
}

test("basket presents the selected retailer and checkout action before bounded alternatives", async () => {
  const basket = await source("components/commerce/procurement-basket.tsx");

  const selectedPosition = basket.indexOf("Selected retailer");
  const continuePosition = basket.indexOf("Continue to checkout");
  const alternativesPosition = basket.indexOf("Other stores");

  assert.ok(selectedPosition >= 0);
  assert.ok(continuePosition > selectedPosition);
  assert.ok(alternativesPosition > continuePosition);
  assert.match(basket, /alternativeOptions\.slice\(0, 2\)/);
  assert.match(basket, /More stores \(\$\{hiddenAlternativeCount\}\)/);
  assert.match(basket, /aria-expanded=\{showMoreStores\}/);
  assert.match(
    basket,
    /chooseRetailerBasketOption\(options, preferredRetailer\)/,
  );
});

test("basket keeps exact products ahead of retailer commitment on mobile", async () => {
  const basket = await source("components/commerce/procurement-basket.tsx");
  const styles = await source("components/commerce/procurement.module.css");

  assert.ok(
    basket.indexOf("basketProducts") < basket.indexOf("retailerChoice"),
  );
  assert.match(basket, /Confirm exact products/);
  assert.match(basket, /Choose a retailer\./);
  assert.doesNotMatch(basket, /Continue with \$\{chosen\.retailer\}/);
  assert.match(
    styles,
    /\.quantity button\s*\{[\s\S]*?width:\s*2\.75rem;[\s\S]*?height:\s*2\.75rem;/,
  );
  assert.doesNotMatch(styles, /\.basketLayout \.retailerChoice\s*\{\s*order:/);
  assert.match(styles, /\.moreStores\s*\{[\s\S]*?min-height:\s*2\.75rem;/);
});
