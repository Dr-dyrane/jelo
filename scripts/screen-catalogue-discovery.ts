import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { catalogueDiscoverySources, type CatalogueDiscoverySource } from '@/data/catalogue-discovery-sources';
import { reviewCatalogueDiscoveryRefresh } from '@/lib/catalogue/discovery-refresh';
import {
  auditCatalogueDiscoverySnapshot,
  buildCatalogueDiscoverySnapshot,
  type CatalogueDiscoverySnapshot,
  type DiscoveryProductInput,
  type DiscoveryResponseEvidence,
  type WooStoreProduct,
} from '@/lib/catalogue/discovery-screening';

const pageSize = 100;
const requestTimeoutMs = 20_000;
const maxResponseBytes = 5_000_000;
const concurrency = 4;

type PageResult = {
  products: DiscoveryProductInput[];
  evidence: DiscoveryResponseEvidence;
  totalPages: number;
  totalProducts: number;
};

function numericArg(name: string, fallback: number) {
  const raw = process.argv.find(argument => argument.startsWith(`--${name}=`))?.split('=', 2)[1];
  if (raw == null) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`--${name} must be a positive integer.`);
  return parsed;
}

function writeArg() {
  return process.argv.find(argument => argument.startsWith('--write='))?.slice('--write='.length);
}

function stringArg(name: string) {
  return process.argv.find(argument => argument.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length);
}

function directDataJson(repositoryRoot: string, value: string, label: string) {
  const dataRoot = path.resolve(repositoryRoot, 'data');
  const filename = path.resolve(repositoryRoot, value);
  if (path.dirname(filename) !== dataRoot || !filename.endsWith('.json')) {
    throw new Error(`${label} must be a direct JSON file inside data/.`);
  }
  return filename;
}

async function optionalSnapshot(filename: string | undefined) {
  if (!filename) return undefined;
  try {
    const bytes = await readFile(filename);
    const snapshot = JSON.parse(bytes.toString('utf8')) as CatalogueDiscoverySnapshot;
    auditCatalogueDiscoverySnapshot(snapshot);
    return snapshot;
  } catch (error) {
    if (
      error
      && typeof error === 'object'
      && 'code' in error
      && error.code === 'ENOENT'
    ) return undefined;
    throw error;
  }
}

function hostKey(value: string) {
  return value.toLowerCase().replace(/^www\./, '');
}

function sourcePageUrl(source: CatalogueDiscoverySource, page: number) {
  const url = new URL(source.endpoint);
  url.searchParams.set('per_page', String(pageSize));
  url.searchParams.set('page', String(page));
  url.searchParams.set('orderby', 'id');
  url.searchParams.set('order', 'desc');
  return url;
}

function evidenceId(source: CatalogueDiscoverySource, page: number, digest: string) {
  return createHash('sha256')
    .update(`jelocare-discovery-response-v1\n${source.key}\n${page}\n${digest}\n`)
    .digest('hex')
    .slice(0, 24);
}

async function fetchPage(source: CatalogueDiscoverySource, page: number): Promise<PageResult> {
  const requestedUrl = sourcePageUrl(source, page);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(requestedUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'JeloCareCatalogueDiscovery/1.0 (+https://jelocare.com)',
      },
    });
    if (!response.ok) throw new Error(`${source.retailer} page ${page} returned HTTP ${response.status}.`);
    const responseUrl = new URL(response.url || requestedUrl);
    if (
      responseUrl.protocol !== 'https:'
      || hostKey(responseUrl.hostname) !== hostKey(source.host)
      || responseUrl.pathname !== requestedUrl.pathname
    ) throw new Error(`${source.retailer} page ${page} redirected outside its reviewed API route.`);

    const contentType = response.headers.get('content-type') ?? '';
    if (!/^application\/json(?:;|$)/i.test(contentType)) {
      throw new Error(`${source.retailer} page ${page} returned ${contentType || 'an unknown content type'}.`);
    }
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (declaredLength > maxResponseBytes) throw new Error(`${source.retailer} page ${page} exceeded the response limit.`);

    const body = await response.text();
    const bytes = Buffer.from(body, 'utf8');
    if (bytes.byteLength > maxResponseBytes) throw new Error(`${source.retailer} page ${page} exceeded the response limit.`);
    const parsed = JSON.parse(body) as unknown;
    if (!Array.isArray(parsed)) throw new Error(`${source.retailer} page ${page} did not return a product array.`);
    const products = parsed as WooStoreProduct[];
    const digest = createHash('sha256').update(bytes).digest('hex');
    const retrievedAt = new Date().toISOString();
    const id = evidenceId(source, page, digest);
    const totalPages = Number(response.headers.get('x-wp-totalpages') ?? (products.length < pageSize ? page : page + 1));
    const totalProducts = Number(response.headers.get('x-wp-total') ?? products.length);
    if (!Number.isSafeInteger(totalPages) || totalPages < page) throw new Error(`${source.retailer} returned an invalid page count.`);
    if (!Number.isSafeInteger(totalProducts) || totalProducts < products.length) throw new Error(`${source.retailer} returned an invalid product count.`);

    const evidence: DiscoveryResponseEvidence = {
      id,
      retailer: source.retailer,
      requestedUrl: requestedUrl.toString(),
      responseUrl: responseUrl.toString(),
      retrievedAt,
      responseSha256: digest,
      responseByteSize: bytes.byteLength,
      responseMimeType: 'application/json',
      page,
      recordCount: products.length,
    };
    return {
      products: products.map(product => ({ source, product, observedAt: retrievedAt, responseEvidenceId: id })),
      evidence,
      totalPages,
      totalProducts,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function concurrentMap<T, R>(items: T[], worker: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

async function main() {
  const targetCount = numericArg('target', 1000);
  const maxPages = numericArg('max-pages', 100);
  const repositoryRoot = process.cwd();
  const output = writeArg();
  const baseline = stringArg('baseline');
  const acceptedRefresh = stringArg('accept-refresh');
  if (acceptedRefresh && !output) {
    throw new Error('--accept-refresh requires --write.');
  }
  const outputPath = output
    ? directDataJson(repositoryRoot, output, '--write')
    : undefined;
  const baselinePath = baseline
    ? directDataJson(repositoryRoot, baseline, '--baseline')
    : outputPath;
  const previous = await optionalSnapshot(baselinePath);
  if (baseline && !previous) throw new Error('--baseline does not exist.');

  const firstPages = await concurrentMap([...catalogueDiscoverySources], source => fetchPage(source, 1));
  const remaining = catalogueDiscoverySources.flatMap((source, sourceIndex) => {
    const totalPages = Math.min(firstPages[sourceIndex].totalPages, maxPages);
    return Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) => ({ source, page: index + 2 }));
  });
  const laterPages = await concurrentMap(remaining, item => fetchPage(item.source, item.page));
  const pages = [...firstPages, ...laterPages];
  const products = pages.flatMap(page => page.products);
  const sourceResponses = pages.map(page => page.evidence);
  const generatedAt = new Date().toISOString();
  const snapshot = buildCatalogueDiscoverySnapshot({ products, sourceResponses, generatedAt, targetCount });

  const refreshReview = previous
    ? reviewCatalogueDiscoveryRefresh(previous, snapshot)
    : undefined;

  if (output) {
    if (
      refreshReview
      && acceptedRefresh !== refreshReview.acceptanceToken
    ) {
      console.log(JSON.stringify({ refreshReview }, null, 2));
      throw new Error(
        'Refusing to replace the private discovery snapshot without its exact '
        + `review token. Re-run with --accept-refresh=${refreshReview.acceptanceToken}`,
      );
    }
    await writeFile(outputPath!, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  }

  const sourceSummary = catalogueDiscoverySources.map((source, index) => ({
    retailer: source.retailer,
    reviewStatus: source.reviewStatus,
    reportedProducts: firstPages[index].totalProducts,
    fetchedPages: pages.filter(page => page.evidence.retailer === source.retailer).length,
    fetchedProducts: pages
      .filter(page => page.evidence.retailer === source.retailer)
      .reduce((sum, page) => sum + page.products.length, 0),
  }));
  console.log(JSON.stringify({
    policy: snapshot.policy,
    targetCount: snapshot.targetCount,
    selectedCount: snapshot.selectedCount,
    targetDeficit: snapshot.targetDeficit,
    sourceProductCount: snapshot.sourceProductCount,
    eligibleCandidateCount: snapshot.eligibleCandidateCount,
    rejected: snapshot.rejected,
    sources: sourceSummary,
    refreshReview: refreshReview ?? null,
    output: output ?? null,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
