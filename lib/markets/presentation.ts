import type {
  CurrentMarketFinderLocation,
  MarketFinderContext,
  MarketFinderMarket,
  MarketFinderProductIdentity,
  MarketFinderResearchLocation,
  MarketFinderResearchRecord,
} from "@/lib/markets/domain";
import { resolveMarketFinderProductPackshotDecision } from "@/lib/markets/market-finder-packshot-binding";

export type MarketSurfaceProduct = {
  slug: string;
  brand: string;
  name: string;
  size: string;
  identityNote: string;
  image?: string;
};

export type MarketSurfaceMarket = {
  slug: string;
  name: string;
  location: string;
};

export type MarketSurfaceExternalAction = {
  href: string;
  label: string;
};

export type MarketSurfaceLead = {
  kind: "shop";
  slug: string;
  marketSlug: string;
  productSlug: string;
  name: string;
  state: "ready";
  stateLabel: string;
  locationLabel: string;
  identityLabel: string;
  evidenceLabel: string;
  evidenceNote: string;
  observedAt: string;
  observedAtLabel: string;
  expiresAt: string;
  expiresAtLabel: string;
  directions: readonly string[];
  externalAction?: MarketSurfaceExternalAction;
  actionEvidence: {
    exactProductIdentity: true;
    retailerLocationVerified: true;
    observationReviewed: true;
    usableAction: "directions" | "contact";
  };
};

export type MarketSurfaceResearchLead = {
  kind: "shop" | "direction-alert";
  slug: string;
  name: string;
  state: "location-lead" | "stale" | "unavailable" | "disputed";
  stateLabel: string;
  locationLabel: string;
  identityLabel: string;
  evidenceLabel: string;
  evidenceNote: string;
  observedAt?: string;
  observedAtLabel?: string;
  expiresAt?: string;
  expiresAtLabel?: string;
  directions: readonly [];
  detailRecordAvailable: false;
  actionEvidence: {
    exactProductIdentity: true;
    retailerLocationVerified: boolean;
    observationReviewed: true;
    usableAction: null;
  };
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatNaira(value: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function locationLabel(
  market: MarketFinderMarket,
  location: Pick<
    CurrentMarketFinderLocation | MarketFinderResearchLocation,
    "placeName" | "shopNumber" | "floor"
  >,
): string {
  const unit = location.shopNumber ? `Shop ${location.shopNumber}` : null;
  const area =
    market.city === market.stateRegion
      ? market.city
      : `${market.city}, ${market.stateRegion}`;
  const parts = [location.placeName, unit, location.floor, area].filter(
    (part): part is string => Boolean(part),
  );
  return parts.join(" · ");
}

function sourceLabel(
  source:
    | CurrentMarketFinderLocation["observation"]["sourceMethod"]
    | MarketFinderResearchLocation["observation"]["sourceMethod"],
): string {
  if (source === "field_visit") return "Field visit";
  if (source === "retailer_confirmation") return "Retailer confirmation";
  if (source === "branch_online_record") return "Branch record";
  return "Community report";
}

function externalAction(
  location: CurrentMarketFinderLocation,
): MarketSurfaceExternalAction | undefined {
  const { kind, href } = location.action;
  if (!href) return undefined;
  if (kind === "phone") return { href, label: "Call shop" };
  if (kind === "whatsapp") return { href, label: "Open WhatsApp" };
  if (kind === "website") return { href, label: "Visit website" };
  if (kind === "social_business_profile")
    return { href, label: "Open business profile" };
  return undefined;
}

export function resolveMarketFinderProductPackshot(
  product: MarketFinderProductIdentity,
): string | undefined {
  const decision = resolveMarketFinderProductPackshotDecision(product);
  return decision.status === "accepted" ? decision.image.url : undefined;
}

export function presentMarketFinderProduct(
  product: MarketFinderProductIdentity,
): MarketSurfaceProduct {
  return {
    slug: product.slug,
    brand: product.brand,
    name: product.variant,
    size: product.size,
    identityNote: `Exact ${product.size} pack identity reviewed.`,
    image: resolveMarketFinderProductPackshot(product),
  };
}

export function presentMarketFinderMarket(
  market: MarketFinderMarket,
): MarketSurfaceMarket {
  const country =
    new Intl.DisplayNames(["en"], { type: "region" }).of(market.countryCode) ??
    market.countryCode;
  const location =
    market.city === market.stateRegion
      ? `${market.city}, ${country}`
      : `${market.city}, ${market.stateRegion}`;
  return { slug: market.slug, name: market.name, location };
}

export function presentMarketFinderLocation(
  context: MarketFinderContext,
  location: CurrentMarketFinderLocation,
): MarketSurfaceLead {
  const directions =
    location.action.kind === "directions" || location.action.kind === "visit"
      ? [location.action.destination]
      : [];
  const price =
    location.observation.priceNgn === null
      ? ""
      : ` · ${formatNaira(location.observation.priceNgn)}`;
  const availability =
    location.observation.availability === "low_stock"
      ? "Low stock"
      : "In stock";

  return {
    kind: "shop",
    slug: location.slug,
    marketSlug: context.market.slug,
    productSlug: context.product.slug,
    name: location.name,
    state: "ready",
    stateLabel: availability,
    locationLabel: locationLabel(context.market, location),
    identityLabel: "Shop location reviewed",
    evidenceLabel: `${availability}${price} · ${formatDate(location.observation.observedAt)}`,
    evidenceNote: `${sourceLabel(location.observation.sourceMethod)} matched ${location.observation.observedTitle}, ${location.observation.observedSize}.`,
    observedAt: location.observation.observedAt,
    observedAtLabel: formatDate(location.observation.observedAt),
    expiresAt: location.observation.expiresAt,
    expiresAtLabel: formatDate(location.observation.expiresAt),
    directions,
    externalAction: externalAction(location),
    actionEvidence: {
      exactProductIdentity: true,
      retailerLocationVerified: true,
      observationReviewed: true,
      usableAction: directions.length ? "directions" : "contact",
    },
  };
}

function unavailableLabel(
  availability: MarketFinderResearchLocation["observation"]["availability"],
): string {
  if (availability === "out_of_stock") return "Reported out of stock";
  if (availability === "not_carried") return "Reported not carried";
  return "Stock not confirmed";
}

export function presentMarketFinderResearchRecord(
  context: MarketFinderContext,
  record: MarketFinderResearchRecord,
): MarketSurfaceResearchLead {
  if (record.kind === "warning") {
    const disputed = record.reason === "location-disputed";
    return {
      kind: "direction-alert",
      slug: record.id,
      name: disputed
        ? "A market location is under review"
        : "A market location needs rechecking",
      state: disputed ? "disputed" : "stale",
      stateLabel: disputed
        ? "Location under review"
        : "Location needs rechecking",
      locationLabel: `${context.market.name} · ${context.market.city}`,
      identityLabel: "Location details withheld",
      evidenceLabel: disputed ? "Location disputed" : "Verification expired",
      evidenceNote: disputed
        ? "Its name and directions stay hidden until the location is reviewed again."
        : "Its name, contact, and directions stay hidden until verification is current again.",
      directions: [],
      detailRecordAvailable: false,
      actionEvidence: {
        exactProductIdentity: true,
        retailerLocationVerified: false,
        observationReviewed: true,
        usableAction: null,
      },
    };
  }

  const unavailable = unavailableLabel(record.observation.availability);
  const availability =
    record.observation.availability === "low_stock" ? "Low stock" : "In stock";
  const state =
    record.reason === "evidence-expired"
      ? "stale"
      : record.reason === "stock-unavailable"
        ? "unavailable"
        : "location-lead";
  const evidenceLabel =
    record.reason === "evidence-expired"
      ? "Stock check expired"
      : record.reason === "stock-unavailable"
        ? unavailable
        : `${availability} · route unavailable`;
  const stateLabel =
    record.reason === "evidence-expired"
      ? "Stock check expired"
      : record.reason === "stock-unavailable"
        ? unavailable
        : "Route needs review";
  const evidenceNote =
    record.reason === "evidence-expired"
      ? `${sourceLabel(record.observation.sourceMethod)} matched this exact pack on ${formatDate(record.observation.observedAt)}, but current stock is not confirmed.`
      : record.reason === "stock-unavailable"
        ? `${unavailable} for ${context.product.brand} ${context.product.variant}, ${context.product.size}. This does not describe other products or branches.`
        : `${availability} was reviewed for this exact pack, but there is no current reviewed route or contact action.`;

  return {
    kind: "shop",
    slug: record.slug,
    name: record.name,
    state,
    stateLabel,
    locationLabel: locationLabel(context.market, record),
    identityLabel: "Reviewed research record · no travel action",
    evidenceLabel,
    evidenceNote,
    observedAt: record.observation.observedAt,
    observedAtLabel: formatDate(record.observation.observedAt),
    expiresAt: record.observation.expiresAt,
    expiresAtLabel: formatDate(record.observation.expiresAt),
    directions: [],
    detailRecordAvailable: false,
    actionEvidence: {
      exactProductIdentity: true,
      retailerLocationVerified: true,
      observationReviewed: true,
      usableAction: null,
    },
  };
}
