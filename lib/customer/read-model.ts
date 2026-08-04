import 'server-only';

import { products as staticProducts } from '@/data/catalogue';
import { listCatalogueProducts } from '@/lib/catalogue/repository';
import type { CustomerAccessIdentity } from './access-policy';
import { createSyntheticCustomerPortal } from './development-fixture';
import {
  toCustomerPortalProduct,
  resolveCustomerPortalShelfItem,
  type CustomerPortalViewModel,
} from './portal-model';
import { customerShelfService } from './shelf-service';

export async function readCustomerPortal(
  identity: CustomerAccessIdentity,
): Promise<CustomerPortalViewModel> {

  if (identity.source === 'synthetic-development') {
    return {
      ...createSyntheticCustomerPortal(),
      catalogue: staticProducts.map(toCustomerPortalProduct),
    };
  }

  const [products, shelfRead] = await Promise.all([
    listCatalogueProducts(),
    customerShelfService.read(identity),
  ]);
  const catalogue = products.map(toCustomerPortalProduct);
  const catalogueBySlug = new Map(catalogue.map(product => [product.slug, product]));
  const shelf = shelfRead.status === 'ready'
    ? shelfRead.items.map(item => resolveCustomerPortalShelfItem(item, catalogueBySlug))
    : [];
  const firstSavedProduct = shelf.find(item => item.product)?.product ?? null;

  return {
    account: {
      displayName: identity.displayName,
      preferredFirstName: identity.preferredFirstName,
      email: identity.email,
      synthetic: false,
    },
    featuredProduct: firstSavedProduct ?? catalogue[0] ?? null,
    catalogue,
    concerns: [],
    selectedRetailers: [],
    shelfState: {
      status: shelfRead.status,
      message: shelfRead.status === 'unavailable' ? shelfRead.message : null,
    },
    shelf,
    routineProvenance: null,
    routine: [],
  };
}
