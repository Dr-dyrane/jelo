import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("public chrome derives standard and immersive route starts from one header contract", async () => {
  const [globals, header, platform, productExperience] = await Promise.all([
    source("app/globals.css"),
    source("components/navigation/site-header.module.css"),
    source("app/platform.css"),
    source("app/product-experience.css"),
  ]);

  assert.match(
    globals,
    /--site-chrome-safe-top:\s*max\(0\.9rem, env\(safe-area-inset-top, 0px\)\)/,
  );
  assert.match(globals, /--site-chrome-header-height:\s*4\.1rem/);
  assert.match(globals, /--site-chrome-content-gap:\s*12px/);
  assert.match(globals, /--site-chrome-immersive-gap:\s*4px/);
  assert.match(
    globals,
    /--site-chrome-header-bottom:\s*calc\([\s\S]*?--site-chrome-safe-top[\s\S]*?--site-chrome-header-height[\s\S]*?\)/,
  );
  assert.match(
    globals,
    /@media \(max-width: 700px\)[\s\S]*?html\s*\{[\s\S]*?--site-chrome-safe-top:\s*max\(0\.7rem, env\(safe-area-inset-top, 0px\)\)[\s\S]*?--site-chrome-header-height:\s*3\.8rem/,
  );

  assert.match(header, /inset:\s*var\(--site-chrome-safe-top\) 1\.2rem auto/);
  assert.match(header, /height:\s*var\(--site-chrome-header-height\)/);
  assert.match(
    platform,
    /\.product-page\{padding-top:var\(--site-chrome-immersive-start\)\}/,
  );
  assert.doesNotMatch(platform, /\.product-page\{padding-top:4\.75rem\}/);
  assert.match(
    productExperience,
    /top:\s*var\(--site-chrome-immersive-start\)/,
  );
  assert.match(
    productExperience,
    /height:\s*calc\(100svh - var\(--site-chrome-immersive-start\)\)/,
  );
  assert.match(
    header,
    /\.menuDialog\s*\{[\s\S]*?inset:\s*auto 0\.75rem var\(--site-chrome-safe-bottom\)/,
  );
  assert.equal(
    (
      header.match(
        /100dvh - var\(--site-chrome-safe-top\) - var\(--site-chrome-safe-bottom\)/g,
      ) ?? []
    ).length,
    2,
  );
  assert.match(
    header,
    /\.menuDialog\[data-fallback-modal="true"\][\s\S]*?padding:\s*var\(--site-chrome-safe-top\) 0\.75rem[\s\S]*?var\(--site-chrome-safe-bottom\)/,
  );
});

test("public commerce pages use the standard header clearance and shared bottom inset", async () => {
  const [globals, procurement, order, pill] = await Promise.all([
    source("app/globals.css"),
    source("components/commerce/procurement.module.css"),
    source("components/commerce/order-status.module.css"),
    source("components/commerce/public-basket-pill.module.css"),
  ]);

  assert.match(
    procurement,
    /\.page\s*\{[\s\S]*?padding:\s*var\(--site-chrome-content-start\)/,
  );
  assert.match(
    order,
    /\.page\s*\{[\s\S]*?padding:\s*var\(--site-chrome-content-start\)/,
  );
  assert.match(
    globals,
    /--site-chrome-safe-bottom:\s*calc\([\s\S]*?--site-chrome-content-gap[\s\S]*?env\(safe-area-inset-bottom, 0px\)[\s\S]*?\)/,
  );
  assert.match(pill, /bottom:\s*var\(--site-chrome-safe-bottom\)/);
  assert.equal(
    (procurement.match(/top:\s*var\(--site-chrome-content-start\)/g) ?? [])
      .length,
    2,
  );
  assert.match(
    order,
    /\.quoteCard\s*\{[\s\S]*?top:\s*var\(--site-chrome-content-start\)/,
  );
});

test("shared modal dialogs close Escape consistently in native and fallback browsers", async () => {
  const modalController = await source("components/ui/use-modal-dialog.ts");

  assert.match(
    modalController,
    /if \(event\.key === ["']Escape["']\) \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?close\(\);/,
  );
  assert.doesNotMatch(
    modalController,
    /event\.key === ["']Escape["'] && dialogElement\.dataset\.fallbackModal/,
  );
});
