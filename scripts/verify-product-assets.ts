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

const manifestPath = path.resolve(process.cwd(), 'data/product-assets.json');
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

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, AssetRecord>;
  const checked = await Promise.all(Object.entries(manifest).map(async ([slug, record]) => [slug, await inspect(slug, record)] as const));
  const verified = Object.fromEntries(checked) as Record<string, AssetRecord>;
  const changed = Object.keys(verified).filter(slug => JSON.stringify(verified[slug]) !== JSON.stringify(manifest[slug]));

  if (write && changed.length) {
    await writeFile(manifestPath, `${JSON.stringify(verified, null, 2)}\n`, 'utf8');
  }

  console.log(`Verified ${checked.length} canonical product assets.`);
  console.log(changed.length ? `${write ? 'Updated' : 'Outdated'} metadata: ${changed.length}.` : 'Metadata is current.');
  if (changed.length && !write) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
