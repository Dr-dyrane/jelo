import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function source(file: string) {
  return readFile(path.join(process.cwd(), file), "utf8");
}

test("mobile product rails expose the complete terminal card", async () => {
  const [storefront, bundle, buyTogether, products] = await Promise.all([
    source("app/storefront.css"),
    source("components/commerce/bundle-finder.module.css"),
    source("components/commerce/buy-together-suggestions.module.css"),
    source("app/(site)/products/products.module.css"),
  ]);

  assert.match(
    storefront,
    /\.product-rail\s*\{[\s\S]*?scroll-padding-inline:\s*4vw;/,
  );
  assert.match(
    storefront,
    /\.product-rail\s*>\s*:last-child\s*\{\s*scroll-snap-align:\s*end;/,
  );
  assert.match(
    storefront,
    /@media \(max-width:\s*700px\)[\s\S]*?\.product-rail\s*\{[\s\S]*?scroll-padding-inline:\s*1rem;/,
  );
  assert.match(
    bundle,
    /@media \(max-width:\s*640px\)[\s\S]*?\.productRail\s*\{[\s\S]*?scroll-padding-inline:\s*0\.85rem;/,
  );
  assert.match(
    buyTogether,
    /@media \(max-width:\s*720px\)[\s\S]*?\.rail\s*\{[\s\S]*?scroll-padding-inline:\s*1rem;[\s\S]*?\.rail\s*>\s*:last-child\s*\{\s*scroll-snap-align:\s*end;/,
  );
  assert.match(
    products,
    /\.browseRail\s*\{[\s\S]*?--browse-rail-gutter:\s*4vw;[\s\S]*?padding:\s*0\.35rem var\(--browse-rail-gutter\) 1\.2rem;[\s\S]*?scroll-padding-inline:\s*var\(--browse-rail-gutter\);/,
  );
  assert.match(
    products,
    /mask-image:\s*linear-gradient\([\s\S]*?#000 var\(--browse-rail-gutter\),[\s\S]*?#000 calc\(100% - var\(--browse-rail-gutter\)\),/,
  );
  assert.match(
    products,
    /\.browseRail\s*>\s*:last-child\s*\{\s*scroll-snap-align:\s*end;/,
  );
  assert.match(
    products,
    /@media \(max-width:\s*640px\)[\s\S]*?\.browseRail\s*\{[\s\S]*?--browse-rail-gutter:\s*1rem;/,
  );
});
