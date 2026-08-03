import type { Product } from '@/data/products';
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

export type CustomerPortalViewModel = {
  account: {
    displayName: string | null;
    email: string | null;
    synthetic: boolean;
  };
  featuredProduct: CustomerPortalProduct | null;
  catalogue?: readonly CustomerPortalProduct[];
  concerns: readonly string[];
  shelf: readonly CustomerPortalProduct[];
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
