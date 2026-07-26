import postgres from 'postgres';
import { parseInventoryQueueOptions } from '../lib/inventory/queue-options';

async function main() {
const connectionString = process.env.DATABASE_URL_UNPOOLED
  ?? process.env.POSTGRES_URL_NON_POOLING
  ?? process.env.DATABASE_URL
  ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('A Neon connection string is required to queue inventory refresh jobs.');
}

const options = parseInventoryQueueOptions(process.argv.slice(2));

const sql = postgres(connectionString, { max: 1, prepare: false });

try {
  await sql`
    update inventory_refresh_jobs job
    set status = 'failed',
        last_error = 'Product is not currently published; refresh was withdrawn.',
        completed_at = now(),
        updated_at = now()
    from offers offer
    join products product on product.id = offer.product_id
    where job.offer_id = offer.id
      and job.status = 'queued'
      and product.is_published = false
  `;

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
      join products p on p.id = o.product_id
      join retailers r on r.id = o.retailer_id
      where
        p.is_published = true
        and o.match_kind = 'exact'
        and o.url ~* '^https://'
        and (${options.market ?? null}::text is null or o.market_code = ${options.market ?? null})
        and (${options.product ?? null}::text is null or p.slug = ${options.product ?? null})
        and (${options.retailer ?? null}::text is null or r.name = ${options.retailer ?? null})
        and (
          ${options.force}
          or o.last_verified_at is null
          or o.verification_expires_at is null
          or o.verification_expires_at <= now() + (${options.lookaheadHours} * interval '1 hour')
        )
      order by o.verification_expires_at asc nulls first, o.updated_at asc
      limit ${options.limit}
    ), inserted as (
      insert into inventory_refresh_jobs (offer_id, priority)
      select candidates.id, ${options.force ? 200 : 100}
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

  console.log(`Queued ${queued.length} ${options.force ? 'forced ' : ''}inventory refresh job${queued.length === 1 ? '' : 's'}.`);
} finally {
  await sql.end();
}
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
