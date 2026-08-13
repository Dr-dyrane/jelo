import { retailerAdapters } from "@/modules/retail-intelligence/extraction";

const governedVerificationMethods = new Set(["manual", "retailer_page", "api"]);
const dayMs = 24 * 60 * 60 * 1000;

export const defaultStoreChoiceTarget = 3;

/**
 * Products confirmed as genuinely limited in Nigerian distribution after
 * exhaustive retailer search (25+ retailers checked). These use a lower
 * coverage target so the audit doesn't flag them as gaps indefinitely.
 *
 * A product enters this set only after a documented search effort found
 * fewer than `defaultStoreChoiceTarget` exact Nigerian retailers.
 */
const limitedAvailabilitySlugs = new Set([
  // Searched 25+ retailers; only 1-2 exact Nigerian stockists found
  "anessa-perfect-uv-sunscreen-skincare-milk-na-60ml",
  "saltair-santal-bloom-moisture-bound-hair-oil-rich-50ml",
  "keracare-dry-itchy-scalp-conditioner-950ml",
  "amika-the-kure-conditioner-275ml",
  "elf-suntouchable-invisible-sunscreen-spf-35-50ml",
  "garnier-pure-active-tea-tree-salicylic-acid-tissue-mask",
  "estelin-vitamin-c-turmeric-face-oil-30ml",
  // Searched 25+ retailers; only 2 exact Nigerian stockists found
  "lush-hair-mentholated-conditioner",
  "naturium-retinol-complex-cream-1-7oz",
  "naturium-intense-overnight-sleeping-cream-1-7oz",
]);

/**
 * Returns the coverage target for a product. Most products use the default
 * target of 3 stores. Products confirmed as genuinely limited after
 * exhaustive search use a lower target of 2, so the audit reflects market
 * reality rather than an arbitrary uniform number.
 */
export function productCoverageTarget(slug: string): number {
  return limitedAvailabilitySlugs.has(slug) ? 2 : defaultStoreChoiceTarget;
}

type Measurement = { dimension: "mass" | "volume"; baseValue: number };

function measurements(value: string): Measurement[] {
  const matches = value
    .toLowerCase()
    .matchAll(
      /\b(\d+(?:[.,]\d+)?)\s*((?:fl(?:uid)?\.?\s*)?oz\.?|millilit(?:er|re)s?|ml|centilit(?:er|re)s?|cl|lit(?:er|re)s?|l|milligrams?|mg|kilograms?|kg|grams?|g)\b/g,
    );
  const result: Measurement[] = [];
  for (const match of matches) {
    const amount = Number(match[1].replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const unit = match[2].replace(/[.\s]/g, "");
    if (unit === "ml" || unit.startsWith("millilit"))
      result.push({ dimension: "volume", baseValue: amount });
    else if (unit === "cl" || unit.startsWith("centilit"))
      result.push({ dimension: "volume", baseValue: amount * 10 });
    else if (unit === "l" || unit.startsWith("lit"))
      result.push({ dimension: "volume", baseValue: amount * 1_000 });
    else if (unit === "floz" || unit === "fluidoz")
      result.push({ dimension: "volume", baseValue: amount * 29.5735 });
    else if (unit === "mg" || unit.startsWith("milligram"))
      result.push({ dimension: "mass", baseValue: amount / 1_000 });
    else if (unit === "kg" || unit.startsWith("kilogram"))
      result.push({ dimension: "mass", baseValue: amount * 1_000 });
    else if (unit === "g" || unit.startsWith("gram"))
      result.push({ dimension: "mass", baseValue: amount });
    else if (unit === "oz") {
      result.push({ dimension: "mass", baseValue: amount * 28.3495 });
      result.push({ dimension: "volume", baseValue: amount * 29.5735 });
    }
  }
  return result;
}

function retailerSizeMatches(expectedSize: string, observedSize: string) {
  const expected = measurements(expectedSize);
  const observed = measurements(observedSize);
  return expected.some((left) =>
    observed.some(
      (right) =>
        left.dimension === right.dimension &&
        Math.abs(left.baseValue - right.baseValue) <=
          Math.max(left.baseValue, right.baseValue) * 0.03,
    ),
  );
}

export type CoverageOffer = {
  retailer: string;
  url: string;
  matchKind: "exact" | "search";
  priceMinor: number | null;
  currencyCode: string | null;
  inventoryStatus: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
  available: boolean;
  checkedAt: Date | null;
  lastVerifiedAt: Date | null;
  verificationExpiresAt: Date | null;
  verificationMethod: string | null;
  extractionAdapter: string | null;
  observedTitle: string | null;
  observedSize: string | null;
  activeJobStatus: "queued" | "processing" | null;
  latestJobStatus: string | null;
  latestJobError: string | null;
};

export type OfferCoverageState = "fresh" | "stale" | "unverified" | "conflict";

export type CoveragePriority = {
  score: number;
  reasons: {
    exactStoreGap: number;
    freshPriceGap: number;
    staleOrUnverifiedOffers: number;
    blockedExactOffers: number;
  };
  tieBreakObservation: string | null;
};

function utcDay(value: Date) {
  return Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  );
}

export function offerCoverageState(
  productSize: string,
  offer: CoverageOffer,
  now: Date,
): OfferCoverageState {
  if (
    offer.matchKind !== "exact" ||
    !governedVerificationMethods.has(offer.verificationMethod ?? "") ||
    !offer.observedTitle?.trim() ||
    !offer.observedSize?.trim() ||
    !offer.lastVerifiedAt ||
    !offer.verificationExpiresAt
  )
    return "unverified";
  if (!retailerSizeMatches(productSize, offer.observedSize)) return "conflict";
  if (
    offer.lastVerifiedAt.getTime() > now.getTime() ||
    offer.verificationExpiresAt.getTime() <= now.getTime()
  )
    return "stale";
  const ageDays = (utcDay(now) - utcDay(offer.lastVerifiedAt)) / dayMs;
  return ageDays >= 0 && ageDays <= 7 ? "fresh" : "stale";
}

export function offerRefreshCapability(
  offer: Pick<CoverageOffer, "url" | "matchKind" | "verificationMethod">,
) {
  if (offer.matchKind === "search") return "blocked-search";
  let url: URL;
  try {
    url = new URL(offer.url);
  } catch {
    return "blocked-url";
  }
  if (url.protocol !== "https:") return "blocked-url";
  const adapter = retailerAdapters.find((candidate) => candidate.matches(url));
  const adapterKey = adapter?.key ?? "structured-generic";
  return `automation:${adapterKey}+manual-fallback`;
}

export function normalizedRefreshBlocker(error: string | null): string | null {
  if (!error) return null;
  const value = error.toLowerCase();
  if (
    value.includes("http 401") ||
    value.includes("http 403") ||
    value.includes("http 429")
  )
    return "retailer-blocked-automation";
  if (value.includes("timeout") || value.includes("abort"))
    return "retailer-timeout";
  if (value.includes("redirect") || value.includes("canonical"))
    return "redirected-off-exact-route";
  if (value.includes("title")) return "title-or-variant-conflict";
  if (value.includes("size")) return "size-conflict-or-missing-size";
  if (value.includes("stock")) return "missing-product-scoped-stock";
  if (value.includes("content type") || value.includes("expected html"))
    return "unsupported-response-type";
  if (value.includes("fetch") || value.includes("network"))
    return "retailer-network-failure";
  if (value.includes("lease")) return "expired-worker-lease";
  return "exact-offer-refresh-failed";
}

export function compareCoveragePriority(
  left: { slug: string; priority: CoveragePriority },
  right: { slug: string; priority: CoveragePriority },
) {
  if (left.priority.score !== right.priority.score) {
    return right.priority.score - left.priority.score;
  }
  const leftObservation =
    left.priority.tieBreakObservation == null
      ? Number.NEGATIVE_INFINITY
      : Date.parse(left.priority.tieBreakObservation);
  const rightObservation =
    right.priority.tieBreakObservation == null
      ? Number.NEGATIVE_INFINITY
      : Date.parse(right.priority.tieBreakObservation);
  if (leftObservation !== rightObservation)
    return leftObservation - rightObservation;
  return left.slug.localeCompare(right.slug);
}

export function productCoverage(input: {
  slug: string;
  size: string;
  databasePublished: boolean;
  offers: CoverageOffer[];
  now: Date;
}) {
  const exact = input.offers.filter((offer) => offer.matchKind === "exact");
  const search = input.offers.filter((offer) => offer.matchKind === "search");
  const states = exact.map((offer) => ({
    offer,
    state: offerCoverageState(input.size, offer, input.now),
  }));
  const fresh = states.filter((item) => item.state === "fresh");
  const stale = states.filter((item) => item.state === "stale");
  const unverified = states.filter((item) => item.state === "unverified");
  const conflicts = states.filter((item) => item.state === "conflict");
  const active = exact.filter((offer) => offer.activeJobStatus != null);
  const latestObservation =
    exact
      .flatMap((offer) =>
        [offer.lastVerifiedAt ?? offer.checkedAt].filter(
          (value): value is Date => value != null,
        ),
      )
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const freshPrices = fresh.filter(
    ({ offer }) =>
      offer.available &&
      (offer.inventoryStatus === "in_stock" ||
        offer.inventoryStatus === "low_stock") &&
      offer.currencyCode === "NGN" &&
      offer.priceMinor != null &&
      offer.priceMinor > 0,
  );
  const freshStock = fresh.filter(
    ({ offer }) => offer.inventoryStatus !== "unknown",
  );
  const approvedExactStores = new Set(exact.map((offer) => offer.retailer))
    .size;
  const trustworthyFreshExactStores = new Set(
    fresh.map(({ offer }) => offer.retailer),
  ).size;
  const freshPricedStores = new Set(
    freshPrices.map(({ offer }) => offer.retailer),
  ).size;
  const target = productCoverageTarget(input.slug);
  const storeChoiceGap = Math.max(0, target - trustworthyFreshExactStores);
  const freshPriceGap = Math.max(0, target - freshPricedStores);
  const blockers = [
    ...new Set(
      exact
        .map((offer) => normalizedRefreshBlocker(offer.latestJobError))
        .filter((blocker): blocker is string => blocker != null),
    ),
  ];
  const blockedExactOffers = exact.filter(
    (offer) => normalizedRefreshBlocker(offer.latestJobError) != null,
  ).length;
  const capabilities = [
    ...new Set(input.offers.map(offerRefreshCapability)),
  ].sort();
  const priority: CoveragePriority = {
    score:
      10 * storeChoiceGap +
      6 * freshPriceGap +
      3 * (stale.length + unverified.length) +
      2 * blockedExactOffers,
    reasons: {
      exactStoreGap: storeChoiceGap,
      freshPriceGap,
      staleOrUnverifiedOffers: stale.length + unverified.length,
      blockedExactOffers,
    },
    tieBreakObservation: latestObservation?.toISOString() ?? null,
  };

  let nextAction = "none—fresh exact NG coverage";
  if (!input.databasePublished)
    nextAction = "reconcile missing production product";
  else if (input.offers.length === 0)
    nextAction = "find one trustworthy exact NG retailer page";
  else if (exact.length === 0)
    nextAction = "replace search links with exact offer evidence";
  else if (conflicts.length > 0)
    nextAction = "withhold conflicting offers and verify exact identity/size";
  else if (active.length > 0)
    nextAction = "process existing active NG refresh jobs";
  else if (stale.length + unverified.length > 0)
    nextAction = "queue or manually verify due exact NG offers";
  else if (storeChoiceGap > 0)
    nextAction = `find ${storeChoiceGap} more trustworthy exact NG ${storeChoiceGap === 1 ? "store" : "stores"}`;

  return {
    slug: input.slug,
    databasePublished: input.databasePublished,
    approvedRetailerLinkCount: input.offers.length,
    classification: { exact: exact.length, search: search.length },
    lastObservation: latestObservation?.toISOString() ?? null,
    priceStockFreshness: {
      freshPrices: freshPrices.length,
      freshStock: freshStock.length,
      stale: stale.length,
      unverified: unverified.length,
    },
    storeChoice: {
      target,
      approvedExactStores,
      trustworthyFreshExactStores,
      freshPricedStores,
      gapToTarget: storeChoiceGap,
      freshPriceGapToTarget: freshPriceGap,
    },
    capability: capabilities,
    identitySizeConflict: conflicts.map((item) => item.offer.retailer).sort(),
    activeRefreshJobs: active.length,
    blockers,
    priority,
    nextAction,
  };
}
