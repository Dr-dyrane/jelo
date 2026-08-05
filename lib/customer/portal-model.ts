import type { Product } from '@/data/products';
import { getReviewedProductCare } from '@/data/product-care-review';
import type { CustomerShelfRecord } from './shelf-repository';
import type { CustomerRoutineRecord } from './routine-repository';
import { marketPriceLabel } from '@/modules/commerce/market-price-label';
import { exactAvailableOffers } from '@/modules/commerce/market-product';
import { summarizeMarket } from '@/modules/commerce/market-summary';

export type MarketReading = {
  /** Concise human-readable price or range, e.g. "₦9,850" or "From ₦9,850". */
  priceLabel: string;
  /** Full market reading with store count, e.g. "₦9,850 · 1 store" or "From ₦9,850 · 3 stores". */
  summary: string;
  /** Number of eligible exact stores with fresh, in-stock, priced offers. */
  storeCount: number;
  /** Whether the price is a single-source or multi-source reading. */
  basis: 'none' | 'single-source' | 'multi-source';
  /** ISO date string of the most recent observation, or null. */
  lastCheckedAt: string | null;
  /** True when no fresh priced offers exist. */
  unavailable: boolean;
};

/** Default unavailable market reading for test fixtures and edge cases. */
export const UNAVAILABLE_MARKET_READING: MarketReading = {
  priceLabel: 'Price unavailable',
  summary: 'Price unavailable',
  storeCount: 0,
  basis: 'none',
  lastCheckedAt: null,
  unavailable: true,
};

export type CustomerPortalProduct = {
  slug: string;
  brand: string;
  name: string;
  size: string;
  category: string;
  step: string;
  image: string;
  displayLine: string;
  usage: string;
  priceLabel: string | null;
  /** Structured market reading for the Member Product page. */
  marketReading: MarketReading;
  supportedConcernSlugs: readonly string[];
  freshExactRetailerNames: readonly string[];
};

export type CustomerPortalRoutineStep = {
  id: string;
  moment: string;
  status: 'confirmed' | 'done' | 'alert';
  product: CustomerPortalProduct;
};

export type CustomerPortalSavedRoutine = {
  id: string;
  revision: number;
  name: string;
  origin: 'customer' | 'legacy_pages_v1_0';
  createdAt: string;
  updatedAt: string;
  steps: readonly {
    id: string;
    position: number;
    label: string;
    instruction: string;
    referenceState: 'none' | 'catalogue' | 'product_request' | 'unresolved';
    product: CustomerPortalProduct | null;
  }[];
};

export type CustomerPortalConcernReference = {
  slug: string;
  name: string;
  area: 'Face' | 'Scalp' | 'Hair' | 'Body';
  kind: 'concern' | 'condition-pattern';
  source: 'customer' | 'synthetic-development';
};

export type CustomerPortalRetailerPreference = {
  name: string;
  source: 'customer' | 'synthetic-development';
};

export type CustomerPortalShelfItem = {
  identityVersionId: string;
  savedAt: string;
  saveOrigin: 'customer' | 'legacy_pages_v1_0' | 'synthetic-development';
  lifecycleState: 'active' | 'merged' | 'retired' | 'superseded';
  availability: 'available' | 'changed' | 'unavailable';
  snapshot: {
    slug: string;
    brand: string;
    name: string;
    size: string;
    versionNumber: number;
    packageVersion: string;
    formulaVersion: string;
  };
  product: CustomerPortalProduct | null;
  message: string | null;
};

export type CustomerPortalViewModel = {
  account: {
    displayName: string | null;
    preferredFirstName: string | null;
    email: string | null;
    synthetic: boolean;
  };
  featuredProduct: CustomerPortalProduct | null;
  catalogue?: readonly CustomerPortalProduct[];
  concerns: readonly CustomerPortalConcernReference[];
  selectedRetailers: readonly CustomerPortalRetailerPreference[];
  shelfState: {
    status: 'ready' | 'unavailable';
    message: string | null;
  };
  shelf: readonly CustomerPortalShelfItem[];
  routineProvenance: string | null;
  routine: readonly CustomerPortalRoutineStep[];
  routineState?: {
    status: 'ready' | 'unavailable';
    message: string | null;
  };
  routines?: readonly CustomerPortalSavedRoutine[];
};

const naira = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

function buildMarketReading(product: Product): MarketReading {
  const summary = summarizeMarket(product.offers, 'NG');
  if (summary.lowestPrice == null || summary.pricedRetailerCount === 0) {
    return {
      priceLabel: 'Price unavailable',
      summary: 'Price unavailable',
      storeCount: 0,
      basis: 'none',
      lastCheckedAt: summary.lastCheckedAt,
      unavailable: true,
    };
  }
  const price = naira.format(summary.lowestPrice);
  const stores = `${summary.pricedRetailerCount} ${summary.pricedRetailerCount === 1 ? 'store' : 'stores'}`;
  const prefix = summary.pricedRetailerCount > 1 ? 'From ' : '';
  return {
    priceLabel: `${prefix}${price}`,
    summary: `${prefix}${price} · ${stores}`,
    storeCount: summary.pricedRetailerCount,
    basis: summary.priceBasis,
    lastCheckedAt: summary.lastCheckedAt,
    unavailable: false,
  };
}

export function toCustomerPortalProduct(product: Product): CustomerPortalProduct {
  const care = getReviewedProductCare(product.slug);
  const supportedConcernSlugs = care?.careState === 'supportive_eligible'
    ? [...new Set(care.approvedUses.flatMap(use => use.concernSlugs ?? []))]
    : [];
  const freshExactRetailerNames = [...new Set(
    exactAvailableOffers(product.offers, 'NG').map(offer => offer.retailer),
  )];
  return {
    slug: product.slug,
    brand: product.brand,
    name: product.name,
    size: product.size,
    category: product.category,
    step: product.step,
    image: product.image,
    displayLine: product.displayLine,
    usage: product.usage,
    priceLabel: marketPriceLabel(product.offers, 'NG'),
    marketReading: buildMarketReading(product),
    supportedConcernSlugs,
    freshExactRetailerNames,
  };
}

export function resolveCustomerPortalShelfItem(
  record: CustomerShelfRecord,
  catalogueBySlug: ReadonlyMap<string, CustomerPortalProduct>,
): CustomerPortalShelfItem {
  const product = record.lifecycleState === 'active'
    && record.currentProductPublished
    && record.currentSlug
    ? catalogueBySlug.get(record.currentSlug) ?? null
    : null;

  if (product) {
    return { ...record, availability: 'available', product, message: null };
  }

  const changed = record.lifecycleState === 'merged' || record.lifecycleState === 'superseded';
  return {
    ...record,
    availability: changed ? 'changed' : 'unavailable',
    product: null,
    message: changed
      ? 'This saved version changed. Review it before choosing another product.'
      : 'This saved version is no longer available.',
  };
}

export function resolveCustomerPortalRoutine(
  record: CustomerRoutineRecord,
  catalogueBySlug: ReadonlyMap<string, CustomerPortalProduct>,
): CustomerPortalSavedRoutine {
  return {
    id: record.id,
    revision: record.revision,
    name: record.name,
    origin: record.origin,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    steps: record.steps.map(step => ({
      id: step.id,
      position: step.position,
      label: step.label,
      instruction: step.instruction,
      referenceState: step.referenceState,
      product: step.referenceState === 'catalogue'
        && step.productLifecycleState === 'active'
        && step.currentProductPublished
        && step.currentProductSlug
        ? catalogueBySlug.get(step.currentProductSlug) ?? null
        : null,
    })),
  };
}
