import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL_UNPOOLED
  ?? process.env.POSTGRES_URL_NON_POOLING
  ?? process.env.DATABASE_URL
  ?? process.env.POSTGRES_URL;

if (!connectionString) throw new Error('A Neon connection string is required.');

const sql = postgres(connectionString, { max: 1, prepare: false });

try {
  const expiredAttribution = await sql<{ draft_id: string }[]>`
    delete from community_intake_attributions
    where retain_until < now()
    returning draft_id
  `;
  const expired = await sql<{ id: string }[]>`
    delete from community_intake_drafts
    where status = 'draft' and expires_at < now()
    returning id
  `;
  console.log(`Purged ${expiredAttribution.length} expired community intake attribution records.`);
  console.log(`Purged ${expired.length} expired community intake drafts.`);
} finally {
  await sql.end();
}
