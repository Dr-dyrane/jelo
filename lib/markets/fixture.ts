import "server-only";

export const MARKET_FIXTURE_ACCESS = {
  mode: "development-only",
  productionBehavior: "not-found",
} as const;

export const DEFAULT_MARKET_FIXTURE_PRODUCT =
  "cosrx-aloe-soothing-sun-cream-50ml";

export type MarketFixtureState =
  "purchase-report" | "location-lead" | "unavailable" | "disputed";

export type MarketFixtureProduct = {
  slug: string;
  brand: string;
  name: string;
  size: string;
  image?: string;
  identityNote: string;
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
  directions: readonly string[];
  actionEvidence: {
    exactProductIdentity: true;
    retailerLocationVerified: boolean;
    observationReviewed: boolean;
    usableAction: "directions" | "contact" | null;
  };
};

export type MarketPrimaryAction = {
  kind: "directions" | "contact" | "alternative" | "paused";
  label: string;
  enabled: boolean;
};

export const MARKET_FIXTURE_PRODUCTS = [
  {
    slug: DEFAULT_MARKET_FIXTURE_PRODUCT,
    brand: "COSRX",
    name: "Aloe Soothing Sun Cream",
    size: "50 ml",
    image:
      "https://www.cosrx.com/cdn/shop/files/aloe-soothing-sun-cream-spf50-pa-cosrx-official-1.jpg?v=1724835559&width=600",
    identityNote:
      "Exact 50 ml identity retained with the official COSRX packshot as a recognition reference.",
  },
  {
    slug: "miracle-natural-hair-anti-dandruff-shampoo",
    brand: "BEAUTIFUL YOU · MIRACLE",
    name: "Natural Hair Anti-Dandruff & Anti-Itch Shampoo",
    size: "400 ml",
    image:
      "https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/products/beautiful-you-miracle/miracle-natural-hair-anti-dandruff-shampoo/packshot.webp",
    identityNote:
      "Exact catalogue pack retained while physical Trade Fair evidence is still missing.",
  },
] as const satisfies readonly MarketFixtureProduct[];

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
    name: "Cyncel Cosmetics · A43 lead",
    state: "location-lead",
    stateLabel: "Location lead · contact missing",
    locationLabel: "Shop A43, Akwa-Ibom Plaza · reported, not resolved",
    identityLabel: "Name and unit are leads, not reviewed branch identity",
    evidenceLabel: "Location lead · stock not checked",
    evidenceNote:
      "This record preserves the reported Cyncel and A43 reference without treating it as a resolved shop identity or a stock observation.",
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
    query: "Kuza black castor oil",
    reason: "Exact variant and size are unresolved.",
  },
  {
    query: "Moroccan argan oil",
    reason: "Brand, format and size are unresolved.",
  },
  {
    query: "Lush relaxer",
    reason: "Exact product name, variant and size are unresolved.",
  },
] as const;

export function isMarketFixtureEnabled(
  nodeEnvironment: string | undefined = process.env.NODE_ENV,
) {
  return nodeEnvironment === "development";
}

export function listMarketFixtureProducts(): readonly MarketFixtureProduct[] {
  return MARKET_FIXTURE_PRODUCTS;
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

export function deriveMarketPrimaryAction(
  lead: Pick<
    MarketFixtureLead,
    "kind" | "state" | "directions" | "actionEvidence"
  >,
): MarketPrimaryAction {
  if (lead.kind === "direction-alert" || lead.state === "disputed") {
    return { kind: "paused", label: "Directions paused", enabled: false };
  }

  if (lead.state === "unavailable") {
    return {
      kind: "alternative",
      label: "No travel action",
      enabled: false,
    };
  }

  const evidence = lead.actionEvidence;
  const isEligible =
    evidence.exactProductIdentity &&
    evidence.retailerLocationVerified &&
    evidence.observationReviewed &&
    evidence.usableAction;

  if (!isEligible) {
    return { kind: "paused", label: "Research record only", enabled: false };
  }

  if (evidence.usableAction === "directions" && lead.directions.length > 0) {
    return {
      kind: "directions",
      label: "View text directions",
      enabled: true,
    };
  }

  if (evidence.usableAction === "contact") {
    return {
      kind: "contact",
      label: "Contact shop",
      enabled: true,
    };
  }

  return { kind: "paused", label: "Research record only", enabled: false };
}
