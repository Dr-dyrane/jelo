export const catalogueTransitionStorageKey = 'jelocare:catalogue-transition:v1';

export const catalogueFilterKeys = [
  'q',
  'category',
  'review',
  'sort',
  'concern',
  'step',
  'brand',
  'availability',
  'price',
  'market',
] as const;

export type CatalogueFilterKey = typeof catalogueFilterKeys[number];
export type CatalogueTransitionKind = 'filter' | 'clear' | 'undo';

export type CatalogueTransition = {
  version: 1;
  from: string;
  to: string;
  kind: CatalogueTransitionKind;
  changedKeys: CatalogueFilterKey[];
  createdAt: number;
};

export type CompanyFacet = { value: string; count: number };

export type CatalogueConcern = {
  slug: string;
  name: string;
  summary: string;
  signals: string[];
  productTerms: string[];
};

const defaultOrigin = 'https://jelocare.local';
const transitionLifetimeMs = 15 * 60 * 1_000;
const visibleFilterKeys = catalogueFilterKeys.filter(key => key !== 'market');
const defaultValues: Partial<Record<CatalogueFilterKey, string>> = {
  category: 'all',
  review: 'all',
  sort: 'featured',
  availability: 'all',
  price: 'all',
  market: 'ng',
};

function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseUrl(value: string | URL, base = defaultOrigin) {
  try {
    return value instanceof URL ? new URL(value.href) : new URL(value, base);
  } catch {
    return null;
  }
}

function relativeLocation(url: URL) {
  const entries = [...url.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue),
  );
  const query = new URLSearchParams();
  for (const [key, value] of entries) query.append(key, value);
  const suffix = query.toString();
  return suffix ? `/products?${suffix}` : '/products';
}

export function canonicalCatalogueLocation(value: string | URL) {
  const url = parseUrl(value);
  if (!url || url.pathname !== '/products') return null;
  return relativeLocation(url);
}

export function catalogueMarketHref(value: string | URL, market: 'NG' | 'US') {
  const url = parseUrl(value);
  if (!url || url.pathname !== '/products') return null;
  url.searchParams.delete('page');
  if (market === 'US') url.searchParams.set('market', 'US');
  else url.searchParams.delete('market');
  return `${relativeLocation(url)}#all-products`;
}

function filterSnapshot(url: URL) {
  const snapshot = new Map<CatalogueFilterKey, string>();
  for (const key of catalogueFilterKeys) {
    const value = normalize(url.searchParams.get(key) ?? '');
    if (value && value !== defaultValues[key]) snapshot.set(key, value);
  }
  return snapshot;
}

export function diffCatalogueFilters(fromValue: string | URL, toValue: string | URL) {
  const from = parseUrl(fromValue);
  const to = parseUrl(toValue, from?.origin ?? defaultOrigin);
  if (!from || !to || from.pathname !== '/products' || to.pathname !== '/products' || from.origin !== to.origin) return [];
  const before = filterSnapshot(from);
  const after = filterSnapshot(to);
  return catalogueFilterKeys.filter(key => before.get(key) !== after.get(key));
}

export function createCatalogueTransition(
  fromValue: string | URL,
  toValue: string | URL,
  requestedKind?: CatalogueTransitionKind,
  createdAt = Date.now(),
): CatalogueTransition | null {
  const from = parseUrl(fromValue);
  const to = parseUrl(toValue, from?.origin ?? defaultOrigin);
  if (!from || !to || from.pathname !== '/products' || to.pathname !== '/products' || from.origin !== to.origin) return null;
  const changedKeys = diffCatalogueFilters(from, to);
  if (!changedKeys.length) return null;
  const after = filterSnapshot(to);
  const hasVisibleFilter = visibleFilterKeys.some(key => after.has(key));
  const kind = requestedKind ?? (hasVisibleFilter ? 'filter' : 'clear');
  return {
    version: 1,
    from: relativeLocation(from),
    to: relativeLocation(to),
    kind,
    changedKeys,
    createdAt,
  };
}

export function parseCatalogueTransition(raw: string | null, currentValue: string | URL, now = Date.now()) {
  if (!raw || raw.length > 4_096) return null;
  const current = parseUrl(currentValue);
  if (!current || current.pathname !== '/products') return null;
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!candidate || typeof candidate !== 'object') return null;
  const record = candidate as Partial<CatalogueTransition>;
  if (record.version !== 1 || !['filter', 'clear', 'undo'].includes(record.kind ?? '')) return null;
  if (typeof record.from !== 'string' || typeof record.to !== 'string' || typeof record.createdAt !== 'number') return null;
  if (!Number.isFinite(record.createdAt) || record.createdAt > now + 60_000 || now - record.createdAt > transitionLifetimeMs) return null;
  if (!Array.isArray(record.changedKeys) || !record.changedKeys.length || record.changedKeys.some(key => !catalogueFilterKeys.includes(key))) return null;
  const from = parseUrl(record.from, current.origin);
  const to = parseUrl(record.to, current.origin);
  if (!from || !to || from.origin !== current.origin || to.origin !== current.origin || from.pathname !== '/products' || to.pathname !== '/products') return null;
  if (relativeLocation(to) !== relativeLocation(current)) return null;
  const actualKeys = diffCatalogueFilters(from, to);
  if (!actualKeys.length || actualKeys.length !== record.changedKeys.length || actualKeys.some(key => !record.changedKeys?.includes(key))) return null;
  return {
    version: 1,
    from: relativeLocation(from),
    to: relativeLocation(to),
    kind: record.kind as CatalogueTransitionKind,
    changedKeys: actualKeys,
    createdAt: record.createdAt,
  } satisfies CatalogueTransition;
}

export function catalogueTransitionMessage(transition: CatalogueTransition | null) {
  if (transition?.kind === 'undo') return 'Last change undone.';
  if (transition?.kind === 'clear') return 'Filters cleared.';
  if (transition?.changedKeys.length === 1 && transition.changedKeys[0] === 'market') return 'Market updated.';
  return 'Filters applied.';
}

export function matchingCompanies(
  facets: CompanyFacet[],
  query: string,
  selected = '',
  initialLimit = 24,
  searchLimit = 50,
) {
  const normalizedQuery = normalize(query);
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  const candidates = facets.filter(facet => {
    if (!tokens.length) return true;
    const value = normalize(facet.value);
    return tokens.every(token => value.includes(token));
  });
  candidates.sort((left, right) => {
    if (tokens.length) {
      const leftValue = normalize(left.value);
      const rightValue = normalize(right.value);
      const leftPrefix = leftValue.startsWith(normalizedQuery) ? 1 : 0;
      const rightPrefix = rightValue.startsWith(normalizedQuery) ? 1 : 0;
      if (leftPrefix !== rightPrefix) return rightPrefix - leftPrefix;
    }
    return right.count - left.count || left.value.localeCompare(right.value);
  });
  const limit = tokens.length ? searchLimit : initialLimit;
  const items = candidates.slice(0, limit);
  if (!tokens.length && selected) {
    const selectedFacet = facets.find(facet => normalize(facet.value) === normalize(selected));
    if (selectedFacet && !items.some(facet => normalize(facet.value) === normalize(selectedFacet.value))) {
      items.unshift(selectedFacet);
      if (items.length > limit) items.pop();
    }
  }
  return { items, total: candidates.length };
}

export function matchingCatalogueConcerns(concerns: CatalogueConcern[], query: string, limit = 4) {
  const normalizedQuery = normalize(query);
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  if (!tokens.length) return [];
  return concerns
    .map(concern => {
      const name = normalize(concern.name);
      const terms = concern.productTerms.map(normalize);
      const search = normalize([concern.name, concern.slug, concern.summary, ...concern.signals, ...concern.productTerms].join(' '));
      if (!tokens.every(token => search.includes(token))) return null;
      const score = name === normalizedQuery ? 100 : name.startsWith(normalizedQuery) ? 80 : terms.includes(normalizedQuery) ? 60 : 20;
      return { concern, score };
    })
    .filter((match): match is { concern: CatalogueConcern; score: number } => Boolean(match))
    .sort((left, right) => right.score - left.score || left.concern.name.localeCompare(right.concern.name))
    .slice(0, limit)
    .map(match => match.concern);
}

export function resolvedCatalogueGuides(
  concerns: CatalogueConcern[],
  query: string,
  selectedSlug = '',
  limit = 4,
) {
  const safeLimit = Math.max(1, Math.min(12, Math.floor(limit)));
  const selected = concerns.find(concern => concern.slug === selectedSlug);
  const matches = matchingCatalogueConcerns(concerns, query, safeLimit);
  const unique = new Map<string, CatalogueConcern>();
  if (selected) unique.set(selected.slug, selected);
  for (const match of matches) unique.set(match.slug, match);
  return [...unique.values()].slice(0, safeLimit);
}

export function shouldOfferCatalogueResearchHandoff(
  total: number,
  query: string,
  resolvedGuides: CatalogueConcern[],
) {
  return total === 0 && Boolean(query.trim()) && resolvedGuides.length === 0;
}
