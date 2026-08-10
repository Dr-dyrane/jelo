import 'server-only';

import { products as staticProducts } from '@/data/catalogue';
import { listCatalogueProducts } from '@/lib/catalogue/repository';
import { getMarketTrendsReadModel } from '@/lib/share/market-trends';
import type { Product } from '@/data/products';
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
  type CustomerPortalConcernReference,
} from './portal-model';
import { customerShelfService } from './shelf-service';
import { customerRoutineService } from './routine-service';
import { customerConcernService } from './concern-service';
import { concerns as knowledgeLibraryConcerns } from '@/data/knowledge';
import { buildMarketReading, type MarketReading } from '@/modules/commerce/market-reading';
import type { MarketTrendsReadModel } from '@/modules/commerce/market-trends';
import { deriveRoutineContext, unavailableRoutineContext, type ProductRoutineContext } from './routine-context';
import { deriveProductShelfContext, type ProductShelfContext } from './product-shelf-context';

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
 * Governed semantic Home feed model.
 *
 * HomeView renders these semantic props directly. It must not derive
 * offer freshness, attention eligibility, or lifecycle meaning from
 * raw arrays. All eligibility and lifecycle derivation is server-owned
 * in this read model.
 */
export type CustomerHomeReadModel = {
  account: CustomerPortalViewModel['account'];
  greeting: string;
  askEntry: { href: string; label: string };
  routineSection: {
    visible: boolean;
    provenance: string | null;
    steps: readonly CustomerPortalRoutineStep[];
    state: NonNullable<CustomerPortalViewModel['routineState']>;
  };
  shelfSection: {
    visible: boolean;
    items: readonly CustomerPortalShelfItem[];
    state: CustomerPortalViewModel['shelfState'];
  };
  priceEvidenceSection: {
    visible: boolean;
    items: readonly {
      product: CustomerPortalProduct;
      priceLabel: string;
      retailerCount: number;
    }[];
  };
  attentionSection: {
    visible: boolean;
    items: readonly {
      kind: 'shelf-unavailable' | 'shelf-changed' | 'routine-unresolved';
      label: string;
      href: string;
    }[];
  };
  /** Products reviewed for the customer's saved concerns, not already on shelf or in a routine. */
  concernProducts: {
    visible: boolean;
    concernNames: readonly string[];
    items: readonly CustomerPortalProduct[];
  };
  /** The customer's saved concern references, for shell chrome and first-time detection. */
  concerns: readonly CustomerPortalConcernReference[];
  /** True when shelf, routine, and concerns are all empty — drives the first-time greeting. */
  firstTime: boolean;
  exploreEntry: { href: string; label: string };
  /** Skincare market trends — price drops, increases, and out-of-stock alerts. */
  marketTrendsSection: MarketTrendsReadModel;
  synthetic: boolean;
};

/**
 * Explore route data: full catalogue plus shelf context for filtering.
 */
export type CustomerExploreReadModel = {
  account: CustomerPortalViewModel['account'];
  catalogue: readonly CustomerPortalProduct[];
  shelf: readonly CustomerPortalShelfItem[];
  shelfState: CustomerPortalViewModel['shelfState'];
  routine: readonly CustomerPortalRoutineStep[];
  routineState: NonNullable<CustomerPortalViewModel['routineState']>;
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
  shelf: readonly CustomerPortalShelfItem[];
  shelfState: CustomerPortalViewModel['shelfState'];
  routine: readonly CustomerPortalRoutineStep[];
  routineProvenance: string | null;
  routineState: NonNullable<CustomerPortalViewModel['routineState']>;
  routines: readonly CustomerPortalSavedRoutine[];
  concerns: CustomerPortalViewModel['concerns'];
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
 * Shell summary for the Product route: real counts, not a fake adapter.
 */
export type ProductShellSummary = {
  account: CustomerPortalViewModel['account'];
  shelfCount: number;
  shelfAvailable: boolean;
  shelfUnavailableMessage: string | null;
  routineStepCount: number;
  routineAvailable: boolean;
  routineUnavailableMessage: string | null;
  concerns: CustomerPortalViewModel['concerns'];
  synthetic: boolean;
};

/**
 * Member product route data: one product plus market reading and personal context.
 * The market reading is server-owned and route-scoped — it is not stored on the
 * generic CustomerPortalProduct.
 */
export type CustomerProductReadModel = {
  account: CustomerPortalViewModel['account'];
  product: CustomerPortalProduct | null;
  marketReading: MarketReading;
  /** Explicit Shelf context for this product. */
  shelfContext: ProductShelfContext;
  /** Shell summary with real global counts. */
  shell: ProductShellSummary;
  /** Routine context with ready/unavailable authority. */
  routineContext: ProductRoutineContext;
  synthetic: boolean;
  /** Complete preview shelf and catalogue for synthetic customers. Null in production. */
  previewShelf: {
    shelf: readonly CustomerPortalShelfItem[];
    catalogue: readonly CustomerPortalProduct[];
  } | null;
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

async function readConcerns(identity: CustomerAccessIdentity): Promise<readonly CustomerPortalConcernReference[]> {
  const concernResult = await customerConcernService.read(identity);
  if (concernResult.status !== 'ready') return [];
  return concernResult.concerns
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
    .filter((c): c is CustomerPortalConcernReference => c !== null);
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
  const shelfItems = portal.shelf;
  const routineSteps = portal.routine;
  const greeting = portal.account.preferredFirstName ?? 'Welcome back';
  const priceEvidenceItems = shelfItems
    .filter(item => item.product)
    .slice(0, 6)
    .map(item => {
      const product = item.product!;
      const retailerCount = product.freshExactRetailerNames.length;
      return {
        product,
        priceLabel: product.priceLabel ?? 'Price unavailable',
        retailerCount,
      };
    })
    .filter(item => item.retailerCount > 0);
  const attentionItems = shelfItems
    .filter(item => item.availability !== 'available')
    .map(item => ({
      kind: item.availability === 'changed' ? 'shelf-changed' as const : 'shelf-unavailable' as const,
      label: `${item.snapshot.brand} ${item.snapshot.name} — ${item.availability === 'changed' ? 'Changed' : 'Unavailable'}`,
      href: '/me/shelf',
    }));
  return {
    account: portal.account,
    greeting,
    askEntry: { href: '/me/consult', label: 'Ask Me' },
    routineSection: {
      visible: routineSteps.length > 0,
      provenance: null,
      steps: routineSteps.slice(0, 4),
      state: portal.routineState ?? { status: 'ready', message: null },
    },
    shelfSection: {
      visible: shelfItems.length > 0,
      items: shelfItems.slice(0, 6),
      state: portal.shelfState,
    },
    priceEvidenceSection: {
      visible: priceEvidenceItems.length > 0,
      items: priceEvidenceItems,
    },
    attentionSection: {
      visible: attentionItems.length > 0,
      items: attentionItems,
    },
    concernProducts: {
      visible: false,
      concernNames: [],
      items: [],
    },
    concerns: portal.concerns,
    firstTime: shelfItems.length === 0 && routineSteps.length === 0 && portal.concerns.length === 0,
    exploreEntry: { href: '/me/explore', label: 'Explore products' },
    marketTrendsSection: {
      summary: { productCount: 0, offerCount: 0, storeCount: 0, pricedCount: 0, outOfStockCount: 0 },
      priceDrops: [],
      priceIncreases: [],
      outOfStockAlerts: [],
    },
    synthetic: true,
  };
}

function syntheticExplore(): CustomerExploreReadModel {
  const portal = createSyntheticCustomerPortal();
  return {
    account: portal.account,
    catalogue: staticProducts.map(toCustomerPortalProduct),
    shelf: portal.shelf,
    shelfState: portal.shelfState,
    routine: portal.routine,
    routineState: portal.routineState ?? { status: 'ready', message: null },
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
    shelf: portal.shelf,
    shelfState: portal.shelfState,
    routine: portal.routine,
    routineProvenance: portal.routineProvenance,
    routineState: portal.routineState ?? { status: 'ready', message: null },
    routines: portal.routines ?? [],
    concerns: portal.concerns,
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
  const product = catalogue.find(p => p.slug === slug) ?? null;
  const rawProduct = staticProducts.find(p => p.slug === slug);
  const shelfAvailable = portal.shelfState.status === 'ready';
  const shelfContext = deriveProductShelfContext(
    portal.shelf,
    slug,
    shelfAvailable,
    portal.shelfState.message,
  );
  const routineContext = portal.routineState?.status === 'unavailable'
    ? unavailableRoutineContext()
    : deriveRoutineContext(portal.routines ?? [], slug);
  return {
    account: portal.account,
    product,
    marketReading: rawProduct
      ? buildMarketReading(rawProduct.offers, 'NG')
      : buildMarketReading([], 'NG'),
    shelfContext,
    shell: {
      account: portal.account,
      shelfCount: portal.shelf.length,
      shelfAvailable,
      shelfUnavailableMessage: portal.shelfState.message,
      routineStepCount: portal.routine.length,
      routineAvailable: (portal.routineState?.status ?? 'ready') === 'ready',
      routineUnavailableMessage: portal.routineState?.message ?? null,
      concerns: portal.concerns,
      synthetic: true,
    },
    routineContext,
    synthetic: true,
    previewShelf: {
      shelf: portal.shelf,
      catalogue,
    },
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
  const [shelfData, routineData, concerns, marketTrendsSection] = await Promise.all([
    readShelf(identity, catalogueBySlug),
    readRoutines(identity, catalogueBySlug),
    readConcerns(identity),
    getMarketTrendsReadModel(),
  ]);

  const shelfItems = shelfData.shelf;
  const routineSteps = routineData.routine;
  const greeting = identity.preferredFirstName ?? 'Welcome back';

  // Governed eligibility: the model passes only eligible price-evidence
  // items. The view does not filter freshness again.
  const priceEvidenceItems = shelfItems
    .filter(item => item.product)
    .slice(0, 6)
    .map(item => {
      const product = item.product!;
      const retailerCount = product.freshExactRetailerNames.length;
      return {
        product,
        priceLabel: product.priceLabel ?? 'Price unavailable',
        retailerCount,
      };
    })
    .filter(item => item.retailerCount > 0);

  // Governed eligibility: attention items are derived server-side from
  // authoritative lifecycle state. The view does not inspect shelf
  // arrays to decide what needs attention.
  const attentionItems = shelfItems
    .filter(item => item.availability !== 'available')
    .map(item => ({
      kind: item.availability === 'changed' ? 'shelf-changed' as const : 'shelf-unavailable' as const,
      label: `${item.snapshot.brand} ${item.snapshot.name} — ${item.availability === 'changed' ? 'Changed' : 'Unavailable'}`,
      href: '/me/shelf',
    }));

  // Governed eligibility: concern products are catalogue products whose
  // supportedConcernSlugs intersect the customer's saved concern slugs,
  // minus products already on the shelf or in a routine. Limited to 6.
  const concernSlugs = new Set(
    concerns.filter(c => c.kind === 'concern').map(c => c.slug),
  );
  const ownedSlugs = new Set<string>();
  for (const item of shelfItems) {
    if (item.product) ownedSlugs.add(item.product.slug);
  }
  for (const step of routineSteps) {
    ownedSlugs.add(step.product.slug);
  }
  const concernProductItems = catalogue
    .filter(product => (
      !ownedSlugs.has(product.slug)
      && product.supportedConcernSlugs.some(slug => concernSlugs.has(slug))
    ))
    .slice(0, 6);
  const concernNames = concerns
    .filter(c => c.kind === 'concern')
    .map(c => c.name);
  const firstTime = shelfItems.length === 0
    && routineSteps.length === 0
    && concerns.length === 0;

  return {
    account: {
      displayName: identity.displayName,
      preferredFirstName: identity.preferredFirstName,
      email: identity.email,
      synthetic: false,
    },
    greeting,
    askEntry: { href: '/me/consult', label: 'Ask Me' },
    routineSection: {
      visible: routineSteps.length > 0,
      provenance: null,
      steps: routineSteps.slice(0, 4),
      state: routineData.routineState,
    },
    shelfSection: {
      visible: shelfItems.length > 0,
      items: shelfItems.slice(0, 6),
      state: shelfData.shelfState,
    },
    priceEvidenceSection: {
      visible: priceEvidenceItems.length > 0,
      items: priceEvidenceItems,
    },
    attentionSection: {
      visible: attentionItems.length > 0,
      items: attentionItems,
    },
    concernProducts: {
      visible: concernProductItems.length > 0,
      concernNames,
      items: concernProductItems,
    },
    concerns,
    firstTime,
    exploreEntry: { href: '/me/explore', label: 'Explore products' },
    marketTrendsSection,
    synthetic: false,
  };
}

export async function readMeExplore(identity: CustomerAccessIdentity): Promise<CustomerExploreReadModel> {
  if (identity.source === 'synthetic-development') return syntheticExplore();

  const catalogue = await readCatalogue();
  const catalogueBySlug = new Map(catalogue.map(p => [p.slug, p]));
  const [shelfData, routineData, concerns] = await Promise.all([
    readShelf(identity, catalogueBySlug),
    readRoutines(identity, catalogueBySlug),
    readConcerns(identity),
  ]);
  return {
    account: {
      displayName: identity.displayName,
      preferredFirstName: identity.preferredFirstName,
      email: identity.email,
      synthetic: false,
    },
    catalogue,
    shelf: shelfData.shelf,
    shelfState: shelfData.shelfState,
    routine: routineData.routine,
    routineState: routineData.routineState,
    concerns,
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
  const [shelfData, routineData, concerns] = await Promise.all([
    readShelf(identity, catalogueBySlug),
    readRoutines(identity, catalogueBySlug),
    readConcerns(identity),
  ]);
  return {
    account: {
      displayName: identity.displayName,
      preferredFirstName: identity.preferredFirstName,
      email: identity.email,
      synthetic: false,
    },
    shelf: shelfData.shelf,
    shelfState: shelfData.shelfState,
    routine: routineData.routine,
    routineProvenance: null,
    routineState: routineData.routineState,
    routines: routineData.routines,
    concerns,
    synthetic: false,
  };
}

export async function readMeConsult(identity: CustomerAccessIdentity): Promise<CustomerConsultReadModel> {
  if (identity.source === 'synthetic-development') return syntheticConsult();

  const [catalogue, concerns] = await Promise.all([
    readCatalogue(),
    readConcerns(identity),
  ]);
  return {
    account: {
      displayName: identity.displayName,
      preferredFirstName: identity.preferredFirstName,
      email: identity.email,
      synthetic: false,
    },
    catalogue,
    concerns,
    synthetic: false,
  };
}

/**
 * Read the Member Product route model from a pre-resolved catalogue product.
 *
 * The caller performs the single catalogue lookup and passes the result here.
 * This function does NOT call findCatalogueProduct — one lookup for the entire
 * route.
 */
export async function readMeProduct(identity: CustomerAccessIdentity, product: Product, now: number | Date = Date.now()): Promise<CustomerProductReadModel> {
  if (identity.source === 'synthetic-development') return syntheticProduct(product.slug);

  const slug = product.slug;
  const portalProduct = toCustomerPortalProduct(product);
  const catalogueBySlug = new Map([[slug, portalProduct]]);

  // Route-scoped reads: count + contextForProduct for shelf, summary +
  // contextForProduct for routine. Does NOT load the complete shelf or every
  // routine merely to render one product.
  const [shelfCountResult, shelfContextResult, routineSummaryResult, routineContextResult, concerns] = await Promise.all([
    customerShelfService.count(identity),
    customerShelfService.contextForProduct(identity, slug),
    customerRoutineService.summary(identity),
    customerRoutineService.contextForProduct(identity, slug),
    readConcerns(identity),
  ]);

  const shelfAvailable = shelfCountResult.status === 'ready' && shelfContextResult.status === 'ready';
  const shelfUnavailableMessage = shelfCountResult.status === 'unavailable'
    ? shelfCountResult.message
    : shelfContextResult.status === 'unavailable'
      ? shelfContextResult.message
      : null;

  const shelfItems = shelfContextResult.status === 'ready'
    ? shelfContextResult.items.map(item => resolveCustomerPortalShelfItem(item, catalogueBySlug))
    : [];
  const shelfContext = deriveProductShelfContext(
    shelfItems,
    slug,
    shelfAvailable,
    shelfUnavailableMessage,
  );

  const routineAvailable = routineSummaryResult.status === 'ready' && routineContextResult.status === 'ready';
  const routineUnavailableMessage = routineSummaryResult.status === 'unavailable'
    ? routineSummaryResult.message
    : routineContextResult.status === 'unavailable'
      ? routineContextResult.message
      : null;

  const routines = routineContextResult.status === 'ready'
    ? routineContextResult.routines.map(routine => resolveCustomerPortalRoutine(routine, catalogueBySlug))
    : [];
  const routineContext = !routineAvailable
    ? unavailableRoutineContext()
    : deriveRoutineContext(routines, slug);

  const account = {
    displayName: identity.displayName,
    preferredFirstName: identity.preferredFirstName,
    email: identity.email,
    synthetic: false,
  };

  return {
    account,
    product: portalProduct,
    marketReading: buildMarketReading(product.offers, 'NG', now),
    shelfContext,
    shell: {
      account,
      shelfCount: shelfCountResult.status === 'ready' ? shelfCountResult.count : 0,
      shelfAvailable,
      shelfUnavailableMessage,
      routineStepCount: routineSummaryResult.status === 'ready' ? routineSummaryResult.stepCount : 0,
      routineAvailable,
      routineUnavailableMessage,
      concerns,
      synthetic: false,
    },
    routineContext,
    synthetic: false,
    previewShelf: null,
  };
}
