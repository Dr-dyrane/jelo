import 'server-only';

import type { TransactionSql } from 'postgres';
import {
  assertCustomerShelfRlsRole,
  getCustomerShelfPostgresClient,
} from './shelf-database';

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

export type PendingRequestReconciliationResult = {
  scanned: number;
  matched: number;
  matchedRequests: Array<{ requestId: string; ownerSubject: string; slug: string }>;
};

async function reconcileOwner(
  transaction: TransactionSql,
  request: PendingRequestRow,
): Promise<MatchRow | null> {
  // RLS is owner-scoped via app.customer_subject, so set it per request.
  await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
  await transaction`select pg_catalog.set_config('app.customer_subject', ${request.owner_subject}, true)`;

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

  return match ?? null;
}

/**
 * Reconcile pending customer product requests against the published catalogue.
 *
 * For each pending request, attempt an exact brand + name + size match against
 * active published identity versions. On a match: add the matched product to
 * the owner's shelf (idempotent) and mark the request as published. Uses the
 * customer shelf runtime role with per-owner RLS context — never an admin role,
 * never a schema mutation.
 *
 * @param limit Maximum number of pending requests to scan per run.
 */
export async function reconcilePendingProductRequests(
  limit = 200,
): Promise<PendingRequestReconciliationResult> {
  const sql = getCustomerShelfPostgresClient();

  const pendingRequests = await sql<PendingRequestRow[]>`
    select id, owner_subject, revision, brand, full_pack_name, printed_size_variant
    from public.customer_product_requests
    where lifecycle_state in ('pending', 'in_review', 'needs_info')
      and matched_identity_version_id is null
    order by updated_at asc, id
    limit ${limit}
  `;

  const matchedRequests: PendingRequestReconciliationResult['matchedRequests'] = [];

  for (const request of pendingRequests) {
    await sql.begin(async (transaction) => {
      const match = await reconcileOwner(transaction, request);
      if (!match) return;

      await assertCustomerShelfRlsRole(transaction);

      // Add the matched product to the owner's shelf (idempotent).
      await transaction`
        insert into public.customer_shelf_items (
          owner_subject,
          product_identity_version_id,
          save_origin
        ) values (
          ${request.owner_subject},
          ${match.identity_version_id},
          'legacy_pages_v1_0'
        )
        on conflict (owner_subject, product_identity_version_id) do nothing
      `;

      // Mark the request as published and bind the matched identity version.
      await transaction`
        update public.customer_product_requests
        set lifecycle_state = 'published',
            matched_identity_version_id = ${match.identity_version_id},
            revision = revision + 1,
            updated_at = now()
        where id = ${request.id}
          and lifecycle_state in ('pending', 'in_review', 'needs_info')
          and matched_identity_version_id is null
      `;

      matchedRequests.push({
        requestId: request.id,
        ownerSubject: request.owner_subject,
        slug: match.slug,
      });
    }).catch((error) => {
      // A single request failing must not abort the whole batch.
      console.error(
        JSON.stringify({
          event: 'pending_request_reconciliation_request_failed',
          requestId: request.id,
          error: error instanceof Error ? error.message : 'unknown',
        }),
      );
    });
  }

  return {
    scanned: pendingRequests.length,
    matched: matchedRequests.length,
    matchedRequests,
  };
}
