import assert from "node:assert/strict";
import test from "node:test";
import { lagosCommerceJourneys } from "../../app/(site)/lagos/lagos-journeys";

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
      "Browse exact products",
      "Choose one retailer",
      "Request a verified quote",
      "Approve, then pay",
      "Track delivery",
    ],
  );

  assert.ok(bundle);
  assert.equal(bundle.heading, "One basket. One retailer.");
  assert.deepEqual(
    bundle.steps.map((step) => step.title),
    ["Choose products", "Compare one retailer", "Open exact listings"],
  );

  assert.doesNotMatch(
    JSON.stringify(lagosCommerceJourneys),
    /different retailers|any store|single quote|two stores|2 stores/i,
  );
});
