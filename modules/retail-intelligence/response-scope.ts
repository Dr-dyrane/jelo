const ignoredTitleWords = new Set([
  'and', 'for', 'with', 'the', 'from', 'skin', 'hair', 'face', 'new', 'version', 'pack',
]);

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
    .split(' ')
    .filter(token => token.length >= 3 && !ignoredTitleWords.has(token))));
}

function titleMatches(expected: string, observed: string) {
  const expectedTokens = titleTokens(expected);
  const observedTokens = new Set(titleTokens(observed));
  const overlap = expectedTokens.filter(token => observedTokens.has(token)).length;
  return overlap >= Math.min(2, expectedTokens.length);
}

function sizes(value: string) {
  return Array.from(value.toLowerCase().matchAll(/\b\d+(?:\.\d+)?\s*(?:fl\s*)?(?:ml|g|oz)\b/g))
    .map(match => match[0].replace(/\s+/g, ''));
}

export type RetailerResponseScope = {
  requestedUrl: string;
  responseUrl: string;
  canonicalUrl?: string;
  expectedTitle: string;
  expectedSize: string;
  observedTitle?: string;
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

  if (input.observedTitle) {
    if (!titleMatches(input.expectedTitle, input.observedTitle)) {
      throw new Error('Retailer product title does not match the catalogue product.');
    }

    const expectedSizes = sizes(input.expectedSize);
    const observedSizes = sizes(input.observedTitle);
    if (expectedSizes.length && observedSizes.length && !expectedSizes.some(size => observedSizes.includes(size))) {
      throw new Error('Retailer product size does not match the catalogue product.');
    }
  }

  const expectedCurrency = input.marketCode === 'NG' ? 'NGN' : input.marketCode === 'US' ? 'USD' : undefined;
  if (input.currencyCode && expectedCurrency && input.currencyCode !== expectedCurrency) {
    throw new Error(`Retailer currency does not match the ${input.marketCode} market.`);
  }
}
