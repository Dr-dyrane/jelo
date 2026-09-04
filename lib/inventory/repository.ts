import "server-only";

import { getPostgresClient } from "@/lib/db/postgres";
import { INVENTORY_REFRESH_LEASE_MS } from "@/lib/inventory/refresh-policy";

export type InventoryFreshness = "fresh" | "stale" | "unknown";

export type InventoryOffer = {
  id: string;
  productSlug: string;
  retailer: string;
  marketCode: string;
  url: string;
  status: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
  available: boolean;
  priceMinor: number | null;
  currencyCode: string | null;
  lastVerifiedAt: Date | null;
  verificationExpiresAt: Date | null;
  freshness: InventoryFreshness;
  extractionConfidence: number | null;
  extractionEvidence: string[];
  extractionAdapter: string | null;
  observedTitle: string | null;
  observedSize: string | null;
  canonicalUrl: string | null;
};

type InventoryOfferRow = {
  id: string;
  product_slug: string;
  retailer: string;
  market_code: string;
  url: string;
  inventory_status: InventoryOffer["status"];
  available: boolean;
  price_minor: number | null;
  currency_code: string | null;
  last_verified_at: Date | null;
  verification_expires_at: Date | null;
  freshness: InventoryFreshness;
  extraction_confidence: number | null;
  extraction_evidence: string[];
  extraction_adapter: string | null;
  observed_title: string | null;
  observed_size: string | null;
  canonical_url: string | null;
};

function mapOffer(row: InventoryOfferRow): InventoryOffer {
  return {
    id: row.id,
    productSlug: row.product_slug,
    retailer: row.retailer,
    marketCode: row.market_code,
    url: row.url,
    status: row.inventory_status,
    available: row.available,
    priceMinor: row.price_minor,
    currencyCode: row.currency_code,
    lastVerifiedAt: row.last_verified_at,
    verificationExpiresAt: row.verification_expires_at,
    freshness: row.freshness,
    extractionConfidence: row.extraction_confidence,
    extractionEvidence: row.extraction_evidence,
    extractionAdapter: row.extraction_adapter,
    observedTitle: row.observed_title,
    observedSize: row.observed_size,
    canonicalUrl: row.canonical_url,
  };
}

export async function listInventoryOffers(
  options: { staleOnly?: boolean; limit?: number } = {},
) {
  const sql = getPostgresClient();
  const staleOnly = options.staleOnly ?? false;
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);

  const rows = await sql<InventoryOfferRow[]>`
    select
      o.id,
      p.slug as product_slug,
      r.name as retailer,
      o.market_code,
      o.url,
      o.inventory_status,
      o.available,
      o.price_minor,
      o.currency_code,
      o.last_verified_at,
      o.verification_expires_at,
      o.extraction_confidence,
      o.extraction_evidence,
      o.extraction_adapter,
      o.observed_title,
      o.observed_size,
      o.canonical_url,
      case
        when o.last_verified_at is null or o.verification_expires_at is null then 'unknown'
        when o.verification_expires_at <= now() then 'stale'
        else 'fresh'
      end as freshness
    from offers o
    join products p on p.id = o.product_id
    join retailers r on r.id = o.retailer_id
    where (
      ${staleOnly} = false
      or o.last_verified_at is null
      or o.verification_expires_at is null
      or o.verification_expires_at <= now()
    )
    order by
      case
        when o.verification_expires_at is null then 0
        else 1
      end,
      o.verification_expires_at asc nulls first,
      p.slug,
      r.name
    limit ${limit}
  `;

  return rows.map(mapOffer);
}

export async function enqueueDueInventoryOffers(
  limit = 100,
  lookaheadHours = 24,
) {
  const sql = getPostgresClient();
  const safeLimit = Math.min(Math.max(limit, 1), 500);
  const safeLookaheadHours = Math.min(Math.max(lookaheadHours, 0), 168);

  const [summary] = await sql<{ queued: number; withdrawn: number }[]>`
    with withdrawn as (
      update inventory_refresh_jobs job
      set status = 'cancelled',
          last_error = 'Offer is no longer a published exact HTTPS offer; refresh was withdrawn.',
          completed_at = now(),
          updated_at = now()
      from offers o
      join products p on p.id = o.product_id
      where job.offer_id = o.id
        and job.status in ('queued', 'processing')
        and (
          p.is_published = false
          or o.match_kind <> 'exact'
          or o.url !~* '^https://'
        )
      returning job.id
    ), candidates as (
      select o.id
      from offers o
      join products p on p.id = o.product_id
      where
        p.is_published = true
        and o.match_kind = 'exact'
        and o.url ~* '^https://'
        and (
          o.last_verified_at is null
          or o.verification_expires_at is null
          or o.verification_expires_at <= now() + (${safeLookaheadHours} * interval '1 hour')
        )
        and not exists (
          select 1
          from inventory_refresh_jobs active_job
          where active_job.offer_id = o.id
            and active_job.status in ('queued', 'processing')
        )
      order by o.verification_expires_at asc nulls first, o.updated_at asc
      limit ${safeLimit}
    ), inserted as (
      insert into inventory_refresh_jobs (offer_id)
      select candidates.id
      from candidates
      on conflict do nothing
      returning id
    )
    select
      (select count(*)::int from inserted) as queued,
      (select count(*)::int from withdrawn) as withdrawn
  `;

  return summary ?? { queued: 0, withdrawn: 0 };
}

export type InventoryRefreshBacklogSummary = {
  active: number;
  queued: number;
  due: number;
  processing: number;
  leaseExpired: number;
  oldestDueAt: Date | null;
};

export async function getInventoryRefreshBacklogSummary(): Promise<InventoryRefreshBacklogSummary> {
  const sql = getPostgresClient();
  const [row] = await sql<
    {
      active: number;
      queued: number;
      due: number;
      processing: number;
      lease_expired: number;
      oldest_due_at: Date | null;
    }[]
  >`
    select
      (count(*) filter (where status in ('queued', 'processing')))::int as active,
      (count(*) filter (where status = 'queued'))::int as queued,
      (count(*) filter (
        where status = 'queued' and next_attempt_at <= now()
      ))::int as due,
      (count(*) filter (where status = 'processing'))::int as processing,
      (count(*) filter (
        where status = 'processing'
          and (
            started_at is null
            or started_at <= now() - (${INVENTORY_REFRESH_LEASE_MS} * interval '1 millisecond')
          )
      ))::int as lease_expired,
      min(requested_at) filter (
        where status = 'queued' and next_attempt_at <= now()
      ) as oldest_due_at
    from inventory_refresh_jobs
  `;

  return {
    active: row?.active ?? 0,
    queued: row?.queued ?? 0,
    due: row?.due ?? 0,
    processing: row?.processing ?? 0,
    leaseExpired: row?.lease_expired ?? 0,
    oldestDueAt: row?.oldest_due_at ?? null,
  };
}

/**
 * Counts exact Nigerian offers whose verification has expired (stale) and
 * have no active refresh job. Used by the alerting system to flag data
 * freshness degradation before users see outdated prices.
 */
export async function getStaleOfferCount(): Promise<number> {
  const sql = getPostgresClient();
  const [row] = await sql<{ stale: number }[]>`
    select count(*)::int as stale
    from offers o
    where o.match_kind = 'exact'
      and o.market_code = 'NG'
      and o.verification_expires_at is not null
      and o.verification_expires_at <= now()
      and not exists (
        select 1 from inventory_refresh_jobs j
        where j.offer_id = o.id
          and j.status in ('queued', 'processing')
      )
  `;
  return row?.stale ?? 0;
}
