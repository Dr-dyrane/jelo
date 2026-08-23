import assert from "node:assert/strict";
import test from "node:test";
import type { Offer } from "@/data/products";
import {
  materializeCurrentPersistedOffers,
  type PersistedCatalogueOffer,
} from "@/lib/catalogue/persisted-offers";
import { hasCompletePriceObservation } from "@/modules/commerce/offer-evidence";

const now = new Date("2026-08-22T12:00:00Z");

function persistedOffer(
  overrides: Partial<PersistedCatalogueOffer> = {},
): PersistedCatalogueOffer {
  const offer: Offer = {
    retailer: "Verified retailer",
    url: "https://retailer.example/product",
    trust: 95,
    available: true,
    priceNgn: 12_500,
    checkedAt: "2026-08-21T10:00:00Z",
    expiresAt: "2026-08-23T10:00:00Z",
    match: "exact",
    location: ["NG"],
  };

  return {
    ...offer,
    verificationMethod: "retailer_page",
    lastVerifiedAt: "2026-08-21T10:00:00Z",
    inventoryStatus: "in_stock",
    observedTitle: "Approved brand Foaming Facial Cleanser",
    observedSize: "50 ml",
    canonicalUrl: offer.url,
    ...overrides,
  };
}

test("expired persisted offers stay in history but never reach public catalogue products", () => {
  const offers = materializeCurrentPersistedOffers(
    { name: "Foaming Facial Cleanser", size: "50 ml" },
    [persistedOffer({ expiresAt: "2026-08-22T11:59:59Z" })],
    now,
  );

  assert.deepEqual(offers, []);
});

test("current persisted offers retain complete reviewed listing evidence", () => {
  const [offer] = materializeCurrentPersistedOffers(
    { name: "Foaming Facial Cleanser", size: "50 ml" },
    [persistedOffer()],
    now,
  );

  assert.ok(offer);
  assert.equal(offer.listingEvidence?.basis, "retailer-page");
  assert.equal(hasCompletePriceObservation(offer), true);
});
