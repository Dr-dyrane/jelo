import "server-only";

import { productBySlug } from "@/data/catalogue";
export {
  deriveMarketPrimaryAction,
  type MarketPrimaryAction,
} from "@/lib/markets/action";

export const MARKET_FIXTURE_ACCESS = {
  mode: "development-only",
  productionBehavior: "not-found",
} as const;

export const DEFAULT_MARKET_FIXTURE_PRODUCT =
  "cosrx-aloe-soothing-sun-cream-50ml";
export const ROUTE_REHEARSAL_MARKET_FIXTURE_PRODUCT =
  "fixture-exact-pack-route-rehearsal";

export type MarketFixtureState =
  | "ready"
  | "purchase-report"
  | "location-lead"
  | "stale"
  | "unavailable"
  | "disputed";

export type MarketFixtureProduct = {
  slug: string;
  brand: string;
  name: string;
  size: string;
  identityNote: string;
  listed: boolean;
};

export type MarketFixture = {
  slug: string;
  name: string;
  location: string;
  summary: string;
};

export type MarketFixtureLead = {
  kind: "shop" | "direction-alert";
  slug: string;
  marketSlug: string;
  productSlug: string;
  name: string;
  state: MarketFixtureState;
  stateLabel: string;
  locationLabel: string;
  identityLabel: string;
  evidenceLabel: string;
  evidenceNote: string;
  observedAt: string;
  observedAtLabel: string;
  expiresAt?: string;
  expiresAtLabel?: string;
  directions: readonly string[];
  actionEvidence: {
    exactProductIdentity: true;
    retailerLocationVerified: boolean;
    observationReviewed: boolean;
    usableAction: "directions" | "contact" | null;
  };
};

export const MARKET_FIXTURE_PRODUCTS: readonly MarketFixtureProduct[] = [
  {
    slug: DEFAULT_MARKET_FIXTURE_PRODUCT,
    brand: "COSRX",
    name: "Aloe Soothing Sun Cream",
    size: "50 ml",
    identityNote:
      "Exact 50 ml identity retained; a reviewed transparent packshot is still pending.",
    listed: true,
  },
  {
    slug: ROUTE_REHEARSAL_MARKET_FIXTURE_PRODUCT,
    brand: "DEVELOPMENT FIXTURE",
    name: "Exact Pack Route Rehearsal",
    size: "400 ml · fictional",
    identityNote:
      "Fictional exact-pack identity used only to exercise the ready-route UI.",
    listed: false,
  },
] as const;

export const MARKET_FIXTURE_MARKETS = [
  {
    slug: "trade-fair",
    name: "Lagos Trade Fair",
    location: "Lagos, Nigeria",
    summary:
      "A list-first research fixture for testing exact-product evidence and landmark directions before any market guidance is published.",
  },
] as const satisfies readonly MarketFixture[];

export const MARKET_FIXTURE_LEADS = [
  {
    kind: "shop",
    slug: "fixture-beauty-supply-route-rehearsal",
    marketSlug: "trade-fair",
    productSlug: ROUTE_REHEARSAL_MARKET_FIXTURE_PRODUCT,
    name: "Fixture Beauty Supply",
    state: "ready",
    stateLabel: "Reviewed fixture · route enabled",
    locationLabel: "Prototype Plaza · Shop D01 (fictional)",
    identityLabel: "Fictional shop identity used only for interaction testing",
    evidenceLabel: "Synthetic reviewed observation · 1 Sep 2026",
    evidenceNote:
      "This is deliberately fictional data for testing an eligible result, text directions and browser navigation. It is not Trade Fair evidence.",
    observedAt: "2026-09-01",
    observedAtLabel: "1 Sep 2026",
    expiresAt: "2026-09-03",
    expiresAtLabel: "3 Sep 2026",
    directions: [
      "Start at the entrance labelled Prototype Entrance in this development fixture.",
      "Continue to the fictional Prototype Plaza and follow the D-row signs.",
      "Stop at fictional Shop D01 and confirm the fictional 400 ml rehearsal pack.",
    ],
    actionEvidence: {
      exactProductIdentity: true,
      retailerLocationVerified: true,
      observationReviewed: true,
      usableAction: "directions",
    },
  },
  {
    kind: "shop",
    slug: "fixture-hair-supply-stale-observation",
    marketSlug: "trade-fair",
    productSlug: ROUTE_REHEARSAL_MARKET_FIXTURE_PRODUCT,
    name: "Fixture Hair Supply · expired observation",
    state: "stale",
    stateLabel: "Evidence expired · recheck needed",
    locationLabel: "Prototype Hair Section · Shop H02 (fictional)",
    identityLabel:
      "Fictional verified location; product evidence is no longer current",
    evidenceLabel: "Synthetic observation · expired 30 Aug 2026",
    evidenceNote:
      "This fictional record tests fail-closed freshness. The shop can remain verified while an expired product observation removes the travel action.",
    observedAt: "2026-08-01",
    observedAtLabel: "1 Aug 2026",
    expiresAt: "2026-08-30",
    expiresAtLabel: "30 Aug 2026",
    directions: [],
    actionEvidence: {
      exactProductIdentity: true,
      retailerLocationVerified: true,
      observationReviewed: true,
      usableAction: null,
    },
  },
  {
    kind: "shop",
    slug: "shop-beside-cyncel-lead",
    marketSlug: "trade-fair",
    productSlug: DEFAULT_MARKET_FIXTURE_PRODUCT,
    name: "Shop beside Cyncel · identity unresolved",
    state: "purchase-report",
    stateLabel: "Recent purchase report · shop unresolved",
    locationLabel: "Akwa-Ibom Plaza area · exact unit unresolved",
    identityLabel: "Shop identity remains a research lead",
    evidenceLabel: "First-person purchase report · 1 Sep 2026",
    evidenceNote:
      "The exact COSRX 50 ml pack was reported bought from a shop beside the Cyncel lead. The shop name and unit still require review.",
    observedAt: "2026-09-01",
    observedAtLabel: "1 Sep 2026",
    directions: [],
    actionEvidence: {
      exactProductIdentity: true,
      retailerLocationVerified: false,
      observationReviewed: false,
      usableAction: null,
    },
  },
  {
    kind: "shop",
    slug: "cyncel-a43-lead",
    marketSlug: "trade-fair",
    productSlug: DEFAULT_MARKET_FIXTURE_PRODUCT,
    name: "Cyncel Cosmetics · A43 branch",
    state: "location-lead",
    stateLabel: "Branch verified · exact pack check needed",
    locationLabel: "Shop A43, Akwa-Ibom Plaza",
    identityLabel: "Official branch identity and public contact verified",
    evidenceLabel: "Official branch and product pages · reviewed 2 Sep 2026",
    evidenceNote:
      "Cyncel’s official site confirms Shop A43, Akwa-Ibom Plaza and public contact details. Its current product page lists COSRX Aloe Soothing Sun Cream as in stock online, but it omits the pack size and does not establish A43 shelf stock. Cyncel is not attributed as the unnamed seller in the purchase report.",
    observedAt: "2026-09-02",
    observedAtLabel: "2 Sep 2026",
    directions: [],
    actionEvidence: {
      exactProductIdentity: true,
      retailerLocationVerified: true,
      observationReviewed: false,
      usableAction: null,
    },
  },
  {
    kind: "shop",
    slug: "kuddy-cosmetics-visit-record",
    marketSlug: "trade-fair",
    productSlug: DEFAULT_MARKET_FIXTURE_PRODUCT,
    name: "Kuddy Cosmetics · visit record",
    state: "unavailable",
    stateLabel: "Reported unavailable",
    locationLabel: "Trade Fair · branch details unresolved",
    identityLabel: "Visit report; branch identity needs review",
    evidenceLabel: "Product-scoped prototype scenario · 1 Sep 2026",
    evidenceNote:
      "This no-stock scenario applies only to COSRX Aloe Soothing Sun Cream 50 ml in the prototype. It says nothing about Kuddy’s other products or branches.",
    observedAt: "2026-09-01",
    observedAtLabel: "1 Sep 2026",
    directions: [],
    actionEvidence: {
      exactProductIdentity: true,
      retailerLocationVerified: false,
      observationReviewed: false,
      usableAction: null,
    },
  },
  {
    kind: "direction-alert",
    slug: "disputed-plaza-reference",
    marketSlug: "trade-fair",
    productSlug: DEFAULT_MARKET_FIXTURE_PRODUCT,
    name: "Disputed plaza direction",
    state: "disputed",
    stateLabel: "Location disputed · directions paused",
    locationLabel: "No route shown",
    identityLabel: "The referenced plaza is not established",
    evidenceLabel: "Conflicting direction report · 1 Sep 2026",
    evidenceNote:
      "A prior direction named “Moore Plaza,” but the shopper could not find it. This fixture does not claim that the plaza exists and does not route people there.",
    observedAt: "2026-09-01",
    observedAtLabel: "1 Sep 2026",
    directions: [],
    actionEvidence: {
      exactProductIdentity: true,
      retailerLocationVerified: false,
      observationReviewed: false,
      usableAction: null,
    },
  },
] as const satisfies readonly MarketFixtureLead[];

export const MARKET_UNRESOLVED_REQUESTS = [
  {
    slug: "kuza-black-castor-oil",
    query: "Kuza black castor oil",
    reason: "Exact variant and size are unresolved.",
  },
  {
    slug: "moroccan-argan-oil",
    query: "Moroccan argan oil",
    reason: "Brand, format and size are unresolved.",
  },
  {
    slug: "miracle-anti-dandruff-shampoo",
    query: "Miracle anti-dandruff shampoo",
    reason: "Natural Hair or Processed Hair variant and size are unresolved.",
  },
  {
    slug: "lush-relaxer",
    query: "Lush relaxer",
    reason: "Exact product name, variant and size are unresolved.",
  },
] as const;

const MARKET_UNRESOLVED_REQUEST_ALIASES: Readonly<Record<string, string>> = {
  "miracle-natural-hair-anti-dandruff-shampoo": "miracle-anti-dandruff-shampoo",
};

export function findMarketUnresolvedRequest(slug: string) {
  const canonicalSlug = MARKET_UNRESOLVED_REQUEST_ALIASES[slug] ?? slug;
  return MARKET_UNRESOLVED_REQUESTS.find(
    (request) => request.slug === canonicalSlug,
  );
}

export function isMarketFixtureEnabled(
  nodeEnvironment: string | undefined = process.env.NODE_ENV,
) {
  return nodeEnvironment === "development";
}

export function listMarketFixtureProducts(): readonly MarketFixtureProduct[] {
  return MARKET_FIXTURE_PRODUCTS.filter((product) => product.listed);
}

export function resolveMarketFixtureProductPackshot(
  product: MarketFixtureProduct,
) {
  const publishedProduct = productBySlug(product.slug);
  if (
    !publishedProduct ||
    publishedProduct.brand !== product.brand ||
    publishedProduct.name !== product.name ||
    publishedProduct.size !== product.size
  ) {
    return undefined;
  }

  return publishedProduct.image;
}

export function findMarketFixtureProduct(slug: string) {
  return MARKET_FIXTURE_PRODUCTS.find((product) => product.slug === slug);
}

export function resolveMarketFixtureProductQuery(
  value: string | string[] | undefined,
) {
  if (typeof value !== "string" || value.length === 0) return undefined;
  return findMarketFixtureProduct(value);
}

export function listMarketFixtures(): readonly MarketFixture[] {
  return MARKET_FIXTURE_MARKETS;
}

export function findMarketFixture(slug: string) {
  return MARKET_FIXTURE_MARKETS.find((market) => market.slug === slug);
}

export function listMarketFixtureLeads(
  marketSlug: string,
  productSlug: string,
): readonly MarketFixtureLead[] {
  return MARKET_FIXTURE_LEADS.filter(
    (lead) =>
      lead.marketSlug === marketSlug && lead.productSlug === productSlug,
  );
}

export function findMarketFixtureShop(
  marketSlug: string,
  productSlug: string,
  shopSlug: string,
) {
  return MARKET_FIXTURE_LEADS.find(
    (lead) =>
      lead.kind === "shop" &&
      lead.marketSlug === marketSlug &&
      lead.productSlug === productSlug &&
      lead.slug === shopSlug,
  );
}
