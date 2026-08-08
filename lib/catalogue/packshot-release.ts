import { stableJson, sha256 } from "@/lib/crypto/hashing";

// Legacy research-cutout integrity verifier. Passing these invariants never
// grants public catalogue approval; catalogue-publication-gate.ts is the only
// exposure boundary.

const hashPattern = /^[0-9a-f]{64}$/;
const barcodePattern = /^\d{8,14}$/;
const packshotPathPattern =
  /^\/catalogue\/open-beauty-facts\/(\d{8,14})\/packshot-([0-9a-f]{12})\.webp$/;

export const packshotReviewScope =
  "product-identity-source-and-cutout" as const;

export type PackshotReleaseProduct = {
  source: string;
  sourceProductId: string;
  barcode: string;
  sourceSnapshotSha256: string;
  rawPayloadSha256: string;
  sourceImageUrl: string;
  sourceFullImageUrl: string;
  canonicalImageUrl: string;
  sourceImageSha256: string;
  imageSha256: string;
  imageMimeType: string;
  imageWidth: number;
  imageHeight: number;
  imageByteSize: number;
  imageHasAlpha: boolean;
  imageTreatment: string;
  imageReviewStatus: string;
  imageReviewScope: string;
  imageReviewedAt: string;
  imageReviewer: string;
  imageProcessingModel: string;
  imageProcessingVersion: string;
  imageProcessingProvider: string;
  candidateSha256: string;
  packshotReleaseSha256: string;
};

export type PackshotReleaseMetadata = {
  sourceSnapshotSha256: string;
  requestedPublishedCount: number;
  reviewedCount: number;
  communitySourcedCount: number;
  publicCatalogueCount: number;
  mirroredImageCount: number;
  mirrorFailureCount: number;
  packshotReleaseSha256: string;
  packshotSelectionSha256: string;
  packshotCandidateManifestSha256: string;
  packshotCandidateMetadataSha256: string;
  packshotAuditManifestSha256: string;
  packshotReviewStatus: string;
  packshotReviewScope: string;
  packshotReviewedAt: string;
  packshotReviewer: string;
  packshotProcessingModels: string[];
  packshotProcessingVersions: string[];
  packshotProcessingProviders: string[];
};

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition)
    throw new Error(`Packshot release invariant failed: ${message}`);
}

function validDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now() + 5 * 60_000;
}

function httpsUrl(value: string, hostname?: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (!hostname || url.hostname === hostname)
      ? url
      : null;
  } catch {
    return null;
  }
}

export function candidateSha256(candidate: unknown) {
  return sha256(stableJson(candidate));
}

function candidateFromPublishedProduct(product: PackshotReleaseProduct) {
  const candidate = { ...product } as Record<string, unknown>;
  for (const key of [
    "sourceSnapshotSha256",
    "sourceFullImageUrl",
    "canonicalImageUrl",
    "sourceImageSha256",
    "imageSha256",
    "imageMimeType",
    "imageWidth",
    "imageHeight",
    "imageByteSize",
    "imageHasAlpha",
    "imageTreatment",
    "imageReviewStatus",
    "imageReviewScope",
    "imageReviewedAt",
    "imageReviewer",
    "imageProcessingModel",
    "imageProcessingVersion",
    "imageProcessingProvider",
    "candidateSha256",
    "packshotReleaseSha256",
  ])
    delete candidate[key];
  return candidate;
}

export function assertPublishedPackshotRelease(
  products: readonly PackshotReleaseProduct[],
  metadata: PackshotReleaseMetadata,
  target = 977,
) {
  invariant(
    products.length === target,
    `expected ${target} products, received ${products.length}`,
  );
  invariant(
    metadata.requestedPublishedCount === target,
    "requested count does not match release target",
  );
  invariant(
    metadata.communitySourcedCount === target,
    "community count does not match release target",
  );
  invariant(
    metadata.mirroredImageCount === target,
    "mirrored image count does not match release target",
  );
  invariant(
    metadata.publicCatalogueCount === target + metadata.reviewedCount,
    "public count does not reconcile",
  );
  invariant(
    metadata.mirrorFailureCount === 0,
    "release still records mirror failures",
  );

  for (const [label, value] of [
    ["source snapshot", metadata.sourceSnapshotSha256],
    ["release", metadata.packshotReleaseSha256],
    ["selection", metadata.packshotSelectionSha256],
    ["candidate manifest", metadata.packshotCandidateManifestSha256],
    ["candidate metadata", metadata.packshotCandidateMetadataSha256],
    ["audit manifest", metadata.packshotAuditManifestSha256],
  ] as const)
    invariant(hashPattern.test(value), `${label} SHA-256 is invalid`);

  invariant(
    metadata.packshotReviewStatus === "human-approved",
    "release is not human-approved",
  );
  invariant(
    metadata.packshotReviewScope === packshotReviewScope,
    "review scope does not cover identity, source, and cutout",
  );
  invariant(
    validDate(metadata.packshotReviewedAt),
    "review timestamp is invalid or in the future",
  );
  invariant(
    metadata.packshotReviewer.trim().length >= 2,
    "reviewer identity is missing",
  );
  invariant(
    metadata.packshotProcessingModels.length > 0,
    "processing model provenance is missing",
  );
  invariant(
    metadata.packshotProcessingVersions.length > 0,
    "processing version provenance is missing",
  );
  invariant(
    metadata.packshotProcessingProviders.length > 0,
    "processing provider provenance is missing",
  );

  const barcodes = new Set<string>();
  const sourceIds = new Set<string>();
  const imageUrls = new Set<string>();
  const models = new Set<string>();
  const versions = new Set<string>();
  const providers = new Set<string>();
  for (const product of products) {
    invariant(
      product.source === "open-beauty-facts",
      `${product.barcode}: unexpected source`,
    );
    invariant(
      barcodePattern.test(product.barcode),
      `${product.barcode}: invalid barcode`,
    );
    invariant(
      product.sourceProductId === product.barcode,
      `${product.barcode}: source ID mismatch`,
    );
    invariant(
      !barcodes.has(product.barcode),
      `${product.barcode}: duplicate barcode`,
    );
    invariant(
      !sourceIds.has(product.sourceProductId),
      `${product.barcode}: duplicate source ID`,
    );
    barcodes.add(product.barcode);
    sourceIds.add(product.sourceProductId);

    invariant(
      product.sourceSnapshotSha256 === metadata.sourceSnapshotSha256,
      `${product.barcode}: source snapshot mismatch`,
    );
    invariant(
      hashPattern.test(product.rawPayloadSha256),
      `${product.barcode}: raw payload hash is invalid`,
    );
    invariant(
      hashPattern.test(product.sourceImageSha256),
      `${product.barcode}: source image hash is invalid`,
    );
    invariant(
      hashPattern.test(product.imageSha256),
      `${product.barcode}: image hash is invalid`,
    );
    invariant(
      hashPattern.test(product.candidateSha256),
      `${product.barcode}: candidate hash is invalid`,
    );
    invariant(
      candidateSha256(candidateFromPublishedProduct(product)) ===
        product.candidateSha256,
      `${product.barcode}: candidate payload no longer matches its hash`,
    );
    invariant(
      product.packshotReleaseSha256 === metadata.packshotReleaseSha256,
      `${product.barcode}: release hash mismatch`,
    );

    invariant(
      Boolean(httpsUrl(product.sourceImageUrl, "images.openbeautyfacts.org")),
      `${product.barcode}: invalid source image URL`,
    );
    invariant(
      Boolean(
        httpsUrl(product.sourceFullImageUrl, "images.openbeautyfacts.org"),
      ),
      `${product.barcode}: invalid full source image URL`,
    );
    const canonical = httpsUrl(product.canonicalImageUrl);
    invariant(canonical, `${product.barcode}: invalid canonical image URL`);
    invariant(
      canonical.hostname.endsWith(".public.blob.vercel-storage.com"),
      `${product.barcode}: canonical image is not in Vercel Blob`,
    );
    const pathMatch = canonical.pathname.match(packshotPathPattern);
    invariant(
      pathMatch?.[1] === product.barcode,
      `${product.barcode}: canonical path barcode mismatch`,
    );
    invariant(
      pathMatch?.[2] === product.imageSha256.slice(0, 12),
      `${product.barcode}: canonical path hash mismatch`,
    );
    invariant(
      !imageUrls.has(product.canonicalImageUrl),
      `${product.barcode}: duplicate canonical image URL`,
    );
    imageUrls.add(product.canonicalImageUrl);

    invariant(
      product.imageMimeType === "image/webp",
      `${product.barcode}: image is not WebP`,
    );
    invariant(
      product.imageWidth === 1000 && product.imageHeight === 1000,
      `${product.barcode}: image is not 1000 × 1000`,
    );
    invariant(
      product.imageByteSize > 0,
      `${product.barcode}: image byte size is invalid`,
    );
    invariant(
      product.imageHasAlpha === true,
      `${product.barcode}: transparent-alpha attestation is missing`,
    );
    invariant(
      product.imageTreatment === "source-faithful-background-extraction",
      `${product.barcode}: image treatment is invalid`,
    );
    invariant(
      product.imageReviewStatus === "human-approved",
      `${product.barcode}: image is not human-approved`,
    );
    invariant(
      product.imageReviewScope === packshotReviewScope,
      `${product.barcode}: image review scope is incomplete`,
    );
    invariant(
      product.imageReviewedAt === metadata.packshotReviewedAt,
      `${product.barcode}: review timestamp mismatch`,
    );
    invariant(
      product.imageReviewer === metadata.packshotReviewer,
      `${product.barcode}: reviewer mismatch`,
    );
    invariant(
      product.imageProcessingModel.trim().length > 0,
      `${product.barcode}: processing model is missing`,
    );
    invariant(
      product.imageProcessingVersion.trim().length > 0,
      `${product.barcode}: processing version is missing`,
    );
    invariant(
      product.imageProcessingProvider.trim().length > 0,
      `${product.barcode}: processing provider is missing`,
    );
    models.add(product.imageProcessingModel);
    versions.add(product.imageProcessingVersion);
    providers.add(product.imageProcessingProvider);
  }
  invariant(
    JSON.stringify([...models].sort()) ===
      JSON.stringify([...metadata.packshotProcessingModels].sort()),
    "processing model summary does not reconcile",
  );
  invariant(
    JSON.stringify([...versions].sort()) ===
      JSON.stringify([...metadata.packshotProcessingVersions].sort()),
    "processing version summary does not reconcile",
  );
  invariant(
    JSON.stringify([...providers].sort()) ===
      JSON.stringify([...metadata.packshotProcessingProviders].sort()),
    "processing provider summary does not reconcile",
  );
}
