import 'server-only';

import {
  catalogueGuideSearchSuggestions,
  type CatalogueSearchSuggestion,
} from '@/components/products/catalogue-search-suggestions';
import { externalProducts } from '@/data/external-catalogue';
import { concerns } from '@/data/knowledge';
import { getReviewedProductCare } from '@/data/product-care-review';
import type { Market } from '@/data/prices';
import type { ReviewedProduct } from '@/data/products';
import {
  catalogueMarketHref,
  type CatalogueConcern,
  resolvedCatalogueGuides,
  shouldOfferCatalogueResearchHandoff,
} from '@/lib/catalogue/catalogue-interactions';
import {
  type InventoryContinuationQuery,
  inventoryContinuationTargetPage,
} from '@/lib/catalogue/inventory-continuation';
import {
  type InventoryResult,
  loadInventory,
} from '@/lib/catalogue/inventory-repository';
import { selectRecentlyCheckedProducts } from '@/lib/catalogue/inventory-shelves';
import { brandProfileHref } from '@/lib/catalogue/brand-profile';
import { catalogueSearchHandoffHref } from '@/lib/community-intake/catalogue-search-handoff';
import { productMatchesConcern } from '@/modules/concerns/product-matching';

export type CataloguePageQuery = {
  q: string;
  category: string;
  review: string;
  sort: string;
  concern: string;
  step: string;
  brand: string;
  availability: string;
  price: string;
  market: Market;
};

export type CataloguePageParams = Record<string, string | string[] | undefined>;

export type CatalogueBrowseMode = 'concern' | 'category' | 'routine';

export type CataloguePageModel = {
  result: InventoryResult;
  reviewedProducts: ReviewedProduct[];
  supportiveProducts: ReviewedProduct[];
  recentlyChecked: ReviewedProduct[];
  approvedConcerns: typeof concerns;
  searchSuggestions: CatalogueSearchSuggestion[];
  requestedPage: number;
  concernGuides: CatalogueConcern[];
  primaryGuide: CatalogueConcern | undefined;
  hasGuideIntent: boolean;
  hasGuideOnlyConcern: boolean;
  hasActiveIntent: boolean;
  researchHandoffHref: string | null;
  appliedFilters: Array<{ key: string; label: string }>;
  linkedFilters: Array<{ key: string; label: string; href: string }>;
  clearSearchHref: string;
  clearGuideHref: string;
  clearHref: string;
  marketHrefs: { NG: string; US: string };
  currentHref: string;
  continuationQuery: InventoryContinuationQuery;
  continuationKey: string;
  paginationParams: URLSearchParams;
  market: Market;
  browse: CatalogueBrowseMode;
  href: (params: CataloguePageParams, updates: Record<string, string | null>, anchor?: string) => string;
  externalProductsCount: number;
};

function value(params: CataloguePageParams, key: string) {
  const current = params[key];
  return Array.isArray(current) ? current[0] ?? '' : current ?? '';
}

function queryFrom(params: CataloguePageParams) {
  const query = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    const current = Array.isArray(raw) ? raw[0] : raw;
    if (current) query.set(key, current);
  }
  return query;
}

function href(params: CataloguePageParams, updates: Record<string, string | null>, anchor = '') {
  const query = queryFrom(params);
  query.delete('page');
  for (const [key, next] of Object.entries(updates)) {
    if (next) query.set(key, next);
    else query.delete(key);
  }
  const suffix = query.toString();
  const base = suffix ? `/products?${suffix}` : '/products';
  return anchor ? `${base}#${anchor}` : base;
}

function inventoryShortcutHref(market: Market, key: 'brand' | 'category', value: string) {
  const query = new URLSearchParams({ [key]: value });
  if (market === 'US') query.set('market', 'US');
  return `/products?${query.toString()}#all-products`;
}

function inventoryCategory(product: ReviewedProduct) {
  if (product.category === 'Hair') return 'Hair & scalp';
  if (product.category === 'Body') return 'Body care';
  return 'Face care';
}

export function parseCataloguePageParams(params: CataloguePageParams) {
  const market: Market = value(params, 'market') === 'US' ? 'US' : 'NG';
  const browse: CatalogueBrowseMode = ['concern', 'category', 'routine'].includes(value(params, 'browse'))
    ? (value(params, 'browse') as CatalogueBrowseMode)
    : 'category';
  const inventoryQuery: CataloguePageQuery = {
    q: value(params, 'q'),
    category: value(params, 'category'),
    review: value(params, 'review'),
    sort: value(params, 'sort'),
    concern: value(params, 'concern'),
    step: value(params, 'step'),
    brand: value(params, 'brand'),
    availability: value(params, 'availability'),
    price: value(params, 'price'),
    market,
  };
  return { market, browse, inventoryQuery };
}

export async function buildCataloguePageModel(
  params: CataloguePageParams,
): Promise<CataloguePageModel> {
  const { market, browse, inventoryQuery } = parseCataloguePageParams(params);
  const { result, reviewedProducts } = await loadInventory(inventoryQuery);
  const supportiveProducts = reviewedProducts.filter(
    product => getReviewedProductCare(product.slug)?.careState === 'supportive_eligible',
  );
  const requestedPage = inventoryContinuationTargetPage(value(params, 'page'), result.pageCount);
  const recentlyChecked = selectRecentlyCheckedProducts(reviewedProducts, market);
  const approvedConcerns = concerns.filter(concern => supportiveProducts.some(product => productMatchesConcern(product, concern)));
  const publicSearchRecords = [
    ...reviewedProducts.map(product => ({ brand: product.brand, category: inventoryCategory(product) })),
    ...externalProducts.map(product => ({ brand: product.brand, category: product.category })),
  ];
  const companyIndex = new Map<string, { label: string; count: number }>();
  const categoryIndex = new Map<string, number>();
  for (const record of publicSearchRecords) {
    const companyKey = record.brand.toLocaleLowerCase();
    const company = companyIndex.get(companyKey);
    if (company) company.count += 1;
    else companyIndex.set(companyKey, { label: record.brand, count: 1 });
    categoryIndex.set(record.category, (categoryIndex.get(record.category) ?? 0) + 1);
  }
  const searchSuggestions: CatalogueSearchSuggestion[] = [
    ...[...categoryIndex.entries()]
      .filter(([, count]) => count > 0)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([label, count]) => ({
        kind: 'category' as const,
        label,
        detail: `${count} ${count === 1 ? 'product' : 'products'}`,
        href: inventoryShortcutHref(market, 'category', label),
      })),
    ...catalogueGuideSearchSuggestions(concerns),
    ...[...companyIndex.values()]
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
      .slice(0, 40)
      .map(company => ({
        kind: 'company' as const,
        label: company.label,
        detail: `${company.count} ${company.count === 1 ? 'product' : 'products'}`,
        href: brandProfileHref(company.label),
      })),
  ];
  const paginationParams = queryFrom(params);
  const currentSuffix = paginationParams.toString();
  const currentHref = currentSuffix ? `/products?${currentSuffix}` : '/products';
  const marketHrefs = {
    NG: catalogueMarketHref(currentHref, 'NG') ?? '/products#all-products',
    US: catalogueMarketHref(currentHref, 'US') ?? '/products?market=US#all-products',
  };
  const clearHref = market === 'US' ? '/products?market=US#all-products' : '/products#all-products';
  const priceLabels = market === 'NG'
    ? { low: 'Under ₦10k', mid: '₦10k–₦25k', high: '₦25k+' }
    : { low: 'Under $15', mid: '$15–$35', high: '$35+' };
  const concernName = concerns.find(concern => concern.slug === result.filters.concern)?.name;
  const appliedFilters = [
    result.filters.q ? { key: 'q', label: `“${result.filters.q}”` } : null,
    result.filters.category !== 'All' ? { key: 'category', label: result.filters.category } : null,
    result.filters.review !== 'all' ? { key: 'review', label: result.filters.review === 'supportive' ? 'Supportive use' : result.filters.review === 'reviewed' ? 'JeloCare profiles' : 'Community data' } : null,
    result.filters.brand ? { key: 'brand', label: result.filters.brand } : null,
    concernName ? { key: 'concern', label: concernName } : null,
    result.filters.step ? { key: 'step', label: result.filters.step } : null,
    result.filters.availability === 'priced' ? { key: 'availability', label: 'Fresh price' } : null,
    result.filters.price !== 'all' ? { key: 'price', label: priceLabels[result.filters.price] } : null,
    result.filters.sort !== 'featured' ? { key: 'sort', label: result.filters.sort === 'name' ? 'Name order' : 'Recently updated' } : null,
  ].filter((filter): filter is { key: string; label: string } => Boolean(filter));
  const linkedFilters = appliedFilters.map(filter => ({ ...filter, href: href(params, { [filter.key]: null }, 'all-products') }));
  const selectedGuide = concerns.find(concern => concern.slug === result.filters.concern);
  const concernGuides = resolvedCatalogueGuides(
    concerns,
    result.filters.q,
    selectedGuide?.slug,
  );
  const primaryGuide = concernGuides[0];
  const hasGuideIntent = Boolean(primaryGuide);
  const hasGuideOnlyConcern = selectedGuide?.kind === 'condition-pattern';
  const hasActiveIntent = appliedFilters.length > 0 || market === 'US';
  const researchHandoffHref = shouldOfferCatalogueResearchHandoff(
    result.total,
    result.filters.q,
    concernGuides,
  )
    ? catalogueSearchHandoffHref(result.filters.q)
    : null;
  const clearSearchHref = href(params, { q: null }, 'all-products');
  const clearGuideHref = href(params, { q: null, concern: null, review: null }, 'all-products');
  const continuationQuery: InventoryContinuationQuery = {
    q: result.filters.q,
    category: result.filters.category,
    review: result.filters.review,
    sort: result.filters.sort,
    concern: result.filters.concern,
    step: result.filters.step,
    brand: result.filters.brand,
    availability: result.filters.availability,
    price: result.filters.price,
    market: result.filters.market,
  };
  const continuationKey = JSON.stringify(continuationQuery);

  return {
    result,
    reviewedProducts,
    supportiveProducts,
    recentlyChecked,
    approvedConcerns,
    searchSuggestions,
    requestedPage,
    concernGuides,
    primaryGuide,
    hasGuideIntent,
    hasGuideOnlyConcern,
    hasActiveIntent,
    researchHandoffHref,
    appliedFilters,
    linkedFilters,
    clearSearchHref,
    clearGuideHref,
    clearHref,
    marketHrefs,
    currentHref,
    continuationQuery,
    continuationKey,
    paginationParams,
    market,
    browse,
    href,
    externalProductsCount: externalProducts.length,
  };
}
