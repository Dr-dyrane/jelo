import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { analysePackshotSilhouette, likelyTruncatedPackshot } from '../lib/assets/packshot-silhouette';

type AssetRecord = {
  sourceUrl: string;
  blobUrl: string;
  contentType: string;
  byteSize: number;
  width?: number;
  height?: number;
  hasAlpha?: boolean;
  contentHash?: string;
  importedAt: string;
};

type EditorialAssetRecord = {
  id: string;
  blobUrl: string;
  localPath: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  transparent: boolean;
};

const manifestPath = path.resolve(process.cwd(), 'data/product-assets.json');
const editorialManifestPath = path.resolve(process.cwd(), 'data/editorial-assets.json');
const write = process.argv.includes('--write');

async function transparentCanvasMetrics(bytes: Buffer) {
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .resize(256, 256, { fit: 'fill', kernel: sharp.kernel.nearest })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let transparentPixels = 0;
  let edgePixels = 0;
  let opaqueEdgePixels = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3] ?? 255;
      if (alpha <= 16) transparentPixels += 1;
      if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) {
        edgePixels += 1;
        if (alpha >= 245) opaqueEdgePixels += 1;
      }
    }
  }

  return {
    transparentFraction: transparentPixels / (info.width * info.height),
    opaqueEdgeFraction: opaqueEdgePixels / edgePixels,
  };
}

async function inspect(slug: string, record: AssetRecord) {
  const response = await fetch(record.blobUrl, {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.1' },
  });
  if (!response.ok) throw new Error(`${slug}: Blob returned ${response.status}`);

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error(`${slug}: Blob is empty`);
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`${slug}: dimensions are unavailable`);
  const displayReady = record.hasAlpha === true && Math.min(record.width ?? 0, record.height ?? 0) >= 1_000;
  if (displayReady) {
    if (!metadata.hasAlpha) throw new Error(`${slug}: public packshot lost its alpha channel`);
    const canvas = await transparentCanvasMetrics(bytes);
    if (canvas.transparentFraction < 0.12) {
      throw new Error(`${slug}: public packshot has too little transparent canvas (${canvas.transparentFraction.toFixed(3)})`);
    }
    if (canvas.opaqueEdgeFraction > 0.01) {
      throw new Error(`${slug}: public packshot touches an opaque canvas edge (${canvas.opaqueEdgeFraction.toFixed(3)})`);
    }
    const silhouette = await analysePackshotSilhouette(bytes);
    if (likelyTruncatedPackshot(silhouette)) {
      throw new Error(`${slug}: public packshot has a full-width lower silhouette edge (${silhouette.bottomTerminalRunFraction.toFixed(3)}), indicating an inherited crop or incomplete package base.`);
    }
  }

  return {
    ...record,
    contentType,
    byteSize: bytes.length,
    width: metadata.width,
    height: metadata.height,
    hasAlpha: metadata.hasAlpha,
    contentHash: createHash('sha256').update(bytes).digest('hex'),
  } satisfies AssetRecord;
}

async function inspectEditorial(record: EditorialAssetRecord) {
  const response = await fetch(record.blobUrl, {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.1' },
  });
  if (!response.ok) throw new Error(`${record.id}: Blob returned ${response.status}`);

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  const bytes = Buffer.from(await response.arrayBuffer());
  const [metadata, statistics] = await Promise.all([sharp(bytes).metadata(), sharp(bytes).stats()]);

  if (contentType !== record.mimeType) throw new Error(`${record.id}: expected ${record.mimeType}, received ${contentType}`);
  if (bytes.length !== record.byteSize) throw new Error(`${record.id}: byte size changed from ${record.byteSize} to ${bytes.length}`);
  if (metadata.width !== record.width || metadata.height !== record.height) {
    throw new Error(`${record.id}: expected ${record.width}x${record.height}, received ${metadata.width}x${metadata.height}`);
  }
  if (record.transparent && (!metadata.hasAlpha || statistics.isOpaque)) {
    throw new Error(`${record.id}: transparent editorial asset no longer contains visible alpha pixels`);
  }
}

async function main() {
  const [manifestSource, editorialManifestSource] = await Promise.all([
    readFile(manifestPath, 'utf8'),
    readFile(editorialManifestPath, 'utf8'),
  ]);
  const manifest = JSON.parse(manifestSource) as Record<string, AssetRecord>;
  const editorialManifest = JSON.parse(editorialManifestSource) as EditorialAssetRecord[];
  const [checked] = await Promise.all([
    Promise.all(Object.entries(manifest).map(async ([slug, record]) => [slug, await inspect(slug, record)] as const)),
    Promise.all(editorialManifest.map(inspectEditorial)),
  ]);
  const verified = Object.fromEntries(checked) as Record<string, AssetRecord>;
  const changed = Object.keys(verified).filter(slug => JSON.stringify(verified[slug]) !== JSON.stringify(manifest[slug]));

  if (write && changed.length) {
    await writeFile(manifestPath, `${JSON.stringify(verified, null, 2)}\n`, 'utf8');
  }

  console.log(`Verified ${checked.length} canonical product assets.`);
  console.log(`Verified ${editorialManifest.length} canonical editorial assets.`);
  console.log(changed.length ? `${write ? 'Updated' : 'Outdated'} metadata: ${changed.length}.` : 'Metadata is current.');
  if (changed.length && !write) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
