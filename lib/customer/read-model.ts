import 'server-only';

import { products } from '@/data/catalogue';
import type { CustomerAccessIdentity } from './access-policy';
import { createSyntheticCustomerPortal } from './development-fixture';
import {
  toCustomerPortalProduct,
  type CustomerPortalViewModel,
} from './portal-model';

export function readCustomerPortal(identity: CustomerAccessIdentity): CustomerPortalViewModel {
  const catalogue = products.map(toCustomerPortalProduct);

  if (identity.source === 'synthetic-development') {
    return {
      ...createSyntheticCustomerPortal(),
      catalogue,
    };
  }

  return {
    account: {
      displayName: identity.displayName,
      email: identity.email,
      synthetic: false,
    },
    featuredProduct: catalogue[0] ?? null,
    catalogue,
    concerns: [],
    shelf: [],
    routineProvenance: null,
    routine: [],
  };
}
