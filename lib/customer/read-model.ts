import 'server-only';

import { products } from '@/data/catalogue';
import type { CustomerAccessIdentity } from './access-policy';
import { createSyntheticCustomerPortal } from './development-fixture';
import {
  toCustomerPortalProduct,
  type CustomerPortalViewModel,
} from './portal-model';

export function readCustomerPortal(identity: CustomerAccessIdentity): CustomerPortalViewModel {
  if (identity.source === 'synthetic-development') {
    return createSyntheticCustomerPortal();
  }

  return {
    account: {
      displayName: identity.displayName,
      email: identity.email,
      synthetic: false,
    },
    featuredProduct: products[0] ? toCustomerPortalProduct(products[0]) : null,
    concerns: [],
    shelf: [],
    routineProvenance: null,
    routine: [],
  };
}
