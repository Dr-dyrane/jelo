import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import { requireAdminDatabaseUrl } from './lib/admin-database';

type AssetRecord = {
  sourceUrl: string;
  blobUrl: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
  hasAlpha: boolean;
  contentHash: string;
};

function sourceHost(value: string) {
  return new URL(value).hostname.replace(/^www\./, '');
}

async function main() {
  const connectionString = requireAdminDatabaseUrl();

  const manifestPath = path.resolve(process.cwd(), 'data/product-assets.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, AssetRecord>;
  const sql = postgres(connectionString, { max: 1, prepare: false });
  let updated = 0;
  let skipped = 0;

  try {
    await sql.begin(async transaction => {
      for (const [slug, asset] of Object.entries(manifest)) {
        const rows = await transaction<{ id: string }[]>`
          update product_images pi
          set blob_url = ${asset.blobUrl},
              source_url = ${asset.sourceUrl},
              source_host = ${sourceHost(asset.sourceUrl)},
              mime_type = ${asset.contentType},
              width = ${asset.width},
              height = ${asset.height},
              byte_size = ${asset.byteSize},
              has_alpha = ${asset.hasAlpha},
              content_hash = ${asset.contentHash},
              status = 'verified',
              verified_at = case
                when pi.blob_url is distinct from ${asset.blobUrl}
                  or pi.content_hash is distinct from ${asset.contentHash}
                  then now()
                else coalesce(pi.verified_at, now())
              end,
              updated_at = now()
          from products p
          where pi.product_id = p.id
            and pi.kind = 'packshot'
            and p.slug = ${slug}
          returning pi.id
        `;
        if (rows.length > 1) throw new Error(`Expected at most one packshot record for ${slug}; found ${rows.length}.`);
        if (rows.length === 0) {
          // A product may be absent during a targeted repair or an interrupted prior
          // release. Runtime still renders the checked-in catalogue and the reviewed
          // packshot is already immutable on Blob, so keep this seed non-destructive.
          console.warn(`No Neon packshot row for ${slug}; skipping metadata seed.`);
          skipped += 1;
          continue;
        }
        updated += 1;
      }
    });
    console.log(`Seeded metadata for ${updated} canonical product assets${skipped ? `; skipped ${skipped} not yet mirrored into Neon` : ''}.`);
  } finally {
    await sql.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
