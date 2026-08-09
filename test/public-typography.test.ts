import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

const publicTypographySources = [
  "app/(site)/contribute/contribute.module.css",
  "app/(site)/products/products.module.css",
  "components/products/catalogue-search.module.css",
  "components/products/inventory-card.module.css",
  "components/products/inventory-filter-sheet.module.css",
  "components/ui/adaptive-selector.module.css",
] as const;

function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("current public surfaces keep subtle labels in sentence case", async () => {
  const sources = await Promise.all(
    publicTypographySources.map(async (relativePath) => ({
      relativePath,
      source: await readSource(relativePath),
    })),
  );

  for (const { relativePath, source } of sources) {
    assert.doesNotMatch(
      source,
      /text-transform:\s*uppercase/i,
      `${relativePath} must not force interface copy to uppercase`,
    );

    for (const match of source.matchAll(
      /letter-spacing:\s*([+-]?(?:\d*\.)?\d+)(em|rem|px)/gi,
    )) {
      assert.ok(
        Number(match[1]) <= 0,
        `${relativePath} must not use expanded label tracking (${match[0]})`,
      );
    }
  }
});

test("public eyebrows, filter labels, card signals, and selection labels stay regular", async () => {
  const [contribute, products, search, card, filterSheet, adaptiveSelector] =
    await Promise.all(publicTypographySources.map(readSource));

  assert.match(
    contribute,
    /\.heroCopy\s*>\s*p[\s\S]*?\.complete\s*>\s*p:first-of-type\s*\{[^}]*font-weight:\s*var\(--weight-regular\)/,
  );
  assert.match(
    contribute,
    /\.boundary\s+p\s*\{[^}]*font-weight:\s*var\(--weight-regular\)/,
  );
  assert.match(
    products,
    /\.kicker[\s\S]*?\.storyCopy\s*>\s*p\s*\{[^}]*font-weight:\s*var\(--weight-regular\)/,
  );
  assert.match(
    search,
    /\.suggestionHeading > span\s*\{[^}]*font-weight:\s*var\(--weight-regular\)/,
  );
  assert.match(
    search,
    /\.suggestionList small\s*\{[^}]*font-weight:\s*var\(--weight-regular\)/,
  );
  assert.match(
    card,
    /\.copy\s*>\s*p\s*\{[^}]*font-weight:\s*var\(--weight-regular\)/,
  );
  assert.match(
    filterSheet,
    /\.sheet header small\s*\{[^}]*font-weight:\s*var\(--weight-regular\)/,
  );
  assert.match(
    filterSheet,
    /\.sheet legend\s*\{[^}]*font-weight:\s*var\(--weight-regular\)/,
  );
  assert.match(
    filterSheet,
    /\.guideOnly > p\s*\{[^}]*font-weight:\s*var\(--weight-regular\)/,
  );
  assert.match(
    adaptiveSelector,
    /\.selectedBlock\s*>\s*p\s*\{[^}]*font-weight:\s*var\(--weight-regular\)/,
  );
});
