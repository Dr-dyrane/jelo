import 'server-only';

import { products } from '@/data/catalogue';
import { concernBySlug } from '@/data/knowledge';
import type { CustomerAccessIdentity } from './access-policy';
import {
  toCustomerPortalProduct,
  type CustomerPortalConcernReference,
  type CustomerPortalShelfItem,
  type CustomerPortalViewModel,
} from './portal-model';

export const SYNTHETIC_CUSTOMER_IDENTITY: CustomerAccessIdentity = {
  subject: 'synthetic-development:amara-example',
  email: 'amara.customer@example.test',
  emailVerified: true,
  name: 'Amara Example',
  displayName: 'Amara Example',
  preferredFirstName: 'Amara',
  source: 'synthetic-development',
};

export const SYNTHETIC_SHELF_PRODUCT_SLUGS = [
  'simple-kind-to-skin-refreshing-facial-gel-wash-150ml',
  'nineless-mela-pro-rice-txa-toner-200ml',
  'laroche-posay-mela-b3-serum-30ml',
  'cerave-pm-facial-moisturising-lotion-52ml',
  'eucerin-oil-control-sun-gel-cream-spf50-50ml',
  'dove-calming-moisture-body-wash-547ml',
  'eucerin-urearepair-plus-10-urea-body-lotion-250ml',
  'sheamoisture-jamaican-black-castor-oil-shampoo-384ml',
  'cecred-moisturizing-deep-conditioner-300ml',
] as const;

const SYNTHETIC_ROUTINE_PRODUCT_SLUGS = [
  SYNTHETIC_SHELF_PRODUCT_SLUGS[0],
  SYNTHETIC_SHELF_PRODUCT_SLUGS[3],
  SYNTHETIC_SHELF_PRODUCT_SLUGS[4],
] as const;

const SYNTHETIC_CONCERN_SLUGS = [
  'dry-dehydrated-skin',
  'dark-spots',
  'dandruff-itchy-scalp',
] as const;

function syntheticConcernReference(slug: string): CustomerPortalConcernReference {
  const concern = concernBySlug(slug);
  if (!concern) throw new Error(`The development customer requires canonical concern ${slug}.`);
  return {
    slug: concern.slug,
    name: concern.name,
    area: concern.area,
    kind: concern.kind,
    source: 'synthetic-development',
  };
}

export function createSyntheticCustomerPortal(): CustomerPortalViewModel {
  const shelf = SYNTHETIC_SHELF_PRODUCT_SLUGS.map((slug, index): CustomerPortalShelfItem => {
    const product = products.find((candidate) => candidate.slug === slug);
    if (!product) throw new Error(`The development customer requires catalogue product ${slug}.`);
    const presentation = toCustomerPortalProduct(product);
    return {
      identityVersionId: `synthetic-development:${slug}`,
      savedAt: new Date(Date.UTC(2026, 7, 3, 12, 0, 9 - index)).toISOString(),
      saveOrigin: 'synthetic-development',
      lifecycleState: 'active',
      availability: 'available',
      snapshot: {
        slug: product.slug,
        brand: product.brand,
        name: product.name,
        size: product.size,
        versionNumber: 1,
        packageVersion: 'synthetic-development',
        formulaVersion: 'synthetic-development',
      },
      product: presentation,
      message: null,
    };
  });

  const routineProducts = SYNTHETIC_ROUTINE_PRODUCT_SLUGS.map(slug => {
    const item = shelf.find(candidate => candidate.snapshot.slug === slug);
    if (!item?.product) throw new Error(`The development routine requires ${slug}.`);
    return item.product;
  });

  return {
    account: {
      displayName: SYNTHETIC_CUSTOMER_IDENTITY.displayName,
      preferredFirstName: SYNTHETIC_CUSTOMER_IDENTITY.preferredFirstName,
      email: SYNTHETIC_CUSTOMER_IDENTITY.email,
      synthetic: true,
    },
    featuredProduct: shelf[0]?.product ?? null,
    concerns: SYNTHETIC_CONCERN_SLUGS.map(syntheticConcernReference),
    selectedRetailers: [
      { name: 'Beauty by Daz', source: 'synthetic-development' },
      { name: 'Care to Beauty', source: 'synthetic-development' },
    ],
    shelfState: { status: 'ready', message: null },
    shelf,
    routineProvenance: 'Amara’s routine',
    routine: [
      { id: 'cleanse', moment: 'Done today · local preview', status: 'done', product: routineProducts[0] },
      { id: 'moisturise', moment: 'Added to routine · local preview', status: 'confirmed', product: routineProducts[1] },
      { id: 'protect', moment: 'Routine reminder · local preview', status: 'alert', product: routineProducts[2] },
    ],
  };
}
