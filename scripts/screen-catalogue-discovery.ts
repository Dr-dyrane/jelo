import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { catalogueDiscoverySources, type CatalogueDiscoverySource } from '@/data/catalogue-discovery-sources';
import { reviewCatalogueDiscoveryRefresh } from '@/lib/catalogue/discovery-refresh';
import {
  resolveDirectDataJson,
  writeDirectDataJsonAtomically,
} from '@/lib/catalogue/private-data-json';
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
const maxHtmlProductLinks = 12;
const jsonAccept = 'application/json';
const htmlAccept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

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

function evidenceId(source: CatalogueDiscoverySource, page: number, digest: string) {
  return createHash('sha256')
    .update(`jelocare-discovery-response-v1\n${source.key}\n${page}\n${digest}\n`)
    .digest('hex')
    .slice(0, 24);
}

function objectRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

async function fetchText(requestedUrl: URL, accept: string): Promise<{ text: string; responseUrl: URL; bytes: Buffer }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(requestedUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: accept,
        'User-Agent': 'JeloCareCatalogueDiscovery/1.0 (+https://jelocare.com)',
      },
    });
    if (!response.ok) throw new Error(`${requestedUrl.hostname} returned HTTP ${response.status}.`);
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (declaredLength > maxResponseBytes) throw new Error('Response exceeded the size limit.');
    const body = await response.text();
    const bytes = Buffer.from(body, 'utf8');
    if (bytes.byteLength > maxResponseBytes) throw new Error('Response exceeded the size limit.');
    const responseUrl = new URL(response.url || requestedUrl.toString());
    return { text: body, responseUrl, bytes };
  } finally {
    clearTimeout(timeout);
  }
}

function createEvidence(
  source: CatalogueDiscoverySource,
  page: number,
  requestedUrl: URL,
  responseUrl: URL,
  bytes: Buffer,
  recordCount: number,
): DiscoveryResponseEvidence {
  const digest = createHash('sha256').update(bytes).digest('hex');
  const retrievedAt = new Date().toISOString();
  const id = evidenceId(source, page, digest);
  return {
    id,
    retailer: source.retailer,
    requestedUrl: requestedUrl.toString(),
    responseUrl: responseUrl.toString(),
    retrievedAt,
    responseSha256: digest,
    responseByteSize: bytes.byteLength,
    responseMimeType: 'application/json',
    page,
    recordCount,
  };
}

function sourcePageUrl(source: CatalogueDiscoverySource, page: number): URL {
  const url = new URL(source.endpoint);
  switch (source.platform) {
    case 'woocommerce':
      url.searchParams.set('per_page', String(pageSize));
      url.searchParams.set('page', String(page));
      url.searchParams.set('orderby', 'id');
      url.searchParams.set('order', 'desc');
      break;
    case 'shopify':
      url.searchParams.set(source.limitParam ?? 'limit', '250');
      url.searchParams.set(source.pageParam ?? 'page', String(page));
      break;
    case 'magento':
      url.searchParams.set(source.limitParam ?? 'searchCriteria[pageSize]', '100');
      url.searchParams.set(source.pageParam ?? 'searchCriteria[currentPage]', String(page));
      break;
    case 'opencart':
      url.searchParams.set(source.limitParam ?? 'limit', String(pageSize));
      url.searchParams.set(source.pageParam ?? 'page', String(page));
      break;
    case 'custom':
      if (source.pageParam) url.searchParams.set(source.pageParam, String(page));
      break;
    default:
      break;
  }
  return url;
}

function toInput(
  source: CatalogueDiscoverySource,
  product: WooStoreProduct,
  observedAt: string,
  responseEvidenceId: string,
): DiscoveryProductInput {
  return { source, product, observedAt, responseEvidenceId };
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#8211;|&ndash;/g, '-')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&[a-zA-Z]+;/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html: string): string | undefined {
  const ogTitle = html.match(/<meta[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]*content\s*=\s*["']([^"']+)["'][^>]*property\s*=\s*["']og:title["']/i)?.[1];
  if (ogTitle) {
    const title = decodeHtmlEntities(ogTitle);
    if (title.length >= 3 && !/home|welcome|search/i.test(title)) return title;
  }
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) {
    const title = decodeHtmlEntities(h1.replace(/<[^>]+>/g, ' '));
    if (title.length >= 3 && !/home|welcome|search/i.test(title)) return title;
  }
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (t) {
    const title = decodeHtmlEntities(t).split(/[|—–-]/)[0].trim();
    if (title.length >= 3 && !/home|welcome|search/i.test(title)) return title;
  }
  return undefined;
}

function extractPriceKobo(text: string): string | undefined {
  const patterns = [
    /₦\s*([\d,]+(?:\.\d{1,2})?)/i,
    /NGN\s*([\d,]+(?:\.\d{1,2})?)/i,
    /price[:\s]*(?:₦|NGN)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:data-)?price(?:-currency)?=["']([\d,]+(?:\.\d{1,2})?)["']/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const raw = match[1].replace(/,/g, '');
      const num = Number(raw);
      if (!Number.isFinite(num) || num <= 0) continue;
      const kobo = Math.round(num * 100);
      if (Number.isSafeInteger(kobo) && kobo > 0) return String(kobo);
    }
  }
  return undefined;
}

function extractImageUrl(html: string, baseHost: string): string | undefined {
  const ogImage = html.match(/<meta[^>]*property\s*=\s*["']og:image["'][^>]*content\s*=\s*["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]*content\s*=\s*["']([^"']+)["'][^>]*property\s*=\s*["']og:image["']/i)?.[1];
  let src = ogImage;
  if (!src) {
    const img = html.match(/<img[^>]*(?:src|data-src)\s*=\s*["'](https:\/\/[^"']+\.(?:jpg|jpeg|png|webp|avif))["']/i)?.[1];
    src = img;
  }
  if (!src) return undefined;
  try {
    if (src.startsWith('//')) src = `https:${src}`;
    const url = new URL(src, `https://${baseHost}`);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function extractProductLinks(html: string, host: string): string[] {
  const base = `https://${host}`;
  const links = new Set<string>();
  const regex = /href\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const raw = match[1].trim();
    try {
      let absolute: string;
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
        absolute = raw;
      } else if (raw.startsWith('//')) {
        absolute = `https:${raw}`;
      } else if (raw.startsWith('/')) {
        absolute = `${base}${raw}`;
      } else if (raw.startsWith('?')) {
        continue;
      } else {
        absolute = `${base}/${raw}`;
      }
      const url = new URL(absolute);
      if (url.protocol !== 'https:') continue;
      if (hostKey(url.hostname) !== hostKey(host)) continue;
      const path = url.pathname.toLowerCase();
      const search = url.search.toLowerCase();
      const isProduct = path.includes('/product/')
        || path.includes('/products/')
        || path.includes('/catalog/product/')
        || (search.includes('product_id') && (search.includes('route=product/product') || search.includes('product/product')))
        || /\.html$/i.test(url.pathname);
      const isNoise = /\/(cart|checkout|account|login|register|search|wishlist|collections?|categories?|tags?|blogs?|pages?)(\/|$)/i.test(path)
        || path === '/';
      if (isProduct && !isNoise) links.add(url.toString());
    } catch {
      // ignore malformed URLs
    }
  }
  return Array.from(links);
}

async function parseProductPage(productUrl: string, id: number): Promise<WooStoreProduct | undefined> {
  try {
    const { text } = await fetchText(new URL(productUrl), htmlAccept);
    const title = extractTitle(text);
    if (!title) return undefined;
    const price = extractPriceKobo(text);
    if (!price) return undefined;
    const image = extractImageUrl(text, new URL(productUrl).hostname);
    const inStock = !/(out\s+of\s+stock|sold\s+out|unavailable)/i.test(text);
    return {
      id,
      name: title,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      permalink: productUrl,
      prices: { price, currency_code: 'NGN', currency_minor_unit: 2 },
      stock_availability: { text: inStock ? 'In stock' : 'Out of stock', class: inStock ? 'in-stock' : 'out-of-stock' },
      is_in_stock: inStock,
      images: image ? [{ src: image }] : [],
    };
  } catch {
    return undefined;
  }
}

async function productsFromHtml(source: CatalogueDiscoverySource, page: number, html: string): Promise<WooStoreProduct[]> {
  const links = extractProductLinks(html, source.host);
  const items = links.slice(0, maxHtmlProductLinks).map((url, index) => ({ url, id: page * 1000 + index + 1 }));
  const products = (await concurrentMap(items, item => parseProductPage(item.url, item.id)))
    .filter((p): p is WooStoreProduct => p != null);
  return products;
}

function fallbackSearchUrl(source: CatalogueDiscoverySource, page: number): URL {
  const searchPath = source.searchPath ?? '/search';
  const searchUrl = new URL(searchPath, `https://${source.host}`);
  const query = source.searchQuery ?? 'skincare';
  if (source.platform === 'magento') {
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('p', String(page));
  } else if (source.platform === 'opencart') {
    searchUrl.searchParams.set('search', query);
    searchUrl.searchParams.set('page', String(page));
  } else {
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set(source.pageParam ?? 'page', String(page));
  }
  return searchUrl;
}

function normalizeShopifyProduct(raw: unknown, source: CatalogueDiscoverySource): WooStoreProduct | undefined {
  if (!objectRecord(raw)) return undefined;
  const id = Number(raw.id);
  if (!Number.isSafeInteger(id) || id <= 0) return undefined;
  const name = typeof raw.title === 'string' ? raw.title : undefined;
  if (!name) return undefined;
  const slug = typeof raw.handle === 'string' ? raw.handle : String(id);
  const variants = Array.isArray(raw.variants) ? (raw.variants as unknown[]) : [];
  const variant = variants[0];
  const variantRecord = objectRecord(variant) ? variant : undefined;
  const priceValue = variantRecord?.price;
  let priceString: string | undefined;
  if (typeof priceValue === 'string') {
    const n = Number(priceValue.replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0) priceString = String(Math.round(n * 100));
  } else if (typeof priceValue === 'number' && priceValue > 0) {
    priceString = String(Math.round(priceValue * 100));
  }
  const sku = typeof variantRecord?.sku === 'string' ? variantRecord.sku : undefined;
  const images = Array.isArray(raw.images)
    ? (raw.images as unknown[]).map(img => {
      const rec = objectRecord(img) ? img : undefined;
      const src = typeof rec?.src === 'string' ? rec.src : undefined;
      return src ? { src } : undefined;
    }).filter((x): x is { src: string } => x != null)
    : [];
  const inStock = variants.some(v => {
    const rec = objectRecord(v) ? v : undefined;
    return (typeof rec?.inventory_quantity === 'number' && (rec.inventory_quantity as number) > 0) || rec?.available === true;
  });
  const productType = typeof raw.product_type === 'string' ? raw.product_type : undefined;
  return {
    id,
    name,
    slug,
    permalink: `https://${source.host}/products/${slug}`,
    ...(sku ? { sku } : {}),
    ...(priceString ? { prices: { price: priceString, currency_code: 'NGN' as const, currency_minor_unit: 2 } } : {}),
    stock_availability: { text: inStock ? 'In stock' : 'Out of stock', class: inStock ? 'in-stock' : 'out-of-stock' },
    is_in_stock: inStock,
    images,
    ...(productType ? { categories: [{ name: productType }] } : {}),
  };
}

function normalizeMagentoProduct(raw: unknown, source: CatalogueDiscoverySource): WooStoreProduct | undefined {
  if (!objectRecord(raw)) return undefined;
  const id = Number(raw.id);
  if (!Number.isSafeInteger(id) || id <= 0) return undefined;
  const name = typeof raw.name === 'string' ? raw.name : undefined;
  if (!name) return undefined;
  const sku = typeof raw.sku === 'string' ? raw.sku : undefined;
  const priceValue = raw.price;
  let priceString: string | undefined;
  if (typeof priceValue === 'number' && priceValue > 0) {
    priceString = String(Math.round(priceValue * 100));
  } else if (typeof priceValue === 'string') {
    const n = Number(priceValue.replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0) priceString = String(Math.round(n * 100));
  }
  let urlKey: string | undefined;
  const attrs = Array.isArray(raw.custom_attributes) ? (raw.custom_attributes as unknown[]) : [];
  for (const attr of attrs) {
    if (!objectRecord(attr)) continue;
    if (attr.attribute_code === 'url_key' && typeof attr.value === 'string') {
      urlKey = attr.value;
    } else if (!urlKey && attr.attribute_code === 'url_path' && typeof attr.value === 'string') {
      urlKey = attr.value;
    }
  }
  const permalink = urlKey ? `https://${source.host}/${urlKey.replace(/^\//, '')}` : `https://${source.host}/product/${id}`;
  const entries = Array.isArray(raw.media_gallery_entries) ? (raw.media_gallery_entries as unknown[]) : [];
  const images = entries.map(entry => {
    const rec = objectRecord(entry) ? entry : undefined;
    const file = typeof rec?.file === 'string' ? rec.file : undefined;
    if (!file) return undefined;
    const src = file.startsWith('http') ? file : `https://${source.host}/media/catalog/product/${file.replace(/^\//, '')}`;
    return { src };
  }).filter((x): x is { src: string } => x != null);
  const status = raw.status;
  const inStock = status === 1 || status === true || status === '1';
  return {
    id,
    name,
    slug: String(id),
    permalink,
    ...(sku ? { sku } : {}),
    ...(priceString ? { prices: { price: priceString, currency_code: 'NGN' as const, currency_minor_unit: 2 } } : {}),
    stock_availability: { text: inStock ? 'In stock' : 'Out of stock', class: inStock ? 'in-stock' : 'out-of-stock' },
    is_in_stock: inStock,
    images,
  };
}

function normalizeOpenCartProduct(raw: unknown, source: CatalogueDiscoverySource): WooStoreProduct | undefined {
  if (!objectRecord(raw)) return undefined;
  const id = Number(raw.product_id ?? raw.id);
  if (!Number.isSafeInteger(id) || id <= 0) return undefined;
  const name = typeof raw.name === 'string' ? raw.name : undefined;
  if (!name) return undefined;
  const sku = typeof raw.sku === 'string' ? raw.sku : undefined;
  const priceValue = raw.price;
  let priceString: string | undefined;
  if (typeof priceValue === 'number' && priceValue > 0) {
    priceString = String(Math.round(priceValue * 100));
  } else if (typeof priceValue === 'string') {
    const n = Number(priceValue.replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0) priceString = String(Math.round(n * 100));
  }
  const seo = typeof raw.seo_url === 'string' ? raw.seo_url : (typeof raw.keyword === 'string' ? raw.keyword : undefined);
  const permalink = seo
    ? `https://${source.host}/${seo.replace(/^\//, '')}`
    : `https://${source.host}/index.php?route=product/product&product_id=${id}`;
  const image = typeof raw.image === 'string' ? raw.image : (typeof raw.thumb === 'string' ? raw.thumb : undefined);
  const images: { src: string }[] = [];
  if (image) {
    const src = image.startsWith('http') ? image : `https://${source.host}/${image.replace(/^\//, '')}`;
    images.push({ src });
  }
  const qty = Number(raw.quantity ?? 0);
  const inStock = Number.isFinite(qty) && qty > 0;
  return {
    id,
    name,
    slug: String(id),
    permalink,
    ...(sku ? { sku } : {}),
    ...(priceString ? { prices: { price: priceString, currency_code: 'NGN' as const, currency_minor_unit: 2 } } : {}),
    stock_availability: { text: inStock ? 'In stock' : 'Out of stock', class: inStock ? 'in-stock' : 'out-of-stock' },
    is_in_stock: inStock,
    images,
  };
}

function pageResultFromProducts(
  source: CatalogueDiscoverySource,
  page: number,
  requestedUrl: URL,
  responseUrl: URL,
  bytes: Buffer,
  products: WooStoreProduct[],
  totalPages: number,
  retrievedAt: string,
): PageResult {
  const evidence = createEvidence(source, page, requestedUrl, responseUrl, bytes, products.length);
  return {
    products: products.map(product => toInput(source, product, retrievedAt, evidence.id)),
    evidence,
    totalPages,
    totalProducts: products.length,
  };
}

async function fetchWooPage(source: CatalogueDiscoverySource, page: number): Promise<PageResult> {
  const requestedUrl = sourcePageUrl(source, page);
  const { text, responseUrl, bytes } = await fetchText(requestedUrl, jsonAccept);
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`${source.retailer} page ${page} did not return a product array.`);
  const products = parsed as WooStoreProduct[];
  const retrievedAt = new Date().toISOString();
  const totalPages = Number(responseUrl.searchParams.get('x-wp-totalpages') ?? (products.length < pageSize ? page : page + 1));
  const totalProducts = Number(responseUrl.searchParams.get('x-wp-total') ?? products.length);
  if (!Number.isSafeInteger(totalPages) || totalPages < page) throw new Error(`${source.retailer} returned an invalid page count.`);
  if (!Number.isSafeInteger(totalProducts) || totalProducts < products.length) throw new Error(`${source.retailer} returned an invalid product count.`);
  return pageResultFromProducts(source, page, requestedUrl, responseUrl, bytes, products, totalPages, retrievedAt);
}

async function fetchShopifyPage(source: CatalogueDiscoverySource, page: number): Promise<PageResult> {
  const requestedUrl = sourcePageUrl(source, page);
  try {
    const { text, responseUrl, bytes } = await fetchText(requestedUrl, jsonAccept);
    const json = JSON.parse(text) as unknown;
    const rawProducts = Array.isArray(json) ? json : (objectRecord(json) && Array.isArray(json.products) ? json.products : undefined);
    if (!Array.isArray(rawProducts)) throw new Error('Shopify response did not contain a product array.');
    const products = rawProducts.map(p => normalizeShopifyProduct(p, source)).filter((p): p is WooStoreProduct => p != null);
    const retrievedAt = new Date().toISOString();
    const totalPages = products.length < 250 ? page : page + 1;
    return pageResultFromProducts(source, page, requestedUrl, responseUrl, bytes, products, totalPages, retrievedAt);
  } catch (error) {
    const searchUrl = fallbackSearchUrl(source, page);
    const { text, responseUrl, bytes } = await fetchText(searchUrl, htmlAccept);
    const products = await productsFromHtml(source, page, text);
    const retrievedAt = new Date().toISOString();
    return pageResultFromProducts(source, page, searchUrl, responseUrl, bytes, products, 1, retrievedAt);
  }
}

async function fetchMagentoPage(source: CatalogueDiscoverySource, page: number): Promise<PageResult> {
  const requestedUrl = sourcePageUrl(source, page);
  try {
    const { text, responseUrl, bytes } = await fetchText(requestedUrl, jsonAccept);
    const json = JSON.parse(text) as unknown;
    const items = objectRecord(json) && Array.isArray(json.items) ? json.items : undefined;
    if (!Array.isArray(items)) throw new Error('Magento response did not contain an items array.');
    const products = items.map(p => normalizeMagentoProduct(p, source)).filter((p): p is WooStoreProduct => p != null);
    const retrievedAt = new Date().toISOString();
    const totalPages = products.length < 100 ? page : page + 1;
    return pageResultFromProducts(source, page, requestedUrl, responseUrl, bytes, products, totalPages, retrievedAt);
  } catch (error) {
    const searchUrl = fallbackSearchUrl(source, page);
    const { text, responseUrl, bytes } = await fetchText(searchUrl, htmlAccept);
    const products = await productsFromHtml(source, page, text);
    const retrievedAt = new Date().toISOString();
    return pageResultFromProducts(source, page, searchUrl, responseUrl, bytes, products, 1, retrievedAt);
  }
}

async function fetchOpenCartPage(source: CatalogueDiscoverySource, page: number): Promise<PageResult> {
  const requestedUrl = sourcePageUrl(source, page);
  try {
    const { text, responseUrl, bytes } = await fetchText(requestedUrl, jsonAccept);
    const json = JSON.parse(text) as unknown;
    const rawProducts = Array.isArray(json) ? json : (objectRecord(json) && Array.isArray(json.products) ? json.products : undefined);
    if (!Array.isArray(rawProducts)) throw new Error('OpenCart response did not contain a product array.');
    const products = rawProducts.map(p => normalizeOpenCartProduct(p, source)).filter((p): p is WooStoreProduct => p != null);
    const retrievedAt = new Date().toISOString();
    const totalPages = products.length < pageSize ? page : page + 1;
    return pageResultFromProducts(source, page, requestedUrl, responseUrl, bytes, products, totalPages, retrievedAt);
  } catch (error) {
    const searchUrl = fallbackSearchUrl(source, page);
    const { text, responseUrl, bytes } = await fetchText(searchUrl, htmlAccept);
    const products = await productsFromHtml(source, page, text);
    const retrievedAt = new Date().toISOString();
    return pageResultFromProducts(source, page, searchUrl, responseUrl, bytes, products, 1, retrievedAt);
  }
}

async function fetchCustomPage(source: CatalogueDiscoverySource, page: number): Promise<PageResult> {
  const requestedUrl = sourcePageUrl(source, page);
  const { text, responseUrl, bytes } = await fetchText(requestedUrl, htmlAccept);
  const products = await productsFromHtml(source, page, text);
  const retrievedAt = new Date().toISOString();
  return pageResultFromProducts(source, page, requestedUrl, responseUrl, bytes, products, 1, retrievedAt);
}

function errorPageResult(source: CatalogueDiscoverySource, page: number, error: unknown): PageResult {
  const requestedUrl = sourcePageUrl(source, page);
  const message = error instanceof Error ? error.message : String(error);
  const bytes = Buffer.from(message, 'utf8');
  const evidence = createEvidence(source, page, requestedUrl, requestedUrl, bytes, 0);
  return { products: [], evidence, totalPages: 1, totalProducts: 0 };
}

async function fetchPage(source: CatalogueDiscoverySource, page: number): Promise<PageResult> {
  try {
    switch (source.platform) {
      case 'woocommerce':
        return await fetchWooPage(source, page);
      case 'shopify':
        return await fetchShopifyPage(source, page);
      case 'magento':
        return await fetchMagentoPage(source, page);
      case 'opencart':
        return await fetchOpenCartPage(source, page);
      case 'custom':
        return await fetchCustomPage(source, page);
      default:
        return errorPageResult(source, page, new Error(`Unknown platform ${(source as CatalogueDiscoverySource).platform}`));
    }
  } catch (error) {
    return errorPageResult(source, page, error);
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
    ? await resolveDirectDataJson(repositoryRoot, output, '--write')
    : undefined;
  const baselinePath = baseline
    ? await resolveDirectDataJson(repositoryRoot, baseline, '--baseline')
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
    await writeDirectDataJsonAtomically(
      outputPath!,
      `${JSON.stringify(snapshot, null, 2)}\n`,
    );
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
