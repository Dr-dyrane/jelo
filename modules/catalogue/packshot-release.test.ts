import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertPublishedPackshotRelease,
  candidateSha256,
  packshotReviewScope,
  type PackshotReleaseMetadata,
  type PackshotReleaseProduct,
} from '@/lib/catalogue/packshot-release';

const hash = 'a'.repeat(64);
const imageHash = `123456789abc${'d'.repeat(52)}`;

function fixture() {
  const candidate = {
    source: 'open-beauty-facts',
    sourceProductId: '12345670',
    barcode: '12345670',
    rawPayloadSha256: hash,
    sourceImageUrl: 'https://images.openbeautyfacts.org/images/products/123/456/70/front.1.400.jpg',
  };
  const product: PackshotReleaseProduct = {
    ...candidate,
    sourceSnapshotSha256: hash,
    sourceFullImageUrl: 'https://images.openbeautyfacts.org/images/products/123/456/70/front.1.full.jpg',
    canonicalImageUrl: `https://example.public.blob.vercel-storage.com/catalogue/open-beauty-facts/12345670/packshot-${imageHash.slice(0, 12)}.webp`,
    sourceImageSha256: hash,
    imageSha256: imageHash,
    imageMimeType: 'image/webp',
    imageWidth: 1000,
    imageHeight: 1000,
    imageByteSize: 12_345,
    imageHasAlpha: true,
    imageTreatment: 'source-faithful-background-extraction',
    imageReviewStatus: 'human-approved',
    imageReviewScope: packshotReviewScope,
    imageReviewedAt: '2026-07-22T08:00:00.000Z',
    imageReviewer: 'Release reviewer',
    imageProcessingModel: 'isnet-general-use',
    imageProcessingVersion: 'rembg-2.0.77-normalization-v2',
    imageProcessingProvider: 'CPUExecutionProvider',
    candidateSha256: candidateSha256(candidate),
    packshotReleaseSha256: hash,
  };
  const metadata: PackshotReleaseMetadata = {
    sourceSnapshotSha256: hash,
    requestedPublishedCount: 1,
    reviewedCount: 23,
    communitySourcedCount: 1,
    publicCatalogueCount: 24,
    mirroredImageCount: 1,
    mirrorFailureCount: 0,
    packshotReleaseSha256: hash,
    packshotSelectionSha256: hash,
    packshotCandidateManifestSha256: hash,
    packshotCandidateMetadataSha256: hash,
    packshotAuditManifestSha256: hash,
    packshotReviewStatus: 'human-approved',
    packshotReviewScope,
    packshotReviewedAt: product.imageReviewedAt,
    packshotReviewer: product.imageReviewer,
    packshotProcessingModels: [product.imageProcessingModel],
    packshotProcessingVersions: [product.imageProcessingVersion],
    packshotProcessingProviders: [product.imageProcessingProvider],
  };
  return { product, metadata };
}

test('accepts a complete identity-bound transparent packshot release', () => {
  const { product, metadata } = fixture();
  assert.doesNotThrow(() => assertPublishedPackshotRelease([product], metadata, 1));
});

test('rejects a legacy image even when counts and hashes look plausible', () => {
  const { product, metadata } = fixture();
  const legacy = {
    ...product,
    canonicalImageUrl: 'https://example.public.blob.vercel-storage.com/catalogue/open-beauty-facts/12345670/front-123456789abc.webp',
    imageWidth: 400,
    imageHeight: 400,
    imageHasAlpha: false,
  };
  assert.throws(
    () => assertPublishedPackshotRelease([legacy], metadata, 1),
    /canonical path barcode mismatch|image is not 1000 × 1000|transparent-alpha/,
  );
});

test('rejects a partial or weakly reviewed release', () => {
  const { product, metadata } = fixture();
  assert.throws(
    () => assertPublishedPackshotRelease([product], { ...metadata, packshotReviewer: '' }, 1),
    /reviewer identity is missing/,
  );
  assert.throws(
    () => assertPublishedPackshotRelease([{ ...product, packshotReleaseSha256: 'b'.repeat(64) }], metadata, 1),
    /release hash mismatch/,
  );
});
