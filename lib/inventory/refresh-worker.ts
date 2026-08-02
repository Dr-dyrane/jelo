import postgres from 'postgres';
import {
  canClaimInventoryRefreshJob,
  INVENTORY_REFRESH_LEASE_MS,
  type InventoryRefreshRunStatus,
} from '@/lib/inventory/refresh-policy';
import { extractRetailerPage, type InventoryStatus, type RetailerExtraction } from '@/modules/retail-intelligence/extraction';
import { assertRetailerResponseScope } from '@/modules/retail-intelligence/response-scope';

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BYTES = 1_500_000;
const MAX_ATTEMPTS = 5;

type RetailerObservation = RetailerExtraction & { adapterKey: string; responseUrl: string };

export type InventoryRefreshResult = {
  jobId: string;
  offerId: string;
  productSlug: string;
  status: InventoryRefreshRunStatus;
  recoveredLease: boolean;
  inventoryStatus?: InventoryStatus;
  priceMinor?: number;
  currencyCode?: string;
  error?: string;
};

type ClaimedJob = {
  job_id: string;
  offer_id: string;
  attempt_count: number;
  url: string;
  market_code: string;
  product_slug: string;
  product_name: string;
  product_size: string;
  brand_name: string;
  recovered_lease: boolean;
  offer_version: string;
};

type CurrentClaim = {
  current_url: string;
  current_offer_version: string;
  current_market_code: string;
  match_kind: string;
  is_published: boolean;
};

type ClaimSettlement = {
  status: InventoryRefreshRunStatus;
  error?: string;
};

const VERIFIED_PRODUCT_TITLE_ALIASES: Record<string, string[]> = {
  'anua-niacinamide-10-txa-4-serum': ['Niacinamide 10% + TXA 4% Serum'],
  'eucerin-urearepair-plus-10-urea-body-lotion-250ml': ['UreaRepair PLUS 10% Urea Body Lotion'],
};

let inventoryRefreshClient: ReturnType<typeof postgres> | undefined;

function getInventoryRefreshClient() {
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) throw new Error('DATABASE_URL or POSTGRES_URL is required for inventory refresh.');
  if (!inventoryRefreshClient) {
    inventoryRefreshClient = postgres(connectionString, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return inventoryRefreshClient;
}

export async function closeInventoryRefreshClient() {
  if (!inventoryRefreshClient) return;
  const client = inventoryRefreshClient;
  inventoryRefreshClient = undefined;
  await client.end({ timeout: 5 });
}

type InventoryRefreshWorkerOptions = {
  claimDeadlineAt?: number;
  marketCode?: string;
};

function normalizeMarketCode(marketCode: string | undefined) {
  if (marketCode == null) return undefined;
  const normalized = marketCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) throw new Error('Inventory refresh market must be a two-letter code.');
  return normalized;
}

async function claimJob(options: InventoryRefreshWorkerOptions = {}): Promise<ClaimedJob | undefined> {
  const sql = getInventoryRefreshClient();
  const claimDeadline = options.claimDeadlineAt == null ? null : new Date(options.claimDeadlineAt);
  const marketCode = normalizeMarketCode(options.marketCode);
  const [job] = await sql<ClaimedJob[]>`
    with exhausted_candidate as (
      select j.id
      from inventory_refresh_jobs j
      join offers o on o.id = j.offer_id
      where j.status = 'processing'
        and j.attempt_count >= ${MAX_ATTEMPTS}
        and (${marketCode ?? null}::text is null or o.market_code = ${marketCode ?? null})
        and (
          j.started_at is null
          or j.started_at <= now() - (${INVENTORY_REFRESH_LEASE_MS} * interval '1 millisecond')
        )
      for update of j skip locked
      limit 100
    ), exhausted as (
      update inventory_refresh_jobs j
      set status = 'failed',
          last_error = 'Processing lease expired after the maximum refresh attempts.',
          completed_at = now(),
          updated_at = now()
      from exhausted_candidate
      where j.id = exhausted_candidate.id
      returning j.id
    ), candidate as (
      select
        j.id,
        j.status = 'processing' as recovered_lease
      from inventory_refresh_jobs j
      join offers o on o.id = j.offer_id
      join products p on p.id = o.product_id
      where (
          (j.status = 'queued' and j.next_attempt_at <= now())
          or (
            j.status = 'processing'
            and j.attempt_count < ${MAX_ATTEMPTS}
            and (
              j.started_at is null
              or j.started_at <= now() - (${INVENTORY_REFRESH_LEASE_MS} * interval '1 millisecond')
            )
          )
        )
        and p.is_published = true
        and o.match_kind = 'exact'
        and o.url ~* '^https://'
        and (${marketCode ?? null}::text is null or o.market_code = ${marketCode ?? null})
        and (
          ${claimDeadline}::timestamptz is null
          or now() < ${claimDeadline}::timestamptz
        )
      order by
        case when j.status = 'processing' then 0 else 1 end,
        j.priority desc,
        j.requested_at asc
      for update of j skip locked
      limit 1
    ), claimed as (
      update inventory_refresh_jobs j
      set status = 'processing', attempt_count = j.attempt_count + 1,
          started_at = now(), completed_at = null, updated_at = now()
      from candidate
      where j.id = candidate.id
      returning
        j.id,
        j.offer_id,
        j.attempt_count,
        candidate.recovered_lease
    )
    select
      claimed.id as job_id,
      claimed.offer_id,
      claimed.attempt_count,
      claimed.recovered_lease,
      o.url,
      extract(epoch from o.updated_at)::text as offer_version,
      o.market_code,
      p.slug as product_slug,
      p.name as product_name,
      p.size as product_size,
      b.name as brand_name
    from claimed
    join offers o on o.id = claimed.offer_id
    join products p on p.id = o.product_id
    join brands b on b.id = p.brand_id
  `;
  return job;
}

async function fetchRetailerPage(url: string): Promise<RetailerObservation> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
        'User-Agent': 'JeloCareInventoryVerifier/1.1 (+https://jelocare.com)',
      },
    });
    if (!response.ok) throw new Error(`Retailer returned HTTP ${response.status}.`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) throw new Error(`Expected HTML but received ${contentType || 'an unknown content type'}.`);
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (declaredLength > MAX_RESPONSE_BYTES) throw new Error('Retailer page is too large to inspect safely.');
    const html = await response.text();
    if (Buffer.byteLength(html, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('Retailer page exceeded the inspection size limit.');
    const responseUrl = response.url || url;
    const result = extractRetailerPage({ url: new URL(responseUrl), html });
    return { ...result.extraction, adapterKey: result.adapterKey, responseUrl };
  } finally {
    clearTimeout(timeout);
  }
}

async function lockCurrentClaim(
  transaction: postgres.TransactionSql,
  job: ClaimedJob,
) {
  const [claim] = await transaction<CurrentClaim[]>`
    select
      o.url as current_url,
      extract(epoch from o.updated_at)::text as current_offer_version,
      o.market_code as current_market_code,
      o.match_kind,
      p.is_published
    from inventory_refresh_jobs j
    join offers o on o.id = j.offer_id
    join products p on p.id = o.product_id
    where j.id = ${job.job_id}
      and j.offer_id = ${job.offer_id}
      and j.status = 'processing'
      and j.attempt_count = ${job.attempt_count}
    for update of j, o, p
  `;
  return claim;
}

async function settleChangedCurrentClaim(
  transaction: postgres.TransactionSql,
  job: ClaimedJob,
  claim: CurrentClaim,
): Promise<ClaimSettlement | undefined> {
  const remainsEligible = claim.is_published
    && claim.match_kind === 'exact'
    && /^https:\/\//i.test(claim.current_url);

  if (!remainsEligible) {
    await transaction`
      update inventory_refresh_jobs
      set status = 'cancelled',
          last_error = 'Offer is no longer a published exact HTTPS offer; in-flight result was discarded.',
          completed_at = now(),
          updated_at = now()
      where id = ${job.job_id}
        and offer_id = ${job.offer_id}
        and status = 'processing'
        and attempt_count = ${job.attempt_count}
    `;
    return {
      status: 'discarded',
      error: 'Offer eligibility changed while the refresh was running.',
    };
  }

  if (claim.current_url !== job.url) {
    await transaction`
      update inventory_refresh_jobs
      set status = 'queued',
          last_error = 'Offer URL changed while refresh was running; a fresh claim is required.',
          started_at = null,
          completed_at = null,
          next_attempt_at = now(),
          updated_at = now()
      where id = ${job.job_id}
        and offer_id = ${job.offer_id}
        and status = 'processing'
        and attempt_count = ${job.attempt_count}
    `;
    return {
      status: 'retrying',
      error: 'Offer URL changed while the refresh was running.',
    };
  }

  if (claim.current_market_code !== job.market_code) {
    await transaction`
      update inventory_refresh_jobs
      set status = 'queued',
          last_error = 'Offer market changed while refresh was running; a fresh claim is required.',
          started_at = null,
          completed_at = null,
          next_attempt_at = now(),
          updated_at = now()
      where id = ${job.job_id}
        and offer_id = ${job.offer_id}
        and status = 'processing'
        and attempt_count = ${job.attempt_count}
    `;
    return {
      status: 'retrying',
      error: 'Offer market changed while the refresh was running.',
    };
  }

  if (claim.current_offer_version !== job.offer_version) {
    await transaction`
      update inventory_refresh_jobs
      set status = 'queued',
          last_error = 'Offer changed while refresh was running; a fresh claim is required.',
          started_at = null,
          completed_at = null,
          next_attempt_at = now(),
          updated_at = now()
      where id = ${job.job_id}
        and offer_id = ${job.offer_id}
        and status = 'processing'
        and attempt_count = ${job.attempt_count}
    `;
    return {
      status: 'retrying',
      error: 'Offer changed while the refresh was running.',
    };
  }

  return undefined;
}

async function completeJob(
  job: ClaimedJob,
  observation: RetailerObservation,
): Promise<ClaimSettlement> {
  const sql = getInventoryRefreshClient();
  const available = observation.inventoryStatus === 'in_stock' || observation.inventoryStatus === 'low_stock';
  const validity = observation.inventoryStatus === 'unknown' || observation.confidence < 60
    ? '1 day'
    : observation.confidence < 85
      ? '3 days'
      : '7 days';
  const verificationNote = observation.inventoryStatus === 'unknown'
    ? 'No product-scoped stock evidence found on the retailer page.'
    : observation.confidence < 60
      ? 'Retailer-page extraction has low confidence.'
      : null;

  return sql.begin(async transaction => {
    const claim = await lockCurrentClaim(transaction, job);
    if (!claim) {
      return {
        status: 'discarded',
        error: 'Inventory refresh claim was superseded before completion.',
      };
    }

    const changed = await settleChangedCurrentClaim(transaction, job, claim);
    if (changed) return changed;

    const updatedOffers = await transaction<{ id: string }[]>`
      update offers o
      set inventory_status = ${observation.inventoryStatus},
          available = ${available},
          price_minor = ${observation.priceMinor},
          currency_code = ${observation.currencyCode},
          verification_method = 'retailer_page',
          verification_note = ${verificationNote},
          extraction_confidence = ${observation.confidence},
          extraction_evidence = ${transaction.json(observation.evidence)},
          extraction_adapter = ${observation.adapterKey},
          observed_title = ${observation.productTitle ?? null},
          observed_size = ${observation.productSize ?? null},
          canonical_url = ${observation.canonicalUrl ?? null},
          last_verified_at = now(), verification_expires_at = now() + ${validity}::interval,
          checked_at = now(), updated_at = now()
      where o.id = ${job.offer_id}
        and o.url = ${job.url}
        and extract(epoch from o.updated_at)::text = ${job.offer_version}
        and o.match_kind = 'exact'
        and o.url ~* '^https://'
        and o.market_code = ${job.market_code}
        and exists (
          select 1
          from products p
          where p.id = o.product_id
            and p.is_published = true
        )
      returning o.id
    `;
    if (updatedOffers.length !== 1) {
      throw new Error('Published exact offer changed before its observation could be recorded.');
    }

    if (observation.priceMinor != null && observation.currencyCode) {
      await transaction`
        insert into offer_price_history (offer_id, price_minor, currency_code, observed_at, source)
        values (${job.offer_id}, ${observation.priceMinor}, ${observation.currencyCode}, now(), 'retailer_page')
      `;
    }

    const settledJobs = await transaction<{ id: string }[]>`
      update inventory_refresh_jobs
      set status = 'completed', last_error = null, completed_at = now(), updated_at = now()
      where id = ${job.job_id}
        and offer_id = ${job.offer_id}
        and status = 'processing'
        and attempt_count = ${job.attempt_count}
      returning id
    `;
    if (settledJobs.length !== 1) {
      throw new Error('Inventory refresh claim changed before completion.');
    }

    return { status: 'completed' };
  });
}

async function failJob(job: ClaimedJob, error: unknown): Promise<ClaimSettlement> {
  const sql = getInventoryRefreshClient();
  const message = error instanceof Error ? error.message : String(error);
  const terminal = job.attempt_count >= MAX_ATTEMPTS;
  const backoffMinutes = Math.min(2 ** Math.max(job.attempt_count - 1, 0) * 5, 240);
  return sql.begin(async transaction => {
    const claim = await lockCurrentClaim(transaction, job);
    if (!claim) {
      return {
        status: 'discarded',
        error: 'Inventory refresh claim was superseded before failure settlement.',
      };
    }

    const changed = await settleChangedCurrentClaim(transaction, job, claim);
    if (changed) return changed;

    const settledJobs = await transaction<{ id: string }[]>`
      update inventory_refresh_jobs
      set status = ${terminal ? 'failed' : 'queued'}::inventory_refresh_status,
          last_error = ${message.slice(0, 1000)},
          started_at = case when ${terminal} then started_at else null end,
          next_attempt_at = now() + (${backoffMinutes} * interval '1 minute'),
          completed_at = ${terminal ? new Date() : null},
          updated_at = now()
      where id = ${job.job_id}
        and offer_id = ${job.offer_id}
        and status = 'processing'
        and attempt_count = ${job.attempt_count}
      returning id
    `;
    if (settledJobs.length !== 1) {
      return {
        status: 'discarded',
        error: 'Inventory refresh claim changed before failure settlement.',
      };
    }

    return {
      status: terminal ? 'failed' : 'retrying',
      error: message,
    };
  });
}

export async function processNextInventoryRefreshJob(options: {
  claimDeadlineAt?: number;
  marketCode?: string;
} = {}): Promise<InventoryRefreshResult | undefined> {
  if (!canClaimInventoryRefreshJob(options.claimDeadlineAt)) return undefined;
  const job = await claimJob(options);
  if (!job) return undefined;
  try {
    const observation = await fetchRetailerPage(job.url);
    assertRetailerResponseScope({
      requestedUrl: job.url,
      responseUrl: observation.responseUrl,
      canonicalUrl: observation.canonicalUrl,
      expectedTitle: `${job.brand_name} ${job.product_name}`,
      expectedTitleAliases: VERIFIED_PRODUCT_TITLE_ALIASES[job.product_slug],
      expectedSize: job.product_size,
      observedTitle: observation.productTitle,
      observedSize: observation.productSize,
      marketCode: job.market_code,
      currencyCode: observation.currencyCode,
    });
    const settlement = await completeJob(job, observation);
    return {
      jobId: job.job_id,
      offerId: job.offer_id,
      productSlug: job.product_slug,
      status: settlement.status,
      recoveredLease: job.recovered_lease,
      inventoryStatus: settlement.status === 'completed'
        ? observation.inventoryStatus
        : undefined,
      priceMinor: settlement.status === 'completed'
        ? observation.priceMinor ?? undefined
        : undefined,
      currencyCode: settlement.status === 'completed'
        ? observation.currencyCode ?? undefined
        : undefined,
      error: settlement.error,
    };
  } catch (error) {
    const settlement = await failJob(job, error);
    return {
      jobId: job.job_id,
      offerId: job.offer_id,
      productSlug: job.product_slug,
      status: settlement.status,
      recoveredLease: job.recovered_lease,
      error: settlement.error,
    };
  }
}

export async function processInventoryRefreshBatch(
  limit = 25,
  options: InventoryRefreshWorkerOptions = {},
) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const results: InventoryRefreshResult[] = [];
  let stoppedByDeadline = false;
  for (let index = 0; index < safeLimit; index += 1) {
    if (!canClaimInventoryRefreshJob(options.claimDeadlineAt)) {
      stoppedByDeadline = true;
      break;
    }
    const result = await processNextInventoryRefreshJob(options);
    if (!result) {
      stoppedByDeadline = !canClaimInventoryRefreshJob(options.claimDeadlineAt);
      break;
    }
    results.push(result);
  }
  return { results, stoppedByDeadline };
}
