import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

async function main() {
const connectionString = process.env.DATABASE_URL_UNPOOLED
  ?? process.env.POSTGRES_URL_NON_POOLING
  ?? process.env.DATABASE_URL
  ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('A Neon connection string is required to audit catalogue assets.');
}

const sql = postgres(connectionString, { max: 1, prepare: false });
const outputPath = path.resolve(process.cwd(), process.argv[2] ?? 'data/asset-inventory.json');

type AssetRow = {
  product_slug: string;
  brand_slug: string;
  product_name: string;
  kind: string;
  status: 'pending' | 'verified' | 'failed' | 'retired';
  blob_url: string | null;
  source_url: string | null;
  source_host: string | null;
  mime_type: string | null;
  byte_size: number | null;
  verified_at: string | null;
};

try {
  const rows = await sql<AssetRow[]>`
    select
      p.slug as product_slug,
      b.slug as brand_slug,
      p.name as product_name,
      pi.kind,
      pi.status,
      pi.blob_url,
      pi.source_url,
      pi.source_host,
      pi.mime_type,
      pi.byte_size,
      pi.verified_at
    from products p
    join brands b on b.id = p.brand_id
    left join product_images pi on pi.product_id = p.id and pi.kind = 'packshot'
    order by
      case coalesce(pi.status, 'failed'::asset_status)
        when 'failed' then 0
        when 'pending' then 1
        when 'verified' then 2
        else 3
      end,
      b.name,
      p.name
  `;

  const normalized = rows.map(row => ({
    productSlug: row.product_slug,
    brandSlug: row.brand_slug,
    productName: row.product_name,
    role: row.kind ?? 'packshot',
    status: row.status ?? 'failed',
    blobUrl: row.blob_url,
    sourceUrl: row.source_url,
    sourceHost: row.source_host,
    mimeType: row.mime_type,
    byteSize: row.byte_size == null ? null : Number(row.byte_size),
    verifiedAt: row.verified_at,
    needsImport: !row.blob_url && Boolean(row.source_url?.startsWith('https://')),
  }));

  const summary = normalized.reduce<Record<string, number>>((counts, asset) => {
    counts.total += 1;
    counts[asset.status] = (counts[asset.status] ?? 0) + 1;
    if (asset.needsImport) counts.importable += 1;
    if (!asset.blobUrl && !asset.sourceUrl) counts.missing += 1;
    return counts;
  }, { total: 0, verified: 0, pending: 0, failed: 0, retired: 0, importable: 0, missing: 0 });

  const payload = {
    generatedAt: new Date().toISOString(),
    summary,
    assets: normalized,
  };

  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log('Catalogue asset inventory');
  console.table(summary);
  console.log(`Wrote ${normalized.length} records to ${outputPath}`);
} finally {
  await sql.end();
}
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
