import { productBySlug } from "@/data/catalogue";
import cataloguePublicationDossierManifest from "@/data/catalogue-publication-dossiers.json";
import { marketFinderPackshotBindings } from "@/data/market-finder-packshot-bindings";
import productAssetManifest from "@/data/product-assets.json";
import { publishedIntakeReport } from "@/data/published-intake-products";
import {
  cataloguePublicationImageMaxBytes,
  cataloguePublicationImageMaxSide,
  cataloguePublicationImageMinSide,
  assertCataloguePublicationImageLocation,
  type CataloguePublicationImageMimeType,
} from "@/lib/catalogue/publication-image-policy";
import { fingerprint } from "@/lib/crypto/hashing";
import type { MarketFinderProductIdentity } from "@/lib/markets/domain";
import { z } from "zod";

export const marketFinderPackshotBindingSchemaVersion = 1 as const;
export const marketFinderPackshotBindingScope =
  "market-finder-supplemental-packshot" as const;
export const marketFinderPackshotReviewScope =
  "exact-market-finder-identity-rights-treatment-and-native-render" as const;
export const marketFinderPackshotFingerprintDomain =
  "jelocare-market-finder-packshot-rights-treatment-v1" as const;

export type MarketFinderPackshotBindingReviewInput = {
  schemaVersion: typeof marketFinderPackshotBindingSchemaVersion;
  scope: typeof marketFinderPackshotBindingScope;
  identity: MarketFinderProductIdentity;
  asset: {
    url: string;
    sha256: string;
    mimeType: CataloguePublicationImageMimeType;
    byteSize: number;
    width: number;
    height: number;
  };
  alphaAudit: {
    outputSha256: string;
    width: number;
    height: number;
    hasAlpha: true;
    transparentPixelCount: number;
    partialAlphaPixelCount: number;
    opaquePixelCount: number;
  };
  sourceSubjectEvidence: {
    source: {
      url: string;
      sha256: string;
      mimeType: "image/jpeg" | "image/png" | "image/webp";
      width: number;
      height: number;
    };
    sourceSubject: {
      width: number;
      height: number;
    };
    outputSha256: string;
    outputSubject: {
      width: number;
      height: number;
    };
    method: "reviewed-pixel-bounds";
  };
  rendering: {
    component: "native-catalogue-product-image";
    fit: "contain";
    transformedUrl: false;
  };
  review: {
    status: "human-approved";
    scope: typeof marketFinderPackshotReviewScope;
    rights: {
      status: "documented";
      basis: "brand-owner" | "licensed-for-publication" | "open-license";
      evidenceUrl: string;
    };
    treatment: {
      kind: "none" | "source-pixel-isolation";
      packagingIntact: true;
      labelVariantSizeUnchanged: true;
      packagingInvented: false;
    };
    reviewer: string;
    reviewedAt: string;
  };
};

export type MarketFinderPackshotBinding = Omit<
  MarketFinderPackshotBindingReviewInput,
  "review"
> & {
  review: MarketFinderPackshotBindingReviewInput["review"] & {
    rightsTreatmentFingerprintSha256: string;
  };
};

export type MarketFinderPublishedCatalogueImage = {
  slug: string;
  brand: string;
  name: string;
  size: string;
  image: string;
  sha256: string;
  mimeType: CataloguePublicationImageMimeType;
  byteSize: number;
  width: number;
  height: number;
};

export type MarketFinderPackshotRejectionReason =
  | "binding-missing"
  | "binding-ambiguous"
  | "binding-invalid"
  | "identity-mismatch"
  | "catalogue-product-missing"
  | "catalogue-image-evidence-missing"
  | "catalogue-identity-mismatch"
  | "catalogue-image-url-mismatch"
  | "catalogue-image-metadata-mismatch"
  | "asset-location-mismatch"
  | "alpha-evidence-mismatch"
  | "alpha-not-genuine"
  | "source-subject-evidence-mismatch"
  | "source-subject-upscaled"
  | "rights-treatment-fingerprint-mismatch";

export type MarketFinderPackshotDecision =
  | {
      status: "accepted";
      image: {
        url: string;
        sha256: string;
        mimeType: CataloguePublicationImageMimeType;
        width: number;
        height: number;
        rendering: "native-contain";
      };
    }
  | {
      status: "rejected";
      reason: MarketFinderPackshotRejectionReason;
    };

export type MarketFinderPackshotRegistryIssue = {
  entry: number;
  slug: string | null;
  reason: Exclude<MarketFinderPackshotRejectionReason, "binding-missing">;
};

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const positiveIntegerSchema = z.number().int().positive();
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const httpsUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" && !url.username && !url.password && !url.port
    );
  });
const dimensionsSchema = z.strictObject({
  width: positiveIntegerSchema,
  height: positiveIntegerSchema,
});
const identitySchema = z.strictObject({
  identityVersionId: z.string().min(1),
  productId: z.string().min(1),
  slug: z.string().min(1),
  brand: z.string().min(1),
  variant: z.string().min(1),
  size: z.string().min(1),
  packageVersion: z.string().min(1),
  formulaVersion: z.string().min(1),
});
const reviewSchema = z.strictObject({
  status: z.literal("human-approved"),
  scope: z.literal(marketFinderPackshotReviewScope),
  rights: z.strictObject({
    status: z.literal("documented"),
    basis: z.enum(["brand-owner", "licensed-for-publication", "open-license"]),
    evidenceUrl: httpsUrlSchema,
  }),
  treatment: z.strictObject({
    kind: z.enum(["none", "source-pixel-isolation"]),
    packagingIntact: z.literal(true),
    labelVariantSizeUnchanged: z.literal(true),
    packagingInvented: z.literal(false),
  }),
  reviewer: z
    .string()
    .min(2)
    .refine((value) => value === value.trim()),
  reviewedAt: z.iso.datetime(),
  rightsTreatmentFingerprintSha256: sha256Schema,
});
const bindingSchema = z.strictObject({
  schemaVersion: z.literal(marketFinderPackshotBindingSchemaVersion),
  scope: z.literal(marketFinderPackshotBindingScope),
  identity: identitySchema,
  asset: z.strictObject({
    url: httpsUrlSchema,
    sha256: sha256Schema,
    mimeType: z.enum(["image/png", "image/webp"]),
    byteSize: positiveIntegerSchema.max(cataloguePublicationImageMaxBytes),
    width: positiveIntegerSchema
      .min(cataloguePublicationImageMinSide)
      .max(cataloguePublicationImageMaxSide),
    height: positiveIntegerSchema
      .min(cataloguePublicationImageMinSide)
      .max(cataloguePublicationImageMaxSide),
  }),
  alphaAudit: z.strictObject({
    outputSha256: sha256Schema,
    width: positiveIntegerSchema,
    height: positiveIntegerSchema,
    hasAlpha: z.literal(true),
    transparentPixelCount: positiveIntegerSchema,
    partialAlphaPixelCount: nonNegativeIntegerSchema,
    opaquePixelCount: nonNegativeIntegerSchema,
  }),
  sourceSubjectEvidence: z.strictObject({
    source: z.strictObject({
      url: httpsUrlSchema,
      sha256: sha256Schema,
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      width: positiveIntegerSchema,
      height: positiveIntegerSchema,
    }),
    sourceSubject: dimensionsSchema,
    outputSha256: sha256Schema,
    outputSubject: dimensionsSchema,
    method: z.literal("reviewed-pixel-bounds"),
  }),
  rendering: z.strictObject({
    component: z.literal("native-catalogue-product-image"),
    fit: z.literal("contain"),
    transformedUrl: z.literal(false),
  }),
  review: reviewSchema,
});
const publishedImageSchema = z.strictObject({
  slug: z.string().min(1),
  brand: z.string().min(1),
  name: z.string().min(1),
  size: z.string().min(1),
  image: httpsUrlSchema,
  sha256: sha256Schema,
  mimeType: z.enum(["image/png", "image/webp"]),
  byteSize: positiveIntegerSchema.max(cataloguePublicationImageMaxBytes),
  width: positiveIntegerSchema
    .min(cataloguePublicationImageMinSide)
    .max(cataloguePublicationImageMaxSide),
  height: positiveIntegerSchema
    .min(cataloguePublicationImageMinSide)
    .max(cataloguePublicationImageMaxSide),
});

type LegacyProductAsset = {
  blobUrl: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
  hasAlpha: boolean;
  contentHash: string;
};

type PublishedDossierImage = {
  candidateId: string;
  dossierFingerprint: string;
  finalImage: {
    url: string;
    sha256: string;
    mimeType: string;
    byteSize: number;
    width: number;
    height: number;
  };
};

const legacyProductAssets = productAssetManifest as Record<
  string,
  LegacyProductAsset
>;
const publishedDossierImages = (
  cataloguePublicationDossierManifest as unknown as {
    dossiers: readonly PublishedDossierImage[];
  }
).dossiers;
const publishedReleaseFingerprintByCandidate = new Map(
  publishedIntakeReport.releases.map((release) => [
    release.candidateId,
    release.dossierFingerprint,
  ]),
);

function sameIdentity(
  expected: MarketFinderProductIdentity,
  actual: MarketFinderProductIdentity,
) {
  return (
    expected.identityVersionId === actual.identityVersionId &&
    expected.productId === actual.productId &&
    expected.slug === actual.slug &&
    expected.brand === actual.brand &&
    expected.variant === actual.variant &&
    expected.size === actual.size &&
    expected.packageVersion === actual.packageVersion &&
    expected.formulaVersion === actual.formulaVersion
  );
}

function bindingReviewInput(
  binding: MarketFinderPackshotBinding,
): MarketFinderPackshotBindingReviewInput {
  const { rightsTreatmentFingerprintSha256: fingerprintSha256, ...review } =
    binding.review;
  void fingerprintSha256;
  return { ...binding, review };
}

export function marketFinderPackshotRightsTreatmentFingerprint(
  input: MarketFinderPackshotBindingReviewInput,
) {
  return fingerprint(marketFinderPackshotFingerprintDomain, input);
}

function rejected(
  reason: MarketFinderPackshotRejectionReason,
): MarketFinderPackshotDecision {
  return { status: "rejected", reason };
}

/**
 * Validates one supplemental record against an independently published
 * catalogue projection. This function is pure so the exact fail-closed cases
 * can be exercised without granting a test fixture publication authority.
 */
export function evaluateMarketFinderPackshotBinding(
  product: MarketFinderProductIdentity,
  candidate: unknown,
  publishedCandidate: MarketFinderPublishedCatalogueImage | undefined,
): MarketFinderPackshotDecision {
  if (candidate === undefined) return rejected("binding-missing");
  const parsed = bindingSchema.safeParse(candidate);
  if (!parsed.success) return rejected("binding-invalid");
  const binding = parsed.data as MarketFinderPackshotBinding;

  if (!sameIdentity(product, binding.identity)) {
    return rejected("identity-mismatch");
  }
  if (!publishedCandidate) return rejected("catalogue-product-missing");
  const publishedResult = publishedImageSchema.safeParse(publishedCandidate);
  if (!publishedResult.success) {
    return rejected("catalogue-image-evidence-missing");
  }
  const published = publishedResult.data;
  if (
    published.slug !== product.slug ||
    published.brand !== product.brand ||
    published.name !== product.variant ||
    published.size !== product.size
  ) {
    return rejected("catalogue-identity-mismatch");
  }
  if (published.image !== binding.asset.url) {
    return rejected("catalogue-image-url-mismatch");
  }
  if (
    published.sha256 !== binding.asset.sha256 ||
    published.mimeType !== binding.asset.mimeType ||
    published.byteSize !== binding.asset.byteSize ||
    published.width !== binding.asset.width ||
    published.height !== binding.asset.height
  ) {
    return rejected("catalogue-image-metadata-mismatch");
  }

  try {
    assertCataloguePublicationImageLocation(
      product.slug,
      binding.asset.url,
      binding.asset.mimeType,
      binding.asset.sha256,
    );
  } catch {
    return rejected("asset-location-mismatch");
  }

  const alpha = binding.alphaAudit;
  if (
    alpha.outputSha256 !== binding.asset.sha256 ||
    alpha.width !== binding.asset.width ||
    alpha.height !== binding.asset.height
  ) {
    return rejected("alpha-evidence-mismatch");
  }
  const auditedPixels =
    alpha.transparentPixelCount +
    alpha.partialAlphaPixelCount +
    alpha.opaquePixelCount;
  if (
    auditedPixels !== binding.asset.width * binding.asset.height ||
    alpha.transparentPixelCount === 0 ||
    alpha.partialAlphaPixelCount + alpha.opaquePixelCount === 0
  ) {
    return rejected("alpha-not-genuine");
  }

  const subject = binding.sourceSubjectEvidence;
  if (
    subject.outputSha256 !== binding.asset.sha256 ||
    subject.sourceSubject.width > subject.source.width ||
    subject.sourceSubject.height > subject.source.height ||
    subject.outputSubject.width > binding.asset.width ||
    subject.outputSubject.height > binding.asset.height ||
    (binding.review.treatment.kind === "none" &&
      (subject.source.sha256 !== binding.asset.sha256 ||
        subject.source.width !== binding.asset.width ||
        subject.source.height !== binding.asset.height))
  ) {
    return rejected("source-subject-evidence-mismatch");
  }
  if (
    subject.outputSubject.width > subject.sourceSubject.width ||
    subject.outputSubject.height > subject.sourceSubject.height
  ) {
    return rejected("source-subject-upscaled");
  }

  const expectedFingerprint = marketFinderPackshotRightsTreatmentFingerprint(
    bindingReviewInput(binding),
  );
  if (binding.review.rightsTreatmentFingerprintSha256 !== expectedFingerprint) {
    return rejected("rights-treatment-fingerprint-mismatch");
  }

  const reviewedAt = Date.parse(binding.review.reviewedAt);
  if (!Number.isFinite(reviewedAt) || reviewedAt > Date.now() + 5 * 60_000) {
    return rejected("binding-invalid");
  }

  return {
    status: "accepted",
    image: {
      url: binding.asset.url,
      sha256: binding.asset.sha256,
      mimeType: binding.asset.mimeType,
      width: binding.asset.width,
      height: binding.asset.height,
      rendering: "native-contain",
    },
  };
}

function bindingSlug(candidate: unknown) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
    return undefined;
  const identity = (candidate as Record<string, unknown>).identity;
  if (!identity || typeof identity !== "object" || Array.isArray(identity))
    return undefined;
  const slug = (identity as Record<string, unknown>).slug;
  return typeof slug === "string" ? slug : undefined;
}

function publishedCatalogueImageEvidence(
  published: NonNullable<ReturnType<typeof productBySlug>>,
): MarketFinderPublishedCatalogueImage | undefined {
  const releaseFingerprint = publishedReleaseFingerprintByCandidate.get(
    published.slug,
  );
  if (releaseFingerprint) {
    const dossier = publishedDossierImages.find(
      (candidate) =>
        candidate.candidateId === published.slug &&
        candidate.dossierFingerprint === releaseFingerprint &&
        candidate.finalImage.url === published.image,
    );
    if (
      dossier &&
      (dossier.finalImage.mimeType === "image/png" ||
        dossier.finalImage.mimeType === "image/webp")
    ) {
      return {
        slug: published.slug,
        brand: published.brand,
        name: published.name,
        size: published.size,
        image: published.image,
        sha256: dossier.finalImage.sha256,
        mimeType: dossier.finalImage.mimeType,
        byteSize: dossier.finalImage.byteSize,
        width: dossier.finalImage.width,
        height: dossier.finalImage.height,
      };
    }
  }

  const legacyAsset = legacyProductAssets[published.slug];
  if (
    legacyAsset?.blobUrl === published.image &&
    legacyAsset.hasAlpha === true &&
    (legacyAsset.contentType === "image/png" ||
      legacyAsset.contentType === "image/webp")
  ) {
    return {
      slug: published.slug,
      brand: published.brand,
      name: published.name,
      size: published.size,
      image: published.image,
      sha256: legacyAsset.contentHash,
      mimeType: legacyAsset.contentType,
      byteSize: legacyAsset.byteSize,
      width: legacyAsset.width,
      height: legacyAsset.height,
    };
  }

  return undefined;
}

/**
 * Audits every declared supplemental record, including records that do not
 * match a currently surfaced Market Finder product. Missing records are valid;
 * malformed, duplicate, or orphaned declarations are not.
 */
export function evaluateMarketFinderPackshotRegistryIntegrity(
  candidates: readonly unknown[] = marketFinderPackshotBindings as readonly unknown[],
): readonly MarketFinderPackshotRegistryIssue[] {
  const parsedCandidates = candidates.map((candidate) =>
    bindingSchema.safeParse(candidate),
  );
  const slugCounts = new Map<string, number>();

  for (const parsed of parsedCandidates) {
    if (!parsed.success) continue;
    const slug = parsed.data.identity.slug;
    slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1);
  }

  const issues: MarketFinderPackshotRegistryIssue[] = [];
  parsedCandidates.forEach((parsed, index) => {
    const candidate = candidates[index];
    if (!parsed.success) {
      issues.push({
        entry: index + 1,
        slug: bindingSlug(candidate) ?? null,
        reason: "binding-invalid",
      });
      return;
    }

    const identity = parsed.data.identity;
    if ((slugCounts.get(identity.slug) ?? 0) !== 1) {
      issues.push({
        entry: index + 1,
        slug: identity.slug,
        reason: "binding-ambiguous",
      });
      return;
    }

    const published = productBySlug(identity.slug);
    const decision = evaluateMarketFinderPackshotBinding(
      identity,
      candidate,
      published ? publishedCatalogueImageEvidence(published) : undefined,
    );
    if (decision.status === "accepted") return;

    issues.push({
      entry: index + 1,
      slug: identity.slug,
      reason:
        decision.reason === "binding-missing"
          ? "binding-invalid"
          : decision.reason,
    });
  });

  return issues;
}

/** The production decision shared by Market Finder presentation and readiness. */
export function resolveMarketFinderProductPackshotDecision(
  product: MarketFinderProductIdentity,
): MarketFinderPackshotDecision {
  const matches = (marketFinderPackshotBindings as readonly unknown[]).filter(
    (candidate) => bindingSlug(candidate) === product.slug,
  );
  if (matches.length === 0) return rejected("binding-missing");
  if (matches.length !== 1) return rejected("binding-ambiguous");

  const published = productBySlug(product.slug);
  return evaluateMarketFinderPackshotBinding(
    product,
    matches[0],
    published ? publishedCatalogueImageEvidence(published) : undefined,
  );
}
