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
  assert.match(picker, /<span>01<\/span> Products/);
  assert.match(client, /<span>02<\/span> One-retailer baskets/);
  assert.match(results, /<span>03<\/span>[\s\S]*Request[\s\S]*quote/);
  assert.doesNotMatch(client, /<details|How Bundle Finder works/);
  assert.doesNotMatch(page, /<ol className=\{styles\.steps\}/);
  assert.match(page, /See the real one-retailer baskets available/);
});

test("bundle copy stays within verified product-price evidence", async () => {
  const files = await Promise.all([
    source("app/(site)/bundle/page.tsx"),
    source("components/commerce/bundle-finder-client.tsx"),
    source("components/commerce/bundle-results.tsx"),
    source("lib/og/social-card.tsx"),
  ]);
  const ui = files.join("\n");

  assert.match(ui, /Exact listed prices only/);
  assert.match(ui, /Product totals exclude delivery/);
  assert.match(ui, /Prices may change/);
  assert.match(ui, /Review details, then request a verified quote/);
  assert.match(ui, /Continue with \{bundle\.retailer\}/);
  assert.match(ui, /bundle\.allInStock \? \(/);
  assert.match(ui, /Availability changed/);
  assert.match(ui, /cannot continue as one basket right now/);
  assert.match(ui, /basket\.replace/);
  assert.match(ui, /CHECKOUT_RETAILER_STORAGE_KEY/);
  assert.match(ui, /router\.push\("\/checkout"\)/);
  assert.doesNotMatch(ui, /save on delivery fees/i);
  assert.doesNotMatch(ui, /one shipment/i);
  assert.doesNotMatch(ui, /cheapest combined/i);
});

test("bundle route styles are locally owned", async () => {
  const [page, picker, results, styles, globalCss] = await Promise.all([
    source("app/(site)/bundle/page.tsx"),
    source("components/commerce/bundle-product-picker.tsx"),
    source("components/commerce/bundle-results.tsx"),
    source("components/commerce/bundle-finder.module.css"),
    source("app/globals.css"),
  ]);

  assert.match(page, /bundle-finder\.module\.css/);
  assert.match(picker, /bundle-finder\.module\.css/);
  assert.match(results, /bundle-finder\.module\.css/);
  assert.match(
    styles,
    /\.productRail\s*\{[\s\S]*?margin:\s*1rem 0 0;[\s\S]*?padding:\s*0\.6rem 0\.2rem 1\.5rem;/,
  );
  assert.match(
    styles,
    /@media \(min-width: 901px\)[\s\S]*?grid-auto-columns:\s*max\(15rem, calc\(23\.53% - 1\.13rem\)\)/,
  );
  assert.match(
    styles,
    /\.selected\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/,
  );
  assert.match(
    styles,
    /@media \(max-width: 640px\)[\s\S]*?\.hero\s*\{[\s\S]*?padding:\s*1\.8rem 1rem 1\.6rem;/,
  );
  assert.match(styles, /\.stageLabel\s*\{/);
  assert.doesNotMatch(styles, /\.explainer\s*\{/);
  assert.doesNotMatch(
    globalCss,
    /\.bundle-(?:page|hero|finder|picker|row|empty)/,
  );
});

test("product-page bundle suggestions reuse image-led product cards", async () => {
  const [suggestions, styles, globalCss] = await Promise.all([
    source("components/commerce/buy-together-suggestions.tsx"),
    source("components/commerce/buy-together-suggestions.module.css"),
    source("app/globals.css"),
  ]);

  assert.match(suggestions, /<ProductCard/);
  assert.match(suggestions, /image: catalogueProduct\.image/);
  assert.match(suggestions, /together`/);
  assert.match(suggestions, /shared store/);
  assert.match(suggestions, /Product totals\s+exclude delivery/);
  assert.match(styles, /\.rail/);
  assert.doesNotMatch(suggestions, /buy-together-card/);
  assert.doesNotMatch(globalCss, /\.buy-together-card/);
});
