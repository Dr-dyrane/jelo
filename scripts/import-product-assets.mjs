import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { put } from '@vercel/blob';
import postgres from 'postgres';

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']);
const manifestPath = resolve(process.cwd(), process.argv[2] ?? 'data/asset-imports.json');
const outputPath = resolve(process.cwd(), process.argv[3] ?? 'data/asset-import-results.json');
const connectionString = process.env.DATABASE_URL_UNPOOLED
  ?? process.env.POSTGRES_URL_NON_POOLING
  ?? process.env.DATABASE_URL
  ?? process.env.POSTGRES_URL;

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  throw new Error('BLOB_READ_WRITE_TOKEN is required. Run with Vercel environment variables loaded.');
}

if (!connectionString) {
  throw new Error('A Neon connection string is required so imported assets can update catalogue inventory.');
}

const sql = postgres(connectionString, { max: 1, prepare: false });

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

async function persistAsset(item, imported) {
  const [product] = await sql`
    select id
    from products
    where slug = ${item.productSlug}
    limit 1
  `;

  if (!product) {
    throw new Error(`Product ${item.productSlug} does not exist in Neon. Run npm run db:seed first.`);
  }

  await sql`
    insert into product_images (
      product_id,
      kind,
      blob_url,
      source_url,
      source_host,
      alt_text,
      mime_type,
      byte_size,
      status,
      verified_at
    ) values (
      ${product.id},
      ${item.role ?? 'packshot'},
      ${imported.url},
      ${item.sourceUrl},
      ${new URL(item.sourceUrl).hostname.replace(/^www\./, '')},
      ${item.altText ?? `${item.brandSlug} ${item.productSlug}`.replace(/-/g, ' ')},
      ${imported.contentType},
      ${imported.size},
      'verified',
      now()
    )
    on conflict (product_id, kind) do update set
      blob_url = excluded.blob_url,
      source_url = excluded.source_url,
      source_host = excluded.source_host,
      alt_text = excluded.alt_text,
      mime_type = excluded.mime_type,
      byte_size = excluded.byte_size,
      status = 'verified',
      verified_at = now(),
      updated_at = now()
  `;
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

  const imported = {
    slug: item.productSlug,
    sourceUrl: item.sourceUrl,
    pathname: blob.pathname,
    url: blob.url,
    contentType,
    size: bytes.byteLength,
    importedAt: new Date().toISOString(),
  };

  await persistAsset(item, imported);
  return imported;
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (!Array.isArray(manifest)) throw new Error('Asset import manifest must be a JSON array.');

const results = [];
try {
  for (const item of manifest) {
    try {
      const result = await importAsset(item);
      console.log(`✓ ${item.productSlug} → ${result.url} (Neon verified)`);
      results.push({ status: 'ok', ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`✗ ${item.productSlug}: ${message}`);
      results.push({ status: 'failed', slug: item.productSlug, sourceUrl: item.sourceUrl, error: message });
    }
  }
} finally {
  await sql.end();
}

await writeFile(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
console.log(`Wrote ${results.length} results to ${outputPath}`);

if (results.some(result => result.status === 'failed')) process.exitCode = 1;
