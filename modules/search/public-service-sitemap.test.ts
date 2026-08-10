import assert from "node:assert/strict";
import test from "node:test";
import sitemap from "@/app/sitemap";
import { nigeriaRetailers, retailerSlug } from "@/data/retailers";
import { buildBrandDirectory } from "@/lib/catalogue/brand-profile";
import { listCatalogueProducts } from "@/lib/catalogue/repository";

const origin = "https://www.jelocare.com";

test("public service directories and profiles remain discoverable", async () => {
  const catalogue = await listCatalogueProducts();
  const brands = buildBrandDirectory(catalogue);
  const entries = await sitemap();
  const urls = entries.map((entry) => entry.url);
  const uniqueUrls = new Set(urls);

  assert.equal(uniqueUrls.size, urls.length, "sitemap URLs must stay unique");

  for (const route of [
    "/products",
    "/brands",
    "/ingredients",
    "/retailers",
    "/concerns",
    "/consult",
    "/contribute",
    "/share",
    "/search",
  ]) {
    assert.ok(uniqueUrls.has(`${origin}${route}`), route);
  }

  for (const brand of brands) {
    assert.ok(uniqueUrls.has(`${origin}/brands/${brand.slug}`), brand.slug);
  }

  for (const retailer of nigeriaRetailers) {
    const slug = retailerSlug(retailer.name);
    assert.ok(uniqueUrls.has(`${origin}/retailers/${slug}`), slug);
  }

  for (const privateOrUtilityRoute of [
    "/me",
    "/sign-in",
    "/go",
    "/image-audit",
  ]) {
    assert.ok(
      !uniqueUrls.has(`${origin}${privateOrUtilityRoute}`),
      privateOrUtilityRoute,
    );
  }
});
