import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  filterRetailerDirectory,
  type RetailerDirectoryItem,
} from "./retailer-directory-search";
import { products } from "@/data/catalogue";
import {
  nigeriaRetailers,
  retailerBySlug,
  retailerSlug,
} from "@/data/retailers";
import { mergeRetailOffers } from "@/data/retail-offers";
import { buildRetailerProfile } from "./retailer-profile";
import { isShareableNgOffer } from "./shareable-offer";

const now = new Date("2026-08-30T02:44:24Z");

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
  const historicalProducts = products.map((product) => ({
    ...product,
    offers: mergeRetailOffers(product, product.offers, now),
  }));
  const profile = buildRetailerProfile(beautyHut, historicalProducts, now);

  assert.ok(profile.productCount >= 13);
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
  const [profilePage, directoryPage, directoryComponent] = await Promise.all([
    readFile(path.join(root, "app/(site)/retailers/[slug]/page.tsx"), "utf8"),
    readFile(path.join(root, "app/(site)/retailers/page.tsx"), "utf8"),
    readFile(
      path.join(root, "components/retailers/retailer-directory.tsx"),
      "utf8",
    ),
  ]);

  assert.match(profilePage, /ProductCardGrid/);
  assert.match(profilePage, /shopping \? "Now shopping at"/);
  assert.match(profilePage, /<AddToBasketButton/);
  assert.match(profilePage, /redirectToStore=\{false\}/);
  assert.match(profilePage, /buildRetailerProfile\(retailer, catalogue\)/);
  assert.match(
    profilePage,
    /\/go\?product=\$\{encodeURIComponent\(product\.slug\)\}&retailer=/,
  );
  assert.match(profilePage, /Listing ≠ genuine/);
  assert.match(
    directoryPage,
    /<RetailerDirectory items=\{directoryItems\} \/>/,
  );
  assert.match(directoryComponent, /href=\{`\/retailers\/\$\{item\.slug\}`\}/);
});

test("retailer search preserves source positions while narrowing by name and kind", () => {
  const items: RetailerDirectoryItem[] = [
    {
      rank: 2,
      slug: "beauty-hut-africa",
      name: "Beauty Hut Africa",
      kind: "Direct retailer",
      productCount: 15,
      evidenceNote: "Reference source",
      trust: 80,
      latestObservedAt: "2026-08-10T12:00:00Z",
    },
    {
      rank: 11,
      slug: "jumia-nigeria",
      name: "Jumia Nigeria",
      kind: "Marketplace",
      productCount: 3,
      evidenceNote: "Seller identity checked per offer",
      trust: 60,
      latestObservedAt: "2026-08-10T12:00:00Z",
    },
  ];

  assert.deepEqual(filterRetailerDirectory(items, "beauty hut"), [items[0]]);
  assert.deepEqual(filterRetailerDirectory(items, "marketplace"), [items[1]]);
  assert.deepEqual(filterRetailerDirectory(items, ""), items);
  assert.equal(filterRetailerDirectory(items, "missing").length, 0);
  assert.equal(filterRetailerDirectory(items, "beauty")[0]?.rank, 2);
});
