import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { products as staticProducts } from "@/data/catalogue";
import type { Offer, Product } from "@/data/products";
import {
  mergeDossierReleasedCatalogue,
  reconcilePublishedCatalogue,
} from "@/lib/catalogue/publication-boundary";
import { hasShareableNgOffer } from "@/modules/commerce/shareable-offer";

function product(slug: string, overrides: Partial<Product> = {}): Product {
  return {
    slug,
    brand: "Approved brand",
    name: "Foaming Facial Cleanser",
    size: "50 ml",
    category: "Face",
    step: "Treat",
    image: `https://assets.example/${slug}/approved.png`,
    displayLine: "Approved identity",
    bestFor: [],
    concerns: [],
    skinTypes: [],
    sensitiveFriendly: false,
    usage: "Use as directed.",
    evidence: "moderate",
    offers: [],
    ...overrides,
  };
}

function exactOffer(overrides: Partial<Offer> = {}): Offer {
  return { ...exactOfferBase(), ...overrides };
}

function exactOfferBase(): Offer {
  return {
    retailer: "Live",
    url: "https://live.example/product",
    trust: 95,
    available: true,
    priceNgn: 12_000,
    location: ["NG"],
    listingEvidence: {
      observedAt: "2026-07-22T10:00:00Z",
      sourceUrl: "https://live.example/product",
      basis: "retailer-page" as const,
    },
    priceObservation: {
      observedAt: "2026-07-22T10:00:00Z",
      variant: "Approved brand Foaming Facial Cleanser",
      size: "50 ml",
      stock: "in-stock" as const,
      landedCost: "unknown" as const,
    },
  };
}

test("database rows cannot bypass the checked-in product and image approvals", () => {
  const approved = product("approved", {
    offers: [
      {
        retailer: "Static",
        url: "https://static.example/product",
        trust: 90,
        available: true,
        location: ["NG"],
      },
    ],
  });
  const persisted = product("approved", {
    brand: "Stale brand",
    name: "Stale identity",
    image: "https://database.example/white-canvas.jpg",
    offers: [exactOffer()],
  });
  const unapproved = product("unapproved", {
    image: "https://database.example/opaque.jpg",
  });

  const result = reconcilePublishedCatalogue(
    [persisted, unapproved],
    [approved],
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].slug, "approved");
  assert.equal(result[0].brand, approved.brand);
  assert.equal(result[0].name, approved.name);
  assert.equal(result[0].image, approved.image);
  assert.equal(result[0].offers[0]?.retailer, "Static");
});

test("only exact persisted offers for the approved identity and size can replace static offers", () => {
  const approved = product("approved", {
    offers: [
      {
        retailer: "Static",
        url: "https://static.example/product",
        trust: 90,
        available: true,
        location: ["NG"],
      },
    ],
  });
  const valid = reconcilePublishedCatalogue(
    [product("approved", { offers: [exactOffer()] })],
    [approved],
  );
  assert.equal(valid[0].offers[0]?.retailer, "Live");

  const wrongSize = exactOffer();
  wrongSize.priceObservation!.size = "100 ml";
  const rejected = reconcilePublishedCatalogue(
    [product("approved", { offers: [wrongSize] })],
    [approved],
  );
  assert.equal(rejected[0].offers[0]?.retailer, "Static");

  const sibling = exactOffer();
  sibling.priceObservation!.variant =
    "Approved brand Hydrating Facial Cleanser";
  const siblingRejected = reconcilePublishedCatalogue(
    [product("approved", { offers: [sibling] })],
    [approved],
  );
  assert.equal(siblingRejected[0].offers[0]?.retailer, "Static");
});

test("approved static offers remain available when a persisted row has none", () => {
  const approved = product("approved", {
    offers: [
      {
        retailer: "Static",
        url: "https://static.example/product",
        trust: 90,
        available: true,
        location: ["NG"],
      },
    ],
  });
  const [result] = reconcilePublishedCatalogue(
    [product("approved")],
    [approved],
  );

  assert.equal(result.offers[0]?.retailer, "Static");
});

test("newer checked-in exact offers stay available before database reconciliation runs", () => {
  const approvedOffer = exactOffer({
    retailer: "New retailer",
    url: "https://new.example/product",
    checkedAt: "2026-08-09T12:00:00Z",
    listingEvidence: {
      observedAt: "2026-08-09T12:00:00Z",
      sourceUrl: "https://new.example/product",
      basis: "retailer-page",
    },
    priceObservation: {
      observedAt: "2026-08-09T12:00:00Z",
      variant: "Approved brand Foaming Facial Cleanser",
      size: "50 ml",
      stock: "in-stock",
      landedCost: "unknown",
    },
  });
  const stalePersisted = exactOffer({
    retailer: "Old retailer",
    checkedAt: "2026-08-01T12:00:00Z",
  });

  const [result] = reconcilePublishedCatalogue(
    [product("approved", { offers: [stalePersisted] })],
    [product("approved", { offers: [approvedOffer] })],
  );

  assert.deepEqual(
    result.offers.map((offer) => offer.retailer),
    ["New retailer", "Old retailer"],
  );
});

test("the newest exact observation wins for the same retailer and market", () => {
  const approvedOffer = exactOffer({
    priceNgn: 10_800,
    checkedAt: "2026-08-09T12:00:00Z",
    listingEvidence: {
      observedAt: "2026-08-09T12:00:00Z",
      sourceUrl: "https://live.example/product",
      basis: "retailer-page",
    },
    priceObservation: {
      observedAt: "2026-08-09T12:00:00Z",
      variant: "Approved brand Foaming Facial Cleanser",
      size: "50 ml",
      stock: "in-stock",
      landedCost: "unknown",
    },
  });
  const stalePersisted = exactOffer({
    priceNgn: 12_000,
    checkedAt: "2026-08-01T12:00:00Z",
  });

  const [checkedInWins] = reconcilePublishedCatalogue(
    [product("approved", { offers: [stalePersisted] })],
    [product("approved", { offers: [approvedOffer] })],
  );
  assert.equal(checkedInWins.offers[0]?.priceNgn, 10_800);

  const newerPersisted = exactOffer({
    priceNgn: 10_500,
    checkedAt: "2026-08-10T12:00:00Z",
    listingEvidence: {
      observedAt: "2026-08-10T12:00:00Z",
      sourceUrl: "https://live.example/product",
      basis: "retailer-page",
    },
    priceObservation: {
      observedAt: "2026-08-10T12:00:00Z",
      variant: "Approved brand Foaming Facial Cleanser",
      size: "50 ml",
      stock: "in-stock",
      landedCost: "unknown",
    },
  });
  const [persistedWins] = reconcilePublishedCatalogue(
    [product("approved", { offers: [newerPersisted] })],
    [product("approved", { offers: [approvedOffer] })],
  );
  assert.equal(persistedWins.offers[0]?.priceNgn, 10_500);
});

test("a newly enriched product remains shareable while Neon still has only stale offers", () => {
  const approved = staticProducts.find(
    (product) =>
      product.slug === "aqua-rich-licorice-mulberry-body-wash-1000ml",
  );
  assert.ok(approved);

  const stalePersisted = exactOffer({
    retailer: "Stale retailer",
    checkedAt: "2026-08-01T12:00:00Z",
    expiresAt: "2026-08-08T12:00:00Z",
    listingEvidence: {
      observedAt: "2026-08-01T12:00:00Z",
      sourceUrl: "https://live.example/product",
      basis: "retailer-page",
    },
    priceObservation: {
      observedAt: "2026-08-01T12:00:00Z",
      variant: `${approved.brand} ${approved.name}`,
      size: approved.size,
      stock: "in-stock",
      landedCost: "unknown",
    },
  });
  const [reconciled] = reconcilePublishedCatalogue(
    [{ ...approved, offers: [stalePersisted] }],
    [approved],
  );

  assert.equal(
    hasShareableNgOffer(reconciled, new Date("2026-08-09T13:00:00Z")),
    true,
  );
  assert.deepEqual(
    reconciled.offers
      .filter((offer) =>
        ["BuyBetter", "Perona Beauty"].includes(offer.retailer),
      )
      .map((offer) => offer.retailer),
    ["BuyBetter", "Perona Beauty"],
  );
});

test("duplicate persisted image rows cannot duplicate a public product", () => {
  const approved = product("approved");
  const result = reconcilePublishedCatalogue(
    [product("approved"), product("approved")],
    [approved],
  );

  assert.equal(result.length, 1);
});

test("an explicit dossier release remains public before its database projection exists", () => {
  const persisted = [product("legacy")];
  const released = product("dossier-release", {
    brand: "Dossier brand",
    image: "https://assets.example/dossier-release/packshot-v1-hash.png",
    offers: [exactOffer()],
  });

  const all = mergeDossierReleasedCatalogue(persisted, [released]);
  assert.deepEqual(
    all.map((item) => item.slug),
    ["legacy", "dossier-release"],
  );
  assert.equal(all[1].brand, "Dossier brand");

  const scoped = mergeDossierReleasedCatalogue(
    [],
    [released],
    "dossier-release",
  );
  assert.deepEqual(scoped, [released]);
  assert.deepEqual(
    mergeDossierReleasedCatalogue([], [released], "another-product"),
    [],
  );
});

test("a projected dossier release appears once and keeps reconciled database offers", () => {
  const projected = product("dossier-release", { offers: [exactOffer()] });
  const released = product("dossier-release");
  const result = mergeDossierReleasedCatalogue([projected], [released]);

  assert.equal(result.length, 1);
  assert.equal(result[0].offers[0]?.retailer, "Live");
});

test("outbound redirects resolve through the same reconciled catalogue", async () => {
  // The trust bridge page and continue route both resolve through the
  // reconciled catalogue (via resolveHandoff / findCatalogueProduct).
  const handoffModel = await readFile(
    path.join(process.cwd(), "lib/commerce/handoff-model.ts"),
    "utf8",
  );
  const continueRoute = await readFile(
    path.join(process.cwd(), "app/(site)/go/continue/route.ts"),
    "utf8",
  );

  assert.match(handoffModel, /await findCatalogueProduct\(productSlug\)/);
  assert.match(continueRoute, /await findCatalogueProduct\(productSlug\)/);
  assert.doesNotMatch(
    handoffModel,
    /import \{ products \} from '@\/data\/catalogue'/,
  );
  assert.doesNotMatch(
    continueRoute,
    /import \{ products \} from '@\/data\/catalogue'/,
  );
});
