import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL_UNPOOLED
  ?? process.env.POSTGRES_URL_NON_POOLING
  ?? process.env.DATABASE_URL
  ?? process.env.POSTGRES_URL;

if (!connectionString) throw new Error('A Neon connection string is required to audit offer prices.');

const sql = postgres(connectionString, { max: 1, prepare: false });

try {
  const [summary] = await sql<{
    total: number;
    missing_price: number;
    missing_currency: number;
    suspicious_ngn: number;
    observed_last_30_days: number;
  }[]>`
    select
      count(*)::int as total,
      count(*) filter (where price_minor is null)::int as missing_price,
      count(*) filter (where price_minor is not null and currency_code is null)::int as missing_currency,
      count(*) filter (
        where currency_code = 'NGN' and (price_minor < 100 or price_minor > 5000000)
      )::int as suspicious_ngn,
      (
        select count(distinct offer_id)::int
        from offer_price_history
        where observed_at >= now() - interval '30 days'
      ) as observed_last_30_days
    from offers
  `;

  const recentChanges = await sql<{
    product_slug: string;
    retailer: string;
    market_code: string;
    currency_code: string;
    previous_price: number;
    current_price: number;
    observed_at: Date;
  }[]>`
    with ranked as (
      select
        h.offer_id,
        h.price_minor,
        h.currency_code,
        h.observed_at,
        lag(h.price_minor) over (partition by h.offer_id order by h.observed_at) as previous_price
      from offer_price_history h
    )
    select
      p.slug as product_slug,
      r.name as retailer,
      o.market_code,
      ranked.currency_code,
      ranked.previous_price,
      ranked.price_minor as current_price,
      ranked.observed_at
    from ranked
    join offers o on o.id = ranked.offer_id
    join products p on p.id = o.product_id
    join retailers r on r.id = o.retailer_id
    where ranked.previous_price is not null
      and ranked.previous_price <> ranked.price_minor
    order by ranked.observed_at desc
    limit 50
  `;

  console.log(JSON.stringify({ summary, recentChanges }, null, 2));
  if (summary.missing_currency > 0 || summary.suspicious_ngn > 0) process.exitCode = 1;
} finally {
  await sql.end();
}
