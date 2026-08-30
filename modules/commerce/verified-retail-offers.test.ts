import assert from "node:assert/strict";
import test from "node:test";
import {
  products as catalogueProducts,
  reviewedProductRecords,
} from "@/data/catalogue";
import waveOneAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-1-2026-08-27.json";
import waveTwoAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-2-2026-08-27.json";
import waveThreeAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-3-2026-08-27.json";
import waveFourAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-4-2026-08-27.json";
import waveFiveAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-5-2026-08-27.json";
import waveSixAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-6-2026-08-27.json";
import waveSevenAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-7-2026-08-29.json";
import waveEightAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-8-2026-08-29.json";
import waveNineAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-9-2026-08-29.json";
import waveTenAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-10-2026-08-29.json";
import waveElevenAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-11-2026-08-29.json";
import waveTwelveAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-12-2026-08-29.json";
import waveThirteenAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-13-2026-08-29.json";
import waveFourteenAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-14-2026-08-29.json";
import waveFifteenAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-15-2026-08-29.json";
import waveSixteenAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-16-2026-08-29.json";
import waveSeventeenAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-17-2026-08-29.json";
import waveEighteenAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-18-2026-08-29.json";
import waveNineteenAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-19-2026-08-29.json";
import waveTwentyAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-20-2026-08-29.json";
import waveTwentyOneAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-21-2026-08-29.json";
import waveTwentyTwoAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-22-2026-08-29.json";
import waveTwentyThreeAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-23-2026-08-29.json";
import waveTwentyFourAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-24-2026-08-29.json";
import waveTwentyFiveAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-25-2026-08-29.json";
import waveTwentySixAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-26-2026-08-29.json";
import waveTwentySevenAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-27-2026-08-29.json";
import waveTwentyEightAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-28-2026-08-29.json";
import waveTwentyNineAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-29-2026-08-29.json";
import waveThirtyAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-30-2026-08-29.json";
import waveThirtyOneAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-31-2026-08-29.json";
import waveThirtyTwoAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-32-2026-08-29.json";
import waveThirtyThreeAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-33-2026-08-29.json";
import waveThirtyFourAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-34-2026-08-29.json";
import {
  materializeRetailOffersForCatalogueSeed,
  mergeRetailOffers,
  verifiedRetailOffers,
} from "@/data/retail-offers";
import { nigeriaRetailers } from "@/data/retailers";
import { reconcilePublishedCatalogue } from "@/lib/catalogue/publication-boundary";
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
    const latestRefresh = [
      ...waveThirtyFourAudit.products,
      ...waveThirtyThreeAudit.products,
    ].find((candidate) => candidate.candidateId === product.candidateId);
    if (latestRefresh) {
      assert.equal(
        verifiedRetailOffers[product.candidateId]?.length,
        latestRefresh.offers.length,
        product.candidateId,
      );
      continue;
    }
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

test("catalogue offer refresh wave 2 projects only current exact-SKU evidence", () => {
  const projected = waveTwoAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveTwoAudit.summary.productsReviewed, 4);
  assert.equal(projected.length, 10);
  assert.equal(waveTwoAudit.scheduledOwner.manifestRecurringOwner, null);
  for (const product of waveTwoAudit.products) {
    const latestRefresh = [
      ...waveThirtyFourAudit.products,
      ...waveThirtyThreeAudit.products,
    ].find((candidate) => candidate.candidateId === product.candidateId);
    if (latestRefresh) {
      assert.equal(
        verifiedRetailOffers[product.candidateId]?.length,
        latestRefresh.offers.length,
        product.candidateId,
      );
      continue;
    }
    assert.equal(
      verifiedRetailOffers[product.candidateId]?.length,
      product.offers.length,
      product.candidateId,
    );
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
      assert.ok(evidence.responseByteSize > 0);
      assert.ok(
        ["reviewed-browser-dom", "live-woocommerce-store-api"].includes(
          evidence.evidenceMethod,
        ),
      );
      assert.equal(
        Date.parse(evidence.expiresAt) - Date.parse(evidence.checkedAt),
        7 * 24 * 60 * 60 * 1000,
      );
    }
  }
});

test("catalogue offer refresh wave 3 releases admitted cells and fails the unit-mismatched cell closed", () => {
  const projected = waveThreeAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveThreeAudit.summary.productsReviewed, 4);
  assert.equal(waveThreeAudit.summary.productsReleased, 3);
  assert.equal(projected.length, 9);
  assert.equal(waveThreeAudit.scheduledOwner.manifestRecurringOwner, null);
  assert.deepEqual(
    waveThreeAudit.blockedProducts.map((product) => product.candidateId),
    ["naturium-glow-getter-multi-oil-body-scrub-8oz"],
  );
  for (const product of waveThreeAudit.products) {
    const latestRefresh = [
      ...waveThirtyFourAudit.products,
      ...waveThirtyThreeAudit.products,
    ].find((candidate) => candidate.candidateId === product.candidateId);
    if (latestRefresh) {
      assert.equal(
        verifiedRetailOffers[product.candidateId]?.length,
        latestRefresh.offers.length,
        product.candidateId,
      );
      continue;
    }
    assert.equal(
      verifiedRetailOffers[product.candidateId]?.length,
      product.offers.length,
      product.candidateId,
    );
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
      assert.ok(evidence.responseByteSize > 0);
      assert.ok(
        ["reviewed-browser-dom", "live-woocommerce-store-api"].includes(
          evidence.evidenceMethod,
        ),
      );
      assert.equal(
        Date.parse(evidence.expiresAt) - Date.parse(evidence.checkedAt),
        7 * 24 * 60 * 60 * 1000,
      );
    }
  }
});

test("catalogue offer refresh wave 4 projects exact tube cells and blocks package drift", () => {
  const projected = waveFourAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveFourAudit.summary.productsReviewed, 8);
  assert.equal(waveFourAudit.summary.productsReleased, 3);
  assert.equal(projected.length, 5);
  assert.equal(waveFourAudit.scheduledOwner.manifestRecurringOwner, null);
  assert.deepEqual(
    waveFourAudit.blockedProducts.map((product) => product.candidateId),
    [
      "naturium-vitamin-c-complex-serum-1fl-oz",
      "naturium-niacinamide-serum-12-percent-1fl-oz",
      "naturium-salicylic-acid-serum-2-percent-1fl-oz",
      "naturium-retinol-complex-serum-1fl-oz",
      "naturium-niacinamide-gel-cream-5-1-7oz",
    ],
  );
  for (const product of waveFourAudit.products) {
    assert.equal(
      verifiedRetailOffers[product.candidateId]?.length,
      product.offers.length,
      product.candidateId,
    );
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
      assert.ok(evidence.responseByteSize > 0);
      assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
      assert.ok(evidence.packageImageByteSize > 0);
      assert.equal(
        Date.parse(evidence.expiresAt) - Date.parse(evidence.checkedAt),
        7 * 24 * 60 * 60 * 1000,
      );
    }
  }
});

test("catalogue offer refresh wave 5 projects exact legacy cells and isolates new blockers", () => {
  const projected = waveFiveAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveFiveAudit.summary.productsReviewed, 7);
  assert.equal(waveFiveAudit.summary.productsReleased, 3);
  assert.equal(projected.length, 6);
  assert.equal(waveFiveAudit.scheduledOwner.manifestRecurringOwner, null);
  assert.deepEqual(
    waveFiveAudit.blockedProducts.map((product) => product.candidateId),
    [
      "dove-moroccan-argan-oil-beauty-bar",
      "b-lab-matcha-hydrating-real-sunscreen",
      "kuza-indian-hemp-hair-scalp-treatment",
    ],
  );
  assert.equal(waveFiveAudit.carriedIdentityBlockers.length, 6);
  assert.deepEqual(
    waveFiveAudit.notReleasedProducts.map((product) => product.candidateId),
    ["nizoral-ad-ketoconazole-shampoo"],
  );
  assert.equal(
    verifiedRetailOffers["nizoral-ad-ketoconazole-shampoo"],
    undefined,
  );
  for (const product of waveFiveAudit.products) {
    assert.equal(
      verifiedRetailOffers[product.candidateId]?.filter(
        (offer) =>
          product.offers.some((evidence) => evidence.url === offer.url) &&
          offer.available !== false &&
          Boolean(offer.expiresAt) &&
          Date.parse(offer.expiresAt!) >= Date.parse(waveFiveAudit.reviewedAt),
      ).length,
      product.offers.length,
      product.candidateId,
    );
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
      assert.ok(evidence.responseByteSize > 0);
      assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
      assert.ok(evidence.packageImageByteSize > 0);
      assert.equal(
        Date.parse(evidence.expiresAt) - Date.parse(evidence.checkedAt),
        7 * 24 * 60 * 60 * 1000,
      );
    }
  }
});

test("catalogue offer refresh wave 6 projects exact package cells and blocks a unit conflict", () => {
  const projected = waveSixAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveSixAudit.summary.productsReviewed, 4);
  assert.equal(waveSixAudit.summary.productsReleased, 3);
  assert.equal(projected.length, 6);
  assert.equal(waveSixAudit.scheduledOwner.manifestRecurringOwner, null);
  assert.equal(waveSixAudit.scheduledOwner.latestObservedRun.due, 0);
  assert.equal(waveSixAudit.scheduledOwner.latestObservedRun.processing, 0);
  assert.deepEqual(
    waveSixAudit.blockedProducts.map((product) => product.candidateId),
    ["lush-hair-mentholated-conditioner"],
  );
  assert.equal(waveSixAudit.carriedIdentityBlockers.length, 9);
  for (const product of waveSixAudit.products) {
    assert.equal(
      verifiedRetailOffers[product.candidateId]?.filter(
        (offer) =>
          offer.available !== false &&
          Boolean(offer.expiresAt) &&
          Date.parse(offer.expiresAt!) >= Date.parse(waveSixAudit.reviewedAt),
      ).length,
      product.offers.length,
      product.candidateId,
    );
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
      assert.ok(evidence.responseByteSize > 0);
      assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
      assert.ok(evidence.packageImageByteSize > 0);
      assert.equal(
        Date.parse(evidence.expiresAt) - Date.parse(evidence.checkedAt),
        7 * 24 * 60 * 60 * 1000,
      );
    }
  }
});

test("catalogue offer refresh wave 7 updates exact COSRX cells and rejects the redirected 50 ml sibling", () => {
  const product = waveSevenAudit.products[0];
  assert.ok(product);
  assert.equal(waveSevenAudit.summary.productsReviewed, 1);
  assert.equal(waveSevenAudit.summary.productsReleased, 1);
  assert.equal(waveSevenAudit.summary.offersReviewed, 5);
  assert.equal(waveSevenAudit.summary.offersAdmitted, 4);
  assert.equal(waveSevenAudit.summary.offersBlocked, 1);
  assert.equal(
    waveSevenAudit.scheduledOwner.latestObservedRun.activeBacklog,
    0,
  );
  assert.equal(waveSevenAudit.scheduledOwner.latestObservedRun.due, 0);
  assert.equal(waveSevenAudit.scheduledOwner.latestObservedRun.processing, 0);
  assert.equal(waveSevenAudit.carriedProductBlockers.length, 10);

  const projected = verifiedRetailOffers[product.candidateId] ?? [];
  assert.equal(
    projected.some((offer) => offer.retailer === "BuyBetter"),
    false,
  );
  assert.equal(product.notProjected[0]?.observedSize, "50 ml");
  assert.match(product.notProjected[0]?.reason ?? "", /150 ml.*50 ml/);

  for (const evidence of product.offers) {
    const offer = projected.find((candidate) => candidate.url === evidence.url);
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, true);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    assert.equal(offer.priceObservation?.size, product.identity.size);
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.packageImageByteSize > 0);
    assert.equal(
      Date.parse(evidence.expiresAt) - Date.parse(evidence.checkedAt),
      7 * 24 * 60 * 60 * 1000,
    );
  }
});

test("catalogue offer refresh wave 8 releases exact Aqua Rich cells without normalizing blocked siblings", () => {
  const projected = waveEightAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveEightAudit.summary.productsReviewed, 2);
  assert.equal(waveEightAudit.summary.productsReleased, 2);
  assert.equal(waveEightAudit.summary.offersReviewed, 5);
  assert.equal(waveEightAudit.summary.offersAdmitted, 3);
  assert.equal(waveEightAudit.summary.offersBlocked, 2);
  assert.equal(projected.length, 3);
  assert.equal(
    waveEightAudit.scheduledOwner.latestObservedRun.activeBacklog,
    0,
  );
  assert.deepEqual(
    waveEightAudit.blockedCells.map((cell) => cell.retailer),
    ["CSi Grocery", "TOS Nigeria"],
  );
  assert.equal(waveEightAudit.carriedProductBlockers.length, 10);
  assert.equal(
    verifiedRetailOffers[
      "aqua-rich-niacinamide-alpha-arbutin-body-wash-1000ml"
    ]?.some((offer) => offer.retailer === "TOS Nigeria"),
    false,
  );

  for (const product of waveEightAudit.products) {
    const offers = verifiedRetailOffers[product.candidateId] ?? [];
    for (const evidence of product.offers) {
      const offer = offers.find((candidate) => candidate.url === evidence.url);
      assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
      assert.equal(offer.retailer, evidence.retailer);
      assert.equal(offer.priceNgn, evidence.priceNgn);
      assert.equal(offer.available, true);
      assert.equal(offer.priceObservation?.stock, evidence.stock);
      assert.equal(offer.priceObservation?.size, product.identity.size);
      assert.equal(offer.checkedAt, evidence.checkedAt);
      assert.equal(offer.expiresAt, evidence.expiresAt);
      assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
      assert.ok(evidence.responseByteSize > 0);
      assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
      assert.ok(evidence.packageImageByteSize > 0);
      assert.equal(
        Date.parse(evidence.expiresAt) - Date.parse(evidence.checkedAt),
        7 * 24 * 60 * 60 * 1000,
      );
    }
  }
});

test("catalogue offer refresh wave 9 releases exact product cells and preserves current out-of-stock truth", () => {
  const projected = waveNineAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveNineAudit.matrix.unit, "exact product SKU");
  assert.equal(waveNineAudit.matrix.before, 23);
  assert.equal(waveNineAudit.matrix.after, 26);
  assert.equal(waveNineAudit.matrix.total, 162);
  assert.equal(waveNineAudit.summary.productsReviewed, 3);
  assert.equal(waveNineAudit.summary.productsReleased, 3);
  assert.equal(waveNineAudit.summary.offersReviewed, 10);
  assert.equal(waveNineAudit.summary.offersAdmitted, 8);
  assert.equal(waveNineAudit.summary.shopperActiveOffers, 6);
  assert.equal(waveNineAudit.summary.outOfStockObservations, 2);
  assert.equal(waveNineAudit.summary.offersBlocked, 2);
  assert.equal(projected.length, 8);
  assert.equal(waveNineAudit.scheduledOwner.latestObservedRun.activeBacklog, 0);
  assert.deepEqual(
    waveNineAudit.blockedCells.map((cell) => cell.retailer),
    ["Jumia", "BabesQuarters"],
  );
  assert.equal(waveNineAudit.carriedProductBlockers.length, 10);

  const eyeOffers =
    verifiedRetailOffers["naturium-multi-peptide-eye-cream-0-5oz"] ?? [];
  assert.equal(
    eyeOffers.some((offer) => offer.retailer === "BabesQuarters"),
    false,
  );
  const staleJumia = eyeOffers.find((offer) => offer.retailer === "Jumia");
  assert.ok(staleJumia);
  assert.equal(
    isOfferFresh(staleJumia, new Date(waveNineAudit.reviewedAt)),
    false,
  );

  for (const product of waveNineAudit.products) {
    const offers = verifiedRetailOffers[product.candidateId] ?? [];
    for (const evidence of product.offers) {
      const offer = offers.find((candidate) => candidate.url === evidence.url);
      assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
      assert.equal(offer.retailer, evidence.retailer);
      assert.equal(offer.priceNgn, evidence.priceNgn);
      assert.equal(offer.available, evidence.available);
      assert.equal(offer.priceObservation?.stock, evidence.stock);
      assert.equal(offer.priceObservation?.size, product.identity.size);
      assert.equal(offer.checkedAt, evidence.checkedAt);
      assert.equal(offer.expiresAt, evidence.expiresAt);
      assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
      assert.ok(evidence.responseByteSize > 0);
      assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
      assert.ok(evidence.packageImageByteSize > 0);
      assert.equal(
        Date.parse(evidence.expiresAt) - Date.parse(evidence.checkedAt),
        7 * 24 * 60 * 60 * 1000,
      );
    }
  }
});

test("catalogue offer refresh wave 10 releases all exact EOS 473 ml retailer cells", () => {
  const projected = waveTenAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveTenAudit.matrix.unit, "exact product SKU");
  assert.equal(waveTenAudit.matrix.before, 26);
  assert.equal(waveTenAudit.matrix.after, 29);
  assert.equal(waveTenAudit.matrix.total, 162);
  assert.equal(waveTenAudit.summary.productsReviewed, 3);
  assert.equal(waveTenAudit.summary.productsReleased, 3);
  assert.equal(waveTenAudit.summary.offersReviewed, 12);
  assert.equal(waveTenAudit.summary.offersAdmitted, 12);
  assert.equal(waveTenAudit.summary.shopperActiveOffers, 12);
  assert.equal(waveTenAudit.summary.offersBlocked, 0);
  assert.equal(projected.length, 12);
  assert.equal(waveTenAudit.scheduledOwner.latestObservedRun.activeBacklog, 0);

  for (const product of waveTenAudit.products) {
    const offers = verifiedRetailOffers[product.candidateId] ?? [];
    assert.equal(offers.length, product.offers.length, product.candidateId);
    for (const evidence of product.offers) {
      const offer = offers.find((candidate) => candidate.url === evidence.url);
      assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
      assert.equal(offer.retailer, evidence.retailer);
      assert.equal(offer.priceNgn, evidence.priceNgn);
      assert.equal(offer.available, evidence.available);
      assert.equal(offer.priceObservation?.stock, evidence.stock);
      assert.equal(offer.priceObservation?.size, product.identity.size);
      assert.equal(offer.checkedAt, evidence.checkedAt);
      assert.equal(offer.expiresAt, evidence.expiresAt);
      assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
      assert.ok(evidence.responseByteSize > 0);
      assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
      assert.ok(evidence.packageImageByteSize > 0);
      assert.equal(
        Date.parse(evidence.expiresAt) - Date.parse(evidence.checkedAt),
        7 * 24 * 60 * 60 * 1000,
      );
    }
  }
});

test("catalogue offer refresh wave 11 releases five exact product cells and isolates blocked siblings", () => {
  const projected = waveElevenAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveElevenAudit.matrix.unit, "exact product SKU");
  assert.equal(waveElevenAudit.matrix.before, 29);
  assert.equal(waveElevenAudit.matrix.after, 34);
  assert.equal(waveElevenAudit.matrix.total, 162);
  assert.equal(waveElevenAudit.summary.productsReleased, 5);
  assert.equal(waveElevenAudit.summary.offersReviewed, 21);
  assert.equal(waveElevenAudit.summary.offersAdmitted, 11);
  assert.equal(waveElevenAudit.summary.offersBlocked, 10);
  assert.equal(projected.length, 11);
  assert.equal(
    waveElevenAudit.scheduledOwner.latestObservedRun.activeBacklog,
    0,
  );

  for (const product of waveElevenAudit.products) {
    const offers = verifiedRetailOffers[product.candidateId] ?? [];
    for (const evidence of product.offers) {
      const offer = offers.find((candidate) => candidate.url === evidence.url);
      assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
      assert.equal(offer.retailer, evidence.retailer);
      assert.equal(offer.priceNgn, evidence.priceNgn);
      assert.equal(offer.available, evidence.available);
      assert.equal(offer.priceObservation?.stock, evidence.stock);
      assert.equal(offer.priceObservation?.size, product.identity.size);
      assert.equal(offer.checkedAt, evidence.checkedAt);
      assert.equal(offer.expiresAt, evidence.expiresAt);
      assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
      assert.ok(evidence.responseByteSize > 0);
      if (
        typeof evidence.packageImageSha256 === "string" &&
        typeof evidence.packageImageByteSize === "number"
      ) {
        assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
        assert.ok(evidence.packageImageByteSize > 0);
      } else {
        assert.equal(evidence.packageReviewMethod, "reviewed-browser-render");
      }
    }
  }

  const asOf = new Date(waveElevenAudit.reviewedAt);
  for (const blocked of waveElevenAudit.blockedCells) {
    const offer = verifiedRetailOffers[blocked.candidateId]?.find(
      (candidate) => candidate.retailer === blocked.retailer,
    );
    assert.ok(offer, `${blocked.candidateId}: ${blocked.retailer}`);
    assert.equal(isOfferFresh(offer, asOf), false);
  }
});

test("catalogue offer refresh wave 12 releases clean cells and fails closed on package conflicts", () => {
  const projected = waveTwelveAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveTwelveAudit.matrix.unit, "exact product SKU");
  assert.equal(waveTwelveAudit.matrix.before, 34);
  assert.equal(waveTwelveAudit.matrix.after, 36);
  assert.equal(waveTwelveAudit.matrix.total, 162);
  assert.equal(waveTwelveAudit.summary.productsReviewed, 5);
  assert.equal(waveTwelveAudit.summary.productsReleased, 2);
  assert.equal(waveTwelveAudit.summary.productsBlocked, 3);
  assert.equal(waveTwelveAudit.summary.offersReviewed, 17);
  assert.equal(waveTwelveAudit.summary.offersAdmitted, 5);
  assert.equal(waveTwelveAudit.summary.offersBlocked, 12);
  assert.equal(projected.length, 5);
  assert.equal(waveTwelveAudit.carriedProductBlockers.length, 13);
  assert.equal(
    waveTwelveAudit.scheduledOwner.latestObservedRun.activeBacklog,
    0,
  );

  for (const product of waveTwelveAudit.products) {
    const offers = verifiedRetailOffers[product.candidateId] ?? [];
    for (const evidence of product.offers) {
      const offer = offers.find((candidate) => candidate.url === evidence.url);
      assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
      assert.equal(offer.retailer, evidence.retailer);
      assert.equal(offer.priceNgn, evidence.priceNgn);
      assert.equal(offer.available, evidence.available);
      assert.equal(offer.priceObservation?.stock, evidence.stock);
      const acceptedSizes = [
        product.identity.size,
        ...("packageLabelSize" in product.identity
          ? [product.identity.packageLabelSize]
          : []),
      ];
      assert.ok(
        acceptedSizes.includes(offer.priceObservation?.size ?? ""),
        `${product.candidateId}: ${evidence.retailer} has exact package size`,
      );
      assert.equal(offer.checkedAt, evidence.checkedAt);
      assert.equal(offer.expiresAt, evidence.expiresAt);
      assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
      assert.ok(evidence.responseByteSize > 0);
      assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
      assert.ok(evidence.packageImageByteSize > 0);
    }
  }

  const asOf = new Date(waveTwelveAudit.reviewedAt);
  for (const blocked of waveTwelveAudit.blockedCells) {
    const offer = verifiedRetailOffers[blocked.candidateId]?.find(
      (candidate) => candidate.retailer === blocked.retailer,
    );
    if (offer && isOfferFresh(offer, asOf)) {
      assert.equal(offer.available, false);
      assert.equal(offer.priceComparison, "exclude");
    }
  }

  const cosrx = catalogueProducts.find(
    (product) => product.slug === "cosrx-advanced-snail-96-mucin-power-essence",
  );
  assert.ok(cosrx);
  assert.deepEqual(
    cosrx.offers
      .filter((offer) => offer.available)
      .map((offer) => offer.retailer)
      .sort(),
    ["Beauty by Daz", "Konga Health", "Perona Beauty"],
  );

  const persistedCosrx = {
    ...cosrx,
    offers: cosrx.offers.map((offer) =>
      ["CSi Grocery", "Lux Beauty", "Care to Beauty"].includes(offer.retailer)
        ? {
            ...offer,
            available: true,
            checkedAt: "2026-08-28T16:00:00Z",
            priceComparison: undefined,
            listingEvidence: {
              ...offer.listingEvidence,
              observedAt: "2026-08-28T16:00:00Z",
              sourceUrl: offer.listingEvidence?.sourceUrl ?? offer.url,
              basis: offer.listingEvidence?.basis ?? "retailer-page",
            },
            priceObservation: {
              observedAt: "2026-08-28T16:00:00Z",
              variant: "Cosrx Advanced Snail 96 Mucin Power Essence",
              size: "100 ml",
              stock: "in-stock" as const,
              landedCost: "unknown" as const,
            },
          }
        : offer,
    ),
  };
  const [reconciledCosrx] = reconcilePublishedCatalogue(
    [persistedCosrx],
    [cosrx],
  );
  assert.deepEqual(
    reconciledCosrx.offers
      .filter((offer) => offer.available)
      .map((offer) => offer.retailer)
      .sort(),
    ["Beauty by Daz", "Konga Health", "Perona Beauty"],
  );
});

test("catalogue offer refresh wave 13 refreshes complete selected products and fails blocked siblings closed", () => {
  const projected = waveThirteenAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveThirteenAudit.matrix.before, 36);
  assert.equal(waveThirteenAudit.matrix.after, 41);
  assert.equal(waveThirteenAudit.matrix.total, 162);
  assert.equal(waveThirteenAudit.summary.productsReviewed, 5);
  assert.equal(projected.length, 15);
  assert.equal(waveThirteenAudit.blockedCells.length, 9);
  assert.equal(waveThirteenAudit.scheduledOwner.manifestRecurringOwner, null);

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    const acceptedSizes = [
      product.identity.size,
      ...("packageLabelSize" in product.identity
        ? [product.identity.packageLabelSize]
        : []),
    ];
    assert.ok(
      acceptedSizes.includes(offer.priceObservation?.size ?? ""),
      `${product.candidateId}: ${evidence.retailer} has exact package size`,
    );
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.packageImageByteSize > 0);
  }

  const asOf = new Date(waveThirteenAudit.reviewedAt);
  for (const blocked of waveThirteenAudit.blockedCells) {
    const offer = verifiedRetailOffers[blocked.candidateId]?.find(
      (candidate) => candidate.retailer === blocked.retailer,
    );
    assert.ok(offer, `${blocked.candidateId}: ${blocked.retailer}`);
    assert.equal(isOfferFresh(offer, asOf), true);
    assert.equal(offer.available, false);
    assert.equal(offer.priceComparison, "exclude");
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    [
      "cerave-acne-foaming-cream-wash-10-150ml",
      ["Beauty by Daz", "Perona Beauty", "Teeka4"],
    ],
    ["cerave-moisturising-cream-454g", ["Nectar Beauty Hub", "Perona Beauty"]],
    [
      "facefacts-vitamin-c-body-lotion-400ml",
      ["Allure Beauty", "Deoset", "Perona Beauty"],
    ],
    [
      "garnier-vitamin-c-brightening-day-cream-50ml",
      ["BuyBetter", "Perona Beauty", "Teeka4"],
    ],
    ["balance-niacinamide-blemish-recovery-serum-30ml", ["Perona Beauty"]],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    assert.deepEqual(
      product.offers
        .filter((offer) => offer.available)
        .map((offer) => offer.retailer)
        .sort(),
      expected,
      slug,
    );
  }
});

test("catalogue offer refresh wave 14 refreshes complete selected products and fails blocked siblings closed", () => {
  const projected = waveFourteenAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveFourteenAudit.matrix.before, 41);
  assert.equal(waveFourteenAudit.matrix.after, 46);
  assert.equal(waveFourteenAudit.matrix.total, 162);
  assert.equal(waveFourteenAudit.summary.productsReviewed, 5);
  assert.equal(projected.length, 11);
  assert.equal(waveFourteenAudit.blockedCells.length, 4);
  assert.equal(waveFourteenAudit.scheduledOwner.manifestRecurringOwner, null);

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    assert.equal(offer.priceObservation?.size, product.identity.size);
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    if (
      typeof evidence.packageImageSha256 === "string" &&
      typeof evidence.packageImageByteSize === "number"
    ) {
      assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
      assert.ok(evidence.packageImageByteSize > 0);
    } else {
      assert.equal(evidence.packageReviewMethod, "reviewed-browser-render");
      assert.equal(evidence.packageImageDirectFetchStatus, 406);
    }
  }

  const asOf = new Date(waveFourteenAudit.reviewedAt);
  for (const blocked of waveFourteenAudit.blockedCells) {
    const offer = verifiedRetailOffers[blocked.candidateId]?.find(
      (candidate) => candidate.retailer === blocked.retailer,
    );
    assert.ok(offer, `${blocked.candidateId}: ${blocked.retailer}`);
    assert.equal(isOfferFresh(offer, asOf), true);
    assert.equal(offer.available, false);
    assert.equal(offer.priceComparison, "exclude");
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    [
      "facefacts-enhance-gel-cream-cleanser-150ml",
      ["BuyBetter", "Perona Beauty"],
    ],
    ["aqua-rich-licorice-mulberry-body-lotion-500ml", ["BuyBetter", "Deoset"]],
    ["dang-beauty-water-toner-100ml", ["DANG Lifestyle", "Konga Health"]],
    [
      "dang-everyday-gentle-foaming-face-wash-120ml",
      ["DANG Lifestyle", "Konga Health", "Perona Beauty"],
    ],
    ["dang-hyaluronic-cream-hydrating-face-cleanser-200ml", ["DANG Lifestyle"]],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    assert.deepEqual(
      product.offers
        .filter((offer) => offer.available)
        .map((offer) => offer.retailer)
        .sort(),
      expected,
      slug,
    );
  }
});

test("catalogue offer refresh wave 15 publishes current stock truth across complete exact offer sets", () => {
  const projected = waveFifteenAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveFifteenAudit.matrix.before, 46);
  assert.equal(waveFifteenAudit.matrix.after, 51);
  assert.equal(waveFifteenAudit.matrix.total, 162);
  assert.equal(waveFifteenAudit.summary.productsReviewed, 5);
  assert.equal(projected.length, 17);
  assert.equal(waveFifteenAudit.blockedCells.length, 2);
  assert.equal(waveFifteenAudit.scheduledOwner.manifestRecurringOwner, null);

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    const acceptedSizes = [
      product.identity.size,
      ...("packageLabelSize" in product.identity &&
      product.identity.packageLabelSize
        ? [product.identity.packageLabelSize]
        : []),
    ];
    assert.ok(
      acceptedSizes.includes(offer.priceObservation?.size ?? ""),
      `${product.candidateId}: ${evidence.retailer} has exact package size`,
    );
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    if (
      typeof evidence.packageImageSha256 === "string" &&
      typeof evidence.packageImageByteSize === "number"
    ) {
      assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
      assert.ok(evidence.packageImageByteSize > 0);
    } else {
      assert.equal(evidence.packageReviewMethod, "reviewed-browser-render");
      assert.equal(evidence.packageImageDirectFetchStatus, 406);
    }
  }

  const asOf = new Date(waveFifteenAudit.reviewedAt);
  for (const blocked of waveFifteenAudit.blockedCells) {
    const offer = verifiedRetailOffers[blocked.candidateId]?.find(
      (candidate) => candidate.retailer === blocked.retailer,
    );
    assert.ok(offer, `${blocked.candidateId}: ${blocked.retailer}`);
    assert.equal(isOfferFresh(offer, asOf), true);
    assert.equal(offer.available, false);
    assert.equal(offer.priceComparison, "exclude");
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    ["dove-melanin-even-tone-body-wash-18-5oz", ["Perona Beauty"]],
    ["laroche-posay-mela-b3-serum-30ml", ["Deoset", "Dunes Center"]],
    [
      "facefacts-ceramide-blemish-gel-moisturiser-50ml",
      ["Beauty by Daz", "BuyBetter", "Deoset", "Perona Beauty"],
    ],
    [
      "skin-by-zaron-vitamin-c-body-wash-650ml",
      ["BuyBetter", "Deoset", "Perona Beauty"],
    ],
    ["tresemme-keratin-smooth-weightless-conditioner-828ml", []],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    assert.deepEqual(
      product.offers
        .filter((offer) => offer.available)
        .map((offer) => offer.retailer)
        .sort(),
      expected,
      slug,
    );
  }
});

test("catalogue offer refresh wave 16 expands rich exact offers and fails unsafe siblings closed", () => {
  const projected = waveSixteenAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveSixteenAudit.matrix.before, 51);
  assert.equal(waveSixteenAudit.matrix.after, 56);
  assert.equal(waveSixteenAudit.matrix.total, 162);
  assert.equal(waveSixteenAudit.summary.productsReviewed, 5);
  assert.equal(projected.length, 19);
  assert.equal(waveSixteenAudit.blockedCells.length, 4);
  assert.equal(waveSixteenAudit.scheduledOwner.manifestRecurringOwner, null);

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    const acceptedSizes = [
      product.identity.size,
      ...("packageLabelSize" in product.identity &&
      product.identity.packageLabelSize
        ? [product.identity.packageLabelSize]
        : []),
    ];
    assert.ok(
      acceptedSizes.includes(offer.priceObservation?.size ?? ""),
      `${product.candidateId}: ${evidence.retailer} has exact package size`,
    );
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    if (
      typeof evidence.packageImageSha256 === "string" &&
      typeof evidence.packageImageByteSize === "number"
    ) {
      assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
      assert.ok(evidence.packageImageByteSize > 0);
    } else {
      assert.equal(evidence.packageReviewMethod, "reviewed-browser-render");
      assert.equal(evidence.packageImageDirectFetchStatus, 406);
    }
  }

  const asOf = new Date(waveSixteenAudit.reviewedAt);
  for (const blocked of waveSixteenAudit.blockedCells) {
    const offer = verifiedRetailOffers[blocked.candidateId]?.find(
      (candidate) => candidate.retailer === blocked.retailer,
    );
    assert.ok(offer, `${blocked.candidateId}: ${blocked.retailer}`);
    assert.equal(isOfferFresh(offer, asOf), true);
    assert.equal(offer.available, false);
    assert.equal(offer.priceComparison, "exclude");
    assert.match(blocked.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(blocked.responseByteSize > 0);
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    [
      "dr-teals-nourish-protect-coconut-oil-body-wash-710ml",
      ["BuyBetter", "Nectar Beauty Hub", "Perfect Trust Beauty", "Reginah"],
    ],
    [
      "dove-skin-replenish-serum-body-wash-547ml",
      ["BuyBetter", "Deoset", "Kadimez Essentials"],
    ],
    [
      "dang-retinal-cream-005-30ml",
      ["Beauty Hut Africa", "Bracketts Beauty", "DANG Lifestyle"],
    ],
    [
      "dang-snail-secretion-filtrate-repair-face-cream-50g",
      ["Bracketts Beauty", "DANG Lifestyle", "Medplus", "Perona Beauty"],
    ],
    [
      "dang-vitamin-c-concentrated-serum-oil-free-30ml",
      [
        "Beauty Hut Africa",
        "Bracketts Beauty",
        "DANG Lifestyle",
        "Perona Beauty",
      ],
    ],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    assert.deepEqual(
      product.offers
        .filter((offer) => offer.available)
        .map((offer) => offer.retailer)
        .sort(),
      expected,
      slug,
    );
  }
});

test("catalogue offer refresh wave 17 expands rich exact offers and fails verification walls closed", () => {
  const projected = waveSeventeenAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveSeventeenAudit.matrix.before, 56);
  assert.equal(waveSeventeenAudit.matrix.after, 61);
  assert.equal(waveSeventeenAudit.matrix.total, 162);
  assert.equal(waveSeventeenAudit.summary.productsReviewed, 5);
  assert.equal(projected.length, 20);
  assert.equal(waveSeventeenAudit.blockedCells.length, 3);
  assert.equal(waveSeventeenAudit.scheduledOwner.manifestRecurringOwner, null);

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    const acceptedSizes = [
      product.identity.size,
      ...("packageLabelSize" in product.identity &&
      product.identity.packageLabelSize
        ? [product.identity.packageLabelSize]
        : []),
    ];
    assert.ok(
      acceptedSizes.includes(offer.priceObservation?.size ?? ""),
      `${product.candidateId}: ${evidence.retailer} has exact package size`,
    );
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.packageImageByteSize > 0);
  }

  const asOf = new Date(waveSeventeenAudit.reviewedAt);
  for (const blocked of waveSeventeenAudit.blockedCells) {
    const offer = verifiedRetailOffers[blocked.candidateId]?.find(
      (candidate) => candidate.retailer === blocked.retailer,
    );
    assert.ok(offer, `${blocked.candidateId}: ${blocked.retailer}`);
    assert.equal(isOfferFresh(offer, asOf), true);
    assert.equal(offer.available, false);
    assert.equal(offer.priceComparison, "exclude");
    assert.match(blocked.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(blocked.responseByteSize > 0);
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    [
      "la-roche-posay-effaclar-purifying-foaming-gel-400ml",
      [
        "Beauty Hut Africa",
        "Perona Beauty",
        "Rhema Beauty Shop",
        "Teeka4",
        "The Beauty Prism",
      ],
    ],
    [
      "de-la-cruz-acne-treatment-10-sulfur-73-7g",
      ["Beauty by Daz", "Deoset", "Perona Beauty"],
    ],
    [
      "facefacts-ceramide-hydrating-gentle-cleanser-400ml",
      ["Beauty Hut Africa", "Teeka4"],
    ],
    [
      "facefacts-vitamin-c-brightening-jelly-cleanser-150ml",
      ["BuyBetter", "Derma Essentials", "Muna Cosmetics"],
    ],
    [
      "cerave-sa-smoothing-cleanser-473ml",
      ["Beauty Hut Africa", "BuyBetter", "Deoset", "Perona Beauty", "Teeka4"],
    ],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    assert.deepEqual(
      product.offers
        .filter((offer) => offer.available)
        .map((offer) => offer.retailer)
        .sort(),
      expected,
      slug,
    );
  }
});

test("catalogue offer refresh wave 18 releases exact package versions and fails conflicted siblings closed", () => {
  const projected = waveEighteenAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveEighteenAudit.matrix.before, 61);
  assert.equal(waveEighteenAudit.matrix.after, 64);
  assert.equal(waveEighteenAudit.matrix.total, 162);
  assert.equal(waveEighteenAudit.summary.productsReviewed, 3);
  assert.equal(projected.length, 21);
  assert.equal(waveEighteenAudit.blockedCells.length, 5);
  assert.equal(waveEighteenAudit.scheduledOwner.manifestRecurringOwner, null);

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    assert.equal(offer.priceObservation?.size, product.identity.size);
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.packageImageByteSize > 0);
  }

  const asOf = new Date(waveEighteenAudit.reviewedAt);
  for (const blocked of waveEighteenAudit.blockedCells) {
    const offer = verifiedRetailOffers[blocked.candidateId]?.find(
      (candidate) => candidate.retailer === blocked.retailer,
    );
    assert.ok(offer, `${blocked.candidateId}: ${blocked.retailer}`);
    assert.equal(isOfferFresh(offer, asOf), true);
    assert.equal(offer.available, false);
    assert.equal(offer.priceComparison, "exclude");
    assert.match(blocked.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(blocked.responseByteSize > 0);
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    [
      "anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml",
      [
        "Beauty Hut Africa",
        "Beauty by Daz",
        "BuyBetter",
        "Deoset",
        "Kadimez Essentials",
        "Konga Health",
        "Perona Beauty",
      ],
    ],
    [
      "eucerin-oil-control-sun-gel-cream-spf50-50ml",
      [
        "Beauty Hut Africa",
        "Beauty by Daz",
        "Deoset",
        "Konga Health",
        "Perona Beauty",
        "Teeka4",
      ],
    ],
    [
      "nineless-mela-pro-rice-txa-toner-200ml",
      [
        "Beauty Hut Africa",
        "BuyBetter",
        "Deoset",
        "Konga Health",
        "Muna Cosmetics",
        "Perona Beauty",
      ],
    ],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    assert.deepEqual(
      product.offers
        .filter((offer) => offer.available)
        .map((offer) => offer.retailer)
        .sort(),
      expected,
      slug,
    );
  }
});

test("catalogue offer refresh wave 19 releases exact FaceFacts cleanser packages and fails conflicted siblings closed", () => {
  const projected = waveNineteenAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveNineteenAudit.matrix.before, 64);
  assert.equal(waveNineteenAudit.matrix.after, 66);
  assert.equal(waveNineteenAudit.matrix.total, 162);
  assert.equal(waveNineteenAudit.summary.productsReviewed, 2);
  assert.equal(projected.length, 9);
  assert.equal(waveNineteenAudit.blockedCells.length, 8);
  assert.equal(waveNineteenAudit.scheduledOwner.manifestRecurringOwner, null);

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    assert.equal(offer.priceObservation?.size, product.identity.size);
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.packageImageByteSize > 0);
  }

  const asOf = new Date(waveNineteenAudit.reviewedAt);
  for (const blocked of waveNineteenAudit.blockedCells) {
    const offer = verifiedRetailOffers[blocked.candidateId]?.find(
      (candidate) => candidate.retailer === blocked.retailer,
    );
    if (offer) {
      assert.equal(isOfferFresh(offer, asOf), true);
      assert.equal(offer.available, false);
      assert.equal(offer.priceComparison, "exclude");
    }
    assert.match(blocked.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(blocked.responseByteSize > 0);
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    [
      "facefacts-ceramide-foaming-cleanser-400ml",
      ["BuyBetter", "Konga Health", "Slique Beauty", "Teeka4"],
    ],
    [
      "facefacts-ceramide-oil-control-foaming-cleanser-400ml",
      ["BuyBetter", "Deoset", "Kadimez Essentials"],
    ],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    assert.deepEqual(
      product.offers
        .filter((offer) => offer.available)
        .map((offer) => offer.retailer)
        .sort(),
      expected,
      slug,
    );
  }
});

test("catalogue offer refresh wave 20 releases exact package siblings and isolates the base-identity hold", () => {
  const projected = waveTwentyAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveTwentyAudit.matrix.before, 66);
  assert.equal(waveTwentyAudit.matrix.after, 70);
  assert.equal(waveTwentyAudit.matrix.total, 162);
  assert.equal(waveTwentyAudit.summary.productsReviewed, 4);
  assert.equal(projected.length, 17);
  assert.equal(waveTwentyAudit.blockedCells.length, 13);
  assert.equal(waveTwentyAudit.heldCandidates.length, 1);
  assert.equal(waveTwentyAudit.scheduledOwner.manifestRecurringOwner, null);

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    assert.equal(offer.priceObservation?.size, product.identity.size);
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.packageImageByteSize > 0);
  }

  const asOf = new Date(waveTwentyAudit.reviewedAt);
  for (const blocked of waveTwentyAudit.blockedCells) {
    const offer = verifiedRetailOffers[blocked.candidateId]?.find(
      (candidate) => candidate.retailer === blocked.retailer,
    );
    assert.ok(offer, `${blocked.candidateId}: ${blocked.retailer}`);
    assert.equal(isOfferFresh(offer, asOf), true);
    assert.equal(offer.available, false);
    assert.equal(offer.priceComparison, "exclude");
    assert.match(blocked.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(blocked.responseByteSize > 0);
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    [
      "cerave-hydrating-cleanser-473ml",
      ["BuyBetter", "Konga Health", "Teeka4"],
    ],
    ["facefacts-soothe-glow-niacinamide-serum-30ml", ["Teeka4"]],
    ["neutrogena-light-sesame-body-oil-8-5oz", ["Perona Beauty", "Teeka4"]],
    [
      "panoxyl-acne-creamy-wash-4-170g",
      [
        "Beauty Hut Africa",
        "Beauty by Daz",
        "BuyBetter",
        "Deoset",
        "Konga Health",
        "Perona Beauty",
        "Teeka4",
      ],
    ],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    assert.deepEqual(
      product.offers
        .filter((offer) => offer.available)
        .map((offer) => offer.retailer)
        .sort(),
      expected,
      slug,
    );
  }

  const [held] = waveTwentyAudit.heldCandidates;
  assert.equal(
    held.candidateId,
    "advanced-clinicals-vitamin-c-face-serum-52ml",
  );
  assert.match(held.reason, /1-75oz.*1\.75 fl oz \/ 52 ml/);
  assert.equal(
    verifiedRetailOffers[held.candidateId]?.some((offer) =>
      isOfferFresh(offer, asOf),
    ),
    false,
  );
});

test("catalogue offer refresh wave 21 releases four exact packages and isolates the Simple reformulation", () => {
  const projected = waveTwentyOneAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveTwentyOneAudit.matrix.before, 70);
  assert.equal(waveTwentyOneAudit.matrix.after, 74);
  assert.equal(waveTwentyOneAudit.matrix.total, 162);
  assert.equal(waveTwentyOneAudit.summary.productsReviewed, 5);
  assert.equal(waveTwentyOneAudit.summary.productsReleased, 4);
  assert.equal(waveTwentyOneAudit.summary.productsBlocked, 1);
  assert.equal(projected.length, 26);
  assert.equal(waveTwentyOneAudit.blockedCells.length, 25);
  assert.equal(waveTwentyOneAudit.heldCandidates.length, 1);
  assert.equal(waveTwentyOneAudit.scheduledOwner.manifestRecurringOwner, null);

  for (const { product, offer: evidence } of projected) {
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
    assert.ok(evidence.responseByteSize > 0);
    assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.packageImageByteSize > 0);
  }

  const asOf = new Date(waveTwentyOneAudit.reviewedAt);
  for (const blocked of waveTwentyOneAudit.blockedCells) {
    if (
      typeof blocked.responseSha256 === "string" &&
      typeof blocked.responseByteSize === "number"
    ) {
      assert.match(blocked.responseSha256, /^[a-f0-9]{64}$/);
      assert.ok(blocked.responseByteSize > 0);
    }
    const offer = verifiedRetailOffers[blocked.candidateId]?.find(
      (candidate) => candidate.url === blocked.url,
    );
    if (offer) {
      const refreshed = waveThirtyOneAudit.products
        .find((product) => product.candidateId === blocked.candidateId)
        ?.offers.find((candidate) => candidate.url === blocked.url);
      if (refreshed) {
        assert.equal(offer.available, refreshed.available);
        assert.equal(offer.checkedAt, refreshed.checkedAt);
        continue;
      }
      assert.equal(isOfferFresh(offer, asOf), true);
      assert.equal(offer.available, false);
      assert.equal(offer.priceComparison, "exclude");
    }
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    [
      "anua-zero-cast-moisturizing-finish-sunscreen-50ml",
      [
        "BuyBetter",
        "Deoset",
        "Konga Health",
        "Nectar Beauty Hub",
        "Nihet Beauty",
        "Perona Beauty",
        "TOS Nigeria",
        "The Beauty Prism",
      ],
    ],
    [
      "cerave-pm-facial-moisturising-lotion-52ml",
      ["Beauty Hut Africa", "Dunes Center", "Shoppaton Store"],
    ],
    [
      "eucerin-urearepair-plus-10-urea-body-lotion-250ml",
      [
        "Beauty Hut Africa",
        "Beauty by Daz",
        "Deoset",
        "Konga Health",
        "Nectar Beauty Hub",
        "Perona Beauty",
        "Teeka4",
        "The Beauty Prism",
      ],
    ],
    [
      "nineless-a-control-10-azelaic-acid-serum-30ml",
      [
        "Beauty Hut Africa",
        "Beauty by Daz",
        "Buy Skincare in Abuja",
        "Deoset",
        "Konga Health",
        "Nectar Beauty Hub",
        "The Skin Hookup",
      ],
    ],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    assert.deepEqual(
      product.offers
        .filter((offer) => offer.available)
        .map((offer) => offer.retailer)
        .sort(),
      expected,
      slug,
    );
  }

  const [held] = waveTwentyOneAudit.heldCandidates;
  assert.equal(
    held.candidateId,
    "simple-kind-to-skin-refreshing-facial-gel-wash-150ml",
  );
  assert.match(held.reason, /N°1 UK badge.*NEW B5\+E/);
  assert.ok(
    waveThirtyOneAudit.products.some(
      (product) => product.candidateId === held.candidateId,
    ),
  );
  assert.equal(
    verifiedRetailOffers[held.candidateId]?.some((offer) => offer.available),
    true,
  );
});

test("catalogue offer refresh wave 22 releases five exact packages and fails conflicted siblings closed", () => {
  const projected = waveTwentyTwoAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveTwentyTwoAudit.matrix.before, 74);
  assert.equal(waveTwentyTwoAudit.matrix.after, 79);
  assert.equal(waveTwentyTwoAudit.matrix.total, 162);
  assert.equal(waveTwentyTwoAudit.summary.productsReviewed, 5);
  assert.equal(waveTwentyTwoAudit.summary.productsReleased, 5);
  assert.equal(waveTwentyTwoAudit.summary.productsBlocked, 0);
  assert.equal(projected.length, 26);
  assert.equal(waveTwentyTwoAudit.summary.shopperActiveOffers, 22);
  assert.equal(waveTwentyTwoAudit.summary.outOfStockObservations, 4);
  assert.equal(waveTwentyTwoAudit.blockedCells.length, 14);
  assert.equal(waveTwentyTwoAudit.heldCandidates.length, 0);
  assert.equal(waveTwentyTwoAudit.scheduledOwner.manifestRecurringOwner, null);

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    assert.equal(offer.priceObservation?.size, product.identity.size);
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.packageImageByteSize > 0);
  }

  const asOf = new Date(waveTwentyTwoAudit.reviewedAt);
  for (const blocked of waveTwentyTwoAudit.blockedCells) {
    assert.match(blocked.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(blocked.responseByteSize > 0);
    const offer = verifiedRetailOffers[blocked.candidateId]?.find(
      (candidate) => candidate.url === blocked.url,
    );
    if (offer) {
      assert.equal(isOfferFresh(offer, asOf), true);
      assert.equal(offer.available, false);
      assert.equal(offer.priceComparison, "exclude");
    }
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    [
      "nivea-perfect-radiant-body-lotion-400ml",
      ["Allure Beauty", "Deoset", "Konga Health", "Perona Beauty", "Teeka4"],
    ],
    [
      "balance-salicylic-acid-zinc-clarifying-toner-200ml",
      [
        "Beauty by Daz",
        "Deoset",
        "Konga Health",
        "Muna Cosmetics",
        "Perona Beauty",
      ],
    ],
    [
      "dang-hydra-glow-sun-protection-gel-60ml",
      [
        "Beauty Hut Africa",
        "Bracketts Beauty",
        "DANG Lifestyle",
        "Konga Health",
        "Perona Beauty",
      ],
    ],
    [
      "dang-niacinamide-n-acetyl-glucosamine-serum-30ml",
      ["Konga Health", "Perona Beauty"],
    ],
    [
      "dang-azelaic-acid-serum-30ml",
      ["DANG Lifestyle", "Konga Health", "Perona Beauty"],
    ],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    assert.deepEqual(
      product.offers
        .filter((offer) => offer.available)
        .map((offer) => offer.retailer)
        .sort(),
      expected,
      slug,
    );
  }
});

test("catalogue offer refresh wave 23 releases five exact packages and fails mismatched siblings closed", () => {
  const projected = waveTwentyThreeAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveTwentyThreeAudit.matrix.before, 79);
  assert.equal(waveTwentyThreeAudit.matrix.after, 84);
  assert.equal(waveTwentyThreeAudit.matrix.total, 162);
  assert.equal(waveTwentyThreeAudit.summary.productsReviewed, 5);
  assert.equal(waveTwentyThreeAudit.summary.productsReleased, 5);
  assert.equal(waveTwentyThreeAudit.summary.productsBlocked, 0);
  assert.equal(projected.length, 20);
  assert.equal(waveTwentyThreeAudit.summary.shopperActiveOffers, 16);
  assert.equal(waveTwentyThreeAudit.summary.outOfStockObservations, 4);
  assert.equal(waveTwentyThreeAudit.blockedCells.length, 15);
  assert.equal(waveTwentyThreeAudit.heldCandidates.length, 0);
  assert.equal(
    waveTwentyThreeAudit.scheduledOwner.manifestRecurringOwner,
    null,
  );

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    assert.equal(offer.priceObservation?.size, product.identity.size);
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.packageImageByteSize > 0);
  }

  const asOf = new Date(waveTwentyThreeAudit.reviewedAt);
  for (const blocked of waveTwentyThreeAudit.blockedCells) {
    assert.match(blocked.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(blocked.responseByteSize > 0);
    const offer = verifiedRetailOffers[blocked.candidateId]?.find(
      (candidate) => candidate.url === blocked.url,
    );
    if (offer) {
      assert.equal(isOfferFresh(offer, asOf), true);
      assert.equal(offer.available, false);
      assert.equal(offer.priceComparison, "exclude");
    }
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    [
      "cosrx-advanced-snail-92-all-in-one-cream-100g-jar",
      ["Beauty by Daz", "Konga Health", "Nectar Beauty Hub", "Perona Beauty"],
    ],
    [
      "cerave-blemish-control-cleanser",
      ["Beauty Hut Africa", "Konga Health", "Perona Beauty", "Teeka4"],
    ],
    [
      "cerave-foaming-facial-cleanser",
      ["Beauty Hut Africa", "Beyond MedPlus", "Ediths Essentials", "Teeka4"],
    ],
    [
      "dove-calming-moisture-body-wash-547ml",
      ["Ceendies Creations", "Deoset", "Ediths Essentials"],
    ],
    ["prequel-gleanser-glycolic-acid-cleanser-400ml", ["Nihet Beauty"]],
  ]);
  const expectedFloors = new Map<string, number>([
    ["cosrx-advanced-snail-92-all-in-one-cream-100g-jar", 12_850],
    ["cerave-blemish-control-cleanser", 14_800],
    ["cerave-foaming-facial-cleanser", 14_700],
    ["dove-calming-moisture-body-wash-547ml", 23_000],
    ["prequel-gleanser-glycolic-acid-cleanser-400ml", 96_000],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    const active = product.offers.filter((offer) => offer.available);
    assert.deepEqual(
      active.map((offer) => offer.retailer).sort(),
      expected,
      slug,
    );
    assert.equal(
      Math.min(
        ...active.map((offer) => offer.priceNgn ?? Number.POSITIVE_INFINITY),
      ),
      expectedFloors.get(slug),
      slug,
    );
  }

  const registered = new Set(nigeriaRetailers.map((retailer) => retailer.name));
  assert.equal(registered.has("Beyond MedPlus"), true);
  assert.equal(registered.has("Ceendies Creations"), true);
});

test("catalogue offer refresh wave 24 releases five exact packages and isolates stale or conflicting listings", () => {
  const projected = waveTwentyFourAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveTwentyFourAudit.matrix.before, 84);
  assert.equal(waveTwentyFourAudit.matrix.after, 89);
  assert.equal(waveTwentyFourAudit.matrix.total, 162);
  assert.equal(waveTwentyFourAudit.summary.productsReviewed, 5);
  assert.equal(waveTwentyFourAudit.summary.productsReleased, 5);
  assert.equal(waveTwentyFourAudit.summary.productsBlocked, 0);
  assert.equal(projected.length, 22);
  assert.equal(waveTwentyFourAudit.summary.shopperActiveOffers, 17);
  assert.equal(waveTwentyFourAudit.summary.outOfStockObservations, 3);
  assert.equal(waveTwentyFourAudit.blockedCells.length, 12);
  assert.equal(waveTwentyFourAudit.heldCandidates.length, 0);
  assert.equal(waveTwentyFourAudit.scheduledOwner.manifestRecurringOwner, null);
  assert.equal(
    waveTwentyFourAudit.scheduledOwner.latestObservedRun.queued,
    100,
  );
  assert.equal(
    waveTwentyFourAudit.scheduledOwner.latestObservedRun.activeBacklog,
    98,
  );

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    assert.equal(offer.priceObservation?.size, product.identity.size);
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    if (
      typeof evidence.packageImageSha256 === "string" &&
      typeof evidence.packageImageByteSize === "number"
    ) {
      assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
      assert.ok(evidence.packageImageByteSize > 0);
    } else {
      assert.equal(evidence.stock, "unknown");
      assert.equal(offer.priceComparison, "exclude");
    }
  }

  for (const blocked of waveTwentyFourAudit.blockedCells) {
    assert.match(blocked.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(blocked.responseByteSize > 0);
    const offer = verifiedRetailOffers[blocked.candidateId]?.find(
      (candidate) => candidate.url === blocked.url,
    );
    if (offer) {
      assert.equal(offer.available, false);
      assert.equal(offer.priceObservation?.stock, "unknown");
      assert.equal(offer.priceComparison, "exclude");
    }
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    [
      "good-molecules-hyaluronic-acid-serum-30ml",
      [
        "Buy Skincare in Abuja",
        "Gifty Beauty Store",
        "Konga Health",
        "Nectar Beauty Hub",
      ],
    ],
    [
      "good-molecules-niacinamide-serum-30ml",
      [
        "DiasBeauty Cosmetics",
        "Konga Health",
        "Lami Fragrance",
        "Perona Beauty",
      ],
    ],
    [
      "beauty-formulas-glowing-serum-2-vitamin-c-30ml",
      [
        "Beauty by Daz",
        "Bodycare",
        "Perona Beauty",
        "Skin Pop Essentiel",
        "TOS Nigeria",
      ],
    ],
    ["benton-honest-cleansing-foam-150g", ["BuyBetter"]],
    [
      "the-ordinary-glycolic-acid-7-exfoliating-toner-240ml",
      ["Buy Skincare in Abuja", "Nectar Beauty Hub", "ShopStation"],
    ],
  ]);
  const expectedFloors = new Map<string, number>([
    ["good-molecules-hyaluronic-acid-serum-30ml", 10_800],
    ["good-molecules-niacinamide-serum-30ml", 11_000],
    ["beauty-formulas-glowing-serum-2-vitamin-c-30ml", 3_999],
    ["benton-honest-cleansing-foam-150g", 9_675],
    ["the-ordinary-glycolic-acid-7-exfoliating-toner-240ml", 27_000],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    const active = product.offers.filter((offer) => offer.available);
    assert.deepEqual(
      active.map((offer) => offer.retailer).sort(),
      expected,
      slug,
    );
    assert.equal(
      Math.min(
        ...active.map((offer) => offer.priceNgn ?? Number.POSITIVE_INFINITY),
      ),
      expectedFloors.get(slug),
      slug,
    );
  }

  const registered = new Set(nigeriaRetailers.map((retailer) => retailer.name));
  for (const retailer of [
    "Gifty Beauty Store",
    "Lami Fragrance",
    "DiasBeauty Cosmetics",
    "Skin Pop Essentiel",
    "Bodycare",
  ]) {
    assert.equal(registered.has(retailer), true, retailer);
  }
});

test("catalogue offer refresh wave 25 releases four exact packages and holds the ABIB reformulation conflict", () => {
  const projected = waveTwentyFiveAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveTwentyFiveAudit.matrix.before, 89);
  assert.equal(waveTwentyFiveAudit.matrix.after, 93);
  assert.equal(waveTwentyFiveAudit.matrix.total, 162);
  assert.equal(waveTwentyFiveAudit.summary.productsReviewed, 5);
  assert.equal(waveTwentyFiveAudit.summary.productsReleased, 4);
  assert.equal(waveTwentyFiveAudit.summary.productsBlocked, 1);
  assert.equal(waveTwentyFiveAudit.summary.offersAdmitted, 13);
  assert.equal(waveTwentyFiveAudit.summary.shopperActiveOffers, 11);
  assert.equal(waveTwentyFiveAudit.summary.outOfStockObservations, 2);
  assert.equal(waveTwentyFiveAudit.summary.offersBlocked, 15);
  assert.equal(projected.length, 13);
  assert.equal(waveTwentyFiveAudit.blockedCells.length, 13);
  assert.equal(waveTwentyFiveAudit.excludedDiscoveries.length, 2);
  assert.equal(waveTwentyFiveAudit.heldCandidates.length, 1);
  assert.equal(waveTwentyFiveAudit.scheduledOwner.manifestRecurringOwner, null);
  assert.equal(
    waveTwentyFiveAudit.scheduledOwner.latestObservedRun.activeBacklog,
    98,
  );

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    assert.equal(offer.priceObservation?.size, product.identity.size);
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.packageImageByteSize > 0);
  }

  for (const blocked of waveTwentyFiveAudit.blockedCells) {
    assert.match(blocked.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(blocked.responseByteSize > 0);
    const offer = verifiedRetailOffers[blocked.candidateId]?.find(
      (candidate) => candidate.url === blocked.url,
    );
    if (offer) {
      assert.equal(offer.available, false);
      assert.equal(offer.priceObservation?.stock, "unknown");
      assert.equal(offer.priceComparison, "exclude");
    }
  }

  const held = verifiedRetailOffers["abib-heartleaf-foam-cleanser-150ml"];
  assert.ok(held);
  assert.equal(held.length, 3);
  for (const offer of held) {
    assert.equal(offer.available, false);
    assert.equal(offer.priceObservation?.stock, "unknown");
    assert.equal(offer.priceComparison, "exclude");
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    [
      "abib-clear-spot-serum-7-325-30ml",
      ["BuyBetter", "Ediths Essentials", "Konga Health", "MySkinCity"],
    ],
    ["anessa-perfect-uv-sunscreen-skincare-milk-na-60ml", ["BuyBetter"]],
    [
      "axis-y-vegan-collagen-eye-serum-10ml",
      ["MySkinCity", "Nectar Beauty Hub"],
    ],
    [
      "cerave-acne-foaming-cream-cleanser-4-150ml",
      ["Beauty by Daz", "Deoset", "Perona Beauty", "The Skin Hookup"],
    ],
  ]);
  const expectedFloors = new Map<string, number>([
    ["abib-clear-spot-serum-7-325-30ml", 16_500],
    ["anessa-perfect-uv-sunscreen-skincare-milk-na-60ml", 32_249],
    ["axis-y-vegan-collagen-eye-serum-10ml", 12_500],
    ["cerave-acne-foaming-cream-cleanser-4-150ml", 23_850],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    const active = product.offers.filter((offer) => offer.available);
    assert.deepEqual(
      active.map((offer) => offer.retailer).sort(),
      expected,
      slug,
    );
    assert.equal(
      Math.min(
        ...active.map((offer) => offer.priceNgn ?? Number.POSITIVE_INFINITY),
      ),
      expectedFloors.get(slug),
      slug,
    );
  }

  const registered = new Set(nigeriaRetailers.map((retailer) => retailer.name));
  assert.equal(registered.has("MySkinCity"), true);
});

test("catalogue offer refresh wave 26 releases five exact packages and excludes size, formula and provenance conflicts", () => {
  const projected = waveTwentySixAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveTwentySixAudit.matrix.before, 93);
  assert.equal(waveTwentySixAudit.matrix.after, 98);
  assert.equal(waveTwentySixAudit.matrix.total, 162);
  assert.equal(waveTwentySixAudit.summary.productsReviewed, 5);
  assert.equal(waveTwentySixAudit.summary.productsReleased, 5);
  assert.equal(waveTwentySixAudit.summary.productsBlocked, 0);
  assert.equal(waveTwentySixAudit.summary.offersAdmitted, 29);
  assert.equal(waveTwentySixAudit.summary.shopperActiveOffers, 25);
  assert.equal(waveTwentySixAudit.summary.outOfStockObservations, 4);
  assert.equal(waveTwentySixAudit.summary.offersBlocked, 27);
  assert.equal(projected.length, 29);
  assert.equal(waveTwentySixAudit.blockedCells.length, 25);
  assert.equal(waveTwentySixAudit.excludedDiscoveries.length, 2);
  assert.equal(waveTwentySixAudit.heldCandidates.length, 0);
  assert.equal(waveTwentySixAudit.scheduledOwner.manifestRecurringOwner, null);
  assert.equal(
    waveTwentySixAudit.scheduledOwner.latestObservedRun.activeBacklog,
    98,
  );

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    assert.equal(offer.priceObservation?.size, product.identity.size);
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.packageImageByteSize > 0);
  }

  for (const blocked of waveTwentySixAudit.blockedCells) {
    assert.match(blocked.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(blocked.responseByteSize > 0);
    const offer = verifiedRetailOffers[blocked.candidateId]?.find(
      (candidate) => candidate.url === blocked.url,
    );
    if (offer) {
      assert.equal(offer.available, false);
      assert.equal(offer.priceObservation?.stock, "unknown");
      assert.equal(offer.priceComparison, "exclude");
    }
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    [
      "advanced-clinicals-vitamin-c-face-serum-52ml",
      [
        "Beauty by Daz",
        "BuyBetter",
        "Deoset",
        "Konga Health",
        "Ralyd",
        "Rhema Beauty Shop",
        "Skin Pop Essentiel",
      ],
    ],
    [
      "aqua-rich-ceramide-body-lotion-500ml",
      [
        "Deoset",
        "Derma Essentials",
        "Perona Beauty",
        "Wholesale Skincare Shop",
      ],
    ],
    [
      "aqua-rich-turmeric-vitamin-c-body-lotion-500ml",
      [
        "Buy Skincare in Abuja",
        "BuyBetter",
        "Derma Essentials",
        "Konga Health",
        "Muna Cosmetics",
        "Perona Beauty",
        "Skin Pop Essentiel",
        "TOS Nigeria",
      ],
    ],
    [
      "olay-super-serum-body-wash-normal-skin-547ml",
      ["Beauty by Daz", "BuyBetter", "Deoset", "Perona Beauty"],
    ],
    [
      "sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml",
      ["Ediths Essentials"],
    ],
  ]);
  const expectedFloors = new Map<string, number>([
    ["advanced-clinicals-vitamin-c-face-serum-52ml", 12_000],
    ["aqua-rich-ceramide-body-lotion-500ml", 10_900],
    ["aqua-rich-turmeric-vitamin-c-body-lotion-500ml", 10_750],
    ["olay-super-serum-body-wash-normal-skin-547ml", 20_000],
    [
      "sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml",
      15_420,
    ],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    const active = product.offers.filter((offer) => offer.available);
    assert.deepEqual(
      active.map((offer) => offer.retailer).sort(),
      expected,
      slug,
    );
    assert.equal(
      Math.min(
        ...active.map((offer) => offer.priceNgn ?? Number.POSITIVE_INFINITY),
      ),
      expectedFloors.get(slug),
      slug,
    );
  }

  const registered = new Set(nigeriaRetailers.map((retailer) => retailer.name));
  assert.equal(registered.has("Ralyd"), true);
  assert.equal(registered.has("Wholesale Skincare Shop"), true);
});

test("catalogue offer refresh wave 27 releases five exact packages and fails unverifiable siblings closed", () => {
  const projected = waveTwentySevenAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveTwentySevenAudit.matrix.before, 98);
  assert.equal(waveTwentySevenAudit.matrix.after, 103);
  assert.equal(waveTwentySevenAudit.matrix.total, 162);
  assert.equal(waveTwentySevenAudit.summary.productsReviewed, 5);
  assert.equal(waveTwentySevenAudit.summary.productsReleased, 5);
  assert.equal(waveTwentySevenAudit.summary.productsBlocked, 0);
  assert.equal(waveTwentySevenAudit.summary.offersAdmitted, 13);
  assert.equal(waveTwentySevenAudit.summary.shopperActiveOffers, 11);
  assert.equal(waveTwentySevenAudit.summary.outOfStockObservations, 2);
  assert.equal(waveTwentySevenAudit.summary.offersBlocked, 5);
  assert.equal(projected.length, 13);
  assert.equal(waveTwentySevenAudit.blockedCells.length, 3);
  assert.equal(waveTwentySevenAudit.excludedDiscoveries.length, 2);
  assert.equal(waveTwentySevenAudit.heldCandidates.length, 0);
  assert.equal(
    waveTwentySevenAudit.scheduledOwner.manifestRecurringOwner,
    null,
  );
  assert.equal(
    waveTwentySevenAudit.scheduledOwner.latestObservedRun.activeBacklog,
    98,
  );

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    assert.equal(offer.priceObservation?.size, product.identity.size);
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.packageImageByteSize > 0);
  }

  for (const blocked of waveTwentySevenAudit.blockedCells) {
    assert.match(blocked.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(blocked.responseByteSize > 0);
    const offer = verifiedRetailOffers[blocked.candidateId]?.find(
      (candidate) => candidate.url === blocked.url,
    );
    if (offer) {
      assert.equal(offer.available, false);
      assert.equal(offer.priceObservation?.stock, "unknown");
      assert.equal(offer.priceComparison, "exclude");
    }
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    [
      "garnier-pure-active-tea-tree-salicylic-acid-tissue-mask",
      ["Brandlistry"],
    ],
    ["saltair-santal-bloom-moisture-bound-hair-oil-rich-50ml", ["BuyBetter"]],
    [
      "cecred-moisturizing-deep-conditioner-300ml",
      ["Bloom Hair Atelier", "Ediths Essentials", "GlowMart"],
    ],
    [
      "fenty-skin-butta-drop-fenty-fresh-standard-200ml",
      ["Bola Blaque Beauty", "Essenza"],
    ],
    [
      "aveeno-daily-moisturizing-body-oil-mist-200ml",
      ["CSi Grocery", "Citymarket NG", "Perona Beauty", "Teeka4"],
    ],
  ]);
  const expectedFloors = new Map<string, number>([
    ["garnier-pure-active-tea-tree-salicylic-acid-tissue-mask", 9_100],
    ["saltair-santal-bloom-moisture-bound-hair-oil-rich-50ml", 27_200],
    ["cecred-moisturizing-deep-conditioner-300ml", 144_750],
    ["fenty-skin-butta-drop-fenty-fresh-standard-200ml", 83_000],
    ["aveeno-daily-moisturizing-body-oil-mist-200ml", 15_700],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    const active = product.offers.filter((offer) => offer.available);
    assert.deepEqual(
      active.map((offer) => offer.retailer).sort(),
      expected,
      slug,
    );
    assert.equal(
      Math.min(
        ...active.map((offer) => offer.priceNgn ?? Number.POSITIVE_INFINITY),
      ),
      expectedFloors.get(slug),
      slug,
    );
  }

  const registered = new Set(nigeriaRetailers.map((retailer) => retailer.name));
  assert.equal(registered.has("Brandlistry"), true);
  assert.equal(registered.has("Citymarket NG"), true);
});

test("catalogue offer refresh wave 28 releases five exact packages and fails mismatched siblings closed", () => {
  const projected = waveTwentyEightAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveTwentyEightAudit.matrix.before, 103);
  assert.equal(waveTwentyEightAudit.matrix.after, 108);
  assert.equal(waveTwentyEightAudit.matrix.total, 162);
  assert.equal(waveTwentyEightAudit.summary.productsReviewed, 5);
  assert.equal(waveTwentyEightAudit.summary.productsReleased, 5);
  assert.equal(waveTwentyEightAudit.summary.productsBlocked, 0);
  assert.equal(waveTwentyEightAudit.summary.offersReviewed, 16);
  assert.equal(waveTwentyEightAudit.summary.offersAdmitted, 11);
  assert.equal(waveTwentyEightAudit.summary.shopperActiveOffers, 9);
  assert.equal(waveTwentyEightAudit.summary.outOfStockObservations, 2);
  assert.equal(waveTwentyEightAudit.summary.offersBlocked, 5);
  assert.equal(projected.length, 11);
  assert.equal(waveTwentyEightAudit.blockedCells.length, 4);
  assert.equal(waveTwentyEightAudit.excludedDiscoveries.length, 5);
  assert.equal(
    waveTwentyEightAudit.scheduledOwner.manifestRecurringOwner,
    null,
  );
  assert.equal(
    waveTwentyEightAudit.scheduledOwner.latestObservedRun.activeBacklog,
    98,
  );

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    assert.equal(offer.priceObservation?.size, product.identity.size);
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.packageImageByteSize > 0);
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    ["keracare-dry-itchy-scalp-conditioner-950ml", ["Ediths Essentials"]],
    ["lush-hair-mentholated-conditioner", ["Lush Hair Nigeria"]],
    ["medik8-crystal-retinal-3-30ml", ["Ralyd", "Skincare Plug NG"]],
    ["medik8-crystal-retinal-6-30ml", ["Teeka4"]],
    [
      "dang-collagen-hydrating-serum-ceramides-30ml",
      ["Bracketts Beauty", "DANG Lifestyle", "Konga Health", "Perona Beauty"],
    ],
  ]);
  const expectedFloors = new Map<string, number>([
    ["keracare-dry-itchy-scalp-conditioner-950ml", 43_485],
    ["lush-hair-mentholated-conditioner", 1_687],
    ["medik8-crystal-retinal-3-30ml", 116_000],
    ["medik8-crystal-retinal-6-30ml", 94_215],
    ["dang-collagen-hydrating-serum-ceramides-30ml", 17_000],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    const active = product.offers.filter((offer) => offer.available);
    assert.deepEqual(
      active.map((offer) => offer.retailer).sort(),
      expected,
      slug,
    );
    assert.equal(
      Math.min(
        ...active.map((offer) => offer.priceNgn ?? Number.POSITIVE_INFINITY),
      ),
      expectedFloors.get(slug),
      slug,
    );
  }
});

test("catalogue offer refresh wave 29 releases five exact packages with rich current offers", () => {
  const projected = waveTwentyNineAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveTwentyNineAudit.matrix.before, 108);
  assert.equal(waveTwentyNineAudit.matrix.after, 113);
  assert.equal(waveTwentyNineAudit.matrix.total, 162);
  assert.equal(waveTwentyNineAudit.summary.productsReviewed, 5);
  assert.equal(waveTwentyNineAudit.summary.productsReleased, 5);
  assert.equal(waveTwentyNineAudit.summary.productsBlocked, 0);
  assert.equal(waveTwentyNineAudit.summary.offersReviewed, 24);
  assert.equal(waveTwentyNineAudit.summary.offersAdmitted, 18);
  assert.equal(waveTwentyNineAudit.summary.shopperActiveOffers, 14);
  assert.equal(waveTwentyNineAudit.summary.outOfStockObservations, 4);
  assert.equal(waveTwentyNineAudit.summary.offersBlocked, 6);
  assert.equal(projected.length, 18);
  assert.equal(waveTwentyNineAudit.blockedCells.length, 4);
  assert.equal(waveTwentyNineAudit.excludedDiscoveries.length, 6);
  assert.equal(waveTwentyNineAudit.scheduledOwner.manifestRecurringOwner, null);
  assert.equal(
    waveTwentyNineAudit.scheduledOwner.latestObservedRun.activeBacklog,
    98,
  );

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    assert.equal(offer.priceObservation?.size, product.identity.size);
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.packageImageByteSize > 0);
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    [
      "c28f590dd2739ea73f1b5ea3",
      ["Konga Health", "Perona Beauty", "Rhema Beauty Shop"],
    ],
    [
      "11d3a6116ccfc1cbce191430",
      [
        "Beauty by Daz",
        "Derma Essentials",
        "Eslin Beauty",
        "Nectar Beauty Hub",
      ],
    ],
    [
      "la-roche-posay-lipikar-apmax-triple-repair-moisturizing-cream-200ml",
      ["Nihet Beauty", "Teeka4"],
    ],
    [
      "la-roche-posay-lipikar-apmax-triple-repair-moisturizing-cream-400ml",
      ["Deoset", "Perona Beauty"],
    ],
    [
      "nineless-a-control-azelaic-acid-cream-50ml",
      ["Deoset", "Konga Health", "Nihet Beauty"],
    ],
  ]);
  const expectedFloors = new Map<string, number>([
    ["c28f590dd2739ea73f1b5ea3", 5_700],
    ["11d3a6116ccfc1cbce191430", 21_500],
    [
      "la-roche-posay-lipikar-apmax-triple-repair-moisturizing-cream-200ml",
      18_999,
    ],
    [
      "la-roche-posay-lipikar-apmax-triple-repair-moisturizing-cream-400ml",
      28_200,
    ],
    ["nineless-a-control-azelaic-acid-cream-50ml", 14_650],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    const active = product.offers.filter((offer) => offer.available);
    assert.deepEqual(
      active.map((offer) => offer.retailer).sort(),
      expected,
      slug,
    );
    assert.equal(
      Math.min(
        ...active.map((offer) => offer.priceNgn ?? Number.POSITIVE_INFINITY),
      ),
      expectedFloors.get(slug),
      slug,
    );
  }
});

test("catalogue offer refresh wave 30 releases five exact packages with rich current offers", () => {
  const projected = waveThirtyAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveThirtyAudit.matrix.before, 113);
  assert.equal(waveThirtyAudit.matrix.after, 118);
  assert.equal(waveThirtyAudit.matrix.total, 162);
  assert.equal(waveThirtyAudit.summary.productsReviewed, 5);
  assert.equal(waveThirtyAudit.summary.productsReleased, 5);
  assert.equal(waveThirtyAudit.summary.productsBlocked, 0);
  assert.equal(waveThirtyAudit.summary.offersReviewed, 18);
  assert.equal(waveThirtyAudit.summary.offersAdmitted, 15);
  assert.equal(waveThirtyAudit.summary.shopperActiveOffers, 14);
  assert.equal(waveThirtyAudit.summary.outOfStockObservations, 1);
  assert.equal(waveThirtyAudit.summary.offersBlocked, 3);
  assert.equal(projected.length, 15);
  assert.equal(waveThirtyAudit.blockedCells.length, 4);
  assert.equal(waveThirtyAudit.excludedDiscoveries.length, 3);
  assert.equal(waveThirtyAudit.scheduledOwner.manifestRecurringOwner, null);
  assert.equal(
    waveThirtyAudit.scheduledOwner.latestObservedRun.activeBacklog,
    98,
  );

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    assert.equal(offer.priceObservation?.size, product.identity.size);
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.packageImageByteSize > 0);
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    [
      "estelin-ultra-light-hydrating-invisible-sunscreen-spf-50-50g",
      ["Konga Health", "Perona Beauty"],
    ],
    [
      "la-roche-posay-anthelios-uvmune-400-oil-control-fluid",
      ["Konga Health", "Perona Beauty"],
    ],
    [
      "aqua-rich-turmeric-vitamin-c-body-wash-1000ml",
      ["BuyBetter", "Eslin Beauty", "Slique Beauty", "TOS Nigeria"],
    ],
    [
      "nineless-mela-pro-tranexamic-acid-sunscreen-100ml",
      ["Nihet Beauty", "Perona Beauty"],
    ],
    [
      "dang-snail-mucin-repair-serum-100ml",
      ["Beauty Hut Africa", "DANG Lifestyle", "Konga Health", "Perona Beauty"],
    ],
  ]);
  const expectedFloors = new Map<string, number>([
    ["estelin-ultra-light-hydrating-invisible-sunscreen-spf-50-50g", 4_000],
    ["la-roche-posay-anthelios-uvmune-400-oil-control-fluid", 21_540],
    ["aqua-rich-turmeric-vitamin-c-body-wash-1000ml", 10_500],
    ["nineless-mela-pro-tranexamic-acid-sunscreen-100ml", 13_000],
    ["dang-snail-mucin-repair-serum-100ml", 21_600],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    const active = product.offers.filter((offer) => offer.available);
    assert.deepEqual(
      active.map((offer) => offer.retailer).sort(),
      expected,
      slug,
    );
    assert.equal(
      Math.min(
        ...active.map((offer) => offer.priceNgn ?? Number.POSITIVE_INFINITY),
      ),
      expectedFloors.get(slug),
      slug,
    );
  }
});

test("catalogue offer refresh wave 31 releases three exact packages and fails mismatched packages closed", () => {
  const projected = waveThirtyOneAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveThirtyOneAudit.matrix.before, 118);
  assert.equal(waveThirtyOneAudit.matrix.after, 121);
  assert.equal(waveThirtyOneAudit.matrix.total, 162);
  assert.equal(waveThirtyOneAudit.summary.productsReviewed, 5);
  assert.equal(waveThirtyOneAudit.summary.productsReleased, 3);
  assert.equal(waveThirtyOneAudit.summary.productsBlocked, 2);
  assert.equal(waveThirtyOneAudit.summary.offersReviewed, 20);
  assert.equal(waveThirtyOneAudit.summary.offersAdmitted, 10);
  assert.equal(waveThirtyOneAudit.summary.shopperActiveOffers, 9);
  assert.equal(waveThirtyOneAudit.summary.outOfStockObservations, 1);
  assert.equal(waveThirtyOneAudit.summary.offersBlocked, 10);
  assert.equal(projected.length, 10);
  assert.equal(waveThirtyOneAudit.blockedCells.length, 4);
  assert.equal(waveThirtyOneAudit.excludedDiscoveries.length, 10);
  assert.equal(waveThirtyOneAudit.scheduledOwner.manifestRecurringOwner, null);
  assert.equal(
    waveThirtyOneAudit.scheduledOwner.latestObservedRun.activeBacklog,
    98,
  );

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    assert.equal(offer.priceObservation?.size, product.identity.size);
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    if (
      "packageImageSha256" in evidence &&
      typeof evidence.packageImageSha256 === "string"
    ) {
      assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
      assert.ok(
        "packageImageByteSize" in evidence &&
          typeof evidence.packageImageByteSize === "number" &&
          evidence.packageImageByteSize > 0,
      );
    } else {
      assert.equal(evidence.retailer, "CSi Grocery");
      assert.equal(evidence.observedProductSku, product.identity.gtin);
      assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    }
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    [
      "simple-kind-to-skin-refreshing-facial-gel-wash-150ml",
      [
        "Beauty Hut Africa",
        "CSi Grocery",
        "Deoset",
        "Konga Health",
        "Perona Beauty",
        "Teeka4",
      ],
    ],
    [
      "sheamoisture-jamaican-black-castor-oil-shampoo-384ml",
      ["Konga Health", "Perfect Trust Beauty"],
    ],
    ["estelin-vitamin-c-turmeric-face-oil-30ml", ["Konga Health"]],
  ]);
  const expectedFloors = new Map<string, number>([
    ["simple-kind-to-skin-refreshing-facial-gel-wash-150ml", 4_800],
    ["sheamoisture-jamaican-black-castor-oil-shampoo-384ml", 13_300],
    ["estelin-vitamin-c-turmeric-face-oil-30ml", 4_900],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    const active = product.offers.filter((offer) => offer.available);
    assert.deepEqual(
      active.map((offer) => offer.retailer).sort(),
      expected,
      slug,
    );
    assert.equal(
      Math.min(
        ...active.map((offer) => offer.priceNgn ?? Number.POSITIVE_INFINITY),
      ),
      expectedFloors.get(slug),
      slug,
    );
  }

  for (const slug of [
    "loccitane-almond-softening-shower-oil-250ml",
    "replenix-bp-10-acne-wash-aloe-vera-7oz",
  ]) {
    assert.deepEqual(verifiedRetailOffers[slug], [], slug);
  }
});

test("catalogue offer refresh wave 32 releases exact packages and preserves package blockers", () => {
  const projected = waveThirtyTwoAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveThirtyTwoAudit.matrix.before, 121);
  assert.equal(waveThirtyTwoAudit.matrix.after, 124);
  assert.equal(waveThirtyTwoAudit.matrix.total, 162);
  assert.equal(waveThirtyTwoAudit.summary.productsReviewed, 4);
  assert.equal(waveThirtyTwoAudit.summary.productsReleased, 3);
  assert.equal(waveThirtyTwoAudit.summary.productsBlocked, 1);
  assert.equal(waveThirtyTwoAudit.summary.offersReviewed, 12);
  assert.equal(waveThirtyTwoAudit.summary.offersAdmitted, 4);
  assert.equal(waveThirtyTwoAudit.summary.shopperActiveOffers, 3);
  assert.equal(waveThirtyTwoAudit.summary.outOfStockObservations, 1);
  assert.equal(waveThirtyTwoAudit.summary.offersBlocked, 8);
  assert.equal(projected.length, 4);
  assert.equal(waveThirtyTwoAudit.blockedCells.length, 1);
  assert.equal(waveThirtyTwoAudit.excludedDiscoveries.length, 8);
  assert.equal(waveThirtyTwoAudit.scheduledOwner.manifestRecurringOwner, null);
  assert.equal(
    waveThirtyTwoAudit.scheduledOwner.latestObservedRun.activeBacklog,
    98,
  );

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    assert.equal(offer.priceObservation?.size, product.identity.size);
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    if (
      "packageImageSha256" in evidence &&
      typeof evidence.packageImageSha256 === "string"
    ) {
      assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
      assert.ok(
        "packageImageByteSize" in evidence &&
          typeof evidence.packageImageByteSize === "number" &&
          evidence.packageImageByteSize > 0,
      );
    } else {
      assert.equal(evidence.retailer, "CSi Grocery");
      assert.equal(evidence.observedProductSku, product.identity.gtin);
    }
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    [
      "facefacts-ceramide-moisturising-gel-cream-50ml",
      ["BuyBetter", "CSi Grocery"],
    ],
    ["medik8-advanced-night-restore-50ml", []],
    ["ogx-renewing-argan-oil-of-morocco", ["Brandlistry"]],
  ]);
  const expectedFloors = new Map<string, number>([
    ["facefacts-ceramide-moisturising-gel-cream-50ml", 3_440],
    ["ogx-renewing-argan-oil-of-morocco", 25_980],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    const active = product.offers.filter((offer) => offer.available);
    assert.deepEqual(
      active.map((offer) => offer.retailer).sort(),
      expected,
      slug,
    );
    if (expectedFloors.has(slug)) {
      assert.equal(
        Math.min(
          ...active.map((offer) => offer.priceNgn ?? Number.POSITIVE_INFINITY),
        ),
        expectedFloors.get(slug),
        slug,
      );
    }
  }

  assert.deepEqual(
    verifiedRetailOffers["naturium-skin-renewing-retinol-body-lotion-8oz"],
    [],
  );
});

test("catalogue offer refresh wave 33 publishes rich exact-package offers and fails mismatches closed", () => {
  const projected = waveThirtyThreeAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveThirtyThreeAudit.matrix.before, 124);
  assert.equal(waveThirtyThreeAudit.matrix.after, 129);
  assert.equal(waveThirtyThreeAudit.matrix.total, 162);
  assert.equal(waveThirtyThreeAudit.summary.productsReviewed, 9);
  assert.equal(waveThirtyThreeAudit.summary.productsReleased, 5);
  assert.equal(waveThirtyThreeAudit.summary.productsBlocked, 4);
  assert.equal(waveThirtyThreeAudit.summary.offersReviewed, 34);
  assert.equal(waveThirtyThreeAudit.summary.offersAdmitted, 17);
  assert.equal(waveThirtyThreeAudit.summary.shopperActiveOffers, 17);
  assert.equal(waveThirtyThreeAudit.summary.outOfStockObservations, 0);
  assert.equal(waveThirtyThreeAudit.summary.offersBlocked, 17);
  assert.equal(projected.length, 17);
  assert.equal(waveThirtyThreeAudit.blockedCells.length, 4);
  assert.equal(waveThirtyThreeAudit.excludedDiscoveries.length, 17);
  assert.equal(
    waveThirtyThreeAudit.scheduledOwner.manifestRecurringOwner,
    null,
  );
  assert.equal(
    waveThirtyThreeAudit.scheduledOwner.latestObservedRun.activeBacklog,
    98,
  );

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    assert.equal(offer.priceObservation?.size, product.identity.size);
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.packageImageByteSize > 0);
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    [
      "la-roche-posay-toleriane-double-repair-matte",
      ["Brandlistry", "Nihet Beauty"],
    ],
    [
      "naturium-brightener-vitamin-c-body-wash-500ml",
      ["Beauty by Daz", "Perona Beauty", "Rhema Beauty Shop", "TOS Nigeria"],
    ],
    [
      "naturium-energizer-mandelic-acid-body-wash-500ml",
      ["Perona Beauty", "Rhema Beauty Shop", "TOS Nigeria"],
    ],
    [
      "naturium-glow-getter-multi-oil-body-butter-7-7oz",
      [
        "Beauty by Daz",
        "Kadimez Essentials",
        "Perona Beauty",
        "Rhema Beauty Shop",
        "TOS Nigeria",
      ],
    ],
    [
      "naturium-glow-getter-body-oil-100ml",
      ["Kadimez Essentials", "Rhema Beauty Shop", "TOS Nigeria"],
    ],
  ]);
  const expectedFloors = new Map<string, number>([
    ["la-roche-posay-toleriane-double-repair-matte", 47_000],
    ["naturium-brightener-vitamin-c-body-wash-500ml", 38_000],
    ["naturium-energizer-mandelic-acid-body-wash-500ml", 43_500],
    ["naturium-glow-getter-multi-oil-body-butter-7-7oz", 45_000],
    ["naturium-glow-getter-body-oil-100ml", 55_500],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    const active = product.offers.filter((offer) => offer.available);
    assert.deepEqual(
      active.map((offer) => offer.retailer).sort(),
      expected,
      slug,
    );
    assert.equal(
      Math.min(
        ...active.map((offer) => offer.priceNgn ?? Number.POSITIVE_INFINITY),
      ),
      expectedFloors.get(slug),
      slug,
    );
  }

  for (const slug of [
    "amika-the-kure-conditioner-275ml",
    "cerave-sa-smoothing-cream-177ml",
    "dove-go-fresh-cucumber-green-tea-spray",
    "elf-suntouchable-invisible-sunscreen-spf-35-50ml",
  ]) {
    assert.deepEqual(verifiedRetailOffers[slug] ?? [], [], slug);
  }
});

test("catalogue offer refresh wave 34 publishes exact Naturium packages and current stock", () => {
  const projected = waveThirtyFourAudit.products.flatMap((product) =>
    product.offers.map((offer) => ({ product, offer })),
  );

  assert.equal(waveThirtyFourAudit.matrix.before, 129);
  assert.equal(waveThirtyFourAudit.matrix.after, 134);
  assert.equal(waveThirtyFourAudit.matrix.total, 162);
  assert.equal(waveThirtyFourAudit.summary.productsReviewed, 8);
  assert.equal(waveThirtyFourAudit.summary.productsReleased, 5);
  assert.equal(waveThirtyFourAudit.summary.productsBlocked, 3);
  assert.equal(waveThirtyFourAudit.summary.offersReviewed, 24);
  assert.equal(waveThirtyFourAudit.summary.offersAdmitted, 15);
  assert.equal(waveThirtyFourAudit.summary.shopperActiveOffers, 9);
  assert.equal(waveThirtyFourAudit.summary.outOfStockObservations, 6);
  assert.equal(waveThirtyFourAudit.summary.offersBlocked, 9);
  assert.equal(projected.length, 15);
  assert.equal(waveThirtyFourAudit.blockedCells.length, 3);
  assert.equal(waveThirtyFourAudit.excludedDiscoveries.length, 9);
  assert.equal(waveThirtyFourAudit.scheduledOwner.manifestRecurringOwner, null);
  assert.equal(
    waveThirtyFourAudit.scheduledOwner.latestObservedRun.activeBacklog,
    98,
  );

  for (const { product, offer: evidence } of projected) {
    const offer = verifiedRetailOffers[product.candidateId]?.find(
      (candidate) => candidate.url === evidence.url,
    );
    assert.ok(offer, `${product.candidateId}: ${evidence.retailer}`);
    assert.equal(offer.retailer, evidence.retailer);
    assert.equal(offer.priceNgn, evidence.priceNgn);
    assert.equal(offer.available, evidence.available);
    assert.equal(offer.priceObservation?.stock, evidence.stock);
    assert.equal(offer.priceObservation?.size, product.identity.size);
    assert.equal(offer.checkedAt, evidence.checkedAt);
    assert.equal(offer.expiresAt, evidence.expiresAt);
    assert.match(evidence.responseSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.responseByteSize > 0);
    assert.match(evidence.packageImageSha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.packageImageByteSize > 0);
  }

  const expectedActiveRetailers = new Map<string, string[]>([
    [
      "naturium-bha-liquid-exfoliant-2-4oz",
      ["Mirrors Beauty", "Rhema Beauty Shop", "Teeka4", "The Beauty Prism"],
    ],
    ["naturium-uv-reflect-antioxidant-spf-50-1-7fl-oz", ["Nihet Beauty"]],
    [
      "naturium-niacinamide-cleansing-gelee-3-7-1oz",
      ["Mirrors Beauty", "The Beauty Prism"],
    ],
    ["naturium-multi-peptide-moisturizer-1-7oz", ["The Beauty Prism"]],
    ["naturium-purple-ginseng-cleansing-balm-3oz", ["Essentials Hub"]],
  ]);
  const expectedFloors = new Map<string, number>([
    ["naturium-bha-liquid-exfoliant-2-4oz", 29_999],
    ["naturium-uv-reflect-antioxidant-spf-50-1-7fl-oz", 86_000],
    ["naturium-niacinamide-cleansing-gelee-3-7-1oz", 38_000],
    ["naturium-multi-peptide-moisturizer-1-7oz", 45_000],
    ["naturium-purple-ginseng-cleansing-balm-3oz", 38_000],
  ]);

  for (const [slug, expected] of expectedActiveRetailers) {
    const product = catalogueProducts.find(
      (candidate) => candidate.slug === slug,
    );
    assert.ok(product, slug);
    const active = product.offers.filter((offer) => offer.available);
    assert.deepEqual(
      active.map((offer) => offer.retailer).sort(),
      expected,
      slug,
    );
    assert.equal(
      Math.min(
        ...active.map((offer) => offer.priceNgn ?? Number.POSITIVE_INFINITY),
      ),
      expectedFloors.get(slug),
      slug,
    );
  }

  assert.equal(
    verifiedRetailOffers["naturium-multi-peptide-moisturizer-1-7oz"].some(
      (offer) => offer.retailer === "BuyBetter",
    ),
    false,
  );
  for (const slug of [
    "naturium-barrier-bounce-advanced-skin-hydrator-1-7oz",
    "naturium-fermented-camellia-creamy-cleansing-oil-3-5oz",
    "naturium-intense-overnight-sleeping-cream-1-7oz",
  ]) {
    assert.deepEqual(verifiedRetailOffers[slug] ?? [], [], slug);
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
      ["Perona Beauty", 17500],
      ["CSi Grocery", 21500],
      ["Citymarket NG", 17666.67],
    ],
    "beauty-of-joseon-glow-serum-propolis-niacinamide-30ml": [
      ["BuyBetter", 13500],
      ["Kadimez Essentials", 19500],
      ["Rhema Beauty Shop", 19404],
    ],
    "eos-coconut-waters-body-wash-473ml": [
      ["Teeka4", 18500],
      ["BuyBetter", 18500],
      ["Rhema Beauty Shop", 23750],
      ["Beauty Hut Africa", 25000],
    ],
    "eos-pink-champagne-body-wash-473ml": [
      ["Teeka4", 18500],
      ["BuyBetter", 18813],
      ["Rhema Beauty Shop", 23750],
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
          (slug === "anessa-perfect-uv-sunscreen-skincare-milk-na-60ml"
            ? "2026-08-30T04:48:19.559Z"
            : slug === "beauty-of-joseon-glow-serum-propolis-niacinamide-30ml"
              ? "2026-08-29T23:49:23.320Z"
              : slug.startsWith("eos-")
                ? "2026-08-30T00:00:32.487Z"
                : new Set([
                      "aveeno-daily-moisturizing-body-oil-mist-200ml",
                      "saltair-santal-bloom-moisture-bound-hair-oil-rich-50ml",
                    ]).has(slug)
                  ? "2026-08-30T05:39:13.098Z"
                  : offer.retailer === "Beauty Hut Africa"
                    ? "2026-08-14T17:00:00Z"
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
          offer.match === "exact" &&
          Date.parse(offer.expiresAt ?? "") > Date.parse(offer.checkedAt ?? ""),
      ),
      true,
      `${slug}: exact reviewed evidence`,
    );
  }
});

test("browser-verified Beauty by Daz prices serve exact original catalogue products", () => {
  const expected = [
    ["cosrx-salicylic-acid-daily-gentle-cleanser", 8_500, "150 ml", true],
    ["anua-niacinamide-10-txa-4-serum", 18_850, "30 ml", true],
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
      "2026-08-30T02:16:56.000Z",
    ],
    [
      "dove-melanin-even-tone-body-wash-18-5oz",
      19_500,
      false,
      "547 ml / 18.5 fl oz",
      "2026-08-30T01:31:00.820Z",
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
    "dang-azelaic-acid-serum-30ml": [
      17_700,
      "30 ml",
      "2026-08-30T03:13:29.000Z",
      "2026-09-06T03:13:29.000Z",
    ],
    "dang-hydra-glow-sun-protection-gel-60ml": [
      25_000,
      "60 ml",
      "2026-08-30T03:10:33.566Z",
      "2026-09-06T03:10:33.566Z",
    ],
  } as const;

  for (const [slug, [priceNgn, size, observedAt, expiresAt]] of Object.entries(
    expected,
  )) {
    const offer = verifiedRetailOffers[slug]?.find(
      (candidate) => candidate.retailer === "DANG Lifestyle",
    );
    assert.ok(offer, slug);
    assert.equal(offer.priceNgn, priceNgn, slug);
    assert.equal(offer.available, true, slug);
    assert.equal(offer.priceObservation?.size, size, slug);
    assert.equal(offer.checkedAt, observedAt, slug);
    assert.equal(offer.expiresAt, expiresAt, slug);
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
    ["cerave-blemish-control-cleanser", 18_252, "236 ml"],
    ["cerave-foaming-facial-cleanser", 14_700, "236 ml"],
    ["cerave-pm-facial-moisturising-lotion-52ml", 20_300, "52 ml"],
    ["cerave-sa-smoothing-cleanser-473ml", 16_955, "473 ml"],
    ["eos-coconut-waters-body-wash-473ml", 25_000, "16 fl oz / 473 ml"],
    ["eos-pink-champagne-body-wash-473ml", 25_000, "16 fl oz / 473 ml"],
    ["eos-vanilla-cashmere-body-wash-473ml", 23_100, "16 fl oz / 473 ml"],
    ["facefacts-ceramide-hydrating-gentle-cleanser-400ml", 8_775, "400 ml"],
    ["la-roche-posay-effaclar-purifying-foaming-gel-400ml", 15_511, "400 ml"],
    ["nineless-a-control-azelaic-acid-cream-50ml", 20_315, "50 ml"],
  ] as const;

  for (const [slug, priceNgn, size] of expected) {
    const offer = verifiedRetailOffers[slug]?.find(
      (candidate) => candidate.retailer === "Beauty Hut Africa",
    );
    assert.ok(offer, slug);
    assert.equal(offer.priceNgn, priceNgn, slug);
    const isWaveTwentyNine =
      slug === "nineless-a-control-azelaic-acid-cream-50ml";
    assert.equal(offer.available, !isWaveTwentyNine, slug);
    assert.equal(offer.priceObservation?.size, size, slug);
    const isWaveTen = slug.startsWith("eos-");
    const isWaveSeventeen = new Set([
      "cerave-sa-smoothing-cleanser-473ml",
      "facefacts-ceramide-hydrating-gentle-cleanser-400ml",
      "la-roche-posay-effaclar-purifying-foaming-gel-400ml",
    ]).has(slug);
    const isWaveTwentyOne =
      slug === "cerave-pm-facial-moisturising-lotion-52ml";
    const waveTwentyThreeTimes = new Map<string, [string, string]>([
      [
        "cerave-blemish-control-cleanser",
        ["2026-08-30T03:47:32.957Z", "2026-09-06T03:47:32.957Z"],
      ],
      [
        "cerave-foaming-facial-cleanser",
        ["2026-08-30T03:48:25.979Z", "2026-09-06T03:48:25.979Z"],
      ],
    ]);
    const waveTwentyThreeTime = waveTwentyThreeTimes.get(slug);
    assert.equal(
      offer.checkedAt,
      waveTwentyThreeTime
        ? waveTwentyThreeTime[0]
        : isWaveTen
          ? "2026-08-30T00:00:32.487Z"
          : isWaveSeventeen
            ? "2026-08-30T02:02:13.000Z"
            : isWaveTwentyOne
              ? "2026-08-30T02:56:10.000Z"
              : isWaveTwentyNine
                ? "2026-08-30T06:32:58.163Z"
                : "2026-08-14T17:00:00Z",
      slug,
    );
    assert.equal(
      offer.expiresAt,
      waveTwentyThreeTime
        ? waveTwentyThreeTime[1]
        : isWaveTen
          ? "2026-09-06T00:00:32.487Z"
          : isWaveSeventeen
            ? "2026-09-06T02:02:13.000Z"
            : isWaveTwentyOne
              ? "2026-09-06T02:56:10.000Z"
              : isWaveTwentyNine
                ? "2026-09-06T06:32:58.163Z"
                : "2026-08-21T17:00:00Z",
      slug,
    );
    assert.equal(new URL(offer.url).hostname, "beautyhutafrica.com", slug);
  }

  const blockedNivea = verifiedRetailOffers[
    "nivea-perfect-radiant-body-lotion-400ml"
  ]?.find((candidate) => candidate.retailer === "Beauty Hut Africa");
  assert.ok(blockedNivea);
  assert.equal(blockedNivea.priceNgn, 5_156);
  assert.equal(blockedNivea.available, false);
  assert.equal(blockedNivea.priceComparison, "exclude");
  assert.equal(blockedNivea.priceObservation?.size, "400 ml");
  assert.equal(blockedNivea.checkedAt, "2026-08-30T03:10:24.487Z");
  assert.equal(blockedNivea.expiresAt, "2026-09-06T03:10:24.487Z");

  const blockedFaceFacts = verifiedRetailOffers[
    "facefacts-soothe-glow-niacinamide-serum-30ml"
  ]?.find((candidate) => candidate.retailer === "Beauty Hut Africa");
  assert.ok(blockedFaceFacts);
  assert.equal(blockedFaceFacts.priceNgn, 4_380);
  assert.equal(blockedFaceFacts.available, false);
  assert.equal(blockedFaceFacts.priceComparison, "exclude");
  assert.equal(blockedFaceFacts.priceObservation?.size, "30 ml");
  assert.equal(blockedFaceFacts.checkedAt, "2026-08-30T02:37:57.000Z");
  assert.equal(blockedFaceFacts.expiresAt, "2026-09-06T02:37:57.000Z");

  const refreshedBalance = verifiedRetailOffers[
    "balance-niacinamide-blemish-recovery-serum-30ml"
  ]?.find((candidate) => candidate.retailer === "Beauty Hut Africa");
  assert.ok(refreshedBalance);
  assert.equal(refreshedBalance.priceNgn, 10_500);
  assert.equal(refreshedBalance.available, false);
  assert.equal(refreshedBalance.priceObservation?.size, "30 ml");
  assert.equal(refreshedBalance.checkedAt, "2026-08-30T01:02:44.400Z");
  assert.equal(refreshedBalance.expiresAt, "2026-09-06T01:02:44.400Z");

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

test("stale PanOxyl Teeka and Lux routes cannot leak through refreshed offers", () => {
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
    new Date("2026-08-28T00:00:00Z"),
  );

  assert.deepEqual(
    merged.map((offer) => offer.retailer),
    ["Slique Beauty", "Rehmie", "Perona Beauty"],
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
