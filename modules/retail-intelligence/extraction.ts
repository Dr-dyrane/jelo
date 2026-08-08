import { priceAmountToStorageInteger } from '@/lib/inventory/price-storage';

export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';

export type RetailerExtraction = {
  inventoryStatus: InventoryStatus;
  priceMinor: number | null;
  currencyCode: string | null;
  productTitle?: string;
  productSize?: string;
  canonicalUrl?: string;
  evidence: string[];
  confidence: number;
};

export interface RetailerAdapter {
  key: string;
  matches(url: URL): boolean;
  extract(input: { url: URL; html: string }): RetailerExtraction;
}

type JsonObject = Record<string, unknown>;
type ExtractionConfig = {
  key: string;
  hosts: string[];
  defaultCurrency?: string;
  platform?: 'woocommerce' | 'structured' | 'shopify';
};

const PRICE_KEYS = ['price', 'lowPrice'] as const;
const PRODUCT_SIZE_PATTERN = /\b\d+(?:[.,]\d+)?\s*(?:(?:fl(?:uid)?\.?\s*)?oz\.?|millilit(?:er|re)s?|ml|centilit(?:er|re)s?|cl|lit(?:er|re)s?|l|milligrams?|mg|kilograms?|kg|grams?|g)\b/gi;
const STRUCTURED_UNIT_CODES: Record<string, string> = {
  CLT: 'cl',
  GRM: 'g',
  KGM: 'kg',
  LTR: 'l',
  MGM: 'mg',
  MLT: 'ml',
  ONZ: 'oz',
  OZA: 'fl oz',
};

function asObject(value: unknown): JsonObject | undefined {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : undefined;
}

function valuesDeep(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(valuesDeep);
  const object = asObject(value);
  return object ? [object, ...Object.values(object).flatMap(valuesDeep)] : [];
}

function hasType(value: unknown, expected: string) {
  const types = Array.isArray(value) ? value : [value];
  return types.some(type => typeof type === 'string' && type.toLowerCase().endsWith(expected.toLowerCase()));
}

function decodeHtml(value: string) {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, value: string) => String.fromCodePoint(Number.parseInt(value, 16)))
    .replace(/&#(\d+);/g, (_, value: string) => String.fromCodePoint(Number.parseInt(value, 10)))
    .trim();
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
}

function sizeText(value: string) {
  const matches = stripTags(value).match(PRODUCT_SIZE_PATTERN);
  return matches?.map(match => match.replace(/\s+/g, ' ').trim()).join(' / ');
}

function singleSizeText(value?: string) {
  if (!value) return undefined;
  const matches = stripTags(value).match(PRODUCT_SIZE_PATTERN)
    ?.map(match => match.replace(/\s+/g, ' ').trim());
  if (!matches?.length) return undefined;
  const uniqueMatches = new Set(matches.map(match => match.toLowerCase()));
  return uniqueMatches.size === 1 ? matches[0] : undefined;
}

function quantitativeSize(value: unknown): string | undefined {
  if (typeof value === 'string') return sizeText(value);
  if (Array.isArray(value)) {
    for (const candidate of value) {
      const extracted = quantitativeSize(candidate);
      if (extracted) return extracted;
    }
    return undefined;
  }

  const object = asObject(value);
  if (!object) return undefined;
  const amount = typeof object.value === 'number' || typeof object.value === 'string'
    ? String(object.value).trim()
    : undefined;
  const rawUnit = typeof object.unitText === 'string'
    ? object.unitText.trim()
    : typeof object.unitCode === 'string'
      ? (STRUCTURED_UNIT_CODES[object.unitCode.toUpperCase()] ?? object.unitCode.trim())
      : undefined;
  if (amount && rawUnit) return sizeText(`${amount} ${rawUnit}`);

  return undefined;
}

function explicitlyNetWeight(value: unknown) {
  if (typeof value === 'string') {
    return /\bnet\s+(?:content|weight|quantity)\b/i.test(value) ? quantitativeSize(value) : undefined;
  }
  const object = asObject(value);
  if (!object) return undefined;
  const semanticLabel = [object.name, object.description, object.propertyID]
    .filter((candidate): candidate is string => typeof candidate === 'string')
    .join(' ')
    .toLowerCase();
  if (!/\bnet\s+(?:content|weight|quantity)\b/.test(semanticLabel)) return undefined;
  return quantitativeSize(object);
}

function explicitStructuredProductSize(product?: JsonObject) {
  if (!product) return undefined;
  for (const candidate of [product.netContent, product.size]) {
    const extracted = quantitativeSize(candidate);
    if (extracted) return extracted;
  }

  for (const property of valuesDeep(product.additionalProperty).map(asObject)) {
    if (!property) continue;
    const name = typeof property.name === 'string' ? property.name.toLowerCase() : '';
    if (!/\b(?:size|volume|net\s+(?:content|weight|volume|quantity))\b/.test(name)) continue;
    const extracted = quantitativeSize(property.valueReference ?? property.value);
    if (extracted) return extracted;
  }
}

function semanticallyNetProductWeight(product?: JsonObject) {
  if (!product) return undefined;
  return quantitativeSize(product.netWeight) ?? explicitlyNetWeight(product.weight);
}

function attributes(tag: string) {
  const result: Record<string, string> = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) {
    result[match[1].toLowerCase()] = decodeHtml(match[3]);
  }
  return result;
}

function metaContent(html: string, names: string[]) {
  const wanted = new Set(names.map(name => name.toLowerCase()));
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (wanted.has((attrs.property ?? attrs.name ?? attrs.itemprop ?? '').toLowerCase()) && attrs.content) {
      return attrs.content;
    }
  }
}

function canonicalUrl(html: string, pageUrl: URL) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (attrs.rel?.toLowerCase() !== 'canonical' || !attrs.href) continue;
    try {
      const canonical = new URL(attrs.href, pageUrl);
      if (!['http:', 'https:'].includes(canonical.protocol) || canonical.hostname !== pageUrl.hostname) return undefined;
      canonical.hash = '';
      canonical.search = '';
      return canonical.toString();
    } catch {
      return undefined;
    }
  }
}

function parseJsonLd(html: string) {
  const parsed: unknown[] = [];
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      parsed.push(JSON.parse(decodeHtml(match[2])));
    } catch {
      // A malformed retailer block must not prevent safer extraction paths.
    }
  }
  return parsed;
}

function normalizeCurrency(value: unknown, fallback?: string) {
  const currency = typeof value === 'string' ? value.toUpperCase() : fallback?.toUpperCase();
  return currency && /^[A-Z]{3}$/.test(currency) ? currency : null;
}

function normalizePrice(value: unknown, currencyCode: string | null) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const amount = Number(String(value).replace(/[^0-9.,]/g, '').replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0 || !currencyCode) return null;

  // Existing JeloCare NGN records use whole Naira; other currencies use minor units.
  return priceAmountToStorageInteger(amount, currencyCode);
}

function availabilityStatus(value: unknown): InventoryStatus {
  if (typeof value !== 'string') return 'unknown';
  const normalized = value.toLowerCase().replace(/[^a-z]/g, '');
  if (normalized.endsWith('outofstock') || normalized.endsWith('soldout') || normalized.endsWith('discontinued')) return 'out_of_stock';
  if (normalized.endsWith('limitedavailability') || normalized.endsWith('lowstock')) return 'low_stock';
  if (normalized.endsWith('instock') || normalized.endsWith('onlineonly') || normalized.endsWith('preorder')) return 'in_stock';
  return 'unknown';
}

function structuredProduct(html: string) {
  const nodes = parseJsonLd(html).flatMap(valuesDeep).map(asObject).filter((node): node is JsonObject => Boolean(node));
  const product = nodes.find(node => hasType(node['@type'], 'product'));
  if (!product) return undefined;

  const offerCandidates = valuesDeep(product.offers).map(asObject).filter((offer): offer is JsonObject => Boolean(offer));
  const offer = offerCandidates.find(candidate => hasType(candidate['@type'], 'offer')) ?? offerCandidates[0];
  return { product, offer };
}

function structuredPrice(offer: JsonObject | undefined, defaultCurrency?: string) {
  if (!offer) return { priceMinor: null, currencyCode: null };
  const candidates = [offer, ...valuesDeep(offer.priceSpecification).map(asObject).filter((value): value is JsonObject => Boolean(value))];
  for (const candidate of candidates) {
    const currencyCode = normalizeCurrency(candidate.priceCurrency ?? offer.priceCurrency, defaultCurrency);
    for (const key of PRICE_KEYS) {
      const priceMinor = normalizePrice(candidate[key], currencyCode);
      if (priceMinor != null) return { priceMinor, currencyCode };
    }
  }
  return { priceMinor: null, currencyCode: normalizeCurrency(offer.priceCurrency, defaultCurrency) };
}

function productStockMarker(html: string): InventoryStatus {
  for (const match of html.matchAll(/<(?:p|div|span)\b[^>]*class\s*=\s*(["'])([^"']*\bstock\b[^"']*)\1[^>]*>([\s\S]*?)<\/(?:p|div|span)>/gi)) {
    const classes = match[2].toLowerCase();
    const content = stripTags(match[3]).toLowerCase();
    if (classes.includes('out-of-stock') || /\bout\s+of\s+stock\b|\bsold\s+out\b/.test(content)) return 'out_of_stock';
    if (classes.includes('low-stock') || /\bonly\s+\d+\s+left\b|\blow\s+stock\b/.test(content)) return 'low_stock';
    if (classes.includes('in-stock') || /\bin\s+stock\b/.test(content)) return 'in_stock';
  }
  return 'unknown';
}

function woocommerceProductPrice(html: string, defaultCurrency?: string) {
  const title = html.match(/<h1\b[^>]*class\s*=\s*(["'])[^"']*\bproduct_title\b[^"']*\1[^>]*>[\s\S]*?<\/h1>/i);
  if (title?.index == null) return { priceMinor: null, currencyCode: null };
  const productSummary = html.slice(title.index + title[0].length, title.index + title[0].length + 20_000);
  const price = productSummary.match(/<p\b[^>]*class\s*=\s*(["'])[^"']*\bprice\b[^"']*\1[^>]*>([\s\S]*?)<\/p>/i)?.[2];
  if (!price) return { priceMinor: null, currencyCode: null };

  const currentPrice = price.match(/<ins\b[^>]*>([\s\S]*?)<\/ins>/i)?.[1] ?? price;
  const amountTexts = Array.from(currentPrice.matchAll(/<bdi\b[^>]*>([\s\S]*?)<\/bdi>/gi))
    .map(match => stripTags(match[1]))
    .filter(Boolean);
  if (amountTexts.length > 1) return { priceMinor: null, currencyCode: null };
  const priceText = amountTexts[0] ?? stripTags(currentPrice);
  const currencyCode = normalizeCurrency(
    priceText.includes('₦') || /(?:^|\s)NG(?:\s|$)/i.test(priceText) ? 'NGN' : undefined,
    defaultCurrency,
  );
  return { priceMinor: normalizePrice(priceText, currencyCode), currencyCode };
}

function productTitle(html: string, product?: JsonObject) {
  if (typeof product?.name === 'string' && product.name.trim()) return stripTags(product.name);
  const metaTitle = metaContent(html, ['og:title']);
  if (metaTitle) return stripTags(metaTitle);
  const heading = html.match(/<h1\b[^>]*class\s*=\s*(["'])[^"']*\bproduct_title\b[^"']*\1[^>]*>([\s\S]*?)<\/h1>/i)?.[2];
  return heading ? stripTags(heading) : undefined;
}

function extractDocument(input: { url: URL; html: string }, config?: ExtractionConfig): RetailerExtraction {
  const evidence: string[] = [];
  const structured = structuredProduct(input.html);
  if (structured) evidence.push('JSON-LD Product');

  let { priceMinor, currencyCode } = structuredPrice(structured?.offer, config?.defaultCurrency);
  if (priceMinor != null) evidence.push('JSON-LD Offer price');

  let inventoryStatus = availabilityStatus(structured?.offer?.availability);
  if (inventoryStatus !== 'unknown') evidence.push('JSON-LD Offer availability');

  if (priceMinor == null) {
    const amount = metaContent(input.html, ['product:price:amount', 'price']);
    currencyCode = normalizeCurrency(
      metaContent(input.html, ['product:price:currency', 'priceCurrency']),
      config?.defaultCurrency,
    );
    priceMinor = normalizePrice(amount, currencyCode);
    if (priceMinor != null) evidence.push('Product price metadata');
  }

  if (priceMinor == null && config?.platform === 'woocommerce') {
    const wooCommercePrice = woocommerceProductPrice(input.html, config.defaultCurrency);
    priceMinor = wooCommercePrice.priceMinor;
    currencyCode = wooCommercePrice.currencyCode;
    if (priceMinor != null) evidence.push('WooCommerce product price');
  }

  // Shopify stores emit NGN JSON-LD prices in kobo (×100). Detect and correct
  // by checking if the extracted NGN price is divisible by 100 and large enough
  // that dividing by 100 still yields a reasonable product price (≥ ₦1,000).
  // A legitimate ₦145,000 price (145000) would not trigger this, but the kobo
  // equivalent (14,500,000) would: 14,500,000 / 100 = 145,000.
  if (config?.platform === 'shopify' && priceMinor != null && currencyCode === 'NGN' && priceMinor >= 1_000_000 && priceMinor % 100 === 0) {
    priceMinor = Math.round(priceMinor / 100);
    evidence.push('Shopify kobo-to-naira correction');
  }

  if (inventoryStatus === 'unknown' && config?.platform === 'woocommerce') {
    inventoryStatus = productStockMarker(input.html);
    if (inventoryStatus !== 'unknown') evidence.push('WooCommerce product stock marker');
  }

  const title = productTitle(input.html, structured?.product);
  if (title) evidence.push('Product title');
  const structuredSize = explicitStructuredProductSize(structured?.product);
  const titleSize = title ? sizeText(title) : undefined;
  const netWeight = semanticallyNetProductWeight(structured?.product);
  const imageAltSize = singleSizeText(metaContent(input.html, ['og:image:alt']));
  const descriptionSize = singleSizeText(metaContent(input.html, ['description']));
  const routeSize = singleSizeText(decodeURIComponent(input.url.pathname).replace(/[-_]+/g, ' '));
  const observedSize = structuredSize ?? titleSize ?? netWeight ?? imageAltSize ?? descriptionSize ?? routeSize;
  const observedSizeEvidence = structuredSize
    ? 'JSON-LD Product size'
    : titleSize
      ? 'Product title size'
      : netWeight
        ? 'JSON-LD Product size'
        : imageAltSize
          ? 'Open Graph product image size'
          : descriptionSize
            ? 'Product description size'
            : routeSize
              ? 'Product route size'
              : undefined;
  if (observedSizeEvidence) evidence.push(observedSizeEvidence);
  const canonical = canonicalUrl(input.html, input.url);
  if (canonical) evidence.push('Canonical product URL');

  let confidence = config ? 10 : 0;
  if (structured) confidence += 15;
  if (priceMinor != null) confidence += evidence.includes('JSON-LD Offer price') ? 25 : 18;
  if (inventoryStatus !== 'unknown') confidence += evidence.includes('JSON-LD Offer availability') ? 35 : 25;
  if (title) confidence += 5;
  if (observedSize) confidence += 5;
  if (canonical) confidence += 5;
  if (priceMinor != null && inventoryStatus !== 'unknown') confidence += 5;

  return {
    inventoryStatus,
    priceMinor,
    currencyCode,
    productTitle: title,
    productSize: observedSize,
    canonicalUrl: canonical,
    evidence,
    confidence: Math.min(confidence, 100),
  };
}

function configuredAdapter(config: ExtractionConfig): RetailerAdapter {
  return {
    key: config.key,
    matches: url => config.hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)),
    extract: input => extractDocument(input, config),
  };
}

export const retailerAdapters: RetailerAdapter[] = [
  configuredAdapter({ key: 'beauty-by-daz', hosts: ['beautybydaz.com'], defaultCurrency: 'NGN', platform: 'woocommerce' }),
  configuredAdapter({ key: 'lux-beauty-ng', hosts: ['luxbeautyng.com'], defaultCurrency: 'NGN', platform: 'woocommerce' }),
  configuredAdapter({ key: 'teeka4', hosts: ['teeka4.com'], defaultCurrency: 'NGN', platform: 'woocommerce' }),
  configuredAdapter({ key: 'perona-beauty', hosts: ['peronabeauty.com'], defaultCurrency: 'NGN', platform: 'woocommerce' }),
  configuredAdapter({ key: 'buybetter', hosts: ['buybetter.ng'], defaultCurrency: 'NGN', platform: 'woocommerce' }),
  configuredAdapter({ key: 'deoset', hosts: ['deoset.com'], defaultCurrency: 'NGN', platform: 'woocommerce' }),
  configuredAdapter({ key: 'rhema-beauty-shop', hosts: ['rhemabeautyshop.com'], defaultCurrency: 'NGN', platform: 'woocommerce' }),
  configuredAdapter({ key: 'tos-nigeria', hosts: ['tosnigeria.com'], defaultCurrency: 'NGN', platform: 'woocommerce' }),
  configuredAdapter({ key: 'the-beauty-prism', hosts: ['thebeautyprismng.com'], defaultCurrency: 'NGN', platform: 'woocommerce' }),
  configuredAdapter({ key: 'sonavine-beauty', hosts: ['sonavinebeauty.com'], defaultCurrency: 'NGN', platform: 'woocommerce' }),
  configuredAdapter({ key: 'kadimez-essentials', hosts: ['kadimezessentials.com'], defaultCurrency: 'NGN', platform: 'woocommerce' }),
  configuredAdapter({ key: 'dunes-center', hosts: ['dunescenter.com'], defaultCurrency: 'NGN', platform: 'woocommerce' }),
  configuredAdapter({ key: 'slique-beauty', hosts: ['sliquebeautylimited.com'], defaultCurrency: 'NGN', platform: 'woocommerce' }),
  configuredAdapter({ key: 'makeupalley-ng', hosts: ['makeupalleyng.com'], defaultCurrency: 'NGN', platform: 'woocommerce' }),
  configuredAdapter({ key: 'care-to-beauty', hosts: ['caretobeauty.com'], platform: 'structured' }),
  // Shopify-based NG retailers: JSON-LD prices arrive in kobo (minor units)
  configuredAdapter({ key: 'my-skin-hub-ng', hosts: ['myskinhubng.com'], defaultCurrency: 'NGN', platform: 'shopify' }),
  configuredAdapter({ key: 'skincare-plug-ng', hosts: ['skincareplugng.com'], defaultCurrency: 'NGN', platform: 'shopify' }),
  configuredAdapter({ key: 'essentials-hub', hosts: ['essentialshub.com'], defaultCurrency: 'NGN', platform: 'shopify' }),
  configuredAdapter({ key: 'medplus', hosts: ['medplusnig.com'], defaultCurrency: 'NGN', platform: 'structured' }),
];

const genericAdapter: RetailerAdapter = {
  key: 'structured-generic',
  matches: () => true,
  extract: input => extractDocument(input),
};

export function extractRetailerPage(input: { url: URL; html: string }) {
  const adapter = retailerAdapters.find(candidate => candidate.matches(input.url)) ?? genericAdapter;
  return { adapterKey: adapter.key, extraction: adapter.extract(input) };
}
