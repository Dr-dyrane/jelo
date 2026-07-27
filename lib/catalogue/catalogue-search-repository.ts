import 'server-only';

import { matchingCatalogueSearchSuggestions, type CatalogueSearchSuggestion } from '@/components/products/catalogue-search-suggestions';
import publicCatalogueSearchArtifact from '@/data/public-catalogue-search.json';
import { getPostgresClient, hasPostgresConfig } from '@/lib/db/postgres';
import {
  catalogueSearchTokens,
  companyCatalogueSearchSuggestions,
  normalizeCatalogueSearchText,
  productCatalogueSearchSuggestions,
  type CatalogueSearchCompany,
  type CatalogueSearchRecord,
} from './catalogue-search-index';
import { parsePublicCatalogueSearchArtifact } from './public-catalogue-search';

type NeonSearchRow = {
  slug: string;
  brand: string;
  name: string;
  size: string;
  approved_gtin: string | null;
};

type NeonCompanyRow = {
  label: string;
  product_count: number;
};

const publicSearchProducts = parsePublicCatalogueSearchArtifact(publicCatalogueSearchArtifact).products;

function staticSearchRecords(): CatalogueSearchRecord[] {
  return publicSearchProducts.map(product => ({
    source: 'reviewed' as const,
    brand: product.brand,
    name: product.name,
    size: product.size,
    href: `/products/${product.slug}`,
    barcode: product.approvedGtin ?? undefined,
  }));
}

function companiesFromRecords(records: CatalogueSearchRecord[]) {
  const companies = new Map<string, CatalogueSearchCompany>();
  for (const record of records) {
    const key = normalizeCatalogueSearchText(record.brand);
    if (!key) continue;
    const current = companies.get(key);
    if (current) current.count += 1;
    else companies.set(key, { label: record.brand, count: 1 });
  }
  return [...companies.values()];
}

function shouldUseNeon() {
  return process.env.CATALOGUE_SOURCE === 'neon' && hasPostgresConfig();
}

function longestSearchToken(query: string) {
  return catalogueSearchTokens(query)
    .sort((left, right) => right.length - left.length || left.localeCompare(right))[0] ?? '';
}

async function searchNeonCatalogue(query: string, limit: number) {
  const anchor = longestSearchToken(query);
  if (!anchor) return { records: [] as CatalogueSearchRecord[], companies: [] as CatalogueSearchCompany[] };

  const sql = getPostgresClient();
  const pattern = `%${anchor}%`;
  const compactQuery = normalizeCatalogueSearchText(query).replace(/\s+/g, '');
  const recordLimit = Math.min(192, Math.max(64, limit * 16));
  const companyLimit = Math.min(24, Math.max(8, limit * 3));
  const [rows, companyRows] = await Promise.all([
    sql<NeonSearchRow[]>`
      select
        p.slug,
        b.name as brand,
        p.name,
        p.size,
        p.approved_gtin
      from products p
      join brands b on b.id = p.brand_id
      where p.is_published = true
        and p.search_text like ${pattern}
      order by
        case
          when p.approved_gtin = ${compactQuery} then 0
          when lower(p.name) = lower(${query}) then 1
          when lower(b.name) = lower(${query}) then 2
          when lower(p.name) like lower(${`${query}%`}) then 3
          when lower(b.name) like lower(${`${query}%`}) then 4
          else 5
        end,
        b.name,
        p.name,
        p.size,
        p.slug
      limit ${recordLimit}
    `,
    sql<NeonCompanyRow[]>`
      select
        b.name as label,
        count(*)::int as product_count
      from products p
      join brands b on b.id = p.brand_id
      where p.is_published = true
        and p.search_text like ${pattern}
      group by b.id, b.name
      order by
        case
          when lower(b.name) = lower(${query}) then 0
          when lower(b.name) like lower(${`${query}%`}) then 1
          else 2
        end,
        count(*) desc,
        b.name
      limit ${companyLimit}
    `,
  ]);

  return {
    records: rows.map(row => ({
      source: 'reviewed' as const,
      brand: row.brand,
      name: row.name,
      size: row.size,
      href: `/products/${row.slug}`,
      barcode: row.approved_gtin ?? undefined,
    })),
    companies: companyRows.map(row => ({
      label: row.label,
      count: Number(row.product_count),
    })),
  };
}

export async function searchCatalogueSuggestions(
  query: string,
  market: 'NG' | 'US',
  limit = 7,
): Promise<CatalogueSearchSuggestion[]> {
  const safeLimit = Math.max(1, Math.min(12, Math.floor(limit)));
  const staticRecords = staticSearchRecords();
  let records = staticRecords;
  let companies = companiesFromRecords(staticRecords);

  if (shouldUseNeon()) {
    try {
      const neon = await searchNeonCatalogue(query, safeLimit);
      records = [...staticRecords, ...neon.records];
      companies = [...companies, ...neon.companies];
    } catch (error) {
      console.error('Neon catalogue search unavailable; using verified static fallback.', error);
    }
  }

  return matchingCatalogueSearchSuggestions([
    ...companyCatalogueSearchSuggestions(companies, query, market, 4),
    ...productCatalogueSearchSuggestions(records, query, safeLimit),
  ], query, safeLimit);
}
