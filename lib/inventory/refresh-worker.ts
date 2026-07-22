import 'server-only';

import { getPostgresClient } from '@/lib/db/postgres';
import { extractRetailerPage, type InventoryStatus, type RetailerExtraction } from '@/modules/retail-intelligence/extraction';
import { assertRetailerResponseScope } from '@/modules/retail-intelligence/response-scope';

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BYTES = 1_500_000;
const MAX_ATTEMPTS = 5;

type RetailerObservation = RetailerExtraction & { adapterKey: string; responseUrl: string };

export type InventoryRefreshResult = {
  jobId: string;
  offerId: string;
  status: 'completed' | 'failed';
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
  product_name: string;
  product_size: string;
  brand_name: string;
};

async function claimJob(): Promise<ClaimedJob | undefined> {
  const sql = getPostgresClient();
  const [job] = await sql<ClaimedJob[]>`
    with candidate as (
      select j.id
      from inventory_refresh_jobs j
      where j.status = 'queued' and j.next_attempt_at <= now()
      order by j.priority desc, j.requested_at asc
      for update skip locked
      limit 1
    ), claimed as (
      update inventory_refresh_jobs j
      set status = 'processing', attempt_count = j.attempt_count + 1,
          started_at = now(), updated_at = now()
      from candidate
      where j.id = candidate.id
      returning j.id, j.offer_id, j.attempt_count
    )
    select
      claimed.id as job_id,
      claimed.offer_id,
      claimed.attempt_count,
      o.url,
      o.market_code,
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

async function completeJob(job: ClaimedJob, observation: RetailerObservation) {
  const sql = getPostgresClient();
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

  await sql.begin(async transaction => {
    await transaction`
      update offers
      set inventory_status = ${observation.inventoryStatus},
          available = ${available},
          price_minor = ${observation.priceMinor},
          currency_code = ${observation.currencyCode},
          verification_method = 'retailer_page',
          verification_note = ${verificationNote},
          extraction_confidence = ${observation.confidence},
          extraction_evidence = ${sql.json(observation.evidence)},
          extraction_adapter = ${observation.adapterKey},
          observed_title = ${observation.productTitle ?? null},
          observed_size = ${observation.productSize ?? null},
          canonical_url = ${observation.canonicalUrl ?? null},
          last_verified_at = now(), verification_expires_at = now() + ${validity}::interval,
          checked_at = now(), updated_at = now()
      where id = ${job.offer_id}
    `;

    if (observation.priceMinor != null && observation.currencyCode) {
      await transaction`
        insert into offer_price_history (offer_id, price_minor, currency_code, observed_at, source)
        values (${job.offer_id}, ${observation.priceMinor}, ${observation.currencyCode}, now(), 'retailer_page')
      `;
    }

    await transaction`
      update inventory_refresh_jobs
      set status = 'completed', last_error = null, completed_at = now(), updated_at = now()
      where id = ${job.job_id}
    `;
  });
}

async function failJob(job: ClaimedJob, error: unknown) {
  const sql = getPostgresClient();
  const message = error instanceof Error ? error.message : String(error);
  const terminal = job.attempt_count >= MAX_ATTEMPTS;
  const backoffMinutes = Math.min(2 ** Math.max(job.attempt_count - 1, 0) * 5, 240);
  await sql`
    update inventory_refresh_jobs
    set status = ${terminal ? 'failed' : 'queued'}::inventory_refresh_status,
        last_error = ${message.slice(0, 1000)},
        next_attempt_at = now() + (${backoffMinutes} * interval '1 minute'),
        completed_at = ${terminal ? new Date() : null}, updated_at = now()
    where id = ${job.job_id}
  `;
  return message;
}

export async function processNextInventoryRefreshJob(): Promise<InventoryRefreshResult | undefined> {
  const job = await claimJob();
  if (!job) return undefined;
  try {
    const observation = await fetchRetailerPage(job.url);
    assertRetailerResponseScope({
      requestedUrl: job.url,
      responseUrl: observation.responseUrl,
      canonicalUrl: observation.canonicalUrl,
      expectedTitle: `${job.brand_name} ${job.product_name}`,
      expectedSize: job.product_size,
      observedTitle: observation.productTitle,
      observedSize: observation.productSize,
      marketCode: job.market_code,
      currencyCode: observation.currencyCode,
    });
    await completeJob(job, observation);
    return {
      jobId: job.job_id,
      offerId: job.offer_id,
      status: 'completed',
      inventoryStatus: observation.inventoryStatus,
      priceMinor: observation.priceMinor ?? undefined,
      currencyCode: observation.currencyCode ?? undefined,
    };
  } catch (error) {
    const message = await failJob(job, error);
    return { jobId: job.job_id, offerId: job.offer_id, status: 'failed', error: message };
  }
}

export async function processInventoryRefreshBatch(limit = 25) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const results: InventoryRefreshResult[] = [];
  for (let index = 0; index < safeLimit; index += 1) {
    const result = await processNextInventoryRefreshJob();
    if (!result) break;
    results.push(result);
  }
  return results;
}
