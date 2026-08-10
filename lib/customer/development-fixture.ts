import 'server-only';

import { products } from '@/data/catalogue';
import type { CustomerAccessIdentity } from './access-policy';
import { LEGACY_SHELF_IMPORT_MANIFEST } from './legacy-shelf-import-manifest';
import {
  toCustomerPortalProduct,
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

const SYNTHETIC_SHELF_BINDINGS = LEGACY_SHELF_IMPORT_MANIFEST.accepted;

export const SYNTHETIC_SHELF_PRODUCT_SLUGS = SYNTHETIC_SHELF_BINDINGS.map(
  binding => binding.identityVersion.slugAtReview,
);

const SYNTHETIC_ROUTINE_STATUSES = ['done', 'confirmed', 'alert'] as const;

function cosmeticVolumeInMillilitres(value: string) {
  const volume = value.match(/^\s*(\d+(?:\.\d+)?)\s*(ml|fl\.?\s*oz)\s*$/i);
  if (!volume) return null;

  const amount = Number(volume[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  if (/^ml$/i.test(volume[2])) return amount;
  if (/^fl\.?\s*oz$/i.test(volume[2])) return amount * 29.5735;

  return null;
}

export function reviewedSyntheticSizeMatches(current: string, reviewed: string) {
  if (current === reviewed) return true;

  const currentMl = cosmeticVolumeInMillilitres(current);
  const reviewedMl = cosmeticVolumeInMillilitres(reviewed);
  if (currentMl === null || reviewedMl === null) return false;

  return Math.abs(currentMl - reviewedMl) <= Math.max(currentMl, reviewedMl) * 0.03;
}

function morningRoutinePosition(
  binding: (typeof SYNTHETIC_SHELF_BINDINGS)[number],
) {
  const reference = binding.provenance.routineReferences.find(candidate => (
    candidate.startsWith('morning:')
  ));
  if (!reference) return null;
  const position = Number(reference.split(':')[1]);
  if (!Number.isInteger(position)) {
    throw new Error(`The development routine requires an ordered reference for ${binding.legacyId}.`);
  }
  return position;
}

export function createSyntheticCustomerPortal(): CustomerPortalViewModel {
  const shelf = SYNTHETIC_SHELF_BINDINGS.map((binding, index): CustomerPortalShelfItem => {
    const { identityVersion } = binding;
    const product = products.find((candidate) => candidate.slug === identityVersion.slugAtReview);
    if (!product) {
      throw new Error(`The development customer requires catalogue product ${identityVersion.slugAtReview}.`);
    }
    if (
      product.brand !== identityVersion.brandAtReview
      || product.name !== identityVersion.variantAtReview
      || !reviewedSyntheticSizeMatches(product.size, identityVersion.sizeAtReview)
    ) {
      throw new Error(`The development customer requires the reviewed identity for ${binding.legacyId}.`);
    }
    const presentation = toCustomerPortalProduct(product);
    return {
      identityVersionId: `synthetic-development:${LEGACY_SHELF_IMPORT_MANIFEST.id}:${binding.legacyId}`,
      savedAt: new Date(Date.UTC(2026, 7, 3, 12, 0, SYNTHETIC_SHELF_BINDINGS.length - index)).toISOString(),
      saveOrigin: 'legacy_pages_v1_0',
      lifecycleState: LEGACY_SHELF_IMPORT_MANIFEST.requiredIdentity.lifecycleState,
      availability: 'available',
      snapshot: {
        slug: identityVersion.slugAtReview,
        brand: identityVersion.brandAtReview,
        name: identityVersion.variantAtReview,
        size: identityVersion.sizeAtReview,
        versionNumber: LEGACY_SHELF_IMPORT_MANIFEST.requiredIdentity.versionNumber,
        packageVersion: LEGACY_SHELF_IMPORT_MANIFEST.requiredIdentity.packageVersion,
        formulaVersion: LEGACY_SHELF_IMPORT_MANIFEST.requiredIdentity.formulaVersion,
      },
      product: presentation,
      message: null,
    };
  });

  const routineBindings = SYNTHETIC_SHELF_BINDINGS
    .flatMap(binding => {
      const position = morningRoutinePosition(binding);
      return position === null ? [] : [{ binding, position }];
    })
    .sort((left, right) => left.position - right.position);
  if (routineBindings.length !== SYNTHETIC_ROUTINE_STATUSES.length) {
    throw new Error('The development routine requires three reviewed morning references.');
  }
  const routine = routineBindings.map(({ binding }, index) => {
    const item = shelf.find(candidate => (
      candidate.snapshot.slug === binding.identityVersion.slugAtReview
    ));
    if (!item?.product) {
      throw new Error(`The development routine requires ${binding.identityVersion.slugAtReview}.`);
    }
    return {
      id: `${LEGACY_SHELF_IMPORT_MANIFEST.id}:${binding.legacyId}`,
      moment: `${binding.provenance.usage}`,
      status: SYNTHETIC_ROUTINE_STATUSES[index],
      product: item.product,
    };
  });
  const routines = LEGACY_SHELF_IMPORT_MANIFEST.routines.map((savedRoutine, routineIndex) => ({
    id: `synthetic-development:${savedRoutine.legacyId}`,
    revision: 0,
    name: savedRoutine.name,
    origin: 'legacy_pages_v1_0' as const,
    createdAt: new Date(Date.UTC(2026, 7, 3, 12, routineIndex)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 7, 3, 12, routineIndex)).toISOString(),
    steps: savedRoutine.steps.map(step => {
      const reference = step.reference;
      const binding = reference.state === 'catalogue'
        ? SYNTHETIC_SHELF_BINDINGS.find(candidate => candidate.legacyId === reference.legacyId)
        : undefined;
      const product = binding
        ? shelf.find(candidate => candidate.snapshot.slug === binding.identityVersion.slugAtReview)?.product ?? null
        : null;
      return {
        id: `synthetic-development:${savedRoutine.legacyId}:${step.position}`,
        position: step.position,
        label: step.label,
        instruction: step.instruction,
        referenceState: reference.state,
        product,
      };
    }),
  }));

  return {
    account: {
      displayName: SYNTHETIC_CUSTOMER_IDENTITY.displayName,
      preferredFirstName: SYNTHETIC_CUSTOMER_IDENTITY.preferredFirstName,
      email: SYNTHETIC_CUSTOMER_IDENTITY.email,
      synthetic: true,
    },
    featuredProduct: shelf[0]?.product ?? null,
    concerns: [],
    selectedRetailers: [],
    shelfState: { status: 'ready', message: null },
    shelf,
    routineProvenance: null,
    routine,
    routineState: { status: 'ready', message: null },
    routines,
  };
}
