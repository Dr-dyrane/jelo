import type { CatalogueSearchSuggestion } from '@/components/products/catalogue-search-suggestions';

export type CatalogueSearchRecord = {
  source: 'reviewed' | 'community';
  brand: string;
  name: string;
  size: string;
  category?: 'Face' | 'Hair' | 'Body';
  href: string;
  barcode?: string;
};

export type CatalogueSearchCompany = {
  label: string;
  count: number;
};

export function normalizeCatalogueSearchText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function catalogueSearchTokens(query: string) {
  return normalizeCatalogueSearchText(query).split(' ').filter(Boolean);
}

function compact(value: string) {
  return normalizeCatalogueSearchText(value).replace(/\s+/g, '');
}

function recordScore(record: CatalogueSearchRecord, query: string) {
  const normalizedQuery = normalizeCatalogueSearchText(query);
  const compactQuery = compact(query);
  const name = normalizeCatalogueSearchText(record.name);
  const brand = normalizeCatalogueSearchText(record.brand);
  const size = normalizeCatalogueSearchText(record.size);
  const barcode = compact(record.barcode ?? '');

  if (barcode && barcode === compactQuery) return 140;
  if (name === normalizedQuery) return 130;
  if (brand === normalizedQuery) return 120;
  if (name.startsWith(normalizedQuery)) return 110;
  if (brand.startsWith(normalizedQuery)) return 100;
  if (barcode && barcode.startsWith(compactQuery)) return 95;
  if (name.split(' ').some(word => word.startsWith(normalizedQuery))) return 90;
  if (size === normalizedQuery) return 80;
  return 60;
}

export function rankCatalogueSearchRecords(
  records: CatalogueSearchRecord[],
  query: string,
  limit = 7,
) {
  const tokens = catalogueSearchTokens(query);
  const safeLimit = Math.max(1, Math.min(12, Math.floor(limit)));
  if (!tokens.length) return [];

  const unique = new Map<string, CatalogueSearchRecord>();
  for (const record of records) {
    const current = unique.get(record.href);
    if (!current || (!current.barcode && record.barcode)) unique.set(record.href, record);
  }

  return [...unique.values()]
    .filter(record => {
      const search = normalizeCatalogueSearchText([
        record.brand,
        record.name,
        record.size,
        record.barcode ?? '',
      ].join(' '));
      const compactSearch = search.replace(/\s+/g, '');
      return tokens.every(token => search.includes(token) || compactSearch.includes(token));
    })
    .sort((left, right) => (
      recordScore(right, query) - recordScore(left, query)
      || Number(left.source === 'community') - Number(right.source === 'community')
      || left.brand.localeCompare(right.brand)
      || left.name.localeCompare(right.name)
      || left.size.localeCompare(right.size)
      || left.href.localeCompare(right.href)
    ))
    .slice(0, safeLimit);
}

export function productCatalogueSearchSuggestions(
  records: CatalogueSearchRecord[],
  query: string,
  limit = 7,
): CatalogueSearchSuggestion[] {
  return rankCatalogueSearchRecords(records, query, limit).map(record => ({
    kind: 'product',
    label: record.name,
    detail: record.brand,
    href: record.href,
    keywords: [record.size, record.barcode ?? ''].filter(Boolean),
  }));
}

export function companyCatalogueSearchSuggestions(
  companies: CatalogueSearchCompany[],
  query: string,
  market: 'NG' | 'US',
  limit = 4,
): CatalogueSearchSuggestion[] {
  const tokens = catalogueSearchTokens(query);
  const safeLimit = Math.max(1, Math.min(8, Math.floor(limit)));
  if (!tokens.length) return [];

  const unique = new Map<string, CatalogueSearchCompany>();
  for (const company of companies) {
    const key = normalizeCatalogueSearchText(company.label);
    if (!key) continue;
    const current = unique.get(key);
    if (!current || company.count > current.count) unique.set(key, company);
  }

  return [...unique.values()]
    .filter(company => {
      const search = normalizeCatalogueSearchText(company.label);
      return tokens.every(token => search.includes(token));
    })
    .sort((left, right) => {
      const leftLabel = normalizeCatalogueSearchText(left.label);
      const rightLabel = normalizeCatalogueSearchText(right.label);
      const normalizedQuery = normalizeCatalogueSearchText(query);
      const leftScore = leftLabel === normalizedQuery ? 2 : leftLabel.startsWith(normalizedQuery) ? 1 : 0;
      const rightScore = rightLabel === normalizedQuery ? 2 : rightLabel.startsWith(normalizedQuery) ? 1 : 0;
      return rightScore - leftScore || right.count - left.count || left.label.localeCompare(right.label);
    })
    .slice(0, safeLimit)
    .map(company => {
      const params = new URLSearchParams({ brand: company.label });
      if (market === 'US') params.set('market', 'US');
      return {
        kind: 'company',
        label: company.label,
        detail: `${company.count} ${company.count === 1 ? 'product' : 'products'}`,
        href: `/products?${params.toString()}#all-products`,
      };
    });
}
