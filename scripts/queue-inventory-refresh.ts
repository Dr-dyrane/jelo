import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL_UNPOOLED
  ?? process.env.POSTGRES_URL_NON_POOLING
  ?? process.env.DATABASE_URL
  ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('A Neon connection string is required to queue inventory refresh jobs.');
}

const requestedLimit = Number.parseInt(process.argv[2] ?? '100', 10);
const limit = Number.isFinite(requestedLimit)
  ? Math.min(Math.max(requestedLimit, 1), 500)
  : 100;

const sql = postgres(connectionString, { max: 1, prepare: false });

try {
  const queued = await sql<{
    job_id: string;
    product_slug: string;
    retailer: string;
    market_code: string;
    verification_expires_at: Date | null;
  }[]>`
    with candidates as (
      select o.id
      from offers o
      where
        o.last_verified_at is null
        or o.verification_expires_at is null
        or o.verification_expires_at <= now()
      order by o.verification_expires_at asc nulls first, o.updated_at asc
      limit ${limit}
    ), inserted as (
      insert into inventory_refresh_jobs (offer_id)
      select candidates.id
      from candidates
      on conflict do nothing
      returning id, offer_id
    )
    select
      inserted.id as job_id,
      p.slug as product_slug,
      r.name as retailer,
      o.market_code,
      o.verification_expires_at
    from inserted
    join offers o on o.id = inserted.offer_id
    join products p on p.id = o.product_id
    join retailers r on r.id = o.retailer_id
    order by p.slug, r.name, o.market_code
  `;

  for (const job of queued) {
    console.log(`queued ${job.product_slug} · ${job.retailer} · ${job.market_code}`);
  }

  console.log(`Queued ${queued.length} inventory refresh job${queued.length === 1 ? '' : 's'}.`);
} finally {
  await sql.end();
}
