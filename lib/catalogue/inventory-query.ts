import {
  externalCatalogueCategories,
  externalProducts,
  type ExternalCatalogueCategory,
} from '@/data/external-catalogue';
import { concerns as concernLibrary } from '@/data/knowledge';
import { getReviewedProductCare, type ProductCareState } from '@/data/product-care-review';
import type { Market } from '@/data/prices';
import type { Offer, ReviewedProduct } from '@/data/products';
import { comparableMarketPrice } from '@/modules/commerce/offer-evidence';
import { productMatchesConcern } from '@/modules/concerns/product-matching';

export const inventoryPageSize = 24;
export const inventoryCategories = externalCatalogueCategories;

const externalQuality = new Map(externalProducts.map(product => [product.barcode, product.catalogueQuality.score]));

export type InventoryReviewFilter = 'all' | 'reviewed' | 'supportive' | 'community';
export type InventorySort = 'featured' | 'name' | 'newest';
export type InventoryAvailabilityFilter = 'all' | 'priced';
export type InventoryPriceFilter = 'all' | 'low' | 'mid' | 'high';

export type InventoryReviewedItem = {
  kind: 'reviewed';
  id: string;
  slug: string;
  brand: string;
  name: string;
  quantity: string;
  category: ExternalCatalogueCategory;
  step: string;
  image: string;
  href: string;
  external: false;
  offers: Offer[];
  careState: ProductCareState | 'unreviewed';
  sourceUpdatedAt: null;
};

export type InventoryCommunityItem = {
  kind: 'community';
  id: string;
  barcode: string;
  brand: string;
  name: string;
  quantity: string;
  category: ExternalCatalogueCategory;
  image: string;
  href: string;
  external: true;
  label: 'Community data · Not reviewed';
  offers: [];
  sourceUpdatedAt: string;
};

export type InventoryItem = InventoryReviewedItem | InventoryCommunityItem;

export type InventoryQuery = {
  q?: string;
  category?: string;
  review?: string;
  sort?: string;
  concern?: string;
  step?: string;
  brand?: string;
  availability?: string;
  price?: string;
  market?: string;
  page?: string | number;
};

export type InventoryResult = {
  items: InventoryItem[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  filters: {
    q: string;
    category: ExternalCatalogueCategory | 'All';
    review: InventoryReviewFilter;
    sort: InventorySort;
    concern: string;
    step: string;
    brand: string;
    availability: InventoryAvailabilityFilter;
    price: InventoryPriceFilter;
    market: Market;
  };
  facets: {
    categories: Array<{ value: ExternalCatalogueCategory; count: number }>;
    brands: Array<{ value: string; count: number }>;
    steps: Array<{ value: string; count: number }>;
    reviewed: number;
    supportive: number;
    community: number;
    priced: number;
  };
};

function normalized(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function compactNormalized(value: string) {
  return normalized(value).replace(/\s+/g, '');
}

function categoryForReviewed(category: ReviewedProduct['category']): ExternalCatalogueCategory {
  if (category === 'Hair') return 'Hair & scalp';
  if (category === 'Body') return 'Body care';
  return 'Face care';
}

function reviewedItem(product: ReviewedProduct): InventoryReviewedItem {
  return {
    kind: 'reviewed',
    id: `reviewed:${product.slug}`,
    slug: product.slug,
    brand: product.brand,
    name: product.name,
    quantity: product.size,
    category: categoryForReviewed(product.category),
    step: product.step,
    image: product.image,
    href: `/products/${product.slug}`,
    external: false,
    offers: product.offers,
    careState: getReviewedProductCare(product.slug)?.careState ?? 'unreviewed',
    sourceUpdatedAt: null,
  };
}

function communityItem(product: typeof externalProducts[number]): InventoryCommunityItem {
  return {
    kind: 'community',
    id: `open-beauty-facts:${product.barcode}`,
    barcode: product.barcode,
    brand: product.brand,
    name: product.name,
    quantity: product.quantity,
    category: product.category,
    image: product.canonicalImageUrl,
    href: product.sourceUrl,
    external: true,
    label: 'Community data · Not reviewed',
    offers: [],
    sourceUpdatedAt: product.sourceUpdatedAt,
  };
}

function validCategory(value: string | undefined): ExternalCatalogueCategory | 'All' {
  return inventoryCategories.includes(value as ExternalCatalogueCategory) ? value as ExternalCatalogueCategory : 'All';
}

function validReview(value: string | undefined): InventoryReviewFilter {
  return value === 'reviewed' || value === 'supportive' || value === 'community' ? value : 'all';
}

function validSort(value: string | undefined): InventorySort {
  return value === 'name' || value === 'newest' ? value : 'featured';
}

function validAvailability(value: string | undefined): InventoryAvailabilityFilter {
  return value === 'priced' ? 'priced' : 'all';
}

function validPrice(value: string | undefined): InventoryPriceFilter {
  return value === 'low' || value === 'mid' || value === 'high' ? value : 'all';
}

function validMarket(value: string | undefined): Market {
  return value === 'US' ? 'US' : 'NG';
}

function pageNumber(value: string | number | undefined) {
  const parsed = Number(value ?? 1);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function queryMatches(item: InventoryItem, query: string, reviewedSearchTerms = '') {
  if (!query) return true;
  const tokens = normalized(query).split(' ').filter(Boolean);
  const searchFields = [
    item.brand,
    item.name,
    item.quantity,
    item.category,
    item.kind === 'community' ? item.barcode : '',
    reviewedSearchTerms,
  ].filter(Boolean).map(normalized);
  return tokens.every(token => searchFields.some(field => (
    field.includes(token) || field.replace(/\s+/g, '').includes(token)
  )));
}

function reviewedDiscoveryTerms(product: ReviewedProduct) {
  const review = getReviewedProductCare(product.slug);
  if (!review || review.careState !== 'supportive_eligible') return '';
  const approvedConcernSlugs = new Set(review.approvedUses.flatMap(use => use.concernSlugs ?? []));
  const matchingConcerns = concernLibrary.filter(concern => approvedConcernSlugs.has(concern.slug));
  return [
    ...review.approvedUses.flatMap(use => [use.label, ...use.concernIds]),
    ...matchingConcerns.flatMap(concern => [concern.name, ...concern.signals]),
  ].join(' ');
}

function lowestFreshPrice(item: InventoryItem, market: Market) {
  if (item.kind !== 'reviewed') return undefined;
  const prices = item.offers
    .filter(offer => offer.available && offer.match !== 'search' && (offer.location.includes(market) || offer.location.includes('INTL')))
    .map(offer => comparableMarketPrice(offer, market))
    .filter((price): price is number => price != null);
  return prices.length ? Math.min(...prices) : undefined;
}

function priceMatches(price: number | undefined, filter: InventoryPriceFilter, market: Market) {
  if (filter === 'all') return true;
  if (price == null) return false;
  const [low, high] = market === 'NG' ? [10_000, 25_000] : [15, 35];
  if (filter === 'low') return price < low;
  if (filter === 'mid') return price >= low && price < high;
  return price >= high;
}

function brandFacets(items: InventoryItem[]) {
  const groups = new Map<string, { value: string; count: number }>();
  for (const item of items) {
    const key = normalized(item.brand);
    const current = groups.get(key);
    if (current) current.count += 1;
    else if (key) groups.set(key, { value: item.brand, count: 1 });
  }
  return [...groups.values()].sort((left, right) => left.value.localeCompare(right.value));
}

export function queryInventoryRecords(reviewedProducts: ReviewedProduct[], input: InventoryQuery = {}): InventoryResult {
  const q = (input.q ?? '').trim().slice(0, 120);
  const category = validCategory(input.category);
  const review = validReview(input.review);
  const sort = validSort(input.sort);
  const concern = (input.concern ?? '').trim().slice(0, 80);
  const step = (input.step ?? '').trim().slice(0, 40);
  const brand = (input.brand ?? '').trim().slice(0, 100);
  const availability = validAvailability(input.availability);
  const price = validPrice(input.price);
  const market = validMarket(input.market);
  const selectedConcern = concernLibrary.find(item => item.slug === concern);
  const normalizedBrand = normalized(brand);

  const completeItems: InventoryItem[] = [
    ...reviewedProducts.map(reviewedItem),
    ...externalProducts.map(communityItem),
  ];
  const reviewedSearchTerms = new Map(reviewedProducts.map(product => [
    `reviewed:${product.slug}`,
    reviewedDiscoveryTerms(product),
  ]));
  // Routine steps are neutral catalogue metadata from reviewed product records.
  // They support browse structure only and never establish clinical suitability.
  const normalizedStep = normalized(step);
  const selectedStep = normalizedStep
    ? reviewedProducts.find(product => normalized(product.step) === normalizedStep)?.step ?? ''
    : '';
  const selectedBrand = normalizedBrand
    ? completeItems.find(item => normalized(item.brand) === normalizedBrand)?.brand ?? ''
    : '';
  const reviewedById = new Map(reviewedProducts.map(product => [`reviewed:${product.slug}`, product]));
  type FilterDimension = 'review' | 'category' | 'concern' | 'step' | 'brand' | 'availability' | 'price';

  function itemMatches(item: InventoryItem, ignored: FilterDimension[] = []) {
    const skip = new Set(ignored);
    if (!skip.has('review')) {
      if (review === 'community' && item.kind !== 'community') return false;
      if (review === 'reviewed' && item.kind !== 'reviewed') return false;
      if (review === 'supportive' && (item.kind !== 'reviewed' || item.careState !== 'supportive_eligible')) return false;
    }
    if (!skip.has('category') && category !== 'All' && item.category !== category) return false;
    if (!skip.has('step') && selectedStep && (item.kind !== 'reviewed' || normalized(item.step) !== normalized(selectedStep))) return false;
    if (!skip.has('brand') && selectedBrand && normalized(item.brand) !== normalized(selectedBrand)) return false;
    if (!queryMatches(item, q, reviewedSearchTerms.get(item.id))) return false;

    if (!skip.has('concern') && selectedConcern) {
      const product = reviewedById.get(item.id);
      if (!product || !productMatchesConcern(product, selectedConcern)) return false;
    }
    const freshPrice = lowestFreshPrice(item, market);
    if (!skip.has('availability') && availability === 'priced' && freshPrice == null) return false;
    if (!skip.has('price') && !priceMatches(freshPrice, price, market)) return false;
    return true;
  }

  const items = completeItems.filter(item => itemMatches(item));

  const normalizedQuery = normalized(q);
  items.sort((left, right) => {
    if (sort === 'name') return left.name.localeCompare(right.name) || left.brand.localeCompare(right.brand) || left.id.localeCompare(right.id);
    if (sort === 'newest') {
      const leftDate = left.sourceUpdatedAt ? Date.parse(left.sourceUpdatedAt) : Number.MAX_SAFE_INTEGER;
      const rightDate = right.sourceUpdatedAt ? Date.parse(right.sourceUpdatedAt) : Number.MAX_SAFE_INTEGER;
      return rightDate - leftDate || left.id.localeCompare(right.id);
    }
    if (normalizedQuery) {
      const compactQuery = compactNormalized(q);
      const leftExact = left.kind === 'community' && left.barcode === q
        ? 3
        : normalized(left.name) === normalizedQuery
          || normalized(left.brand) === normalizedQuery
          || compactNormalized(left.brand) === compactQuery ? 2 : 0;
      const rightExact = right.kind === 'community' && right.barcode === q
        ? 3
        : normalized(right.name) === normalizedQuery
          || normalized(right.brand) === normalizedQuery
          || compactNormalized(right.brand) === compactQuery ? 2 : 0;
      if (leftExact !== rightExact) return rightExact - leftExact;
    }
    if (left.kind !== right.kind) return left.kind === 'reviewed' ? -1 : 1;
    if (left.kind === 'community' && right.kind === 'community') {
      const leftQuality = externalQuality.get(left.barcode) ?? 0;
      const rightQuality = externalQuality.get(right.barcode) ?? 0;
      if (leftQuality !== rightQuality) return rightQuality - leftQuality;
    }
    return left.brand.localeCompare(right.brand) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
  });

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / inventoryPageSize));
  const page = Math.min(pageNumber(input.page), pageCount);
  const offset = (page - 1) * inventoryPageSize;

  return {
    items: items.slice(offset, offset + inventoryPageSize),
    total,
    page,
    pageCount,
    pageSize: inventoryPageSize,
    filters: {
      q,
      category,
      review,
      sort,
      concern: selectedConcern?.slug ?? '',
      step: selectedStep,
      brand: selectedBrand,
      availability,
      price,
      market,
    },
    facets: {
      categories: inventoryCategories.map(value => ({
        value,
        count: completeItems.filter(item => item.category === value && itemMatches(item, ['category'])).length,
      })),
      brands: brandFacets(completeItems.filter(item => itemMatches(item, ['brand']))),
      steps: [...new Set(reviewedProducts.map(product => product.step).filter(Boolean))]
        .map(value => ({
          value,
          count: completeItems.filter(item => itemMatches(item, ['step']) && item.kind === 'reviewed' && normalized(item.step) === normalized(value)).length,
        }))
        .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value)),
      reviewed: completeItems.filter(item => item.kind === 'reviewed' && itemMatches(item, ['review'])).length,
      supportive: completeItems.filter(item => item.kind === 'reviewed' && item.careState === 'supportive_eligible' && itemMatches(item, ['review'])).length,
      community: completeItems.filter(item => item.kind === 'community' && itemMatches(item, ['review'])).length,
      priced: completeItems.filter(item => lowestFreshPrice(item, market) != null && itemMatches(item, ['availability', 'price'])).length,
    },
  };
}
