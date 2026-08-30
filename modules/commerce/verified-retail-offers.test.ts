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
  assert.equal(
    verifiedRetailOffers[held.candidateId]?.some((offer) => offer.available),
    false,
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
          (slug === "beauty-of-joseon-glow-serum-propolis-niacinamide-30ml"
            ? "2026-08-29T23:49:23.320Z"
            : slug.startsWith("eos-")
              ? "2026-08-30T00:00:32.487Z"
              : offer.retailer === "Beauty Hut Africa"
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
    assert.equal(offer.available, true, slug);
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
