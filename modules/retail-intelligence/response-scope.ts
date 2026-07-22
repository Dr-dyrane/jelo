const ignoredTitleWords = new Set([
  'and', 'for', 'with', 'the', 'from', 'skin', 'hair', 'face', 'new', 'version', 'pack',
  'to', 'of', 'in', 'on', 'by', 'or', 'at',
]);

const equivalentTitleTokens: Record<string, string> = {
  moisturiser: 'moisturizer',
  moisturising: 'moisturizing',
};

function hostKey(url: URL) {
  return url.hostname.toLowerCase().replace(/^www\./, '');
}

function pathKey(url: URL) {
  const path = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
  return path.toLowerCase();
}

function sameProductRoute(left: URL, right: URL) {
  return hostKey(left) === hostKey(right) && pathKey(left) === pathKey(right);
}

function titleTokens(value: string) {
  return Array.from(new Set(value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .split(' ')
    .map(token => equivalentTitleTokens[token] ?? token)
    .filter(token => (token.length >= 2 || /^\d+$/.test(token)) && !ignoredTitleWords.has(token))));
}

function titleMatches(expected: string, observed: string) {
  const expectedTokens = titleTokens(expected);
  const observedTokens = new Set(titleTokens(observed));
  return expectedTokens.length > 0 && expectedTokens.every(token => observedTokens.has(token));
}

type Measurement = { dimension: 'mass' | 'volume'; baseValue: number };

function sizes(value: string): Measurement[] {
  const matches = value.toLowerCase().matchAll(
    /\b(\d+(?:[.,]\d+)?)\s*((?:fl(?:uid)?\.?\s*)?oz\.?|millilit(?:er|re)s?|ml|centilit(?:er|re)s?|cl|lit(?:er|re)s?|l|milligrams?|mg|kilograms?|kg|grams?|g)\b/g,
  );
  const measurements: Measurement[] = [];
  for (const match of matches) {
    const amount = Number(match[1].replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const unit = match[2].replace(/[.\s]/g, '');

    if (unit === 'ml' || unit.startsWith('millilit')) measurements.push({ dimension: 'volume', baseValue: amount });
    else if (unit === 'cl' || unit.startsWith('centilit')) measurements.push({ dimension: 'volume', baseValue: amount * 10 });
    else if (unit === 'l' || unit.startsWith('lit')) measurements.push({ dimension: 'volume', baseValue: amount * 1_000 });
    else if (unit === 'floz' || unit === 'fluidoz') measurements.push({ dimension: 'volume', baseValue: amount * 29.5735 });
    else if (unit === 'mg' || unit.startsWith('milligram')) measurements.push({ dimension: 'mass', baseValue: amount / 1_000 });
    else if (unit === 'kg' || unit.startsWith('kilogram')) measurements.push({ dimension: 'mass', baseValue: amount * 1_000 });
    else if (unit === 'g' || unit.startsWith('gram')) measurements.push({ dimension: 'mass', baseValue: amount });
    else if (unit === 'oz') measurements.push({ dimension: 'mass', baseValue: amount * 28.3495 });
  }
  return measurements;
}

function sameSize(expected: Measurement, observed: Measurement) {
  if (expected.dimension !== observed.dimension) return false;
  const difference = Math.abs(expected.baseValue - observed.baseValue);
  return difference <= Math.max(expected.baseValue, observed.baseValue) * 0.03;
}

export type RetailerResponseScope = {
  requestedUrl: string;
  responseUrl: string;
  canonicalUrl?: string;
  expectedTitle: string;
  expectedSize: string;
  observedTitle?: string;
  observedSize?: string;
  marketCode: string;
  currencyCode?: string | null;
};

export function assertRetailerResponseScope(input: RetailerResponseScope) {
  const requested = new URL(input.requestedUrl);
  const response = new URL(input.responseUrl);
  if (!sameProductRoute(requested, response)) {
    throw new Error('Retailer redirected away from the verified product route.');
  }

  if (input.canonicalUrl) {
    const canonical = new URL(input.canonicalUrl);
    if (!sameProductRoute(response, canonical)) {
      throw new Error('Retailer canonical URL does not match the verified product route.');
    }
  }

  if (!input.observedTitle?.trim()) {
    throw new Error('Retailer product title evidence is missing.');
  }
  if (!titleMatches(input.expectedTitle, input.observedTitle)) {
    throw new Error('Retailer product title does not match the catalogue product.');
  }

  if (!input.observedSize?.trim()) {
    throw new Error('Retailer product size evidence is missing.');
  }
  const expectedSizes = sizes(input.expectedSize);
  if (!expectedSizes.length) {
    throw new Error('Catalogue product size cannot be verified against retailer evidence.');
  }
  const observedSizes = sizes(input.observedSize);
  if (!observedSizes.length) {
    throw new Error('Retailer product size evidence is not measurable.');
  }
  if (!expectedSizes.some(expected => observedSizes.some(observed => sameSize(expected, observed)))) {
    throw new Error('Retailer product size does not match the catalogue product.');
  }

  const expectedCurrency = input.marketCode === 'NG' ? 'NGN' : input.marketCode === 'US' ? 'USD' : undefined;
  if (input.currencyCode && expectedCurrency && input.currencyCode !== expectedCurrency) {
    throw new Error(`Retailer currency does not match the ${input.marketCode} market.`);
  }
}
