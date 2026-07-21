import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { put } from '@vercel/blob';

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']);
const manifestPath = resolve(process.cwd(), process.argv[2] ?? 'data/asset-imports.json');
const outputPath = resolve(process.cwd(), process.argv[3] ?? 'data/asset-import-results.json');

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  throw new Error('BLOB_READ_WRITE_TOKEN is required. Run with Vercel environment variables loaded.');
}

function segment(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function extension(contentType) {
  return ({
    'image/avif': 'avif',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  })[contentType];
}

async function importAsset(item) {
  const source = new URL(item.sourceUrl);
  if (source.protocol !== 'https:') throw new Error('Only HTTPS sources are allowed.');

  const response = await fetch(source, {
    redirect: 'follow',
    headers: {
      Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.8,*/*;q=0.1',
      'User-Agent': 'JeloCareAssetImporter/1.0',
    },
  });

  if (!response.ok) throw new Error(`Source request failed with ${response.status}.`);

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  if (!ALLOWED_TYPES.has(contentType)) throw new Error(`Unsupported content type: ${contentType || 'unknown'}.`);

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_SOURCE_BYTES) {
    throw new Error(`Image is empty or larger than ${MAX_SOURCE_BYTES} bytes.`);
  }

  const pathname = [
    'products',
    segment(item.brandSlug),
    segment(item.productSlug),
    `${segment(item.role ?? 'packshot')}.${extension(contentType)}`,
  ].join('/');

  const blob = await put(pathname, bytes, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    allowOverwrite: Boolean(item.overwrite),
    cacheControlMaxAge: 31_536_000,
  });

  return {
    slug: item.productSlug,
    sourceUrl: item.sourceUrl,
    pathname: blob.pathname,
    url: blob.url,
    contentType,
    size: bytes.byteLength,
    importedAt: new Date().toISOString(),
  };
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (!Array.isArray(manifest)) throw new Error('Asset import manifest must be a JSON array.');

const results = [];
for (const item of manifest) {
  try {
    const result = await importAsset(item);
    console.log(`✓ ${item.productSlug} → ${result.url}`);
    results.push({ status: 'ok', ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ ${item.productSlug}: ${message}`);
    results.push({ status: 'failed', slug: item.productSlug, sourceUrl: item.sourceUrl, error: message });
  }
}

await writeFile(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
console.log(`Wrote ${results.length} results to ${outputPath}`);

if (results.some(result => result.status === 'failed')) process.exitCode = 1;
