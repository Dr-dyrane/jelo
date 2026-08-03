export type CustomerPortalProduct = {
  slug: string;
  brand: string;
  name: string;
  size: string;
  category: string;
  image: string;
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
  concerns: readonly string[];
  shelf: readonly CustomerPortalProduct[];
  routineProvenance: string | null;
  routine: readonly CustomerPortalRoutineStep[];
};

export function toCustomerPortalProduct(product: CustomerPortalProduct): CustomerPortalProduct {
  return {
    slug: product.slug,
    brand: product.brand,
    name: product.name,
    size: product.size,
    category: product.category,
    image: product.image,
  };
}
