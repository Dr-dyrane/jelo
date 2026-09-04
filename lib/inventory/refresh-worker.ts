import postgres from "postgres";
import {
  APPLICATION_RUNTIME_ROLE,
  applicationDatabaseUrl,
  isProductionApplicationRuntime,
} from "@/lib/database/runtime-database-config";
import {
  assertClassifiedInventoryRefreshScope,
  canClaimInventoryRefreshJob,
  INVENTORY_DEFERRED_RECHECK_MS,
  INVENTORY_REFRESH_FRESHNESS_MS,
  INVENTORY_REFRESH_LEASE_MS,
  InventoryRefreshFailure,
  inventoryRefreshFailureSettlement,
  inventoryRefreshLastError,
  isInventoryRefreshTerminalReason,
  transientInventoryRefreshFailure,
  type InventoryRefreshFailureReason,
  type InventoryRefreshRunStatus,
  type InventoryRefreshTerminalReason,
} from "@/lib/inventory/refresh-policy";
import {
  extractRetailerPage,
  type InventoryStatus,
  type RetailerExtraction,
} from "@/modules/retail-intelligence/extraction";
import { assertRetailerResponseScope } from "@/modules/retail-intelligence/response-scope";
import {
  fetchRetailerPageWithBrowser,
  isBrowserFetchAvailable,
} from "@/lib/inventory/browser-fetch";
import {
  aiExtractionConfig,
  extractRetailerPageWithAi,
} from "@/lib/inventory/ai-extraction";

const REQUEST_TIMEOUT_MS = 12_000;
export const INVENTORY_REFRESH_EXTRACTION_BUDGET_MS = 25_000;
const MAX_RESPONSE_BYTES = 1_500_000;
const MAX_ATTEMPTS = 5;
const EXHAUSTED_LEASE_DEFERRED_ERROR = inventoryRefreshLastError({
  deferRecheck: true,
  failureReason: "runtime",
  message:
    "Processing lease expired after the maximum refresh attempts; deferred for daily recheck.",
});

// Woo Store API retailers: map hostname -> store origin for API calls.
// These retailers expose /wp-json/wc/store/v1/products?slug=<slug> which returns
// structured JSON with price, stock status, and currency — more reliable than
// scraping HTML for Woo stores that may have caching or theme quirks.
const WOO_API_HOSTS = new Map<string, string>([
  ["buybetter.ng", "https://buybetter.ng"],
  ["peronabeauty.com", "https://peronabeauty.com"],
  ["deoset.com", "https://deoset.com"],
  ["teeka4.com", "https://teeka4.com"],
  ["rhemabeautyshop.com", "https://rhemabeautyshop.com"],
  ["tosnigeria.com", "https://tosnigeria.com"],
  ["thebeautyprismng.com", "https://thebeautyprismng.com"],
  ["sonavinebeauty.com", "https://sonavinebeauty.com"],
  ["kadimezessentials.com", "https://kadimezessentials.com"],
  ["luxbeautyng.com", "https://www.luxbeautyng.com"],
  ["dunescenter.com", "https://dunescenter.com"],
  ["sliquebeautylimited.com", "https://sliquebeautylimited.com"],
  ["beautybydaz.com", "https://beautybydaz.com"],
]);

// Jumia blocks server-side fetch with Cloudflare 403. These hosts now fall
// back to the Playwright browser fetch instead of being skipped entirely.
const BLOCKED_HOSTS = new Set(["jumia.com.ng"]);

export type RetailerObservation = RetailerExtraction & {
  adapterKey: string;
  responseUrl: string;
  verificationMethod: string;
};

export type InventoryObservationScope = {
  requestedUrl: string;
  expectedTitle: string;
  expectedTitleAliases?: string[];
  expectedSize: string;
  marketCode: string;
};

export function inventoryObservationEvidenceGaps(
  observation: RetailerObservation,
) {
  const gaps: string[] = [];
  if (!observation.productTitle?.trim()) gaps.push("product title");
  if (!observation.productSize?.trim()) gaps.push("measurable product size");
  if (observation.priceMinor != null && !observation.currencyCode) {
    gaps.push("price currency");
  }
  if (
    observation.inventoryStatus === "unknown" &&
    observation.priceMinor == null
  ) {
    gaps.push("price or stock evidence");
  }
  return gaps;
}

export function inventoryObservationScopeGap(
  scope: InventoryObservationScope,
  observation: RetailerObservation,
): string | undefined {
  try {
    assertClassifiedInventoryRefreshScope(() => {
      assertRetailerResponseScope({
        requestedUrl: scope.requestedUrl,
        responseUrl: observation.responseUrl,
        canonicalUrl: observation.canonicalUrl,
        expectedTitle: scope.expectedTitle,
        expectedTitleAliases: scope.expectedTitleAliases,
        expectedSize: scope.expectedSize,
        observedTitle: observation.productTitle?.trim()
          ? observation.productTitle
          : scope.expectedTitle,
        observedSize: observation.productSize?.trim()
          ? observation.productSize
          : scope.expectedSize,
        marketCode: scope.marketCode,
        currencyCode: observation.currencyCode,
      });
    });
    return undefined;
  } catch (error) {
    if (
      error instanceof InventoryRefreshFailure &&
      error.reason === "evidence_incomplete"
    ) {
      return "unverifiable exact-scope evidence";
    }
    throw error;
  }
}

export function combineRetailerObservations(
  existing: RetailerObservation | undefined,
  supplemental: RetailerObservation,
): RetailerObservation {
  const normalizedSupplemental =
    supplemental.priceMinor != null && supplemental.currencyCode == null
      ? { ...supplemental, priceMinor: null }
      : supplemental;
  if (!existing) return normalizedSupplemental;

  const existingHasPrice =
    existing.priceMinor != null && existing.currencyCode != null;
  const verificationMethod =
    existing.verificationMethod === "ai_extraction" ||
    normalizedSupplemental.verificationMethod === "ai_extraction"
      ? "ai_extraction"
      : normalizedSupplemental.verificationMethod;
  const adapterKey = [
    ...new Set([existing.adapterKey, normalizedSupplemental.adapterKey]),
  ]
    .filter(Boolean)
    .join("+");

  return {
    inventoryStatus:
      existing.inventoryStatus !== "unknown"
        ? existing.inventoryStatus
        : normalizedSupplemental.inventoryStatus,
    priceMinor: existingHasPrice
      ? existing.priceMinor
      : normalizedSupplemental.priceMinor,
    currencyCode: existingHasPrice
      ? existing.currencyCode
      : (normalizedSupplemental.currencyCode ?? existing.currencyCode),
    productTitle:
      normalizedSupplemental.productTitle?.trim() ||
      existing.productTitle?.trim()
        ? normalizedSupplemental.productTitle?.trim() ||
          existing.productTitle?.trim()
        : undefined,
    productSize:
      normalizedSupplemental.productSize?.trim() || existing.productSize?.trim()
        ? normalizedSupplemental.productSize?.trim() ||
          existing.productSize?.trim()
        : undefined,
    canonicalUrl: normalizedSupplemental.canonicalUrl ?? existing.canonicalUrl,
    evidence: [
      ...new Set([...existing.evidence, ...normalizedSupplemental.evidence]),
    ],
    confidence:
      verificationMethod === "ai_extraction"
        ? Math.min(
            50,
            Math.max(existing.confidence, normalizedSupplemental.confidence),
          )
        : Math.max(existing.confidence, normalizedSupplemental.confidence),
    adapterKey,
    responseUrl: normalizedSupplemental.responseUrl,
    verificationMethod,
  };
}

function directFetchFailureOutcome(error: unknown): string {
  if (!(error instanceof Error)) return "request failed";
  if (error.name === "AbortError") return "request timed out";
  if (error.message.startsWith("Retailer returned HTTP ")) {
    return error.message.replace(/\.$/, "");
  }
  if (error.message.startsWith("Expected HTML but received ")) {
    return "non-HTML response";
  }
  if (
    error.message === "Retailer page is too large to inspect safely." ||
    error.message === "Retailer page exceeded the inspection size limit."
  ) {
    return "response exceeded size limit";
  }
  return "request failed";
}

export function inventoryExtractionDeadlineAt(
  claimDeadlineAt: number | undefined,
  now = Date.now(),
) {
  const perJobDeadlineAt = now + INVENTORY_REFRESH_EXTRACTION_BUDGET_MS;
  return claimDeadlineAt == null
    ? perJobDeadlineAt
    : Math.min(perJobDeadlineAt, claimDeadlineAt);
}

export function inventoryRequestTimeoutMs(
  extractionDeadlineAt: number,
  now = Date.now(),
): number | undefined {
  const remainingMs = Math.floor(extractionDeadlineAt - now);
  return remainingMs > 0
    ? Math.min(REQUEST_TIMEOUT_MS, remainingMs)
    : undefined;
}

async function runBeforeInventoryExtractionDeadline<T>(
  extractionDeadlineAt: number,
  operation: () => Promise<T>,
): Promise<T | undefined> {
  const timeoutMs = inventoryRequestTimeoutMs(extractionDeadlineAt);
  if (timeoutMs == null) return undefined;

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<undefined>((resolve) => {
        timeout = setTimeout(() => resolve(undefined), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export type InventoryRefreshResult = {
  jobId: string;
  offerId: string;
  productSlug: string;
  retailer?: string;
  status: InventoryRefreshRunStatus;
  recoveredLease: boolean;
  inventoryStatus?: InventoryStatus;
  priceMinor?: number;
  currencyCode?: string;
  verificationMethod?: string;
  extractionConfidence?: number;
  verifiedAt?: string;
  verificationExpiresAt?: string;
  terminalInvalidation?: {
    invalidatedAt: string;
    reason: InventoryRefreshTerminalReason;
  };
  failureReason?: InventoryRefreshFailureReason;
  error?: string;
};

/** @internal Exported for deterministic batch-orchestration tests. */
export function summarizeInventoryRefreshClaimBatch(
  batch: readonly (InventoryRefreshResult | undefined)[],
  canClaimMore: boolean,
) {
  const results = batch.filter(
    (result): result is InventoryRefreshResult => result !== undefined,
  );
  const stoppedByDeadline = !canClaimMore;
  return {
    results,
    shouldStop: stoppedByDeadline || results.length !== batch.length,
    stoppedByDeadline,
  };
}

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
  retailer_name: string;
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
  terminalInvalidation?: {
    invalidatedAt: string;
    reason: InventoryRefreshTerminalReason;
  };
  failureReason?: InventoryRefreshFailureReason;
  error?: string;
  verifiedAt?: string;
  verificationExpiresAt?: string;
};

const VERIFIED_PRODUCT_TITLE_ALIASES: Record<string, string[]> = {
  "anua-niacinamide-10-txa-4-serum": ["Niacinamide 10% + TXA 4% Serum"],
  "eucerin-urearepair-plus-10-urea-body-lotion-250ml": [
    "UreaRepair PLUS 10% Urea Body Lotion",
  ],
};

let inventoryRefreshClient: ReturnType<typeof postgres> | undefined;

function getInventoryRefreshClient() {
  const connectionString = applicationDatabaseUrl(process.env);
  if (!connectionString) {
    throw new Error(
      isProductionApplicationRuntime(process.env)
        ? "Runtime database access is unavailable."
        : "DATABASE_URL or POSTGRES_URL is required for inventory refresh.",
    );
  }
  if (!inventoryRefreshClient) {
    inventoryRefreshClient = postgres(connectionString, {
      ...(isProductionApplicationRuntime(process.env)
        ? { user: APPLICATION_RUNTIME_ROLE }
        : {}),
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
  if (!/^[A-Z]{2}$/.test(normalized))
    throw new Error("Inventory refresh market must be a two-letter code.");
  return normalized;
}

async function claimJob(
  options: InventoryRefreshWorkerOptions = {},
): Promise<ClaimedJob | undefined> {
  const sql = getInventoryRefreshClient();
  const claimDeadline =
    options.claimDeadlineAt == null ? null : new Date(options.claimDeadlineAt);
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
      set status = 'queued',
          last_error = ${EXHAUSTED_LEASE_DEFERRED_ERROR},
          started_at = null,
          next_attempt_at = now() + (${INVENTORY_DEFERRED_RECHECK_MS} * interval '1 millisecond'),
          completed_at = null,
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
      b.name as brand_name,
      r.name as retailer_name
    from claimed
    join offers o on o.id = claimed.offer_id
    join products p on p.id = o.product_id
    join brands b on b.id = p.brand_id
    join retailers r on r.id = o.retailer_id
  `;
  return job;
}

type WooStoreProduct = {
  name?: string;
  permalink?: string;
  prices?: {
    price?: string;
    currency_code?: string;
    currency_minor_unit?: number;
  };
  is_in_stock?: boolean;
  stock_status?: string;
  manage_stock?: boolean;
  stock_quantity?: number | null;
};

function wooHostFromUrl(url: string): string | undefined {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return WOO_API_HOSTS.get(hostname);
  } catch {
    return undefined;
  }
}

function isBlockedHost(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BLOCKED_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

async function fetchWooStoreApi(
  url: string,
  extractionDeadlineAt: number,
): Promise<RetailerObservation | undefined> {
  const origin = wooHostFromUrl(url);
  if (!origin) return undefined;

  const parsedUrl = new URL(url);
  // Extract the product slug from the URL path.
  // Woo permalinks are /product/<slug>/ or /shop/<slug>/ — take the last path segment.
  const segments = parsedUrl.pathname.split("/").filter(Boolean);
  const slug = segments[segments.length - 1]?.replace(/\/+$/, "") ?? "";
  if (!slug) return undefined;

  const requestTimeoutMs = inventoryRequestTimeoutMs(extractionDeadlineAt);
  if (requestTimeoutMs == null) return undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const apiUrl = `${origin}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(slug)}`;
    const response = await fetch(apiUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "JeloCareInventoryVerifier/1.1 (+https://jelocare.com)",
      },
    });
    if (!response.ok) return undefined;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return undefined;
    const products = (await response.json()) as WooStoreProduct[];
    if (!Array.isArray(products) || products.length === 0) return undefined;

    const product = products[0];
    if (!product.prices?.price) return undefined;

    const minorUnit = product.prices.currency_minor_unit ?? 2;
    const rawPrice = Number(product.prices.price);
    if (!Number.isFinite(rawPrice) || rawPrice <= 0) return undefined;

    const currencyCode = (product.prices.currency_code ?? "NGN").toUpperCase();
    // Convert from minor units to whole Naira (or major units for other currencies).
    // JeloCare stores NGN as whole Naira; other currencies as 2-decimal minor units.
    const priceMinor =
      currencyCode === "NGN"
        ? Math.round(rawPrice / 10 ** minorUnit)
        : Math.round(rawPrice / 10 ** Math.max(minorUnit - 2, 0));

    let inventoryStatus: InventoryStatus = "unknown";
    if (
      product.is_in_stock === false ||
      product.stock_status === "outofstock"
    ) {
      inventoryStatus = "out_of_stock";
    } else if (
      product.stock_status === "onbackorder" ||
      (product.manage_stock && (product.stock_quantity ?? 0) <= 0)
    ) {
      inventoryStatus = "out_of_stock";
    } else if (product.manage_stock && (product.stock_quantity ?? 0) <= 5) {
      inventoryStatus = "low_stock";
    } else if (
      product.is_in_stock === true ||
      product.stock_status === "instock"
    ) {
      inventoryStatus = "in_stock";
    }

    const evidence = [
      "Woo Store API product",
      "Woo Store API price",
      `Woo Store API stock: ${inventoryStatus}`,
    ];

    const confidence = Math.min(100, 10 + 25 + 35 + 5 + 5);

    return {
      inventoryStatus,
      priceMinor,
      currencyCode,
      productTitle: product.name,
      canonicalUrl: product.permalink,
      evidence,
      confidence,
      adapterKey: "woo-store-api",
      responseUrl: url,
      verificationMethod: "retailer_page",
    };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetches raw HTML from a retailer page without running extraction. Used as a
 * fallback path when fetchRetailerPage throws (e.g. non-HTML content type) but
 * we still want the HTML for AI Gateway extraction.
 */
async function fetchPageHtml(
  url: string,
  extractionDeadlineAt: number,
): Promise<string | undefined> {
  const requestTimeoutMs = inventoryRequestTimeoutMs(extractionDeadlineAt);
  if (requestTimeoutMs == null) return undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        "User-Agent": "JeloCareInventoryVerifier/1.1 (+https://jelocare.com)",
      },
    });
    if (!response.ok) return undefined;
    const html = await response.text();
    if (Buffer.byteLength(html, "utf8") > MAX_RESPONSE_BYTES) return undefined;
    return html;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRetailerPage(
  url: string,
  extractionDeadlineAt: number,
): Promise<RetailerObservation | undefined> {
  const requestTimeoutMs = inventoryRequestTimeoutMs(extractionDeadlineAt);
  if (requestTimeoutMs == null) return undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        "User-Agent": "JeloCareInventoryVerifier/1.1 (+https://jelocare.com)",
      },
    });
    if (!response.ok)
      throw new Error(`Retailer returned HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html"))
      throw new Error(
        `Expected HTML but received ${contentType || "an unknown content type"}.`,
      );
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_RESPONSE_BYTES)
      throw new Error("Retailer page is too large to inspect safely.");
    const html = await response.text();
    if (Buffer.byteLength(html, "utf8") > MAX_RESPONSE_BYTES)
      throw new Error("Retailer page exceeded the inspection size limit.");
    const responseUrl = response.url || url;
    const result = extractRetailerPage({ url: new URL(responseUrl), html });
    return {
      ...result.extraction,
      adapterKey: result.adapterKey,
      responseUrl,
      verificationMethod: "retailer_page",
    };
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
  const remainsEligible =
    claim.is_published &&
    claim.match_kind === "exact" &&
    /^https:\/\//i.test(claim.current_url);

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
      status: "discarded",
      failureReason: "eligibility_changed",
      error: "Offer eligibility changed while the refresh was running.",
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
      status: "retrying",
      failureReason: "claim_changed",
      error: "Offer URL changed while the refresh was running.",
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
      status: "retrying",
      failureReason: "claim_changed",
      error: "Offer market changed while the refresh was running.",
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
      status: "retrying",
      failureReason: "claim_changed",
      error: "Offer changed while the refresh was running.",
    };
  }

  return undefined;
}

async function completeJob(
  job: ClaimedJob,
  observation: RetailerObservation,
): Promise<ClaimSettlement> {
  const sql = getInventoryRefreshClient();
  const available =
    observation.inventoryStatus === "in_stock" ||
    observation.inventoryStatus === "low_stock";

  const verifiedAt = new Date();
  const verificationExpiresAt = new Date(
    verifiedAt.valueOf() + INVENTORY_REFRESH_FRESHNESS_MS,
  );
  const verificationNote =
    observation.inventoryStatus === "unknown"
      ? "No product-scoped stock evidence found on the retailer page."
      : observation.confidence < 60
        ? "Retailer-page extraction has low confidence."
        : null;

  return sql.begin(async (transaction) => {
    const claim = await lockCurrentClaim(transaction, job);
    if (!claim) {
      return {
        status: "discarded",
        failureReason: "claim_changed",
        error: "Inventory refresh claim was superseded before completion.",
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
          verification_method = ${observation.verificationMethod},
          verification_note = ${verificationNote},
          extraction_confidence = ${observation.confidence},
          extraction_evidence = ${transaction.json(observation.evidence)},
          extraction_adapter = ${observation.adapterKey},
          observed_title = ${observation.productTitle ?? null},
          observed_size = ${observation.productSize ?? null},
          canonical_url = ${observation.canonicalUrl ?? null},
          last_verified_at = ${verifiedAt},
          verification_expires_at = ${verificationExpiresAt},
          checked_at = ${verifiedAt},
          updated_at = ${verifiedAt}
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
      throw new Error(
        "Published exact offer changed before its observation could be recorded.",
      );
    }

    if (observation.priceMinor != null && observation.currencyCode) {
      await transaction`
        insert into offer_price_history (offer_id, price_minor, currency_code, observed_at, source)
        values (${job.offer_id}, ${observation.priceMinor}, ${observation.currencyCode}, ${verifiedAt}, ${observation.verificationMethod})
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
      throw new Error("Inventory refresh claim changed before completion.");
    }

    return {
      status: "completed",
      verifiedAt: verifiedAt.toISOString(),
      verificationExpiresAt: verificationExpiresAt.toISOString(),
    };
  });
}

async function failJob(
  job: ClaimedJob,
  error: unknown,
): Promise<ClaimSettlement> {
  const sql = getInventoryRefreshClient();
  const decision = inventoryRefreshFailureSettlement({
    error,
    attemptCount: job.attempt_count,
    maxAttempts: MAX_ATTEMPTS,
  });
  const failure = decision.failure;
  const message = failure.message;
  const provenTerminalContradiction = decision.invalidateOffer;
  const deferRecheck = decision.deferRecheck;
  const lastError = inventoryRefreshLastError({
    deferRecheck,
    failureReason: failure.reason,
    message,
  });
  const backoffMinutes = Math.min(
    2 ** Math.max(job.attempt_count - 1, 0) * 5,
    240,
  );
  return sql.begin(async (transaction) => {
    const claim = await lockCurrentClaim(transaction, job);
    if (!claim) {
      return {
        status: "discarded",
        failureReason: "claim_changed",
        error:
          "Inventory refresh claim was superseded before failure settlement.",
      };
    }

    const changed = await settleChangedCurrentClaim(transaction, job, claim);
    if (changed) return changed;

    const invalidatedAt = provenTerminalContradiction ? new Date() : undefined;
    if (invalidatedAt) {
      const invalidatedOffers = await transaction<{ id: string }[]>`
        update offers o
        set verification_expires_at = least(
              coalesce(o.verification_expires_at, ${invalidatedAt}),
              ${invalidatedAt}
            ),
            updated_at = ${invalidatedAt}
        where o.id = ${job.offer_id}
          and o.url = ${job.url}
          and o.match_kind = 'exact'
          and o.market_code = ${job.market_code}
          and exists (
            select 1
            from products p
            where p.id = o.product_id
              and p.is_published = true
          )
        returning o.id
      `;
      if (invalidatedOffers.length !== 1) {
        throw new Error(
          "Terminal inventory contradiction could not expire the current exact offer.",
        );
      }
    }

    const settledJobs = await transaction<{ id: string }[]>`
      update inventory_refresh_jobs
      set status = 'queued',
          last_error = ${lastError},
          started_at = null,
          next_attempt_at = now() + (
            ${deferRecheck ? INVENTORY_DEFERRED_RECHECK_MS : backoffMinutes * 60 * 1000}
            * interval '1 millisecond'
          ),
          completed_at = null,
          updated_at = now()
      where id = ${job.job_id}
        and offer_id = ${job.offer_id}
        and status = 'processing'
        and attempt_count = ${job.attempt_count}
      returning id
    `;
    if (settledJobs.length !== 1) {
      if (invalidatedAt) {
        throw new Error(
          "Terminal inventory contradiction could not expire the offer and settle the job atomically.",
        );
      }
      return {
        status: "discarded",
        failureReason: "claim_changed",
        error: "Inventory refresh claim changed before failure settlement.",
      };
    }

    return {
      status: deferRecheck ? "deferred" : "retrying",
      terminalInvalidation:
        invalidatedAt && isInventoryRefreshTerminalReason(failure.reason)
          ? {
              invalidatedAt: invalidatedAt.toISOString(),
              reason: failure.reason,
            }
          : undefined,
      failureReason: failure.reason,
      error: message,
    };
  });
}

export async function processNextInventoryRefreshJob(
  options: {
    claimDeadlineAt?: number;
    marketCode?: string;
  } = {},
): Promise<InventoryRefreshResult | undefined> {
  if (!canClaimInventoryRefreshJob(options.claimDeadlineAt)) return undefined;
  const job = await claimJob(options);
  if (!job) return undefined;

  try {
    // Never spend the route's post-claim reserve on extraction. A final
    // concurrent claim batch may start close to claimDeadlineAt, so every
    // network layer shares the earlier of that cutoff and a per-job budget.
    const extractionDeadlineAt = inventoryExtractionDeadlineAt(
      options.claimDeadlineAt,
    );
    // Track which fetch layers were attempted and their outcomes so that
    // when all layers fail, the error message identifies the failing layer
    // instead of reporting a generic "all strategies failed" message.
    const layerOutcomes: Array<{ layer: string; outcome: string }> = [];
    const observationScope: InventoryObservationScope = {
      requestedUrl: job.url,
      expectedTitle: `${job.brand_name} ${job.product_name}`,
      expectedTitleAliases: VERIFIED_PRODUCT_TITLE_ALIASES[job.product_slug],
      expectedSize: job.product_size,
      marketCode: job.market_code,
    };
    let accumulatedObservation: RetailerObservation | undefined;
    let observation: RetailerObservation | undefined;

    const acceptObservation = (
      layer: string,
      candidate: RetailerObservation,
    ): RetailerObservation | undefined => {
      // A complete contradiction from any retailer-controlled layer remains
      // terminal. Missing or non-measurable evidence stays eligible for a
      // later layer to complete.
      const candidateScopeGap = inventoryObservationScopeGap(
        observationScope,
        candidate,
      );
      accumulatedObservation = combineRetailerObservations(
        accumulatedObservation,
        candidateScopeGap
          ? { ...candidate, productSize: undefined }
          : candidate,
      );
      const gaps = inventoryObservationEvidenceGaps(accumulatedObservation);
      const accumulatedScopeGap = inventoryObservationScopeGap(
        observationScope,
        accumulatedObservation,
      );
      if (accumulatedScopeGap) gaps.push(accumulatedScopeGap);

      if (gaps.length === 0) {
        return accumulatedObservation;
      }
      layerOutcomes.push({
        layer,
        outcome: `incomplete: ${[...new Set(gaps)].join(", ")}`,
      });
      return undefined;
    };

    // Try the Woo Store API first for known Woo retailers — it's more reliable
    // than HTML scraping for price and stock. Its product response frequently
    // omits measurable pack size, so retain its commerce fields and continue
    // to the exact product page until the identity evidence is also complete.
    const wooObservation = await fetchWooStoreApi(
      job.url,
      extractionDeadlineAt,
    );
    if (wooObservation) {
      observation =
        acceptObservation("woo-store-api", wooObservation) ?? observation;
    } else {
      if (wooHostFromUrl(job.url)) {
        layerOutcomes.push({
          layer: "woo-store-api",
          outcome: "no match or error",
        });
      }
    }

    if (!observation) {
      try {
        const directObservation = await fetchRetailerPage(
          job.url,
          extractionDeadlineAt,
        );
        if (directObservation) {
          observation =
            acceptObservation("http-fetch", directObservation) ?? observation;
        } else {
          layerOutcomes.push({
            layer: "http-fetch",
            outcome: "no extraction",
          });
        }
      } catch (error) {
        layerOutcomes.push({
          layer: "http-fetch",
          outcome: directFetchFailureOutcome(error),
        });
      }
    }

    // Cache the browser fetch result so we don't launch the browser twice
    // (once for structured extraction, once for AI extraction fallback).
    let cachedBrowserHtml: string | undefined;
    let cachedBrowserUrl: string | undefined;

    // Known-blocked hosts and any incomplete direct-page extraction can use a
    // rendered page to complete identity evidence before the AI fallback.
    const browserFallbackEligible =
      isBlockedHost(job.url) ||
      layerOutcomes.some((outcome) => outcome.layer === "http-fetch");
    if (!observation && browserFallbackEligible && isBrowserFetchAvailable()) {
      const browserResult = await runBeforeInventoryExtractionDeadline(
        extractionDeadlineAt,
        () => fetchRetailerPageWithBrowser(job.url),
      );
      if (browserResult) {
        cachedBrowserHtml = browserResult.html;
        cachedBrowserUrl = browserResult.responseUrl;
        const result = extractRetailerPage({
          url: new URL(browserResult.responseUrl),
          html: browserResult.html,
        });
        const browserObservation: RetailerObservation = {
          ...result.extraction,
          adapterKey: result.adapterKey,
          responseUrl: browserResult.responseUrl,
          verificationMethod: "retailer_page",
        };
        observation =
          acceptObservation("browser-fetch", browserObservation) ?? observation;
      } else {
        layerOutcomes.push({ layer: "browser-fetch", outcome: "fetch failed" });
      }
    }

    // Final fallback: if all fetch strategies failed or returned no usable
    // extraction, ask the AI Gateway to extract price/stock from any HTML we
    // did manage to fetch. This is gated by INVENTORY_AI_EXTRACTION=true and
    // runs at confidence 50 (1-day freshness window).
    if (!observation && aiExtractionConfig()) {
      let htmlForAi: string | undefined;
      let urlForAi = job.url;

      if (cachedBrowserHtml) {
        // Reuse the browser HTML we already fetched for blocked hosts
        htmlForAi = cachedBrowserHtml;
        urlForAi = cachedBrowserUrl ?? job.url;
      } else {
        // Re-fetch the page HTML directly for AI extraction — the earlier
        // fetchRetailerPage call may have thrown before returning HTML.
        try {
          htmlForAi = await fetchPageHtml(job.url, extractionDeadlineAt);
          if (htmlForAi) {
            // Give a later direct response one more deterministic structured
            // pass before asking the AI to complete the evidence.
            const result = extractRetailerPage({
              url: new URL(job.url),
              html: htmlForAi,
            });
            observation =
              acceptObservation("http-fetch-retry", {
                ...result.extraction,
                adapterKey: result.adapterKey,
                responseUrl: job.url,
                verificationMethod: "retailer_page",
              }) ?? observation;
          }
        } catch {
          // If we can't get HTML, AI extraction can't run either
        }
      }

      if (!observation && htmlForAi) {
        const aiHtml = htmlForAi;
        const aiUrl = urlForAi;
        const aiResult = await runBeforeInventoryExtractionDeadline(
          extractionDeadlineAt,
          () =>
            extractRetailerPageWithAi({
              html: aiHtml,
              url: aiUrl,
              productSlug: job.product_slug,
              productName: job.product_name,
              productSize: job.product_size,
            }),
        );
        if (aiResult) {
          observation =
            acceptObservation("ai-gateway", {
              ...aiResult,
              adapterKey: "ai-gateway-extraction",
              responseUrl: aiUrl,
            }) ?? observation;
        } else {
          layerOutcomes.push({ layer: "ai-gateway", outcome: "no extraction" });
        }
      } else if (!htmlForAi) {
        layerOutcomes.push({
          layer: "ai-gateway",
          outcome: "no html available",
        });
      }
    }

    if (!observation) {
      const layerDetail =
        layerOutcomes.length > 0
          ? layerOutcomes.map((o) => `${o.layer}=${o.outcome}`).join("; ")
          : "no layers attempted";
      const incompleteEvidence = accumulatedObservation != null;
      const settlement = await failJob(
        job,
        transientInventoryRefreshFailure(
          incompleteEvidence ? "evidence_incomplete" : "fetch_unavailable",
          incompleteEvidence
            ? `Retailer evidence remained incomplete. Layers attempted: ${layerDetail}.`
            : `All fetch strategies failed. Layers attempted: ${layerDetail}.`,
        ),
      );
      return {
        jobId: job.job_id,
        offerId: job.offer_id,
        productSlug: job.product_slug,
        retailer: job.retailer_name,
        status: settlement.status,
        recoveredLease: job.recovered_lease,
        terminalInvalidation: settlement.terminalInvalidation,
        failureReason: settlement.failureReason,
        error: settlement.error,
      };
    }

    assertClassifiedInventoryRefreshScope(() => {
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
    });
    const settlement = await completeJob(job, observation);
    return {
      jobId: job.job_id,
      offerId: job.offer_id,
      productSlug: job.product_slug,
      retailer: job.retailer_name,
      status: settlement.status,
      recoveredLease: job.recovered_lease,
      terminalInvalidation: settlement.terminalInvalidation,
      failureReason: settlement.failureReason,
      inventoryStatus:
        settlement.status === "completed"
          ? observation.inventoryStatus
          : undefined,
      priceMinor:
        settlement.status === "completed"
          ? (observation.priceMinor ?? undefined)
          : undefined,
      currencyCode:
        settlement.status === "completed"
          ? (observation.currencyCode ?? undefined)
          : undefined,
      verificationMethod:
        settlement.status === "completed"
          ? observation.verificationMethod
          : undefined,
      extractionConfidence:
        settlement.status === "completed" ? observation.confidence : undefined,
      verifiedAt:
        settlement.status === "completed" ? settlement.verifiedAt : undefined,
      verificationExpiresAt:
        settlement.status === "completed"
          ? settlement.verificationExpiresAt
          : undefined,
      error: settlement.error,
    };
  } catch (error) {
    const settlement = await failJob(job, error);
    return {
      jobId: job.job_id,
      offerId: job.offer_id,
      productSlug: job.product_slug,
      retailer: job.retailer_name,
      status: settlement.status,
      recoveredLease: job.recovered_lease,
      terminalInvalidation: settlement.terminalInvalidation,
      failureReason: settlement.failureReason,
      error: settlement.error,
    };
  }
}

export async function processInventoryRefreshBatch(
  limit = 25,
  options: InventoryRefreshWorkerOptions = {},
) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const concurrency = 5;
  const results: InventoryRefreshResult[] = [];
  let stoppedByDeadline = false;
  let processed = 0;

  while (processed < safeLimit && !stoppedByDeadline) {
    if (!canClaimInventoryRefreshJob(options.claimDeadlineAt)) {
      stoppedByDeadline = true;
      break;
    }
    const batchSize = Math.min(concurrency, safeLimit - processed);
    const batch = await Promise.all(
      Array.from({ length: batchSize }, () =>
        processNextInventoryRefreshJob(options),
      ),
    );
    const claimBatch = summarizeInventoryRefreshClaimBatch(
      batch,
      canClaimInventoryRefreshJob(options.claimDeadlineAt),
    );
    results.push(...claimBatch.results);
    processed += claimBatch.results.length;
    stoppedByDeadline = claimBatch.stoppedByDeadline;
    if (claimBatch.shouldStop) break;
  }
  return { results, stoppedByDeadline };
}
