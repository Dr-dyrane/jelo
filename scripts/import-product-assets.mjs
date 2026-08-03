import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { put } from '@vercel/blob';
import postgres from 'postgres';

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']);
const manifestArgument = process.argv[2];
const outputPath = resolve(process.cwd(), process.argv[3] ?? 'data/asset-import-results.json');
const connectionString = process.env.MIGRATION_DATABASE_URL;

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  throw new Error('BLOB_READ_WRITE_TOKEN is required. Run with Vercel environment variables loaded.');
}

if (!/^postgres(?:ql)?:\/\//.test(connectionString ?? '')) {
  throw new Error('MIGRATION_DATABASE_URL is required so imported assets can update catalogue inventory.');
}
const parsedDatabaseUrl = new URL(connectionString);
if (
  ['jelocare_app_runtime', 'jelocare_shelf_runtime'].includes(decodeURIComponent(parsedDatabaseUrl.username))
  || parsedDatabaseUrl.hostname.toLowerCase().includes('-pooler.')
) {
  throw new Error('MIGRATION_DATABASE_URL must use a protected direct administrative role.');
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

async function loadDatabaseManifest() {
  const rows = await sql`
    select
      p.slug as product_slug,
      b.slug as brand_slug,
      pi.kind as role,
      pi.source_url,
      pi.alt_text
    from product_images pi
    join products p on p.id = pi.product_id
    join brands b on b.id = p.brand_id
    where pi.source_url is not null
      and pi.source_url like 'https://%'
      and (pi.blob_url is null or pi.status <> 'verified')
    order by p.slug, pi.kind
  `;

  return rows.map(row => ({
    productSlug: row.product_slug,
    brandSlug: row.brand_slug,
    role: row.role,
    sourceUrl: row.source_url,
    altText: row.alt_text,
    overwrite: true,
  }));
}

async function loadManifest() {
  if (!manifestArgument) return loadDatabaseManifest();

  const manifestPath = resolve(process.cwd(), manifestArgument);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!Array.isArray(manifest)) throw new Error('Asset import manifest must be a JSON array.');
  return manifest;
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

async function markFailed(item, message) {
  await sql`
    update product_images pi
    set status = 'failed', updated_at = now()
    from products p
    where pi.product_id = p.id
      and p.slug = ${item.productSlug}
      and pi.kind = ${item.role ?? 'packshot'}
  `;

  return { status: 'failed', slug: item.productSlug, sourceUrl: item.sourceUrl, error: message };
}

async function importAsset(item) {
  const source = new URL(item.sourceUrl);
  if (source.protocol !== 'https:') throw new Error('Only HTTPS sources are allowed.');

  const response = await fetch(source, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
    headers: {
      Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.8,*/*;q=0.1',
      'User-Agent': 'JeloCareAssetImporter/1.1',
    },
  });

  if (!response.ok) throw new Error(`Source request failed with ${response.status}.`);

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  if (!ALLOWED_TYPES.has(contentType)) throw new Error(`Unsupported content type: ${contentType || 'unknown'}.`);

  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_SOURCE_BYTES) {
    throw new Error(`Image is larger than ${MAX_SOURCE_BYTES} bytes.`);
  }

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
    allowOverwrite: item.overwrite !== false,
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

const results = [];
try {
  const manifest = await loadManifest();

  if (manifest.length === 0) {
    console.log('No pending catalogue images require Blob import.');
  }

  for (const item of manifest) {
    try {
      const result = await importAsset(item);
      console.log(`✓ ${item.productSlug} → ${result.url} (Neon verified)`);
      results.push({ status: 'ok', ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`✗ ${item.productSlug}: ${message}`);
      results.push(await markFailed(item, message));
    }
  }
} finally {
  await sql.end();
}

await writeFile(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
console.log(`Wrote ${results.length} results to ${outputPath}`);

if (results.some(result => result.status === 'failed')) process.exitCode = 1;
