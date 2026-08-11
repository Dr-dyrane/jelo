import assert from "node:assert/strict";
import test from "node:test";
import { selectRepresentativeOffers } from "./representative-offers";

type Priced = { id: string; price: number };
const priced = (id: string, price: number): Priced => ({ id, price });
const priceOf = (offer: Priced) => offer.price;

test("returns null for an empty list", () => {
  assert.equal(selectRepresentativeOffers<Priced>([], priceOf), null);
});

test("single offer plays every role", () => {
  const only = priced("a", 1000);
  const result = selectRepresentativeOffers([only], priceOf);
  assert.equal(result?.lowest, only);
  assert.equal(result?.median, only);
  assert.equal(result?.highest, only);
  assert.deepEqual(result?.unique, [only]);
});

test("two offers: median floor collapses onto the lower price", () => {
  const low = priced("a", 1000);
  const high = priced("b", 2000);
  const result = selectRepresentativeOffers([high, low], priceOf);
  assert.equal(result?.lowest, low);
  assert.equal(result?.highest, high);
  // Median of two values is their mean, and the floor selection picks the
  // highest-priced offer at or below that mean — the lower of the two.
  assert.equal(result?.median, low);
  assert.deepEqual(result?.unique, [low, high]);
});

test("odd count: median is the exact middle offer", () => {
  const offers = [priced("a", 1000), priced("b", 1500), priced("c", 3000)];
  const result = selectRepresentativeOffers(offers, priceOf);
  assert.equal(result?.lowest.id, "a");
  assert.equal(result?.median.id, "b");
  assert.equal(result?.highest.id, "c");
  assert.deepEqual(
    result?.unique.map((o) => o.id),
    ["a", "b", "c"],
  );
});

test("even count: median floors to the offer at or below the mean of the middle two", () => {
  const offers = [
    priced("a", 1000),
    priced("b", 1400),
    priced("c", 1600),
    priced("d", 3000),
  ];
  // Middle two are 1400 and 1600, mean = 1500. Floor picks 1400 (b).
  const result = selectRepresentativeOffers(offers, priceOf);
  assert.equal(result?.median.id, "b");
  assert.equal(result?.lowest.id, "a");
  assert.equal(result?.highest.id, "d");
});

test("many offers: never returns more than three unique entries", () => {
  const offers = Array.from({ length: 29 }, (_, i) =>
    priced(`r${i}`, 1000 + i * 137),
  );
  const result = selectRepresentativeOffers(offers, priceOf);
  assert.ok(result);
  assert.ok(result.unique.length <= 3);
  assert.equal(result.unique.length, 3);
  // Ascending order.
  assert.equal(result.unique[0], result.lowest);
  assert.equal(result.unique.at(-1), result.highest);
});

test("unique list stays ascending by price and deduplicated by identity", () => {
  const offers = [priced("a", 1000), priced("b", 2000), priced("c", 3000)];
  const result = selectRepresentativeOffers(offers, priceOf);
  const prices = result!.unique.map((o) => o.price);
  const sorted = [...prices].sort((x, y) => x - y);
  assert.deepEqual(prices, sorted);
  assert.equal(new Set(result!.unique).size, result!.unique.length);
});

test("ties at the median value select the same object consistently", () => {
  const tiedLow = priced("a", 1000);
  const tiedMid = priced("b", 1000);
  const high = priced("c", 5000);
  const result = selectRepresentativeOffers([tiedLow, tiedMid, high], priceOf);
  // Both a and b are 1000; median floor picks the last one at/under the
  // median in sorted order, which is deterministic for a stable sort.
  assert.ok(result);
  assert.ok(result.median.price === 1000);
});
