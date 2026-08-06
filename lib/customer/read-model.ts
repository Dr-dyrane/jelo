import 'server-only';

import { products as staticProducts } from '@/data/catalogue';
import { listCatalogueProducts } from '@/lib/catalogue/repository';
import type { CustomerAccessIdentity } from './access-policy';
import { createSyntheticCustomerPortal } from './development-fixture';
import {
  toCustomerPortalProduct,
  resolveCustomerPortalShelfItem,
  resolveCustomerPortalRoutine,
  type CustomerPortalViewModel,
  type CustomerPortalConcernReference,
} from './portal-model';
import { customerShelfService } from './shelf-service';
import { customerRoutineService } from './routine-service';
import { customerConcernService } from './concern-service';
import { concerns as knowledgeLibraryConcerns } from '@/data/knowledge';

export async function readCustomerPortal(
  identity: CustomerAccessIdentity,
): Promise<CustomerPortalViewModel> {

  if (identity.source === 'synthetic-development') {
    return {
      ...createSyntheticCustomerPortal(),
      catalogue: staticProducts.map(toCustomerPortalProduct),
    };
  }

  const [products, shelfRead, routineRead, concernRead] = await Promise.all([
    listCatalogueProducts(),
    customerShelfService.read(identity),
    customerRoutineService.read(identity),
    customerConcernService.read(identity),
  ]);
  const catalogue = products.map(toCustomerPortalProduct);
  const catalogueBySlug = new Map(catalogue.map(product => [product.slug, product]));
  const shelf = shelfRead.status === 'ready'
    ? shelfRead.items.map(item => resolveCustomerPortalShelfItem(item, catalogueBySlug))
    : [];
  const firstSavedProduct = shelf.find(item => item.product)?.product ?? null;
  // catalogue[0] must never be presented as customer preference.
  // featuredProduct is null when no saved product exists.
  const routines = routineRead.status === 'ready'
    ? routineRead.routines.map(routine => resolveCustomerPortalRoutine(routine, catalogueBySlug))
    : [];
  const routine = routines.flatMap(savedRoutine => (
    savedRoutine.steps.flatMap(step => step.product ? [{
      id: step.id,
      moment: step.instruction || `${savedRoutine.name} step ${step.position}`,
      status: 'confirmed' as const,
      product: step.product,
    }] : [])
  ));
  const concerns = concernRead.status === 'ready'
    ? concernRead.concerns
        .map(record => {
          const knowledge = knowledgeLibraryConcerns.find(c => c.slug === record.concernSlug);
          if (!knowledge) return null;
          return {
            slug: knowledge.slug,
            name: knowledge.name,
            area: knowledge.area,
            kind: knowledge.kind,
            source: record.origin === 'synthetic-development' ? 'synthetic-development' as const : 'customer' as const,
          } satisfies CustomerPortalConcernReference;
        })
        .filter((c): c is CustomerPortalConcernReference => c !== null)
    : [];

  return {
    account: {
      displayName: identity.displayName,
      preferredFirstName: identity.preferredFirstName,
      email: identity.email,
      synthetic: false,
    },
    featuredProduct: firstSavedProduct,
    catalogue,
    concerns,
    selectedRetailers: [],
    shelfState: {
      status: shelfRead.status,
      message: shelfRead.status === 'unavailable' ? shelfRead.message : null,
    },
    shelf,
    routineProvenance: null,
    routine,
    routineState: {
      status: routineRead.status,
      message: routineRead.status === 'unavailable' ? routineRead.message : null,
    },
    routines,
  };
}
