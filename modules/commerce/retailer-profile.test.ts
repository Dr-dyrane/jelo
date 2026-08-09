import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { products } from "@/data/catalogue";
import {
  nigeriaRetailers,
  retailerBySlug,
  retailerSlug,
} from "@/data/retailers";
import { buildRetailerProfile } from "./retailer-profile";
import { isShareableNgOffer } from "./shareable-offer";

const now = new Date("2026-08-09T16:00:00Z");

test("every registered retailer has one stable public slug", () => {
  const slugs = nigeriaRetailers.map((retailer) => retailerSlug(retailer.name));
  assert.equal(new Set(slugs).size, nigeriaRetailers.length);
  for (const retailer of nigeriaRetailers) {
    assert.equal(retailerBySlug(retailerSlug(retailer.name)), retailer);
  }
});

test("retailer profiles expose only that store current exact Nigerian offers", () => {
  const beautyHut = retailerBySlug("beauty-hut-africa");
  assert.ok(beautyHut);
  const profile = buildRetailerProfile(beautyHut, products, now);

  assert.ok(profile.productCount >= 15);
  assert.ok(profile.latestObservedAt);
  for (const product of profile.products) {
    assert.ok(product.offers.length > 0);
    assert.ok(
      product.offers.every((offer) => offer.retailer === beautyHut.name),
    );
    assert.ok(product.offers.every((offer) => isShareableNgOffer(offer, now)));
  }
});

test("public retailer routes reuse product cards and keep store links evidence-scoped", async () => {
  const root = process.cwd();
  const [profilePage, directoryPage] = await Promise.all([
    readFile(path.join(root, "app/(site)/retailers/[slug]/page.tsx"), "utf8"),
    readFile(path.join(root, "app/(site)/retailers/page.tsx"), "utf8"),
  ]);

  assert.match(profilePage, /ProductCardGrid/);
  assert.match(profilePage, /buildRetailerProfile\(retailer, catalogue\)/);
  assert.match(
    profilePage,
    /\/go\?product=\$\{encodeURIComponent\(product\.slug\)\}&retailer=/,
  );
  assert.match(profilePage, /Listing ≠ genuine/);
  assert.match(
    directoryPage,
    /href=\{`\/retailers\/\$\{retailerSlug\(store\.name\)\}`\}/,
  );
});
