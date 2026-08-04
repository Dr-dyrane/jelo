import type { Product } from '@/data/products';
import { getReviewedProductCare } from '@/data/product-care-review';
import type { CustomerShelfRecord } from './shelf-repository';
import { marketPriceLabel } from '@/modules/commerce/market-price-label';
import { exactAvailableOffers } from '@/modules/commerce/market-product';

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
  supportedConcernSlugs: readonly string[];
  freshExactRetailerNames: readonly string[];
};

export type CustomerPortalRoutineStep = {
  id: string;
  moment: string;
  status: 'confirmed' | 'done' | 'alert';
  product: CustomerPortalProduct;
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
};

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
