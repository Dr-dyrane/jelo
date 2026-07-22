import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { put } from '@vercel/blob';
import sharp from 'sharp';
import promotions from '../data/product-asset-promotions.json';

const assetHost = 'm6aftkbqbwtkxooa.public.blob.vercel-storage.com';

type Promotion = {
  id: string;
  active: boolean;
  productSlug: string;
  sourceUrl: string;
  localPath: string;
  blobPath: string;
  blobUrl: string;
  contentType: 'image/png' | 'image/webp' | 'image/avif' | 'image/jpeg';
  byteSize: number;
  width: number;
  height: number;
  hasAlpha: boolean;
  contentHash: string;
};

function localAssetPath(localPath: string) {
  const publicRoot = path.resolve(process.cwd(), 'public');
  const resolved = path.resolve(publicRoot, localPath.replace(/^\/+/, ''));
  if (!resolved.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error(`Staged asset escapes public/: ${localPath}`);
  }
  return resolved;
}

async function verifiedBytes(promotion: Promotion) {
  const source = new URL(promotion.sourceUrl);
  const destination = new URL(promotion.blobUrl);
  if (source.protocol !== 'https:') throw new Error(`${promotion.id}: source must use HTTPS`);
  if (destination.protocol !== 'https:' || destination.hostname !== assetHost) {
    throw new Error(`${promotion.id}: destination is outside the JeloCare Blob store`);
  }
  if (destination.pathname !== `/${promotion.blobPath}`) {
    throw new Error(`${promotion.id}: Blob URL and pathname disagree`);
  }

  const bytes = await readFile(localAssetPath(promotion.localPath));
  const [metadata, statistics] = await Promise.all([sharp(bytes).metadata(), sharp(bytes).stats()]);
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
  return bytes;
}

async function main() {
  const active = (promotions as Promotion[]).filter(promotion => promotion.active);
  if (!active.length) {
    console.log('No staged product assets require promotion.');
    return;
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required to promote staged product assets.');
  }

  for (const promotion of active) {
    const bytes = await verifiedBytes(promotion);
    const uploaded = await put(promotion.blobPath, bytes, {
      access: 'public',
      contentType: promotion.contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 31_536_000,
    });
    if (uploaded.url !== promotion.blobUrl || uploaded.pathname !== promotion.blobPath) {
      throw new Error(`${promotion.id}: Blob returned an unexpected immutable location`);
    }
    console.log(`Promoted ${promotion.id} to its hash-reviewed Blob path.`);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
