export const MARKET_FINDER_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const PHYSICAL_OBSERVATION_MAX_AGE_SECONDS = {
  field_visit: 14 * 24 * 60 * 60,
  retailer_confirmation: 7 * 24 * 60 * 60,
  branch_online_record: 3 * 24 * 60 * 60,
  community_report: 3 * 24 * 60 * 60,
} as const;

export type ActionablePhysicalObservationSource =
  keyof typeof PHYSICAL_OBSERVATION_MAX_AGE_SECONDS;

export type PhysicalProductAvailability =
  "in_stock" | "low_stock" | "out_of_stock" | "unknown" | "not_carried";

export type MarketFinderActionKind =
  | "directions"
  | "visit"
  | "phone"
  | "whatsapp"
  | "website"
  | "social_business_profile";

export type NormalizedMarketFinderPublicAction =
  | {
      kind: "directions" | "visit";
      destination: string;
      href: null;
    }
  | {
      kind: "phone" | "whatsapp" | "website" | "social_business_profile";
      destination: string;
      href: string;
    };

export type MarketFinderPublicAction = NormalizedMarketFinderPublicAction & {
  expiresAt: string;
};

export type MarketFinderMarket = {
  id: string;
  slug: string;
  name: string;
  city: string;
  stateRegion: string;
  countryCode: string;
};

export type MarketFinderProductIdentity = {
  identityVersionId: string;
  productId: string;
  slug: string;
  brand: string;
  variant: string;
  size: string;
  packageVersion: string;
  formulaVersion: string;
};

export type MarketFinderContext = {
  market: MarketFinderMarket;
  product: MarketFinderProductIdentity;
};

export type CurrentMarketFinderLocation = {
  id: string;
  slug: string;
  name: string;
  retailerName: string;
  placeName: string | null;
  shopNumber: string | null;
  floor: string | null;
  locationVerificationExpiresAt: string;
  locationIdentityEvidenceExpiresAt: string;
  observation: {
    id: string;
    availability: "in_stock" | "low_stock";
    priceNgn: number | null;
    observedAt: string;
    expiresAt: string;
    sourceMethod: ActionablePhysicalObservationSource;
    observedTitle: string;
    observedSize: string;
  };
  action: MarketFinderPublicAction;
};

export type MarketFinderResearchLocation = {
  kind: "location";
  id: string;
  reason: "evidence-expired" | "stock-unavailable" | "no-usable-action";
  slug: string;
  name: string;
  retailerName: string;
  placeName: string | null;
  shopNumber: string | null;
  floor: string | null;
  locationVerificationExpiresAt: string;
  locationIdentityEvidenceExpiresAt: string;
  observation: {
    id: string;
    availability: PhysicalProductAvailability;
    observedAt: string;
    expiresAt: string;
    sourceMethod: ActionablePhysicalObservationSource;
    observedTitle: string;
    observedSize: string;
  };
};

export type MarketFinderResearchWarning = {
  kind: "warning";
  id: string;
  reason: "location-disputed" | "location-needs-recheck";
};

/**
 * A public-safe, non-actionable record. These shapes deliberately contain no
 * direction, channel destination, or href fields.
 */
export type MarketFinderResearchRecord =
  MarketFinderResearchLocation | MarketFinderResearchWarning;

export type MarketFinderNonCurrentReason =
  | "invalid-context"
  | "no-published-context"
  | "no-approved-observation"
  | "location-disputed"
  | "evidence-expired"
  | "stock-unavailable"
  | "no-usable-action"
  | "public-read-disabled"
  | "repository-unavailable";

export type MarketFinderReadModel =
  | {
      state: "current";
      context: MarketFinderContext;
      locations: CurrentMarketFinderLocation[];
      researchRecords: MarketFinderResearchRecord[];
      evaluatedAt: string;
    }
  | {
      state: "empty" | "stale" | "unavailable" | "disputed";
      context: MarketFinderContext | null;
      locations: [];
      researchRecords: MarketFinderResearchRecord[];
      reason: MarketFinderNonCurrentReason;
      evaluatedAt: string;
    };

export type MarketFinderDirectoryModel =
  | {
      state: "current";
      market: MarketFinderMarket;
      products: MarketFinderProductIdentity[];
      evaluatedAt: string;
    }
  | {
      state: "empty" | "unavailable";
      market: MarketFinderMarket | null;
      products: [];
      reason: MarketFinderNonCurrentReason;
      evaluatedAt: string;
    };

export type ResolvedMarketReportTarget = {
  marketId: string;
  marketSlug: string;
  marketName: string;
  retailerLocationId: string;
  locationSlug: string;
  locationName: string;
  productIdentityVersionId: string;
  productId: string;
  productSlug: string;
  productBrand: string;
  productVariant: string;
  productSize: string;
};

export type MarketReportTargetResolution =
  | { status: "resolved"; context: ResolvedMarketReportTarget }
  | {
      status: "unresolved";
      reason: "invalid-context" | "unknown-context" | "repository-unavailable";
    };

export function isMarketFinderSlug(value: string): boolean {
  return (
    value.length >= 1 &&
    value.length <= 120 &&
    MARKET_FINDER_SLUG_PATTERN.test(value)
  );
}

function normalizedPublicActionText(value: string): string | null {
  const normalized = value.trim().replace(/\s+/gu, " ");
  const characterLength = Array.from(normalized).length;
  if (
    characterLength < 1 ||
    characterLength > 500 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function normalizedHttpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const comparisonHostname = hostname.replace(/\.+$/u, "");
    if (
      url.protocol !== "https:" ||
      url.username.length > 0 ||
      url.password.length > 0 ||
      comparisonHostname.length === 0 ||
      comparisonHostname === "localhost" ||
      comparisonHostname.endsWith(".localhost") ||
      comparisonHostname.endsWith(".local") ||
      /(?:^|\.)xn--/u.test(comparisonHostname) ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(comparisonHostname) ||
      hostname.startsWith("[")
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/**
 * Converts reviewed database destinations into the only public action shapes
 * the UI may render. Directions and physical-visit instructions stay text;
 * link actions receive a protocol- and channel-bounded href.
 */
export function normalizeMarketFinderPublicAction(input: {
  kind: MarketFinderActionKind;
  destination: string;
}): NormalizedMarketFinderPublicAction | null {
  const destination = normalizedPublicActionText(input.destination);
  if (!destination) return null;

  if (input.kind === "directions" || input.kind === "visit") {
    return { kind: input.kind, destination, href: null };
  }

  if (input.kind === "phone") {
    const number = (
      destination.toLowerCase().startsWith("tel:")
        ? destination.slice(4)
        : destination
    ).replace(/[\s().-]/gu, "");
    if (!/^\+[1-9]\d{7,14}$/u.test(number)) return null;
    return {
      kind: "phone",
      destination: number,
      href: `tel:${number}`,
    };
  }

  const url = normalizedHttpsUrl(destination);
  if (!url) return null;

  if (input.kind === "whatsapp") {
    const allowedHosts = new Set([
      "wa.me",
      "api.whatsapp.com",
      "www.whatsapp.com",
      "whatsapp.com",
    ]);
    const comparisonHostname = url.hostname.toLowerCase().replace(/\.+$/u, "");
    if (!allowedHosts.has(comparisonHostname)) return null;
  }

  const href = url.toString();
  return { kind: input.kind, destination: href, href };
}

export function marketFinderNonCurrent(input: {
  state: Exclude<MarketFinderReadModel["state"], "current">;
  reason: MarketFinderNonCurrentReason;
  context?: MarketFinderContext | null;
  researchRecords?: MarketFinderResearchRecord[];
  evaluatedAt: Date;
}): MarketFinderReadModel {
  return {
    state: input.state,
    reason: input.reason,
    context: input.context ?? null,
    locations: [],
    researchRecords: input.researchRecords ?? [],
    evaluatedAt: input.evaluatedAt.toISOString(),
  };
}

export function marketFinderDirectoryNonCurrent(input: {
  state: Exclude<MarketFinderDirectoryModel["state"], "current">;
  reason: MarketFinderNonCurrentReason;
  market?: MarketFinderMarket | null;
  evaluatedAt: Date;
}): MarketFinderDirectoryModel {
  return {
    state: input.state,
    reason: input.reason,
    market: input.market ?? null,
    products: [],
    evaluatedAt: input.evaluatedAt.toISOString(),
  };
}

/**
 * Cached rows are rechecked at request time. An entry that was current when it
 * entered Next's data cache can never retain that label after any location,
 * observation, or action evidence expiry passes.
 */
export function enforceMarketFinderFreshness(
  model: MarketFinderReadModel,
  now: Date,
): MarketFinderReadModel {
  const nowMs = now.getTime();

  function isFuture(value: string): boolean {
    const expiry = Date.parse(value);
    return Number.isFinite(expiry) && expiry > nowMs;
  }

  function genericRecheck(id: string): MarketFinderResearchWarning {
    return {
      kind: "warning",
      id: `location-recheck:${id}`,
      reason: "location-needs-recheck",
    };
  }

  function sanitizeResearchRecord(
    record: MarketFinderResearchRecord,
  ): MarketFinderResearchRecord {
    if (record.kind === "warning") return record;
    if (
      !isFuture(record.locationVerificationExpiresAt) ||
      !isFuture(record.locationIdentityEvidenceExpiresAt)
    ) {
      return genericRecheck(record.id);
    }
    if (!isFuture(record.observation.expiresAt)) {
      return { ...record, reason: "evidence-expired" };
    }
    return record;
  }

  function fromFormerlyCurrent(
    location: CurrentMarketFinderLocation,
  ): MarketFinderResearchRecord {
    if (
      !isFuture(location.locationVerificationExpiresAt) ||
      !isFuture(location.locationIdentityEvidenceExpiresAt)
    ) {
      return genericRecheck(location.id);
    }

    return {
      kind: "location",
      id: location.id,
      reason: isFuture(location.observation.expiresAt)
        ? "no-usable-action"
        : "evidence-expired",
      slug: location.slug,
      name: location.name,
      retailerName: location.retailerName,
      placeName: location.placeName,
      shopNumber: location.shopNumber,
      floor: location.floor,
      locationVerificationExpiresAt: location.locationVerificationExpiresAt,
      locationIdentityEvidenceExpiresAt:
        location.locationIdentityEvidenceExpiresAt,
      observation: location.observation,
    };
  }

  function dedupeResearchRecords(
    records: MarketFinderResearchRecord[],
  ): MarketFinderResearchRecord[] {
    const unique = new Map<string, MarketFinderResearchRecord>();
    for (const record of records) unique.set(record.id, record);
    return [...unique.values()];
  }

  const existingResearch = model.researchRecords.map(sanitizeResearchRecord);
  if (model.state !== "current") {
    return {
      ...model,
      researchRecords: dedupeResearchRecords(existingResearch),
      evaluatedAt: now.toISOString(),
    };
  }

  const locations: CurrentMarketFinderLocation[] = [];
  const downgraded: MarketFinderResearchRecord[] = [];
  for (const location of model.locations) {
    const locationIsCurrent =
      isFuture(location.locationVerificationExpiresAt) &&
      isFuture(location.locationIdentityEvidenceExpiresAt);
    const observationIsCurrent = isFuture(location.observation.expiresAt);
    const actionIsCurrent = isFuture(location.action.expiresAt);
    const action = actionIsCurrent
      ? normalizeMarketFinderPublicAction(location.action)
      : null;

    if (locationIsCurrent && observationIsCurrent && action) {
      locations.push({
        ...location,
        action: { ...action, expiresAt: location.action.expiresAt },
      });
    } else {
      downgraded.push(fromFormerlyCurrent(location));
    }
  }

  const researchRecords = dedupeResearchRecords([
    ...existingResearch,
    ...downgraded,
  ]);
  if (locations.length > 0) {
    return {
      ...model,
      locations,
      researchRecords,
      evaluatedAt: now.toISOString(),
    };
  }

  if (researchRecords.some((record) => record.reason === "location-disputed")) {
    return marketFinderNonCurrent({
      state: "disputed",
      reason: "location-disputed",
      context: model.context,
      researchRecords,
      evaluatedAt: now,
    });
  }
  if (
    researchRecords.some(
      (record) =>
        record.reason === "evidence-expired" ||
        record.reason === "location-needs-recheck",
    )
  ) {
    return marketFinderNonCurrent({
      state: "stale",
      reason: "evidence-expired",
      context: model.context,
      researchRecords,
      evaluatedAt: now,
    });
  }

  return marketFinderNonCurrent({
    state: "unavailable",
    reason: researchRecords.some(
      (record) => record.reason === "stock-unavailable",
    )
      ? "stock-unavailable"
      : "no-usable-action",
    context: model.context,
    researchRecords,
    evaluatedAt: now,
  });
}
