import assert from "node:assert/strict";
import test from "node:test";
import packageEquivalenceSource from "@/data/catalogue-package-revision-equivalences.json";
import visualRevisionSource from "@/data/catalogue-product-visual-revisions.json";
import { productBySlug } from "@/data/catalogue";
import naturiumReleaseSource from "@/data/catalogue-publication-sources/naturium-the-perfector-salicylic-acid-body-wash-500ml.json";
import lipikar200ReleaseSource from "@/data/catalogue-publication-sources/la-roche-posay-lipikar-apmax-triple-repair-moisturizing-cream-200ml.json";
import lipikar400ReleaseSource from "@/data/catalogue-publication-sources/la-roche-posay-lipikar-apmax-triple-repair-moisturizing-cream-400ml.json";
import advancedNightRestoreReleaseSource from "@/data/catalogue-publication-sources/medik8-advanced-night-restore-50ml.json";
import crystalRetinal3ReleaseSource from "@/data/catalogue-publication-sources/medik8-crystal-retinal-3-30ml.json";
import crystalRetinal6ReleaseSource from "@/data/catalogue-publication-sources/medik8-crystal-retinal-6-30ml.json";
import fentyReleaseSource from "@/data/catalogue-publication-sources/fenty-skin-butta-drop-fenty-fresh-standard-200ml.json";
import loccitane250ReleaseSource from "@/data/catalogue-publication-sources/loccitane-almond-softening-shower-oil-250ml.json";
import audit from "@/data/retailer-verification/catalogue-pharmacist-offer-batch-2026-08-04.json";
import waveOneAudit from "@/data/retailer-verification/catalogue-offer-refresh-wave-1-2026-08-27.json";
import { mergeRetailOffers, verifiedRetailOffers } from "@/data/retail-offers";
import { nigeriaRetailers } from "@/data/retailers";
import {
  authorizeHistoricalPackageMatch,
  verifyCataloguePackageRevisionEquivalenceManifest,
  verifyCatalogueProductVisualRevisionManifest,
  type HistoricalPackageMatchInput,
} from "@/lib/catalogue/product-visual-revision";
import {
  catalogueOfferAdmissionBlockers,
  type CatalogueOfferAdmissionAuthorities,
  type CatalogueOfferBatchObservation,
  type CatalogueOfferBatchProduct,
  type ExactReleaseAuthority,
} from "./catalogue-pharmacist-offer-batch";

type BatchProduct = CatalogueOfferBatchProduct & {
  publicRoute: string | null;
  offers: CatalogueOfferBatchObservation[];
};

const products = audit.products as unknown as BatchProduct[];
const observations = products.flatMap((product) =>
  product.offers.map((offer) => ({ product, offer })),
);
const asOf = new Date(audit.reviewedAt);
const visualRevisionManifest =
  verifyCatalogueProductVisualRevisionManifest(visualRevisionSource);
const packageEquivalenceManifest =
  verifyCataloguePackageRevisionEquivalenceManifest(
    packageEquivalenceSource,
    visualRevisionManifest,
  );
const officialPackageMatcher = (input: HistoricalPackageMatchInput) =>
  authorizeHistoricalPackageMatch(input, packageEquivalenceManifest);
const publishedReleaseSources = [
  naturiumReleaseSource,
  lipikar200ReleaseSource,
  lipikar400ReleaseSource,
  advancedNightRestoreReleaseSource,
  crystalRetinal3ReleaseSource,
  crystalRetinal6ReleaseSource,
  fentyReleaseSource,
  loccitane250ReleaseSource,
];
const releaseAuthorities = new Map<string, ExactReleaseAuthority>(
  publishedReleaseSources.map((source) => [
    source.candidateId,
    {
      candidateId: source.candidateId,
      releaseFingerprint: source.release.releaseFingerprint,
      publicRoute: `/products/${source.candidateId}`,
      publicationStatus: "published",
      publicationScope: "neutral-reference",
      canonicalIdentity: {
        kind: "gtin",
        value: source.dossier.identity.gtin,
        brand: source.dossier.identity.brand,
        name: source.dossier.identity.name,
        variant: source.dossier.identity.variant,
        size: source.dossier.identity.size,
        packageVersion: source.dossier.identity.packageVersion,
      },
    },
  ]),
);

function authoritiesFor(
  product: CatalogueOfferBatchProduct,
  offer: CatalogueOfferBatchObservation,
): CatalogueOfferAdmissionAuthorities {
  const retailer = nigeriaRetailers.find(
    (record) => record.name === offer.retailer.displayName,
  );
  return {
    release: releaseAuthorities.get(product.candidateId) ?? null,
    retailer: retailer
      ? {
          displayName: retailer.name,
          origin: new URL(retailer.homepage).origin,
          reviewStatus: retailer.reviewStatus,
        }
      : null,
    packageRevisionEquivalent: officialPackageMatcher,
  };
}

test("the pharmacist offer batch preserves every lead and its independent disposition", () => {
  assert.equal(audit.scope, "exact-sku-nigerian-offer-enrichment");
  assert.equal(observations.length, 15);
  assert.equal(
    new Set(observations.map(({ offer }) => offer.observationId)).size,
    observations.length,
  );
  assert.deepEqual(
    Object.fromEntries(
      ["admitted", "rejected", "pending"].map((status) => [
        status,
        observations.filter(({ offer }) => offer.status === status).length,
      ]),
    ),
    audit.summary,
  );

  for (const { product, offer } of observations) {
    assert.equal(product.canonicalIdentity.kind, "gtin");
    assert.match(product.canonicalIdentity.value, /^\d{8,14}$/);
    assert.equal(new URL(offer.requestedUrl).protocol, "https:");
    assert.equal(new URL(offer.finalUrl).protocol, "https:");
    assert.ok(offer.retailer.displayName);
    assert.ok(!Number.isNaN(Date.parse(offer.observedAt)));
    assert.ok(!Number.isNaN(Date.parse(offer.expiresAt)));
    assert.equal(offer.price.currency, "NGN");
    assert.ok(Number.isInteger(offer.price.amount) && offer.price.amount > 0);
    assert.ok(offer.capture.sha256);
    assert.ok(
      offer.status === "admitted" || offer.reasons.length > 0,
      offer.observationId,
    );
  }
});

test("all fifteen fresh exact offers pass the admission contract", () => {
  const admitted = observations.filter(
    ({ offer }) => offer.status === "admitted",
  );
  assert.equal(admitted.length, 15);

  for (const { product, offer } of observations) {
    const blockers = catalogueOfferAdmissionBlockers(
      product,
      offer,
      asOf,
      authoritiesFor(product, offer),
    );
    if (offer.status === "admitted")
      assert.deepEqual(blockers, [], offer.observationId);
    else
      assert.ok(blockers.length > 0, `${offer.observationId} must fail closed`);
  }
});

test("admission is bound to the exact published release identity, fingerprint and route", () => {
  const original = products.find(
    (item) =>
      item.candidateId ===
      "naturium-the-perfector-salicylic-acid-body-wash-500ml",
  );
  const offer = original?.offers.find(
    (item) => item.retailer.displayName === "Rhema Beauty Shop",
  );
  assert.ok(original && offer);

  for (const mutate of [
    (product: BatchProduct) => {
      product.canonicalIdentity.value = "850010792935";
    },
    (product: BatchProduct) => {
      product.releaseFingerprint = "a".repeat(64);
    },
    (product: BatchProduct) => {
      product.publicRoute = "/products/lookalike";
    },
  ]) {
    const product = structuredClone(original);
    mutate(product);
    assert.ok(
      catalogueOfferAdmissionBlockers(
        product,
        offer,
        asOf,
        authoritiesFor(product, offer),
      ).includes("exact-public-release-mismatch"),
    );
  }
});

test("exact identity fields reject suffix variants and incomplete store text", () => {
  const product = products.find(
    (item) =>
      item.candidateId ===
      "naturium-the-perfector-salicylic-acid-body-wash-500ml",
  );
  const original = product?.offers.find(
    (offer) => offer.retailer.displayName === "Rhema Beauty Shop",
  );
  assert.ok(product && original);

  const suffixVariant = structuredClone(original);
  suffixVariant.observedVariant =
    "The Perfector Salicylic Acid Body Wash Counterfeit Suffix";
  assert.ok(
    catalogueOfferAdmissionBlockers(
      product,
      suffixVariant,
      asOf,
      authoritiesFor(product, suffixVariant),
    ).includes("exact-variant-mismatch"),
  );

  const incompleteText = structuredClone(original);
  incompleteText.storeIdentityText = "Naturium Body Wash 500ml";
  assert.ok(
    catalogueOfferAdmissionBlockers(
      product,
      incompleteText,
      asOf,
      authoritiesFor(product, incompleteText),
    ).includes("store-identity-text-incomplete"),
  );

  for (const storeIdentityText of [
    "Naturium The Perfector Salicylic Acid Body Wash",
    "Naturium The Perfector Salicylic Acid Body Wash Counterfeit Suffix 500ml",
  ]) {
    const widened = structuredClone(original);
    widened.storeIdentityText = storeIdentityText;
    assert.ok(
      catalogueOfferAdmissionBlockers(
        product,
        widened,
        asOf,
        authoritiesFor(product, widened),
      ).includes("store-identity-text-incomplete"),
    );
  }
});

test("the admitted evidence projects exactly once and rejected or pending stores cannot leak", () => {
  const registered = new Set(nigeriaRetailers.map((retailer) => retailer.name));

  for (const { product, offer } of observations) {
    const projected =
      verifiedRetailOffers[product.candidateId]?.filter(
        (candidate) => candidate.retailer === offer.retailer.displayName,
      ) ?? [];

    if (offer.status !== "admitted") {
      assert.deepEqual(projected, [], offer.observationId);
      continue;
    }

    const refreshedProduct = waveOneAudit.products.find(
      (candidate) => candidate.candidateId === product.candidateId,
    );
    if (refreshedProduct) {
      const refreshedOffer = refreshedProduct.offers.find(
        (candidate) => candidate.retailer === offer.retailer.displayName,
      );
      if (!refreshedOffer) {
        assert.deepEqual(projected, [], offer.observationId);
        assert.ok(
          refreshedProduct.notProjected.some(
            (candidate) => candidate.retailer === offer.retailer.displayName,
          ),
          `${offer.observationId} needs an explicit refresh disposition`,
        );
        continue;
      }
      assert.equal(projected.length, 1, offer.observationId);
      assert.equal(projected[0]?.url, refreshedOffer.url);
      assert.equal(projected[0]?.priceNgn, refreshedOffer.priceNgn);
      assert.equal(projected[0]?.checkedAt, refreshedOffer.checkedAt);
      assert.equal(projected[0]?.expiresAt, refreshedOffer.expiresAt);
      continue;
    }

    assert.ok(registered.has(offer.retailer.displayName), offer.observationId);
    assert.equal(projected.length, 1, offer.observationId);
    assert.equal(projected[0]?.url, offer.finalUrl);
    assert.equal(projected[0]?.priceNgn, offer.price.amount);
    assert.equal(projected[0]?.checkedAt, offer.observedAt);
    assert.equal(projected[0]?.expiresAt, offer.expiresAt);
    assert.equal(
      projected[0]?.priceObservation?.variant,
      offer.observedVariant,
    );
    assert.equal(projected[0]?.priceObservation?.size, offer.observedSize);
    assert.equal(projected[0]?.priceObservation?.stock, offer.stock.status);
    assert.equal(projected[0]?.listingEvidence?.sourceUrl, offer.finalUrl);

    const publicProduct = productBySlug(product.candidateId);
    const publicOffer = publicProduct
      ? mergeRetailOffers(
          publicProduct,
          publicProduct.offers,
          new Date(offer.observedAt),
        ).find((candidate) => candidate.retailer === offer.retailer.displayName)
      : undefined;
    assert.ok(
      publicOffer,
      `${offer.observationId} must reach the public catalogue read model`,
    );
    assert.equal(publicOffer.priceNgn, offer.price.amount);
    assert.equal(publicOffer.match, "exact");
  }
});

test("retailer hosts fail closed against subdomain, suffix and credential spoofing", () => {
  const product = products.find(
    (item) =>
      item.candidateId ===
      "naturium-the-perfector-salicylic-acid-body-wash-500ml",
  );
  const original = product?.offers.find(
    (offer) => offer.retailer.displayName === "Rhema Beauty Shop",
  );
  assert.ok(product && original);

  for (const finalUrl of [
    "https://shop.rhemabeautyshop.com/product",
    "https://rhemabeautyshop.com.attacker.example/product",
    "https://rhemabeautyshop.com@attacker.example/product",
    "https://user:pass@rhemabeautyshop.com/product",
    "https://rhemabeautyshop.com:8443/product",
  ]) {
    const spoofed = structuredClone(original);
    spoofed.finalUrl = finalUrl;
    assert.ok(
      catalogueOfferAdmissionBlockers(
        product,
        spoofed,
        asOf,
        authoritiesFor(product, spoofed),
      ).includes("final-retailer-host-mismatch"),
      finalUrl,
    );
  }
});

test("structured price and stock must reconcile to the retained retailer text", () => {
  const product = products.find(
    (item) =>
      item.candidateId ===
      "naturium-the-perfector-salicylic-acid-body-wash-500ml",
  );
  const original = product?.offers.find(
    (offer) => offer.retailer.displayName === "Rhema Beauty Shop",
  );
  assert.ok(product && original);

  const wrongPrice = structuredClone(original);
  wrongPrice.price.amount = 1;
  assert.ok(
    catalogueOfferAdmissionBlockers(
      product,
      wrongPrice,
      asOf,
      authoritiesFor(product, wrongPrice),
    ).includes("ngn-price-evidence-invalid"),
  );

  const wrongStock = structuredClone(original);
  wrongStock.stock.status = "low-stock";
  assert.ok(
    catalogueOfferAdmissionBlockers(
      product,
      wrongStock,
      asOf,
      authoritiesFor(product, wrongStock),
    ).includes("offer-unavailable"),
  );

  for (const sourceText of ["Not in stock", "Only 0 left in stock"]) {
    const negativeStock = structuredClone(original);
    negativeStock.stock.sourceText = sourceText;
    assert.ok(
      catalogueOfferAdmissionBlockers(
        product,
        negativeStock,
        asOf,
        authoritiesFor(product, negativeStock),
      ).includes("offer-unavailable"),
    );
  }
});

test("stale observations remain history but cannot be admitted", () => {
  const product = products.find(
    (item) =>
      item.candidateId ===
      "naturium-the-perfector-salicylic-acid-body-wash-500ml",
  );
  const original = product?.offers.find(
    (offer) => offer.retailer.displayName === "Rhema Beauty Shop",
  );
  assert.ok(product && original);

  const stale = structuredClone(original);
  stale.observedAt = "2026-07-27T14:54:07.717Z";
  stale.expiresAt = "2026-08-12T14:54:07.717Z";
  assert.ok(
    catalogueOfferAdmissionBlockers(
      product,
      stale,
      asOf,
      authoritiesFor(product, stale),
    ).includes("offer-stale"),
  );
});

test("historical packaging uses only the verified official exact-size authority", () => {
  const exact500ml: HistoricalPackageMatchInput = {
    candidateId: "loccitane-almond-shower-oil-500ml",
    brand: "L'Occitane en Provence",
    canonicalName: "Almond (Amande) Shower Oil",
    variant: "Almond (Amande) Softening Shower Oil",
    size: "500 ml",
    currentPackageRevisionId:
      "loccitane-almond-shower-oil-500ml-package-current-2026",
    historicalPackageRevisionId:
      "loccitane-almond-shower-oil-500ml-package-before-2026",
    storeIdentity: {
      brand: "L'Occitane en Provence",
      canonicalName: "Almond (Amande) Shower Oil",
      variant: "Almond (Amande) Softening Shower Oil",
      size: "500 ml",
    },
    storeText:
      "L'Occitane en Provence Almond (Amande) Shower Oil — Almond (Amande) Softening Shower Oil — 500 ml",
    requestedUrl:
      "https://store.example/products/loccitane-almond-shower-oil-500ml",
    finalUrl:
      "https://store.example/products/loccitane-almond-shower-oil-500ml",
  };
  assert.deepEqual(officialPackageMatcher(exact500ml), {
    authorized: true,
    equivalenceId:
      "loccitane-almond-shower-oil-500ml-same-formula-new-look-2026",
    displayDisclosure: "Packaging may vary",
  });

  const crossSize = structuredClone(exact500ml);
  crossSize.candidateId = "loccitane-almond-softening-shower-oil-250ml";
  crossSize.size = "250 ml";
  crossSize.storeIdentity.size = "250 ml";
  crossSize.storeText =
    "L'Occitane en Provence Almond (Amande) Shower Oil — Almond (Amande) Softening Shower Oil — 250 ml";
  assert.deepEqual(officialPackageMatcher(crossSize), {
    authorized: false,
    reason: "no-approved-official-equivalence",
  });
});

test("the Jumia lead is textually 250 ml and no 500 ml authority can bind it", () => {
  const product = products.find(
    (item) =>
      item.candidateId === "loccitane-almond-softening-shower-oil-250ml",
  );
  const offer = product?.offers[0];
  assert.ok(product && offer);
  assert.equal(product.canonicalIdentity.size, "250 ml");
  assert.equal(offer.observedSize, "250 ml");
  assert.equal(offer.packagingRevisionAliasId, null);
  assert.equal(offer.status, "admitted");
  const purportedHistory = structuredClone(offer);
  purportedHistory.packageMatch = "official-revision-equivalent";
  purportedHistory.packagingRevisionAliasId =
    "loccitane-almond-shower-oil-500ml-same-formula-new-look-2026";
  purportedHistory.packageRevisionIds = {
    current: "loccitane-almond-shower-oil-500ml-package-current-2026",
    historical: "loccitane-almond-shower-oil-500ml-package-before-2026",
  };
  assert.ok(
    catalogueOfferAdmissionBlockers(
      product,
      purportedHistory,
      asOf,
      authoritiesFor(product, purportedHistory),
    ).includes("official-package-revision-equivalence-missing"),
  );
  assert.ok(verifiedRetailOffers[product.candidateId]);
  assert.equal(
    verifiedRetailOffers[product.candidateId]?.[0]?.retailer,
    "Jumia",
  );
});

test("explicitly expiring projections disappear from merged public offers", () => {
  const product = products.find(
    (item) =>
      item.candidateId ===
      "naturium-the-perfector-salicylic-acid-body-wash-500ml",
  );
  assert.ok(product);
  const productKey = {
    slug: product.candidateId,
    name: product.canonicalIdentity.name,
    size: product.canonicalIdentity.size,
  };
  const rhemaOffer = verifiedRetailOffers[product.candidateId].find(
    (offer) => offer.retailer === "Rhema Beauty Shop",
  );
  assert.ok(rhemaOffer?.expiresAt);
  const expiry = Date.parse(rhemaOffer.expiresAt);
  const beforeExpiry = mergeRetailOffers(productKey, [], new Date(expiry - 1));
  const atExpiry = mergeRetailOffers(productKey, [], new Date(expiry + 1));
  assert.equal(
    beforeExpiry.some((offer) => offer.retailer === "Rhema Beauty Shop"),
    true,
  );
  assert.equal(
    atExpiry.some((offer) => offer.retailer === "Rhema Beauty Shop"),
    false,
  );

  const incoming = {
    ...verifiedRetailOffers[product.candidateId][0],
    retailer: "Expired incoming offer",
  };
  const mergedIncoming = mergeRetailOffers(
    productKey,
    [incoming],
    new Date(Date.parse(incoming.expiresAt!) + 1),
  );
  assert.equal(
    mergedIncoming.some((offer) => offer.retailer === incoming.retailer),
    false,
  );
});
