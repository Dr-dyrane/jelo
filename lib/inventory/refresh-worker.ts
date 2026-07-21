import 'server-only';

import { getPostgresClient } from '@/lib/db/postgres';

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BYTES = 1_500_000;
const MAX_ATTEMPTS = 5;

export type InventoryRefreshResult = {
  jobId: string;
  offerId: string;
  status: 'completed' | 'failed';
  inventoryStatus?: 'in_stock' | 'out_of_stock' | 'unknown';
  error?: string;
};

type ClaimedJob = {
  job_id: string;
  offer_id: string;
  attempt_count: number;
  url: string;
};

const OUT_OF_STOCK_PATTERNS = [
  /out\s+of\s+stock/i,
  /sold\s+out/i,
  /currently\s+unavailable/i,
  /not\s+available/i,
  /notify\s+me\s+when\s+available/i,
];

const IN_STOCK_PATTERNS = [
  /add\s+to\s+(cart|bag|basket)/i,
  /buy\s+now/i,
  /in\s+stock/i,
  /available\s+now/i,
];

function detectInventoryStatus(html: string): 'in_stock' | 'out_of_stock' | 'unknown' {
  if (OUT_OF_STOCK_PATTERNS.some(pattern => pattern.test(html))) return 'out_of_stock';
  if (IN_STOCK_PATTERNS.some(pattern => pattern.test(html))) return 'in_stock';
  return 'unknown';
}

async function claimJob(): Promise<ClaimedJob | undefined> {
  const sql = getPostgresClient();
  const [job] = await sql<ClaimedJob[]>`
    with candidate as (
      select j.id
      from inventory_refresh_jobs j
      where j.status = 'queued'
        and j.next_attempt_at <= now()
      order by j.priority desc, j.requested_at asc
      for update skip locked
      limit 1
    ), claimed as (
      update inventory_refresh_jobs j
      set
        status = 'processing',
        attempt_count = j.attempt_count + 1,
        started_at = now(),
        updated_at = now()
      from candidate
      where j.id = candidate.id
      returning j.id, j.offer_id, j.attempt_count
    )
    select
      claimed.id as job_id,
      claimed.offer_id,
      claimed.attempt_count,
      o.url
    from claimed
    join offers o on o.id = claimed.offer_id
  `;

  return job;
}

async function fetchRetailerPage(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
        'User-Agent': 'JeloCareInventoryVerifier/1.0 (+https://jelocare.com)',
      },
    });

    if (!response.ok) throw new Error(`Retailer returned HTTP ${response.status}.`);

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      throw new Error(`Expected HTML but received ${contentType || 'an unknown content type'}.`);
    }

    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (declaredLength > MAX_RESPONSE_BYTES) throw new Error('Retailer page is too large to inspect safely.');

    const html = await response.text();
    if (Buffer.byteLength(html, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new Error('Retailer page exceeded the inspection size limit.');
    }

    return detectInventoryStatus(html);
  } finally {
    clearTimeout(timeout);
  }
}

async function completeJob(job: ClaimedJob, inventoryStatus: 'in_stock' | 'out_of_stock' | 'unknown') {
  const sql = getPostgresClient();
  const available = inventoryStatus === 'in_stock';
  const validity = inventoryStatus === 'unknown' ? '1 day' : '7 days';

  await sql.begin(async transaction => {
    await transaction`
      update offers
      set
        inventory_status = ${inventoryStatus},
        available = ${available},
        verification_method = 'retailer_page',
        verification_note = ${inventoryStatus === 'unknown' ? 'No reliable stock marker found on retailer page.' : null},
        last_verified_at = now(),
        verification_expires_at = now() + ${validity}::interval,
        checked_at = now(),
        updated_at = now()
      where id = ${job.offer_id}
    `;

    await transaction`
      update inventory_refresh_jobs
      set
        status = 'completed',
        last_error = null,
        completed_at = now(),
        updated_at = now()
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
    set
      status = ${terminal ? 'failed' : 'queued'}::inventory_refresh_status,
      last_error = ${message.slice(0, 1000)},
      next_attempt_at = now() + (${backoffMinutes} * interval '1 minute'),
      completed_at = ${terminal ? new Date() : null},
      updated_at = now()
    where id = ${job.job_id}
  `;

  return message;
}

export async function processNextInventoryRefreshJob(): Promise<InventoryRefreshResult | undefined> {
  const job = await claimJob();
  if (!job) return undefined;

  try {
    const inventoryStatus = await fetchRetailerPage(job.url);
    await completeJob(job, inventoryStatus);
    return { jobId: job.job_id, offerId: job.offer_id, status: 'completed', inventoryStatus };
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
