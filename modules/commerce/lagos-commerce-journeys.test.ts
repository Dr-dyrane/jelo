import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { lagosCommerceJourneys } from "../../app/(site)/lagos/lagos-journeys";

async function source(file: string) {
  return readFile(path.join(process.cwd(), file), "utf8");
}

test("Lagos commerce stories preserve the one-retailer contracts", () => {
  const order = lagosCommerceJourneys.find((journey) => journey.id === "order");
  const bundle = lagosCommerceJourneys.find(
    (journey) => journey.id === "bundle",
  );

  assert.ok(order);
  assert.equal(order.href, "/products");
  assert.deepEqual(
    order.steps.map((step) => step.title),
    [
      "Open an exact product",
      "Choose one retailer",
      "Keep shopping that store",
      "Review and request quote",
      "Approve, pay and track",
    ],
  );

  assert.ok(bundle);
  assert.equal(bundle.heading, "One basket. One retailer.");
  assert.deepEqual(
    bundle.steps.map((step) => step.title),
    [
      "Choose 2–4 products",
      "See common retailers",
      "Choose one exact basket",
      "Request a verified quote",
      "Approve, pay and track",
    ],
  );

  assert.doesNotMatch(
    JSON.stringify(lagosCommerceJourneys),
    /different retailers|any store|single quote|two stores|2 stores/i,
  );
});

test("Daily Desk shows real catalogue examples and a truthful general-guide fallback", async () => {
  const page = await source("app/(site)/lagos/page.tsx");

  assert.match(page, /<ProductCard/);
  assert.match(page, /findBuyTogetherSuggestions/);
  assert.match(page, /findBundleStores/);
  assert.match(page, /bundle\.allInStock/);
  assert.match(page, /One-store example/);
  assert.match(page, /listed product total/);
  assert.match(page, /Delivery and service fee are checked in the quote/);

  assert.match(page, /concernsLinkedToProduct\(productSlug\)/);
  assert.match(page, /allConcernSummaries\(\)/);
  assert.match(page, /concern\.kind === "concern"/);
  assert.match(page, /\.slice\(0, 10\)/);
  assert.match(page, /General guides—not claims about today’s product/);
  assert.match(page, /Only uses linked through the reviewed product record/);
  assert.doesNotMatch(page, /if \(linked\.length === 0\) return null/);
});
