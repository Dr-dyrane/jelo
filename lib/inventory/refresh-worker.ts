import 'server-only';

import { getPostgresClient } from '@/lib/db/postgres';

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BYTES = 1_500_000;
const MAX_ATTEMPTS = 5;

type InventoryStatus = 'in_stock' | 'out_of_stock' | 'unknown';
type ObservedPrice = { priceMinor: number; currencyCode: string };
type RetailerObservation = { inventoryStatus: InventoryStatus; price: ObservedPrice | null };

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

function detectInventoryStatus(html: string): InventoryStatus {
  if (OUT_OF_STOCK_PATTERNS.some(pattern => pattern.test(html))) return 'out_of_stock';
  if (IN_STOCK_PATTERNS.some(pattern => pattern.test(html))) return 'in_stock';
  return 'unknown';
}

function normalizePrice(rawPrice: string, rawCurrency?: string): ObservedPrice | null {
  const value = Number(rawPrice.replace(/[^0-9.,]/g, '').replace(/,/g, ''));
  if (!Number.isFinite(value) || value <= 0) return null;

  const currency = rawCurrency?.toUpperCase()
    ?? (rawPrice.includes('₦') ? 'NGN'
      : rawPrice.includes('£') ? 'GBP'
        : rawPrice.includes('€') ? 'EUR'
          : rawPrice.includes('$') ? 'USD'
            : undefined);

  if (!currency || !/^[A-Z]{3}$/.test(currency)) return null;

  // Existing JeloCare NGN offers store whole Naira in price_minor. Preserve that
  // convention until the planned money-model migration; other currencies use cents.
  const priceMinor = currency === 'NGN' ? Math.round(value) : Math.round(value * 100);
  return { priceMinor, currencyCode: currency };
}

function extractPrice(html: string): ObservedPrice | null {
  const metaPatterns = [
    /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']product:price:amount["'][^>]*>/i,
    /<meta[^>]+itemprop=["']price["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  ];
  const currencyMatch = html.match(/<meta[^>]+(?:property|itemprop)=["'](?:product:price:currency|priceCurrency)["'][^>]+content=["']([A-Za-z]{3})["'][^>]*>/i)
    ?? html.match(/["']priceCurrency["']\s*:\s*["']([A-Za-z]{3})["']/i);

  for (const pattern of metaPatterns) {
    const amount = html.match(pattern)?.[1];
    if (amount) {
      const normalized = normalizePrice(amount, currencyMatch?.[1]);
      if (normalized) return normalized;
    }
  }

  const jsonPrice = html.match(/["']price["']\s*:\s*["']?([0-9][0-9.,]*)["']?/i)?.[1];
  if (jsonPrice) {
    const normalized = normalizePrice(jsonPrice, currencyMatch?.[1]);
    if (normalized) return normalized;
  }

  const visiblePrice = html.match(/(?:₦|NGN\s*|£|€|\$)\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?/i)?.[0];
  return visiblePrice ? normalizePrice(visiblePrice) : null;
}

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
    select claimed.id as job_id, claimed.offer_id, claimed.attempt_count, o.url
    from claimed
    join offers o on o.id = claimed.offer_id
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
    return { inventoryStatus: detectInventoryStatus(html), price: extractPrice(html) };
  } finally {
    clearTimeout(timeout);
  }
}

async function completeJob(job: ClaimedJob, observation: RetailerObservation) {
  const sql = getPostgresClient();
  const available = observation.inventoryStatus === 'in_stock';
  const validity = observation.inventoryStatus === 'unknown' ? '1 day' : '7 days';

  await sql.begin(async transaction => {
    await transaction`
      update offers
      set inventory_status = ${observation.inventoryStatus},
          available = ${available},
          price_minor = coalesce(${observation.price?.priceMinor ?? null}, price_minor),
          currency_code = coalesce(${observation.price?.currencyCode ?? null}, currency_code),
          verification_method = 'retailer_page',
          verification_note = ${observation.inventoryStatus === 'unknown' ? 'No reliable stock marker found on retailer page.' : null},
          last_verified_at = now(), verification_expires_at = now() + ${validity}::interval,
          checked_at = now(), updated_at = now()
      where id = ${job.offer_id}
    `;

    if (observation.price) {
      await transaction`
        insert into offer_price_history (offer_id, price_minor, currency_code, observed_at, source)
        values (${job.offer_id}, ${observation.price.priceMinor}, ${observation.price.currencyCode}, now(), 'retailer_page')
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
    await completeJob(job, observation);
    return {
      jobId: job.job_id,
      offerId: job.offer_id,
      status: 'completed',
      inventoryStatus: observation.inventoryStatus,
      priceMinor: observation.price?.priceMinor,
      currencyCode: observation.price?.currencyCode,
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
