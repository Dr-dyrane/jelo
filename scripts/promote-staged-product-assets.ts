import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { get, put } from '@vercel/blob';
import sharp from 'sharp';
import promotions from '../data/product-asset-promotions.json';
import repairs from '../data/product-asset-repairs.json';
import {
  analysePackshotSilhouette,
  likelySlicedPackshotBase,
  likelyTruncatedPackshot,
} from '../lib/assets/packshot-silhouette';
import {
  assertStagedProductAssetPromotion,
  promoteVerifiedStagedProductAsset,
  resolveStagedProductAssetPath,
  type CatalogueIntakeAssetPromotion,
  type StagedProductAssetBlobClient,
  type StagedProductAssetPromotion,
  verifyCatalogueIntakePromotionBinding,
} from '../lib/assets/staged-product-asset-promotion';
import {
  verifyCataloguePublicationImageBytes,
  verifyRemoteCataloguePublicationImage,
} from '../lib/catalogue/publication-image-verification';

const repairIds = new Set(repairs.repairs.map(repair => repair.id));
const blobClient: StagedProductAssetBlobClient = { get, put };

function publicationExpectation(
  candidateId: string,
  promotion: StagedProductAssetPromotion,
) {
  if (
    promotion.contentType !== 'image/png'
    && promotion.contentType !== 'image/webp'
  ) {
    throw new Error(
      `${promotion.id}: publication packshots must use PNG or WebP`,
    );
  }
  return {
    candidateId,
    url: promotion.blobUrl,
    sha256: promotion.contentHash,
    mimeType: promotion.contentType,
    byteSize: promotion.byteSize,
    width: promotion.width,
    height: promotion.height,
  };
}

async function verifiedBytes(promotion: StagedProductAssetPromotion) {
  const target = assertStagedProductAssetPromotion(promotion);
  if (target.kind !== 'public-product') {
    await verifyCatalogueIntakePromotionBinding(
      promotion as CatalogueIntakeAssetPromotion,
    );
  }
  const bytes = await readFile(resolveStagedProductAssetPath(promotion));
  const [metadata, statistics, silhouette] = await Promise.all([
    sharp(bytes).metadata(),
    sharp(bytes).stats(),
    analysePackshotSilhouette(bytes),
  ]);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== promotion.byteSize || digest !== promotion.contentHash) {
    throw new Error(`${promotion.id}: staged bytes changed`);
  }
  if (
    metadata.format !== promotion.contentType.split('/')[1]
    || metadata.width !== promotion.width
    || metadata.height !== promotion.height
    || metadata.hasAlpha !== promotion.hasAlpha
  ) throw new Error(`${promotion.id}: decoded image metadata changed`);
  if (promotion.hasAlpha && statistics.isOpaque) {
    throw new Error(`${promotion.id}: declared transparent asset is fully opaque`);
  }
  if (promotion.hasAlpha && likelyTruncatedPackshot(silhouette)) {
    throw new Error(
      `${promotion.id}: staged packshot has a full-width lower silhouette edge `
      + `(${silhouette.bottomTerminalRunFraction.toFixed(3)}); repair the inherited crop before upload`,
    );
  }
  if (promotion.hasAlpha && repairIds.has(promotion.id) && likelySlicedPackshotBase(silhouette)) {
    throw new Error(
      `${promotion.id}: generated repair retains a long lower seam `
      + `(${silhouette.bottomNearTerminalStrongEdgeRunFraction.toFixed(3)}); rebuild and visually review the base before upload`,
    );
  }
  if (target.kind === 'catalogue-publication') {
    await verifyCataloguePublicationImageBytes(
      publicationExpectation(target.id, promotion),
      bytes,
    );
  }
  return bytes;
}

function usableCredential(value: string | undefined) {
  return Boolean(value && value !== '[SENSITIVE]');
}

async function main() {
  const requestedIds = process.argv
    .slice(2)
    .filter(argument => argument.startsWith('--id='))
    .map(argument => argument.slice('--id='.length))
    .filter(Boolean);
  if (new Set(requestedIds).size !== requestedIds.length) {
    throw new Error('Each requested promotion ID must be unique.');
  }
  const activePromotions = (promotions as StagedProductAssetPromotion[])
    .filter(promotion => promotion.active);
  const activeById = new Map(activePromotions.map(promotion => [promotion.id, promotion]));
  const unknownIds = requestedIds.filter(id => !activeById.has(id));
  if (unknownIds.length) {
    throw new Error(`Unknown or inactive promotion IDs: ${unknownIds.join(', ')}`);
  }
  const active = requestedIds.length
    ? requestedIds.map(id => activeById.get(id)!)
    : activePromotions;
  if (!active.length) {
    console.log('No staged product assets require promotion.');
    return;
  }
  if (
    !usableCredential(process.env.BLOB_READ_WRITE_TOKEN)
    && !(
      usableCredential(process.env.VERCEL_OIDC_TOKEN)
      && usableCredential(process.env.BLOB_STORE_ID)
    )
  ) {
    throw new Error(
      'Blob credentials are required: use BLOB_READ_WRITE_TOKEN or VERCEL_OIDC_TOKEN with BLOB_STORE_ID.',
    );
  }

  for (const promotion of active) {
    const target = assertStagedProductAssetPromotion(promotion);
    const bytes = await verifiedBytes(promotion);
    const result = await promoteVerifiedStagedProductAsset(promotion, bytes, blobClient);
    if (target.kind === 'catalogue-publication') {
      await verifyRemoteCataloguePublicationImage(
        publicationExpectation(target.id, promotion),
      );
    }
    console.log(
      result === 'uploaded'
        ? `Promoted ${promotion.id} to its hash-reviewed Blob path.`
        : `Verified existing ${promotion.id} at its hash-reviewed Blob path.`,
    );
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
