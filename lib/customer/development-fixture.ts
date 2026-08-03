import 'server-only';

import { products } from '@/data/catalogue';
import type { CustomerAccessIdentity } from './access-policy';
import {
  toCustomerPortalProduct,
  type CustomerPortalViewModel,
} from './portal-model';

export const SYNTHETIC_CUSTOMER_IDENTITY: CustomerAccessIdentity = {
  subject: 'synthetic-development:amara-example',
  email: 'amara.customer@example.test',
  emailVerified: true,
  displayName: 'Amara Example',
  source: 'synthetic-development',
};

const SYNTHETIC_ROUTINE_PRODUCT_SLUGS = [
  'cosrx-salicylic-acid-daily-gentle-cleanser',
  'cerave-pm-facial-moisturising-lotion-52ml',
  'eucerin-oil-control-sun-gel-cream-spf50-50ml',
] as const;

export function createSyntheticCustomerPortal(): CustomerPortalViewModel {
  const shelf = SYNTHETIC_ROUTINE_PRODUCT_SLUGS.map((slug) => {
    const product = products.find((candidate) => candidate.slug === slug);
    if (!product) throw new Error(`The development customer requires catalogue product ${slug}.`);
    return toCustomerPortalProduct(product);
  });

  return {
    account: {
      displayName: SYNTHETIC_CUSTOMER_IDENTITY.displayName,
      email: SYNTHETIC_CUSTOMER_IDENTITY.email,
      synthetic: true,
    },
    featuredProduct: shelf[0],
    concerns: ['Dryness', 'Uneven tone', 'Scalp comfort'],
    shelf,
    routineProvenance: 'Amara’s routine',
    routine: [
      { id: 'cleanse', moment: 'Saved step', product: shelf[0] },
      { id: 'moisturise', moment: 'Saved step', product: shelf[1] },
      { id: 'protect', moment: 'Saved step', product: shelf[2] },
    ],
  };
}
