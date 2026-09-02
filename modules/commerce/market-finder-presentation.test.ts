import assert from "node:assert/strict";
import test from "node:test";
import type {
  CurrentMarketFinderLocation,
  MarketFinderContext,
} from "@/lib/markets/domain";
import {
  evaluateMarketFinderPackshotBinding,
  marketFinderPackshotRightsTreatmentFingerprint,
  resolveMarketFinderProductPackshotDecision,
  type MarketFinderPackshotBinding,
  type MarketFinderPackshotBindingReviewInput,
  type MarketFinderPublishedCatalogueImage,
} from "@/lib/markets/market-finder-packshot-binding";
import {
  presentMarketFinderLocation,
  presentMarketFinderMarket,
  presentMarketFinderProduct,
  presentMarketFinderResearchRecord,
  resolveMarketFinderProductPackshot,
} from "@/lib/markets/presentation";

const context: MarketFinderContext = {
  market: {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "trade-fair",
    name: "Lagos Trade Fair",
    city: "Lagos",
    stateRegion: "Lagos",
    countryCode: "NG",
  },
  product: {
    identityVersionId: "22222222-2222-4222-8222-222222222222",
    productId: "33333333-3333-4333-8333-333333333333",
    slug: "exact-product-50ml",
    brand: "Exact Brand",
    variant: "Exact Product",
    size: "50 ml",
    packageVersion: "v1",
    formulaVersion: "v1",
  },
};

const outputSha256 = "a".repeat(64);
const sourceSha256 = "b".repeat(64);
const publishedImageUrl = `https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/products/exact-brand/${context.product.slug}/packshot-v1-${outputSha256.slice(0, 16)}.png`;
const publishedProduct: MarketFinderPublishedCatalogueImage = {
  slug: context.product.slug,
  brand: context.product.brand,
  name: context.product.variant,
  size: context.product.size,
  image: publishedImageUrl,
  sha256: outputSha256,
  mimeType: "image/png",
  byteSize: 480_000,
  width: 1_600,
  height: 2_000,
};

function reviewedBinding(
  mutate?: (
    input: MarketFinderPackshotBindingReviewInput,
  ) => MarketFinderPackshotBindingReviewInput,
): MarketFinderPackshotBinding {
  const base: MarketFinderPackshotBindingReviewInput = {
    schemaVersion: 1,
    scope: "market-finder-supplemental-packshot",
    identity: { ...context.product },
    asset: {
      url: publishedImageUrl,
      sha256: outputSha256,
      mimeType: "image/png",
      byteSize: 480_000,
      width: 1_600,
      height: 2_000,
    },
    alphaAudit: {
      outputSha256,
      width: 1_600,
      height: 2_000,
      hasAlpha: true,
      transparentPixelCount: 1_000_000,
      partialAlphaPixelCount: 100_000,
      opaquePixelCount: 2_100_000,
    },
    sourceSubjectEvidence: {
      source: {
        url: "https://brand.example/products/exact-product/source.jpg",
        sha256: sourceSha256,
        mimeType: "image/jpeg",
        width: 2_400,
        height: 3_000,
      },
      sourceSubject: { width: 1_200, height: 1_800 },
      outputSha256,
      outputSubject: { width: 1_000, height: 1_500 },
      method: "reviewed-pixel-bounds",
    },
    rendering: {
      component: "native-catalogue-product-image",
      fit: "contain",
      transformedUrl: false,
    },
    review: {
      status: "human-approved",
      scope: "exact-market-finder-identity-rights-treatment-and-native-render",
      rights: {
        status: "documented",
        basis: "licensed-for-publication",
        evidenceUrl: "https://brand.example/licensing/exact-product",
      },
      treatment: {
        kind: "source-pixel-isolation",
        packagingIntact: true,
        labelVariantSizeUnchanged: true,
        packagingInvented: false,
      },
      reviewer: "JeloCare media reviewer",
      reviewedAt: "2026-08-30T12:00:00.000Z",
    },
  };
  const input = mutate ? mutate(base) : base;
  return {
    ...input,
    review: {
      ...input.review,
      rightsTreatmentFingerprintSha256:
        marketFinderPackshotRightsTreatmentFingerprint(input),
    },
  };
}

const location: CurrentMarketFinderLocation = {
  id: "44444444-4444-4444-8444-444444444444",
  slug: "reviewed-shop-a43",
  name: "Reviewed Shop",
  retailerName: "Reviewed Retailer",
  placeName: "Akwa-Ibom Plaza",
  shopNumber: "A43",
  floor: null,
  locationVerificationExpiresAt: "2026-09-08T10:00:00.000Z",
  locationIdentityEvidenceExpiresAt: "2026-09-08T10:00:00.000Z",
  observation: {
    id: "55555555-5555-4555-8555-555555555555",
    availability: "in_stock",
    priceNgn: 12500.5,
    observedAt: "2026-09-01T10:00:00.000Z",
    expiresAt: "2026-09-08T10:00:00.000Z",
    sourceMethod: "retailer_confirmation",
    observedTitle: "Exact Product",
    observedSize: "50 ml",
  },
  action: {
    kind: "whatsapp",
    destination: "https://wa.me/2348000000000",
    href: "https://wa.me/2348000000000",
    expiresAt: "2026-09-08T10:00:00.000Z",
  },
};

test("production Market Finder presentation preserves exact identity and native packshot gate", () => {
  assert.deepEqual(presentMarketFinderMarket(context.market), {
    slug: "trade-fair",
    name: "Lagos Trade Fair",
    location: "Lagos, Nigeria",
  });
  assert.equal(resolveMarketFinderProductPackshot(context.product), undefined);
  assert.deepEqual(presentMarketFinderProduct(context.product), {
    slug: "exact-product-50ml",
    brand: "Exact Brand",
    name: "Exact Product",
    size: "50 ml",
    identityNote: "Exact 50 ml pack identity reviewed.",
    image: undefined,
  });
});

test("current COSRX and Miracle targets have no accepted supplemental binding", () => {
  for (const target of [
    {
      identityVersionId: "cosrx-identity-pending",
      productId: "cosrx-product-pending",
      slug: "cosrx-aloe-soothing-sun-cream-50ml",
      brand: "COSRX",
      variant: "Aloe Soothing Sun Cream",
      size: "50 ml",
      packageVersion: "pending",
      formulaVersion: "pending",
    },
    {
      identityVersionId: "miracle-identity-pending",
      productId: "miracle-product-pending",
      slug: "miracle-natural-hair-anti-dandruff-shampoo",
      brand: "BEAUTIFUL YOU · MIRACLE",
      variant: "Natural Hair Anti-Dandruff & Anti-Itch Shampoo",
      size: "400 ml",
      packageVersion: "pending",
      formulaVersion: "pending",
    },
  ]) {
    assert.deepEqual(resolveMarketFinderProductPackshotDecision(target), {
      status: "rejected",
      reason: "binding-missing",
    });
  }
});

test("supplemental packshot acceptance binds the public image and all reviewed evidence", () => {
  const decision = evaluateMarketFinderPackshotBinding(
    context.product,
    reviewedBinding(),
    publishedProduct,
  );

  assert.deepEqual(decision, {
    status: "accepted",
    image: {
      url: publishedImageUrl,
      sha256: outputSha256,
      mimeType: "image/png",
      width: 1_600,
      height: 2_000,
      rendering: "native-contain",
    },
  });
});

test("supplemental packshot acceptance fails closed for missing or mismatched proof", async (t) => {
  await t.test("missing binding", () => {
    assert.deepEqual(
      evaluateMarketFinderPackshotBinding(
        context.product,
        undefined,
        publishedProduct,
      ),
      { status: "rejected", reason: "binding-missing" },
    );
  });

  await t.test("full Market Finder identity mismatch", () => {
    const binding = reviewedBinding((input) => ({
      ...input,
      identity: { ...input.identity, packageVersion: "v2" },
    }));
    assert.deepEqual(
      evaluateMarketFinderPackshotBinding(
        context.product,
        binding,
        publishedProduct,
      ),
      { status: "rejected", reason: "identity-mismatch" },
    );
  });

  await t.test("catalogue image URL mismatch", () => {
    assert.deepEqual(
      evaluateMarketFinderPackshotBinding(context.product, reviewedBinding(), {
        ...publishedProduct,
        image: `${publishedImageUrl}?different=1`,
      }),
      { status: "rejected", reason: "catalogue-image-url-mismatch" },
    );
  });

  await t.test("content-address hash mismatch", () => {
    const binding = reviewedBinding((input) => ({
      ...input,
      asset: { ...input.asset, sha256: "c".repeat(64) },
      alphaAudit: { ...input.alphaAudit, outputSha256: "c".repeat(64) },
      sourceSubjectEvidence: {
        ...input.sourceSubjectEvidence,
        outputSha256: "c".repeat(64),
      },
    }));
    assert.deepEqual(
      evaluateMarketFinderPackshotBinding(
        context.product,
        binding,
        publishedProduct,
      ),
      {
        status: "rejected",
        reason: "catalogue-image-metadata-mismatch",
      },
    );
  });

  await t.test("same-prefix SHA-256 tail mismatch", () => {
    const changedSha256 = `${outputSha256.slice(0, 16)}${"c".repeat(48)}`;
    const binding = reviewedBinding((input) => ({
      ...input,
      asset: { ...input.asset, sha256: changedSha256 },
      alphaAudit: { ...input.alphaAudit, outputSha256: changedSha256 },
      sourceSubjectEvidence: {
        ...input.sourceSubjectEvidence,
        outputSha256: changedSha256,
      },
    }));
    assert.deepEqual(
      evaluateMarketFinderPackshotBinding(
        context.product,
        binding,
        publishedProduct,
      ),
      {
        status: "rejected",
        reason: "catalogue-image-metadata-mismatch",
      },
    );
  });

  await t.test("MIME must match the content-addressed URL", () => {
    const binding = reviewedBinding((input) => ({
      ...input,
      asset: { ...input.asset, mimeType: "image/webp" },
    }));
    assert.deepEqual(
      evaluateMarketFinderPackshotBinding(
        context.product,
        binding,
        publishedProduct,
      ),
      {
        status: "rejected",
        reason: "catalogue-image-metadata-mismatch",
      },
    );
  });

  await t.test("native dimensions must match published evidence", () => {
    assert.deepEqual(
      evaluateMarketFinderPackshotBinding(context.product, reviewedBinding(), {
        ...publishedProduct,
        width: publishedProduct.width + 1,
      }),
      {
        status: "rejected",
        reason: "catalogue-image-metadata-mismatch",
      },
    );
  });

  await t.test("alpha false cannot masquerade as transparency", () => {
    const binding = {
      ...reviewedBinding(),
      alphaAudit: { ...reviewedBinding().alphaAudit, hasAlpha: false },
    };
    assert.deepEqual(
      evaluateMarketFinderPackshotBinding(
        context.product,
        binding,
        publishedProduct,
      ),
      { status: "rejected", reason: "binding-invalid" },
    );
  });

  await t.test("alpha hash and dimensions must match the output", () => {
    const binding = reviewedBinding((input) => ({
      ...input,
      alphaAudit: { ...input.alphaAudit, outputSha256: "c".repeat(64) },
    }));
    assert.deepEqual(
      evaluateMarketFinderPackshotBinding(
        context.product,
        binding,
        publishedProduct,
      ),
      { status: "rejected", reason: "alpha-evidence-mismatch" },
    );
  });

  await t.test(
    "a true alpha flag without genuine pixel counts is rejected",
    () => {
      const binding = reviewedBinding((input) => ({
        ...input,
        alphaAudit: {
          ...input.alphaAudit,
          transparentPixelCount: input.alphaAudit.transparentPixelCount - 1,
        },
      }));
      assert.deepEqual(
        evaluateMarketFinderPackshotBinding(
          context.product,
          binding,
          publishedProduct,
        ),
        { status: "rejected", reason: "alpha-not-genuine" },
      );
    },
  );

  await t.test("source-subject upscale is rejected", () => {
    const binding = reviewedBinding((input) => ({
      ...input,
      sourceSubjectEvidence: {
        ...input.sourceSubjectEvidence,
        sourceSubject: { width: 900, height: 1_400 },
      },
    }));
    assert.deepEqual(
      evaluateMarketFinderPackshotBinding(
        context.product,
        binding,
        publishedProduct,
      ),
      { status: "rejected", reason: "source-subject-upscaled" },
    );
  });

  await t.test("rights and treatment review fingerprint is immutable", () => {
    const binding = reviewedBinding();
    const forged = {
      ...binding,
      review: {
        ...binding.review,
        rights: { ...binding.review.rights, basis: "brand-owner" },
      },
    };
    assert.deepEqual(
      evaluateMarketFinderPackshotBinding(
        context.product,
        forged,
        publishedProduct,
      ),
      {
        status: "rejected",
        reason: "rights-treatment-fingerprint-mismatch",
      },
    );
  });
});

test("production location presentation exposes only bounded reviewed display fields", () => {
  const lead = presentMarketFinderLocation(context, location);
  assert.equal(lead.state, "ready");
  assert.equal(lead.stateLabel, "In stock");
  assert.equal(lead.locationLabel, "Akwa-Ibom Plaza · Shop A43 · Lagos");
  assert.match(lead.evidenceLabel, /₦12,500\.5/);
  assert.match(lead.evidenceNote, /Retailer confirmation/);
  assert.deepEqual(lead.directions, []);
  assert.deepEqual(lead.externalAction, {
    href: "https://wa.me/2348000000000",
    label: "Open WhatsApp",
  });
  assert.equal(lead.actionEvidence.usableAction, "contact");
});

test("production research presentation is exact-product scoped and never actionable", () => {
  const baseRecord = {
    kind: "location" as const,
    id: location.id,
    slug: location.slug,
    name: location.name,
    retailerName: location.retailerName,
    placeName: location.placeName,
    shopNumber: location.shopNumber,
    floor: location.floor,
    locationVerificationExpiresAt: location.locationVerificationExpiresAt,
    locationIdentityEvidenceExpiresAt:
      location.locationIdentityEvidenceExpiresAt,
    observation: {
      ...location.observation,
      availability: "not_carried" as const,
    },
  };
  const unavailable = presentMarketFinderResearchRecord(context, {
    ...baseRecord,
    reason: "stock-unavailable",
  });
  assert.equal(unavailable.state, "unavailable");
  assert.equal(unavailable.stateLabel, "Reported not carried");
  assert.equal(unavailable.evidenceLabel, "Reported not carried");
  assert.match(unavailable.evidenceNote, /Exact Brand Exact Product, 50 ml/);
  assert.match(
    unavailable.evidenceNote,
    /does not describe other products or branches/i,
  );
  assert.equal(unavailable.detailRecordAvailable, false);
  assert.deepEqual(unavailable.directions, []);
  assert.equal(unavailable.actionEvidence.usableAction, null);
  assert.doesNotMatch(JSON.stringify(unavailable), /wa\.me|href/i);

  const unknown = presentMarketFinderResearchRecord(context, {
    ...baseRecord,
    reason: "stock-unavailable",
    observation: { ...baseRecord.observation, availability: "unknown" },
  });
  assert.equal(unknown.evidenceLabel, "Stock not confirmed");
  assert.equal(unknown.stateLabel, "Stock not confirmed");

  const noAction = presentMarketFinderResearchRecord(context, {
    ...baseRecord,
    reason: "no-usable-action",
    observation: { ...baseRecord.observation, availability: "low_stock" },
  });
  assert.equal(noAction.state, "location-lead");
  assert.equal(noAction.stateLabel, "Route needs review");
  assert.match(
    noAction.evidenceNote,
    /no current reviewed route or contact action/i,
  );
  assert.equal(noAction.detailRecordAvailable, false);
});

test("generic research warnings withhold disputed or expired location identity", () => {
  const disputed = presentMarketFinderResearchRecord(context, {
    kind: "warning",
    id: "location-disputed",
    reason: "location-disputed",
  });
  assert.equal(disputed.kind, "direction-alert");
  assert.equal(disputed.state, "disputed");
  assert.equal(disputed.stateLabel, "Location under review");
  assert.equal(disputed.name, "A market location is under review");
  assert.equal(disputed.identityLabel, "Location details withheld");
  assert.deepEqual(disputed.directions, []);
  assert.equal(disputed.observedAt, undefined);
  assert.equal(disputed.detailRecordAvailable, false);
  assert.doesNotMatch(JSON.stringify(disputed), /A43|Akwa-Ibom|wa\.me|href/i);
});
