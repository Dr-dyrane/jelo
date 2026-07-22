import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

type EditorialAsset = {
  id: string;
  role: string;
  localPath: string;
  blobUrl: string;
  altText: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  transparent: boolean;
};

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED
    ?? process.env.POSTGRES_URL_NON_POOLING
    ?? process.env.DATABASE_URL
    ?? process.env.POSTGRES_URL;
  if (!connectionString) throw new Error('A Neon connection string is required to seed editorial assets.');

  const manifestPath = path.resolve(process.cwd(), 'data/editorial-assets.json');
  const assets = JSON.parse(await readFile(manifestPath, 'utf8')) as EditorialAsset[];
  const sql = postgres(connectionString, { max: 1, prepare: false });

  try {
    for (const asset of assets) {
      await sql`
        insert into editorial_assets (
          id, role, blob_url, local_path, alt_text, mime_type,
          width, height, byte_size, has_alpha, source_kind, status, verified_at
        ) values (
          ${asset.id}, ${asset.role}, ${asset.blobUrl}, ${asset.localPath},
          ${asset.altText}, ${asset.mimeType}, ${asset.width}, ${asset.height},
          ${asset.byteSize}, ${asset.transparent}, 'generated', 'verified', now()
        )
        on conflict (id) do update set
          role = excluded.role,
          blob_url = excluded.blob_url,
          local_path = excluded.local_path,
          alt_text = excluded.alt_text,
          mime_type = excluded.mime_type,
          width = excluded.width,
          height = excluded.height,
          byte_size = excluded.byte_size,
          has_alpha = excluded.has_alpha,
          status = 'verified',
          verified_at = now(),
          updated_at = now()
      `;
    }
    console.log(`Seeded ${assets.length} editorial assets into Neon.`);
  } finally {
    await sql.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
