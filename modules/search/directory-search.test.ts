import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  filterDirectorySuggestions,
  type DirectorySearchItem,
} from "@/components/directory/directory-search";

const items: DirectorySearchItem[] = [
  {
    href: "/brands/cerave",
    name: "CeraVe",
    detail: "12 products · 2 care areas",
    searchText: "Face care Body care",
  },
  {
    href: "/brands/la-roche-posay",
    name: "La Roche-Posay",
    detail: "5 products · 1 care area",
    searchText: "Face care",
  },
];

test("directory suggestions update from incomplete, normalized query tokens", () => {
  assert.deepEqual(filterDirectorySuggestions(items, "cera"), [items[0]]);
  assert.deepEqual(filterDirectorySuggestions(items, "roche face"), [items[1]]);
  assert.deepEqual(filterDirectorySuggestions(items, ""), items);
  assert.equal(filterDirectorySuggestions(items, "hair").length, 0);
});

test("brand and retailer directories keep search local and profile backs contextual", async () => {
  const root = process.cwd();
  const [
    brands,
    retailers,
    retailerDirectory,
    brandProfile,
    retailerProfile,
    layout,
  ] = await Promise.all([
    readFile(path.join(root, "app/(site)/brands/page.tsx"), "utf8"),
    readFile(path.join(root, "app/(site)/retailers/page.tsx"), "utf8"),
    readFile(
      path.join(root, "components/retailers/retailer-directory.tsx"),
      "utf8",
    ),
    readFile(path.join(root, "app/(site)/brands/[slug]/page.tsx"), "utf8"),
    readFile(path.join(root, "app/(site)/retailers/[slug]/page.tsx"), "utf8"),
    readFile(path.join(root, "app/(site)/layout.tsx"), "utf8"),
  ]);

  assert.match(brands, /<DirectoryTypeahead/);
  assert.doesNotMatch(brands, /action="\/search"/);
  assert.match(retailers, /<RetailerDirectory items=\{directoryItems\} \/>/);
  assert.match(retailerDirectory, /<DirectoryTypeahead/);
  assert.match(retailerDirectory, /onValueChange=\{setQuery\}/);
  assert.match(brandProfile, /fallbackHref="\/brands"/);
  assert.match(retailerProfile, /fallbackHref="\/retailers"/);
  assert.match(layout, /<NavigationMemory \/>/);
});
