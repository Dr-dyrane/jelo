import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL_UNPOOLED
  ?? process.env.POSTGRES_URL_NON_POOLING
  ?? process.env.DATABASE_URL
  ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('A Neon connection string is required to audit offer inventory.');
}

const sql = postgres(connectionString, { max: 1, prepare: false });

try {
  const [summary] = await sql<{
    total: number;
    in_stock: number;
    low_stock: number;
    out_of_stock: number;
    unknown: number;
    stale: number;
    missing_price: number;
  }[]>`
    select
      count(*)::int as total,
      count(*) filter (where inventory_status = 'in_stock')::int as in_stock,
      count(*) filter (where inventory_status = 'low_stock')::int as low_stock,
      count(*) filter (where inventory_status = 'out_of_stock')::int as out_of_stock,
      count(*) filter (where inventory_status = 'unknown')::int as unknown,
      count(*) filter (
        where verification_expires_at is null or verification_expires_at < now()
      )::int as stale,
      count(*) filter (where price_minor is null)::int as missing_price
    from offers
  `;

  const staleOffers = await sql<{
    product: string;
    retailer: string;
    market: string;
    inventory_status: string;
    last_verified_at: string | null;
    verification_expires_at: string | null;
  }[]>`
    select
      p.slug as product,
      r.name as retailer,
      o.market_code as market,
      o.inventory_status,
      o.last_verified_at,
      o.verification_expires_at
    from offers o
    join products p on p.id = o.product_id
    join retailers r on r.id = o.retailer_id
    where o.verification_expires_at is null or o.verification_expires_at < now()
    order by o.verification_expires_at nulls first, p.slug, r.name
    limit 100
  `;

  console.log('\nOffer inventory summary');
  console.table([summary]);

  if (staleOffers.length > 0) {
    console.log('\nOffers requiring verification');
    console.table(staleOffers);
    process.exitCode = 1;
  } else {
    console.log('\nAll offer inventory records are within their verification window.');
  }
} finally {
  await sql.end();
}
