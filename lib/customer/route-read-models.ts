import 'server-only';

import { products as staticProducts } from '@/data/catalogue';
import { listCatalogueProducts } from '@/lib/catalogue/repository';
import type { CustomerAccessIdentity } from './access-policy';
import { createSyntheticCustomerPortal } from './development-fixture';
import {
  toCustomerPortalProduct,
  resolveCustomerPortalShelfItem,
  resolveCustomerPortalRoutine,
  type CustomerPortalProduct,
  type CustomerPortalShelfItem,
  type CustomerPortalRoutineStep,
  type CustomerPortalSavedRoutine,
  type CustomerPortalViewModel,
} from './portal-model';
import { customerShelfService } from './shelf-service';
import { customerRoutineService } from './routine-service';

/**
 * Shell-level summary for the dock and account sheet.
 * Contains only account identity and small counts — not full collections.
 */
export type CustomerPortalShell = {
  account: CustomerPortalViewModel['account'];
  shelfCount: number;
  shelfAvailable: boolean;
  shelfUnavailableMessage: string | null;
  routineStepCount: number;
  routineAvailable: boolean;
  routineUnavailableMessage: string | null;
  synthetic: boolean;
};

/**
 * Home route data: shell summary plus preview-sized Shelf and Routine.
 */
export type CustomerHomeReadModel = {
  account: CustomerPortalViewModel['account'];
  featuredProduct: CustomerPortalProduct | null;
  shelfPreview: readonly CustomerPortalShelfItem[];
  shelfState: CustomerPortalViewModel['shelfState'];
  routinePreview: readonly CustomerPortalRoutineStep[];
  routineProvenance: string | null;
  routineState: NonNullable<CustomerPortalViewModel['routineState']>;
  routines: readonly CustomerPortalSavedRoutine[];
  concerns: CustomerPortalViewModel['concerns'];
  selectedRetailers: CustomerPortalViewModel['selectedRetailers'];
  synthetic: boolean;
};

/**
 * Explore route data: full catalogue plus shelf context for filtering.
 */
export type CustomerExploreReadModel = {
  catalogue: readonly CustomerPortalProduct[];
  shelf: readonly CustomerPortalShelfItem[];
  shelfState: CustomerPortalViewModel['shelfState'];
  routine: readonly CustomerPortalRoutineStep[];
  concerns: CustomerPortalViewModel['concerns'];
  selectedRetailers: CustomerPortalViewModel['selectedRetailers'];
  synthetic: boolean;
};

/**
 * Shelf route data: full shelf plus request presentation context.
 */
export type CustomerShelfReadModel = {
  account: CustomerPortalViewModel['account'];
  shelf: readonly CustomerPortalShelfItem[];
  shelfState: CustomerPortalViewModel['shelfState'];
  synthetic: boolean;
};

/**
 * Routine route data: full routines plus derived routine steps.
 */
export type CustomerRoutineReadModel = {
  account: CustomerPortalViewModel['account'];
  routine: readonly CustomerPortalRoutineStep[];
  routineProvenance: string | null;
  routineState: NonNullable<CustomerPortalViewModel['routineState']>;
  routines: readonly CustomerPortalSavedRoutine[];
  synthetic: boolean;
};

/**
 * Consult route data: catalogue for search plus concerns.
 */
export type CustomerConsultReadModel = {
  account: CustomerPortalViewModel['account'];
  catalogue: readonly CustomerPortalProduct[];
  concerns: CustomerPortalViewModel['concerns'];
  synthetic: boolean;
};

/**
 * Member product route data: one product plus shelf/routine context.
 */
export type CustomerProductReadModel = {
  account: CustomerPortalViewModel['account'];
  product: CustomerPortalProduct | null;
  shelf: readonly CustomerPortalShelfItem[];
  shelfState: CustomerPortalViewModel['shelfState'];
  routine: readonly CustomerPortalRoutineStep[];
  synthetic: boolean;
};

// --- Internal helpers ---

async function readCatalogue(): Promise<readonly CustomerPortalProduct[]> {
  const products = await listCatalogueProducts();
  return products.map(toCustomerPortalProduct);
}

async function readShelf(identity: CustomerAccessIdentity, catalogueBySlug: ReadonlyMap<string, CustomerPortalProduct>) {
  const shelfRead = await customerShelfService.read(identity);
  if (shelfRead.status !== 'ready') {
    return {
      shelf: [] as readonly CustomerPortalShelfItem[],
      shelfState: {
        status: shelfRead.status as 'ready' | 'unavailable',
        message: shelfRead.status === 'unavailable' ? shelfRead.message : null,
      },
    };
  }
  return {
    shelf: shelfRead.items.map(item => resolveCustomerPortalShelfItem(item, catalogueBySlug)),
    shelfState: { status: 'ready' as const, message: null },
  };
}

async function readRoutines(identity: CustomerAccessIdentity, catalogueBySlug: ReadonlyMap<string, CustomerPortalProduct>) {
  const routineRead = await customerRoutineService.read(identity);
  if (routineRead.status !== 'ready') {
    return {
      routines: [] as readonly CustomerPortalSavedRoutine[],
      routine: [] as readonly CustomerPortalRoutineStep[],
      routineState: {
        status: routineRead.status as 'ready' | 'unavailable',
        message: routineRead.status === 'unavailable' ? routineRead.message : null,
      },
    };
  }
  const routines = routineRead.routines.map(routine => resolveCustomerPortalRoutine(routine, catalogueBySlug));
  const routine = routines.flatMap(savedRoutine => (
    savedRoutine.steps.flatMap(step => step.product ? [{
      id: step.id,
      moment: step.instruction || `${savedRoutine.name} step ${step.position}`,
      status: 'confirmed' as const,
      product: step.product,
    }] : [])
  ));
  return {
    routines,
    routine,
    routineState: { status: 'ready' as const, message: null },
  };
}

function deriveRoutineSteps(routines: readonly CustomerPortalSavedRoutine[]): readonly CustomerPortalRoutineStep[] {
  return routines.flatMap(savedRoutine => (
    savedRoutine.steps.flatMap(step => step.product ? [{
      id: step.id,
      moment: step.instruction || `${savedRoutine.name} step ${step.position}`,
      status: 'confirmed' as const,
      product: step.product,
    }] : [])
  ));
}

// --- Synthetic helpers ---

function syntheticShell(): CustomerPortalShell {
  const portal = createSyntheticCustomerPortal();
  return {
    account: portal.account,
    shelfCount: portal.shelf.length,
    shelfAvailable: portal.shelfState.status === 'ready',
    shelfUnavailableMessage: portal.shelfState.message,
    routineStepCount: portal.routine.length,
    routineAvailable: (portal.routineState?.status ?? 'ready') === 'ready',
    routineUnavailableMessage: portal.routineState?.message ?? null,
    synthetic: true,
  };
}

function syntheticHome(): CustomerHomeReadModel {
  const portal = createSyntheticCustomerPortal();
  return {
    account: portal.account,
    featuredProduct: portal.featuredProduct,
    shelfPreview: portal.shelf.slice(0, 6),
    shelfState: portal.shelfState,
    routinePreview: portal.routine.slice(0, 6),
    routineProvenance: portal.routineProvenance,
    routineState: portal.routineState ?? { status: 'ready', message: null },
    routines: portal.routines ?? [],
    concerns: portal.concerns,
    selectedRetailers: portal.selectedRetailers,
    synthetic: true,
  };
}

function syntheticExplore(): CustomerExploreReadModel {
  const portal = createSyntheticCustomerPortal();
  return {
    catalogue: staticProducts.map(toCustomerPortalProduct),
    shelf: portal.shelf,
    shelfState: portal.shelfState,
    routine: portal.routine,
    concerns: portal.concerns,
    selectedRetailers: portal.selectedRetailers,
    synthetic: true,
  };
}

function syntheticShelf(): CustomerShelfReadModel {
  const portal = createSyntheticCustomerPortal();
  return {
    account: portal.account,
    shelf: portal.shelf,
    shelfState: portal.shelfState,
    synthetic: true,
  };
}

function syntheticRoutine(): CustomerRoutineReadModel {
  const portal = createSyntheticCustomerPortal();
  return {
    account: portal.account,
    routine: portal.routine,
    routineProvenance: portal.routineProvenance,
    routineState: portal.routineState ?? { status: 'ready', message: null },
    routines: portal.routines ?? [],
    synthetic: true,
  };
}

function syntheticConsult(): CustomerConsultReadModel {
  const portal = createSyntheticCustomerPortal();
  return {
    account: portal.account,
    catalogue: staticProducts.map(toCustomerPortalProduct),
    concerns: portal.concerns,
    synthetic: true,
  };
}

function syntheticProduct(slug: string): CustomerProductReadModel {
  const portal = createSyntheticCustomerPortal();
  const catalogue = staticProducts.map(toCustomerPortalProduct);
  return {
    account: portal.account,
    product: catalogue.find(p => p.slug === slug) ?? null,
    shelf: portal.shelf,
    shelfState: portal.shelfState,
    routine: portal.routine,
    synthetic: true,
  };
}

// --- Public route-scoped loaders ---

export async function readMeShell(identity: CustomerAccessIdentity): Promise<CustomerPortalShell> {
  if (identity.source === 'synthetic-development') return syntheticShell();

  const [shelfRead, routineRead] = await Promise.all([
    customerShelfService.read(identity),
    customerRoutineService.read(identity),
  ]);
  return {
    account: {
      displayName: identity.displayName,
      preferredFirstName: identity.preferredFirstName,
      email: identity.email,
      synthetic: false,
    },
    shelfCount: shelfRead.status === 'ready' ? shelfRead.items.length : 0,
    shelfAvailable: shelfRead.status === 'ready',
    shelfUnavailableMessage: shelfRead.status === 'unavailable' ? shelfRead.message : null,
    routineStepCount: routineRead.status === 'ready'
      ? routineRead.routines.reduce((total, r) => total + r.steps.length, 0)
      : 0,
    routineAvailable: routineRead.status === 'ready',
    routineUnavailableMessage: routineRead.status === 'unavailable' ? routineRead.message : null,
    synthetic: false,
  };
}

export async function readMeHome(identity: CustomerAccessIdentity): Promise<CustomerHomeReadModel> {
  if (identity.source === 'synthetic-development') return syntheticHome();

  const catalogue = await readCatalogue();
  const catalogueBySlug = new Map(catalogue.map(p => [p.slug, p]));
  const [shelfData, routineData] = await Promise.all([
    readShelf(identity, catalogueBySlug),
    readRoutines(identity, catalogueBySlug),
  ]);

  const firstSavedProduct = shelfData.shelf.find(item => item.product)?.product ?? null;
  return {
    account: {
      displayName: identity.displayName,
      preferredFirstName: identity.preferredFirstName,
      email: identity.email,
      synthetic: false,
    },
    featuredProduct: firstSavedProduct ?? catalogue[0] ?? null,
    shelfPreview: shelfData.shelf.slice(0, 6),
    shelfState: shelfData.shelfState,
    routinePreview: routineData.routine.slice(0, 6),
    routineProvenance: null,
    routineState: routineData.routineState,
    routines: routineData.routines,
    concerns: [],
    selectedRetailers: [],
    synthetic: false,
  };
}

export async function readMeExplore(identity: CustomerAccessIdentity): Promise<CustomerExploreReadModel> {
  if (identity.source === 'synthetic-development') return syntheticExplore();

  const catalogue = await readCatalogue();
  const catalogueBySlug = new Map(catalogue.map(p => [p.slug, p]));
  const [shelfData, routineData] = await Promise.all([
    readShelf(identity, catalogueBySlug),
    readRoutines(identity, catalogueBySlug),
  ]);
  return {
    catalogue,
    shelf: shelfData.shelf,
    shelfState: shelfData.shelfState,
    routine: routineData.routine,
    concerns: [],
    selectedRetailers: [],
    synthetic: false,
  };
}

export async function readMeShelf(identity: CustomerAccessIdentity): Promise<CustomerShelfReadModel> {
  if (identity.source === 'synthetic-development') return syntheticShelf();

  const catalogue = await readCatalogue();
  const catalogueBySlug = new Map(catalogue.map(p => [p.slug, p]));
  const shelfData = await readShelf(identity, catalogueBySlug);
  return {
    account: {
      displayName: identity.displayName,
      preferredFirstName: identity.preferredFirstName,
      email: identity.email,
      synthetic: false,
    },
    shelf: shelfData.shelf,
    shelfState: shelfData.shelfState,
    synthetic: false,
  };
}

export async function readMeRoutine(identity: CustomerAccessIdentity): Promise<CustomerRoutineReadModel> {
  if (identity.source === 'synthetic-development') return syntheticRoutine();

  const catalogue = await readCatalogue();
  const catalogueBySlug = new Map(catalogue.map(p => [p.slug, p]));
  const routineData = await readRoutines(identity, catalogueBySlug);
  return {
    account: {
      displayName: identity.displayName,
      preferredFirstName: identity.preferredFirstName,
      email: identity.email,
      synthetic: false,
    },
    routine: routineData.routine,
    routineProvenance: null,
    routineState: routineData.routineState,
    routines: routineData.routines,
    synthetic: false,
  };
}

export async function readMeConsult(identity: CustomerAccessIdentity): Promise<CustomerConsultReadModel> {
  if (identity.source === 'synthetic-development') return syntheticConsult();

  const catalogue = await readCatalogue();
  return {
    account: {
      displayName: identity.displayName,
      preferredFirstName: identity.preferredFirstName,
      email: identity.email,
      synthetic: false,
    },
    catalogue,
    concerns: [],
    synthetic: false,
  };
}

export async function readMeProduct(identity: CustomerAccessIdentity, slug: string): Promise<CustomerProductReadModel> {
  if (identity.source === 'synthetic-development') return syntheticProduct(slug);

  const catalogue = await readCatalogue();
  const catalogueBySlug = new Map(catalogue.map(p => [p.slug, p]));
  const [shelfData, routineData] = await Promise.all([
    readShelf(identity, catalogueBySlug),
    readRoutines(identity, catalogueBySlug),
  ]);

  return {
    account: {
      displayName: identity.displayName,
      preferredFirstName: identity.preferredFirstName,
      email: identity.email,
      synthetic: false,
    },
    product: catalogue.find(p => p.slug === slug) ?? null,
    shelf: shelfData.shelf,
    shelfState: shelfData.shelfState,
    routine: routineData.routine,
    synthetic: false,
  };
}
