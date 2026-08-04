import postgres from 'postgres';
import { requireAdminDatabaseUrl } from './lib/admin-database';

type PendingRequestRow = {
  id: string;
  owner_subject: string;
  revision: number;
  brand: string;
  full_pack_name: string;
  printed_size_variant: string;
};

type MatchRow = {
  identity_version_id: string;
  slug: string;
};

function parseReconcileOptions(argv: readonly string[]) {
  return {
    dryRun: argv.includes('--dry-run'),
  };
}

async function reconcileWithinTransaction(
  transaction: postgres.TransactionSql,
  options: { dryRun: boolean },
) {
  await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;

  const pendingRequests = await transaction<PendingRequestRow[]>`
    select id, owner_subject, revision, brand, full_pack_name, printed_size_variant
    from public.customer_product_requests
    where lifecycle_state in ('pending', 'in_review', 'needs_info')
      and matched_identity_version_id is null
    order by updated_at asc, id
  `;

  if (pendingRequests.length === 0) {
    console.log('No pending customer product requests awaiting a catalogue match.');
    return { matched: 0, scanned: 0 };
  }

  console.log(
    `Scanning ${pendingRequests.length} pending customer product request${pendingRequests.length === 1 ? '' : 's'}${options.dryRun ? ' (dry-run)' : ''}.`,
  );

  let matched = 0;
  for (const request of pendingRequests) {
    const [match] = await transaction<MatchRow[]>`
      select version.identity_version_id, product.slug
      from public.catalogue_product_identity_versions version
      join public.products product on product.id = version.product_id
      where version.lifecycle_state = 'active'
        and product.is_published = true
        and pg_catalog.lower(
          pg_catalog.regexp_replace(pg_catalog.btrim(version.brand_at_review), '[[:space:]]+', ' ', 'g')
        ) = ${request.brand.toLocaleLowerCase('en-US')}
        and pg_catalog.lower(
          pg_catalog.regexp_replace(pg_catalog.btrim(version.variant_at_review), '[[:space:]]+', ' ', 'g')
        ) = ${request.full_pack_name.toLocaleLowerCase('en-US')}
        and pg_catalog.lower(
          pg_catalog.regexp_replace(pg_catalog.btrim(version.size_at_review), '[[:space:]]+', ' ', 'g')
        ) = ${request.printed_size_variant.toLocaleLowerCase('en-US')}
      order by version.version_number desc, version.identity_version_id
      limit 1
    `;

    if (!match) {
      continue;
    }

    matched += 1;
    console.log(
      `Matched request ${request.id} -> ${match.slug} (identity_version_id ${match.identity_version_id})${options.dryRun ? ' [dry-run]' : ''}`,
    );

    if (options.dryRun) {
      continue;
    }

    await transaction`
      update public.customer_product_requests
      set lifecycle_state = 'matched',
          matched_identity_version_id = ${match.identity_version_id},
          revision = revision + 1,
          updated_at = now()
      where id = ${request.id}
        and lifecycle_state in ('pending', 'in_review', 'needs_info')
        and matched_identity_version_id is null
    `;
  }

  return { matched, scanned: pendingRequests.length };
}

async function main() {
  const options = parseReconcileOptions(process.argv.slice(2));
  const connectionString = requireAdminDatabaseUrl();

  const sql = postgres(connectionString, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    connection: { application_name: 'jelocare-reconcile-pending-requests' },
  });

  try {
    const result = await sql.begin(async (tx) => (
      reconcileWithinTransaction(tx, options)
    ));
    console.log(
      `Reconcile complete: ${result.matched} of ${result.scanned} pending request${result.scanned === 1 ? '' : 's'} matched${options.dryRun ? ' (dry-run, no changes applied)' : ''}.`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
