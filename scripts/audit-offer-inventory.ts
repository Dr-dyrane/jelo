import postgres from 'postgres';
import { products as publicProducts } from '../data/catalogue';
import {
  defaultStoreChoiceTarget,
  productCoverage,
  type CoverageOffer,
} from '../lib/inventory/coverage-audit';

type CoverageRow = {
  product_slug: string;
  product_size: string;
  retailer: string | null;
  url: string | null;
  match_kind: 'exact' | 'search' | null;
  price_minor: number | null;
  currency_code: string | null;
  inventory_status: CoverageOffer['inventoryStatus'] | null;
  available: boolean | null;
  checked_at: Date | null;
  last_verified_at: Date | null;
  verification_expires_at: Date | null;
  verification_method: string | null;
  extraction_adapter: string | null;
  observed_title: string | null;
  observed_size: string | null;
  active_job_status: CoverageOffer['activeJobStatus'];
  latest_job_status: string | null;
  latest_job_error: string | null;
};

function mapCoverageOffer(row: CoverageRow): CoverageOffer | null {
  if (!row.retailer || !row.url || !row.match_kind || !row.inventory_status || row.available == null) return null;
  return {
    retailer: row.retailer,
    url: row.url,
    matchKind: row.match_kind,
    priceMinor: row.price_minor,
    currencyCode: row.currency_code,
    inventoryStatus: row.inventory_status,
    available: row.available,
    checkedAt: row.checked_at,
    lastVerifiedAt: row.last_verified_at,
    verificationExpiresAt: row.verification_expires_at,
    verificationMethod: row.verification_method,
    extractionAdapter: row.extraction_adapter,
    observedTitle: row.observed_title,
    observedSize: row.observed_size,
    activeJobStatus: row.active_job_status,
    latestJobStatus: row.latest_job_status,
    latestJobError: row.latest_job_error,
  };
}

async function reportPublicCoverage(sql: postgres.Sql) {
  const publicSlugs = new Set(publicProducts.map(product => product.slug));
  const rows = await sql<CoverageRow[]>`
    select
      p.slug as product_slug,
      p.size as product_size,
      r.name as retailer,
      o.url,
      o.match_kind,
      o.price_minor,
      o.currency_code,
      o.inventory_status,
      o.available,
      o.checked_at,
      o.last_verified_at,
      o.verification_expires_at,
      o.verification_method,
      o.extraction_adapter,
      o.observed_title,
      o.observed_size,
      active_job.status as active_job_status,
      latest_job.status as latest_job_status,
      latest_job.last_error as latest_job_error
    from products p
    left join offers o on o.product_id = p.id and o.market_code = 'NG'
    left join retailers r on r.id = o.retailer_id
    left join lateral (
      select j.status
      from inventory_refresh_jobs j
      where j.offer_id = o.id and j.status in ('queued', 'processing')
      order by j.requested_at desc
      limit 1
    ) active_job on true
    left join lateral (
      select j.status, j.last_error
      from inventory_refresh_jobs j
      where j.offer_id = o.id
      order by j.requested_at desc, j.updated_at desc
      limit 1
    ) latest_job on true
    where p.is_published = true
    order by p.slug, r.name nulls last
  `;

  const productionSlugs = new Set(rows.map(row => row.product_slug));
  const matrix = publicProducts
    .map(product => productCoverage({
      slug: product.slug,
      size: product.size,
      databasePublished: productionSlugs.has(product.slug),
      offers: rows
        .filter(row => row.product_slug === product.slug)
        .map(mapCoverageOffer)
        .filter((offer): offer is CoverageOffer => offer != null),
      now: new Date(),
    }))
    .sort((left, right) => left.slug.localeCompare(right.slug));
  const coveredProductionSlugs = [...productionSlugs].filter(slug => publicSlugs.has(slug));
  const retailerRows = new Map<string, {
    links: number;
    exact: number;
    search: number;
    fresh: number;
    staleOrUnverified: number;
    conflicts: number;
    activeJobs: number;
    blockers: Set<string>;
  }>();
  for (const row of rows.filter(row => publicSlugs.has(row.product_slug))) {
    const offer = mapCoverageOffer(row);
    if (!offer) continue;
    const product = publicProducts.find(item => item.slug === row.product_slug)!;
    const state = productCoverage({ slug: product.slug, size: product.size, databasePublished: true, offers: [offer], now: new Date() });
    const current = retailerRows.get(offer.retailer) ?? {
      links: 0, exact: 0, search: 0, fresh: 0, staleOrUnverified: 0, conflicts: 0, activeJobs: 0, blockers: new Set<string>(),
    };
    current.links += 1;
    current.exact += offer.matchKind === 'exact' ? 1 : 0;
    current.search += offer.matchKind === 'search' ? 1 : 0;
    current.fresh += state.priceStockFreshness.freshStock > 0 ? 1 : 0;
    current.staleOrUnverified += state.priceStockFreshness.stale + state.priceStockFreshness.unverified;
    current.conflicts += state.identitySizeConflict.length;
    current.activeJobs += state.activeRefreshJobs;
    for (const blocker of state.blockers) current.blockers.add(blocker);
    retailerRows.set(offer.retailer, current);
  }
  const byRetailer = [...retailerRows.entries()]
    .map(([retailer, value]) => ({ ...value, retailer, blockers: [...value.blockers].sort() }))
    .sort((left, right) => right.links - left.links || left.retailer.localeCompare(right.retailer));

  console.log(JSON.stringify({
    auditedAt: new Date().toISOString(),
    scope: {
      expectedPublicProducts: publicProducts.length,
      productionPublicProducts: coveredProductionSlugs.length,
      missingProductionProducts: matrix.filter(product => !product.databasePublished).map(product => product.slug),
      unrelatedPublishedProductionProducts: [...productionSlugs].filter(slug => !publicSlugs.has(slug)).sort(),
    },
    aggregate: {
      approvedNgLinks: matrix.reduce((total, item) => total + item.approvedRetailerLinkCount, 0),
      exactNgLinks: matrix.reduce((total, item) => total + item.classification.exact, 0),
      searchNgLinks: matrix.reduce((total, item) => total + item.classification.search, 0),
      productsWithExactNgLinks: matrix.filter(item => item.classification.exact > 0).length,
      productsWithSearchOnly: matrix.filter(item => item.classification.exact === 0 && item.classification.search > 0).length,
      productsWithoutNgLinks: matrix.filter(item => item.approvedRetailerLinkCount === 0).length,
      storeChoiceTarget: defaultStoreChoiceTarget,
      productsMeetingStoreChoiceTarget: matrix.filter(item => item.storeChoice.gapToTarget === 0).length,
      productsBelowStoreChoiceTarget: matrix.filter(item => item.storeChoice.gapToTarget > 0).length,
      trustworthyFreshExactStoreGap: matrix.reduce((total, item) => total + item.storeChoice.gapToTarget, 0),
      productsMeetingFreshPriceTarget: matrix.filter(item => item.storeChoice.freshPriceGapToTarget === 0).length,
      freshPriceStoreGap: matrix.reduce((total, item) => total + item.storeChoice.freshPriceGapToTarget, 0),
      freshPriceOffers: matrix.reduce((total, item) => total + item.priceStockFreshness.freshPrices, 0),
      freshStockOffers: matrix.reduce((total, item) => total + item.priceStockFreshness.freshStock, 0),
      staleExactOffers: matrix.reduce((total, item) => total + item.priceStockFreshness.stale, 0),
      unverifiedExactOffers: matrix.reduce((total, item) => total + item.priceStockFreshness.unverified, 0),
      identitySizeConflicts: matrix.reduce((total, item) => total + item.identitySizeConflict.length, 0),
      activeRefreshJobs: matrix.reduce((total, item) => total + item.activeRefreshJobs, 0),
    },
    byRetailer,
    matrix,
  }, null, 2));
}

async function main() {
const connectionString = process.env.DATABASE_URL_UNPOOLED
  ?? process.env.POSTGRES_URL_NON_POOLING
  ?? process.env.DATABASE_URL
  ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('A Neon connection string is required to audit offer inventory.');
}

const sql = postgres(connectionString, { max: 1, prepare: false });

try {
  if (process.argv.includes('--coverage')) {
    await reportPublicCoverage(sql);
    return;
  }

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
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
