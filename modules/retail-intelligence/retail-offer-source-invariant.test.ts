import assert from "node:assert/strict";
import test from "node:test";
import {
  assertVerifiedRetailOfferSourceInvariant,
  verifiedRetailOffers,
} from "@/data/retail-offers";

test("reviewed static offers reserve one retailer source slot per product", () => {
  assert.doesNotThrow(() => assertVerifiedRetailOfferSourceInvariant());

  const exemplar = Object.values(verifiedRetailOffers)
    .flat()
    .find((offer) => offer.retailer.trim());
  assert.ok(exemplar, "catalogue needs an offer fixture");
  assert.throws(
    () =>
      assertVerifiedRetailOfferSourceInvariant({
        "duplicate-product": [
          exemplar,
          { ...exemplar, retailer: exemplar.retailer.toUpperCase() },
        ],
      }),
    /one source slot per product and retailer/,
  );
});
