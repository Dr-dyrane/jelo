import assert from "node:assert/strict";
import test from "node:test";
import { reviewedProductRecords } from "@/data/catalogue";
import waveOneAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-1-2026-08-27.json";
import {
  materializeRetailOffersForCatalogueSeed,
  mergeRetailOffers,
  verifiedRetailOffers,
} from "@/data/retail-offers";
import { nigeriaRetailers } from "@/data/retailers";
import {
  hasCompletePriceObservation,
  hasListingEvidence,
} from "./offer-evidence";
import { isOfferFresh } from "./offer-freshness";

const searchRouteMarkers = [
  "?s=",
  "&s=",
  "/search?",
  "/catalog/?q=",
  "/catalogsearch/",
];

test("catalogue offer refresh wave 1 reconciles exact browser evidence to projections", () => {
  const projected = waveOneAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveOneAudit.summary.productsReviewed, 4);
  assert.equal(projected.length, 12);
  for (const product of waveOneAudit.products) {
    assert.equal(product.offers.length, 3, product.candidateId);
    for (const evidence of product.offers) {
      const offer = verifiedRetailOffers[product.candidateId]?.find(
        (candidate) => candidate.url === evidence.url,
      );
      assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
      assert.equal(offer.retailer, evidence.retailer);
      assert.equal(offer.priceNgn, evidence.priceNgn);
      assert.equal(offer.available, true);
      assert.equal(offer.priceObservation?.stock, evidence.stock);
      assert.equal(offer.priceObservation?.size, product.identity.size);
      assert.equal(offer.checkedAt, evidence.checkedAt);
      assert.equal(offer.expiresAt, evidence.expiresAt);
      assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
      assert.ok(evidence.responseByteSize >= 200_000);
      assert.equal(
        Date.parse(evidence.expiresAt) - Date.parse(evidence.checkedAt),
        7 * 24 * 60 * 60 * 1000,
      );
    }
  }
});

test("verified Nigerian observations use exact secure product pages", () => {
  const registered = new Set(nigeriaRetailers.map((retailer) => retailer.name));
  const observations = Object.entries(verifiedRetailOffers).flatMap(
    ([slug, offers]) => offers.map((offer) => ({ slug, offer })),
  );

  assert.ok(observations.length >= 17);
  for (const { slug, offer } of observations) {
    const url = new URL(offer.url);
    assert.equal(
      offer.match,
      "exact",
      `${slug}: ${offer.retailer} must be exact`,
    );
    assert.deepEqual(
      offer.location,
      ["NG"],
      `${slug}: ${offer.retailer} must be Nigerian`,
    );
    assert.equal(url.protocol, "https:");
    assert.ok(
      url.pathname !== "/",
      `${slug}: ${offer.retailer} needs a product path`,
    );
    assert.equal(
      searchRouteMarkers.some((marker) =>
        offer.url.toLowerCase().includes(marker),
      ),
      false,
    );
    assert.ok(Number.isFinite(offer.priceNgn) && offer.priceNgn! > 0);
    assert.ok(offer.checkedAt && !Number.isNaN(Date.parse(offer.checkedAt)));
    assert.ok(
      registered.has(offer.retailer),
      `${offer.retailer} must be in the public registry`,
    );
  }
});

test("catalogue seed retains expired exact URLs for refresh without making them current", () => {
  const product = reviewedProductRecords.find(
    (candidate) =>
      candidate.slug === "cosrx-salicylic-acid-daily-gentle-cleanser",
  );
  assert.ok(product);
  const afterExpiry = new Date("2026-08-23T00:00:00Z");
  const publicOffers = mergeRetailOffers(product, product.offers, afterExpiry);
  const seedOffers = materializeRetailOffersForCatalogueSeed(
    product,
    product.offers,
  );
  assert.equal(
    publicOffers.some(
      (offer) =>
        offer.retailer === "Beauty by Daz" && isOfferFresh(offer, afterExpiry),
    ),
    false,
  );
  const retained = seedOffers.find(
    (offer) => offer.retailer === "Beauty by Daz" && offer.priceNgn != null,
  );
  assert.ok(retained);
  assert.equal(isOfferFresh(retained, afterExpiry), false);
});

test("at least thirteen catalogue products have reliable exact Nigerian price evidence", () => {
  const asOf = new Date("2026-08-14T17:01:00Z");
  const priced = reviewedProductRecords.filter((product) =>
    mergeRetailOffers(product, product.offers, asOf).some(
      (offer) =>
        offer.location.includes("NG") &&
        offer.match === "exact" &&
        typeof offer.priceNgn === "number" &&
        offer.priceNgn > 0,
    ),
  );

  assert.ok(
    priced.length >= 13,
    `expected at least 13 priced products, received ${priced.length}`,
  );
});

test("the seven newest catalogue products carry the exact Nigerian offers found in the enrichment pass", () => {
  const expected = {
    "anessa-perfect-uv-sunscreen-skincare-milk-na-60ml": [["BuyBetter", 32249]],
    "aveeno-daily-moisturizing-body-oil-mist-200ml": [
      ["Teeka4", 15700],
      ["Lux Beauty", 17500],
      ["Perona Beauty", 17500],
    ],
    "beauty-of-joseon-glow-serum-propolis-niacinamide-30ml": [
      ["BuyBetter", 13500],
      ["Kadimez Essentials", 19500],
      ["Rhema Beauty Shop", 20425],
    ],
    "eos-coconut-waters-body-wash-473ml": [
      ["Teeka4", 18500],
      ["BuyBetter", 18500],
      ["Rhema Beauty Shop", 25000],
      ["Beauty Hut Africa", 25000],
    ],
    "eos-pink-champagne-body-wash-473ml": [
      ["Teeka4", 18500],
      ["BuyBetter", 18500],
      ["Rhema Beauty Shop", 25000],
      ["Beauty Hut Africa", 25000],
    ],
    "eos-vanilla-cashmere-body-wash-473ml": [
      ["Beauty by Daz", 19500],
      ["Teeka4", 18500],
      ["Perona Beauty", 20850],
      ["Beauty Hut Africa", 23100],
    ],
    "saltair-santal-bloom-moisture-bound-hair-oil-rich-50ml": [
      ["BuyBetter", 27200],
    ],
  } as const;

  for (const [slug, offerRows] of Object.entries(expected)) {
    const offers = verifiedRetailOffers[slug];
    assert.ok(offers, `missing offers for ${slug}`);
    assert.deepEqual(
      offers.map((offer) => [offer.retailer, offer.priceNgn]),
      offerRows,
      slug,
    );
    assert.equal(
      offers.every(
        (offer) =>
          offer.checkedAt ===
          (offer.retailer === "Beauty Hut Africa"
            ? "2026-08-14T17:00:00Z"
            : offer.retailer === "BuyBetter" &&
                slug ===
                  "saltair-santal-bloom-moisture-bound-hair-oil-rich-50ml"
              ? "2026-08-11T19:54:00Z"
              : "2026-08-14T17:00:00Z"),
      ),
      true,
      `${slug}: observation timestamp`,
    );
  }
});

test("the zero-depth enrichment wave publishes exact offers across its cohort", () => {
  const expected = {
    "aqua-rich-licorice-mulberry-body-wash-1000ml": [
      ["BuyBetter", 11288, "1000 ml"],
      ["Perona Beauty", 10850, "1000 ml"],
      ["Konga Health", 15000, "1000 ml"],
    ],
    "aqua-rich-niacinamide-alpha-arbutin-body-wash-1000ml": [
      ["CSi Grocery", 12000, "1000 ml"],
      ["Nihet Beauty", 21000, "1000 ml"],
      ["TOS Nigeria", 10800, "1000 ml"],
    ],
    "naturium-dew-glow-moisturizer-spf-50-1-7fl-oz": [
      ["Nihet Beauty", 75850, "1.7 fl oz / 50 ml"],
      ["HilarySays", 56500, "1.7 fl oz / 50 ml"],
      ["Mirrors Beauty", 24200, "1.7 fl oz / 50 ml"],
    ],
  } as const;

  for (const [slug, rows] of Object.entries(expected)) {
    const offers = verifiedRetailOffers[slug];
    assert.ok(offers, `missing offers for ${slug}`);
    assert.deepEqual(
      offers.map((offer) => [
        offer.retailer,
        offer.priceNgn,
        offer.priceObservation?.size,
      ]),
      rows,
      slug,
    );
    assert.equal(
      offers.every(
        (offer) =>
          offer.available &&
          offer.match === "exact" &&
          offer.priceObservation?.stock === "in-stock" &&
          Date.parse(offer.expiresAt ?? "") > Date.parse(offer.checkedAt ?? ""),
      ),
      true,
      `${slug}: exact fresh in-stock evidence`,
    );
  }
});

test("browser-verified Beauty by Daz prices serve exact original catalogue products", () => {
  const expected = [
    ["cosrx-salicylic-acid-daily-gentle-cleanser", 8_500, "150 ml", true],
    ["anua-niacinamide-10-txa-4-serum", 18_850, "30 ml", false],
    ["face-facts-bright-clear-face-cream", 7_500, "75 ml", true],
  ] as const;

  for (const [slug, priceNgn, size, available] of expected) {
    const offer = verifiedRetailOffers[slug]?.find(
      (candidate) => candidate.retailer === "Beauty by Daz",
    );
    assert.ok(offer, slug);
    assert.equal(offer.priceNgn, priceNgn, slug);
    assert.equal(offer.available, available, slug);
    assert.equal(offer.priceObservation?.size, size, slug);
    assert.equal(offer.listingEvidence?.basis, "retailer-page", slug);
    assert.equal(new URL(offer.url).hostname, "beautybydaz.com", slug);
  }
});

test("catalogue coverage batch 1 preserves its fresh Beauty by Daz observations", () => {
  const expected = [
    [
      "anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml",
      18_850,
      true,
      "30 ml",
      "2026-08-14T17:00:00Z",
    ],
    [
      "dove-melanin-even-tone-body-wash-18-5oz",
      19_500,
      false,
      "547 ml / 18.5 fl oz",
      "2026-08-14T17:00:00Z",
    ],
  ] as const;

  for (const [slug, priceNgn, available, size, checkedAt] of expected) {
    const offer = verifiedRetailOffers[slug]?.find(
      (candidate) => candidate.retailer === "Beauty by Daz",
    );
    assert.ok(offer, slug);
    assert.equal(offer.priceNgn, priceNgn, slug);
    assert.equal(offer.available, available, slug);
    assert.equal(offer.checkedAt, checkedAt, slug);
    assert.equal(offer.listingEvidence?.observedAt, offer.checkedAt, slug);
    assert.equal(offer.listingEvidence?.sourceUrl, offer.url, slug);
    assert.equal(offer.priceObservation?.observedAt, offer.checkedAt, slug);
    assert.equal(offer.priceObservation?.size, size, slug);
  }
});

test("every curated exact price carries listing, variant, size, stock, time and landed-cost evidence", () => {
  const priced = Object.values(verifiedRetailOffers)
    .flat()
    .filter(
      (offer) =>
        offer.match === "exact" &&
        (typeof offer.priceNgn === "number" ||
          typeof offer.priceUsd === "number"),
    );

  assert.ok(priced.length > 0);
  for (const offer of priced) {
    assert.equal(
      hasListingEvidence(offer),
      true,
      `${offer.retailer} listing evidence`,
    );
    assert.equal(
      hasCompletePriceObservation(offer),
      true,
      `${offer.retailer} price observation`,
    );
  }
});

test("featured marketplace offers retain visible seller evidence", () => {
  const mediana = verifiedRetailOffers[
    "mediana-leave-in-conditioning-milk"
  ]?.find((offer) => offer.retailer === "Jumia");
  const anua = verifiedRetailOffers["anua-niacinamide-10-txa-4-serum"]?.find(
    (offer) => offer.retailer === "Jumia",
  );

  assert.deepEqual(
    { seller: mediana?.sellerName, score: mediana?.sellerScore },
    { seller: "Jeto", score: 88 },
  );
  assert.deepEqual(
    {
      seller: anua?.sellerName,
      score: anua?.sellerScore,
      priceComparison: anua?.priceComparison,
    },
    { seller: "Smile Time", score: 92, priceComparison: "exclude" },
  );

  const disaar = verifiedRetailOffers["disaar-argan-oil-body-oil-gel"]?.find(
    (offer) => offer.retailer === "Jumia",
  );
  assert.deepEqual(
    {
      seller: disaar?.sellerName,
      score: disaar?.sellerScore,
      stock: disaar?.priceObservation?.stock,
      priceComparison: disaar?.priceComparison,
    },
    {
      seller: "Christodel Global Services",
      score: 88,
      stock: "low-stock",
      priceComparison: "exclude",
    },
  );
});

test("the B.LAB Matcha listing publishes verified Perona Beauty offer", () => {
  const offers = verifiedRetailOffers["b-lab-matcha-hydrating-real-sunscreen"];
  assert.ok(offers && offers.length >= 1);
  assert.equal(offers[0].retailer, "Perona Beauty");
});

test("DANG sale prices publish only exact in-stock Nigerian product listings", () => {
  const expected = {
    "dang-azelaic-acid-serum-30ml": [15_045, "30 ml", "2026-08-09T11:40:38Z"],
    "dang-hydra-glow-sun-protection-gel-60ml": [
      21_250,
      "60 ml",
      "2026-08-09T11:40:39Z",
    ],
  } as const;

  for (const [slug, [priceNgn, size, observedAt]] of Object.entries(expected)) {
    const offer = verifiedRetailOffers[slug]?.find(
      (candidate) => candidate.retailer === "DANG Lifestyle",
    );
    assert.ok(offer, slug);
    assert.equal(offer.priceNgn, priceNgn, slug);
    assert.equal(offer.available, true, slug);
    assert.equal(offer.priceObservation?.size, size, slug);
    assert.equal(offer.checkedAt, observedAt, slug);
    assert.equal(offer.expiresAt, "2026-08-21T17:00:00Z", slug);
    assert.equal(new URL(offer.url).hostname, "danglifestyle.co", slug);
  }

  assert.equal(
    verifiedRetailOffers[
      "dang-niacinamide-n-acetyl-glucosamine-serum-30ml"
    ]?.some((candidate) => candidate.retailer === "DANG Lifestyle"),
    false,
  );
});

test("Beauty Hut Africa publishes the complete exact-size enrichment wave", () => {
  const expected = [
    // COSRX and Vitamin C offers pruned to 10 freshest; Beauty Hut Africa
    // was outside the top-10 trust tier for those two products.
    ["balance-niacinamide-blemish-recovery-serum-30ml", 10_500, "30 ml"],
    ["cerave-blemish-control-cleanser", 18_252, "236 ml"],
    ["cerave-foaming-facial-cleanser", 14_700, "236 ml"],
    ["cerave-pm-facial-moisturising-lotion-52ml", 20_300, "52 ml"],
    ["cerave-sa-smoothing-cleanser-473ml", 23_420, "473 ml"],
    ["eos-coconut-waters-body-wash-473ml", 25_000, "16 fl oz / 473 ml"],
    ["eos-pink-champagne-body-wash-473ml", 25_000, "16 fl oz / 473 ml"],
    ["eos-vanilla-cashmere-body-wash-473ml", 23_100, "16 fl oz / 473 ml"],
    ["facefacts-ceramide-hydrating-gentle-cleanser-400ml", 8_775, "400 ml"],
    ["facefacts-soothe-glow-niacinamide-serum-30ml", 4_380, "30 ml"],
    ["la-roche-posay-effaclar-purifying-foaming-gel-400ml", 22_325, "400 ml"],
    ["nineless-a-control-azelaic-acid-cream-50ml", 20_315, "50 ml"],
    ["nivea-perfect-radiant-body-lotion-400ml", 5_156, "400 ml"],
  ] as const;

  for (const [slug, priceNgn, size] of expected) {
    const offer = verifiedRetailOffers[slug]?.find(
      (candidate) => candidate.retailer === "Beauty Hut Africa",
    );
    assert.ok(offer, slug);
    assert.equal(offer.priceNgn, priceNgn, slug);
    assert.equal(offer.available, true, slug);
    assert.equal(offer.priceObservation?.size, size, slug);
    assert.equal(offer.checkedAt, "2026-08-14T17:00:00Z", slug);
    assert.equal(offer.expiresAt, "2026-08-21T17:00:00Z", slug);
    assert.equal(new URL(offer.url).hostname, "beautyhutafrica.com", slug);
  }

  assert.equal(
    verifiedRetailOffers["cerave-foaming-facial-cleanser"].some(
      (offer) => offer.priceObservation?.size !== "236 ml",
    ),
    false,
  );
});

test("PanOxyl publishes only the current GTIN-matched Slique observation", () => {
  const slug = "panoxyl-acne-foaming-wash-10-benzoyl-peroxide";
  const offers = verifiedRetailOffers[slug];

  assert.equal(offers.length, 5);
  assert.deepEqual(
    {
      retailer: offers[0]?.retailer,
      priceNgn: offers[0]?.priceNgn,
      checkedAt: offers[0]?.checkedAt,
      observedAt: offers[0]?.listingEvidence?.observedAt,
      evidenceSource: offers[0]?.listingEvidence?.sourceUrl,
      evidenceBasis: offers[0]?.listingEvidence?.basis,
      variant: offers[0]?.priceObservation?.variant,
      size: offers[0]?.priceObservation?.size,
      stock: offers[0]?.priceObservation?.stock,
    },
    {
      retailer: "Slique Beauty",
      priceNgn: 3500,
      checkedAt: "2026-08-14T17:00:00Z",
      observedAt: "2026-08-14T17:00:00Z",
      evidenceSource:
        "https://sliquebeautylimited.com/wp-json/wc/store/v1/products?slug=panoxyl-acne-foaming-wash-benzoyl-peroxide-10-maximum-strength-156g",
      evidenceBasis: "retailer-api",
      variant:
        "PANOXYL ACNE FOAMING WASH BENZOYL PEROXIDE 10% MAXIMUM STRENGTH -156G",
      size: "156 g",
      stock: "in-stock",
    },
  );
  assert.equal(offers[0]?.brandAuthorizationEvidence, undefined);
  assert.equal(offers[1]?.retailer, "Holly's Wellness");
  assert.equal(offers[2]?.retailer, "BuyBetter");
  assert.equal(offers[3]?.retailer, "Rehmie");
  assert.equal(offers[4]?.retailer, "Perona Beauty");
});

test("stale PanOxyl Teeka and Lux routes cannot leak through base offers", () => {
  const merged = mergeRetailOffers(
    {
      slug: "panoxyl-acne-foaming-wash-10-benzoyl-peroxide",
      name: "Acne Foaming Wash 10% Benzoyl Peroxide",
      size: "156 g",
    },
    [
      {
        retailer: "Teeka4",
        url: "https://teeka4.com/shop/panoxyl-acne-foaming-wash-benzoyl-peroxide-10-maximum-strength/",
        trust: 98,
        available: false,
        priceNgn: 13300,
        location: ["NG"],
      },
      {
        retailer: "Lux Beauty",
        url: "https://www.luxbeautyng.com/product/panoxyl-acne-creamy-wash-benzoyl-peroxide-10/",
        trust: 96,
        available: true,
        priceNgn: 17500,
        location: ["NG"],
      },
    ],
    new Date("2026-08-19T00:00:00Z"),
  );

  assert.deepEqual(
    merged.map((offer) => offer.retailer),
    ["Slique Beauty", "Holly's Wellness", "Rehmie"],
  );
  assert.equal(merged[0]?.brandAuthorizationEvidence, undefined);
});

test("Ghana-priced routes never appear as Nigerian offers", () => {
  const kuza = reviewedProductRecords.find(
    (product) => product.slug === "kuza-indian-hemp-hair-scalp-treatment",
  );
  const perfectPicture = kuza?.offers.find(
    (offer) => offer.retailer === "Perfect Picture Cosmetics",
  );

  assert.ok(perfectPicture);
  assert.deepEqual(perfectPicture.location, ["GH"]);
});
