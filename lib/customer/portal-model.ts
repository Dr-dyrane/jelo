import type { Product } from '@/data/products';
import type { CustomerShelfRecord } from './shelf-repository';
import { marketPriceLabel } from '@/modules/commerce/market-price-label';

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
};

export type CustomerPortalRoutineStep = {
  id: string;
  moment: string;
  product: CustomerPortalProduct;
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
  concerns: readonly string[];
  shelfState: {
    status: 'ready' | 'unavailable';
    message: string | null;
  };
  shelf: readonly CustomerPortalShelfItem[];
  routineProvenance: string | null;
  routine: readonly CustomerPortalRoutineStep[];
};

export function toCustomerPortalProduct(product: Product): CustomerPortalProduct {
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
