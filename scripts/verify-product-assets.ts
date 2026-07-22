import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

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
