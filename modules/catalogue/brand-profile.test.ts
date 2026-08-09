import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { products } from "@/data/catalogue";
import {
  brandProfileHref,
  brandSlug,
  buildBrandDirectory,
  buildBrandProfile,
} from "@/lib/catalogue/brand-profile";
import { buildGlobalSearchRepository } from "@/lib/search/global-search-repository";

test("brand profiles group canonical aliases into one stable public route", () => {
  assert.equal(brandSlug("DANG"), "dang-lifestyle");
  assert.equal(brandSlug("Dang! Lifestyle Inc."), "dang-lifestyle");
  assert.equal(brandProfileHref("DANG! Lifestyle"), "/brands/dang-lifestyle");

  const profile = buildBrandProfile(
    "dang-lifestyle",
    products,
    new Date("2026-08-09T12:00:00Z"),
  );
  assert.ok(profile);
  assert.equal(profile.name, "DANG! Lifestyle");
  assert.equal(profile.productCount, 3);
  assert.deepEqual(
    profile.products.map((product) => product.brand),
    ["DANG! Lifestyle", "DANG! Lifestyle", "DANG! Lifestyle"],
  );
  assert.equal(profile.ownRetailer?.href, "/retailers/dang-lifestyle");
});

test("brand directory covers every public product once after alias normalization", () => {
  const directory = buildBrandDirectory(
    products,
    new Date("2026-08-09T12:00:00Z"),
  );
  assert.equal(
    new Set(directory.map((profile) => profile.slug)).size,
    directory.length,
  );
  assert.equal(
    directory.reduce((total, profile) => total + profile.productCount, 0),
    products.length,
  );
  assert.equal(
    directory.find((profile) => profile.slug === "dang-lifestyle")?.name,
    "DANG! Lifestyle",
  );
});

test("company search results and product pages expose canonical brand entry points", () => {
  const repository = buildGlobalSearchRepository();
  const dang = repository.entries.find(
    (entry) => entry.id === "company:DANG! Lifestyle",
  );
  assert.equal(dang?.href, "/brands/dang-lifestyle");

  const root = process.cwd();
  const productPage = readFileSync(
    path.join(root, "app/(site)/products/[slug]/page.tsx"),
    "utf8",
  );
  const cataloguePage = readFileSync(
    path.join(root, "app/(site)/products/page.tsx"),
    "utf8",
  );
  assert.match(productPage, /brandHref=\{brandProfileHref\(product\.brand\)\}/);
  assert.match(cataloguePage, /View \{result\.filters\.brand\} brand profile/);
});
