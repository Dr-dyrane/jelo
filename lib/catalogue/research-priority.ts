import { createHash } from "node:crypto";
import {
  auditCatalogueDiscoverySnapshot,
  type DiscoveryRetailerObservation,
  type CatalogueDiscoverySnapshot,
  type ScreenedDiscoveryCandidate,
} from "./discovery-screening";
import { canonicalGtin, isValidGtin } from "./gtin";
import { retailerByName } from "@/data/retailers";

export const catalogueResearchQueueSchemaVersion = 2 as const;
export const catalogueResearchQueuePolicy = "private-research-only" as const;
export const catalogueResearchSelectionPolicy =
  "clinical-utility-traceability-v1" as const;

export type CatalogueResearchLane =
  | "sun-protection"
  | "gentle-cleansing"
  | "moisture-barrier"
  | "acne-care"
  | "pigment-support"
  | "hair-scalp"
  | "body-care";

export type CatalogueResearchCaution =
  | "retailer-code-unverified"
  | "single-retailer-observation"
  | "claim-language-review"
  | "abrasive-or-peel-review"
  | "all-observations-out-of-stock"
  | "known-product-binding-review"
  | "provisional-retailer-offer";

export type CatalogueResearchReason =
  | "directory-retailer-observed"
  | "multi-retailer-observed"
  | "gtin-shaped-identity-lead"
  | "current-stock-observed"
  | "high-consumer-utility"
  | "formula-or-active-visible"
  | "known-product-additional-offer-observed";

export type CatalogueResearchOfferTarget = {
  offerKey: string;
  retailer: string;
  retailerStatus: DiscoveryRetailerObservation["retailerStatus"];
  listingUrl: string;
};

export type CatalogueResearchKind =
  "new-product-identity" | "known-product-additional-offer";

export type CatalogueResearchQueueItem = {
  rank: number;
  researchKind: CatalogueResearchKind;
  discoveryId: string;
  title: string;
  brandHint: string;
  size: string;
  categoryHint: ScreenedDiscoveryCandidate["categoryHint"];
  lane: CatalogueResearchLane;
  priorityScore: number;
  retailerObservationCount: number;
  directoryRetailerCount: number;
  offerTargets: CatalogueResearchOfferTarget[];
  knownProduct?: {
    productRef: string;
    canonicalProductSlug: string | null;
    catalogueStatus: "public-catalogue" | "private-intake";
    bindingBasis:
      "retailer-code-crosswalk-review" | "reviewed-title-size-alias-review";
    authority: "private-review-target-only";
  };
  identityLead?: string;
  identityLeadStatus: "unverified-retailer-code" | "missing";
  reasons: CatalogueResearchReason[];
  cautions: CatalogueResearchCaution[];
  nextAction:
    | "confirm-official-manufacturer-identity"
    | "find-official-manufacturer-identity"
    | "review-additional-offer-for-known-product";
  publicationStatus: "private-research-only";
};

export type CatalogueResearchQueue = {
  schemaVersion: typeof catalogueResearchQueueSchemaVersion;
  generatedAt: string;
  policy: typeof catalogueResearchQueuePolicy;
  selectionPolicy: typeof catalogueResearchSelectionPolicy;
  sourceSnapshot: {
    schemaVersion: number;
    generatedAt: string;
    sha256: string;
    selectedCount: number;
  };
  targetCount: number;
  selectedCount: number;
  selection: {
    newProductTargetCount: number;
    newProductSelectedCount: number;
    additionalOfferTargetCount: number;
    additionalOfferSelectedCount: number;
    additionalOfferObservationCount: number;
  };
  laneTargets: Record<CatalogueResearchLane, number>;
  laneCounts: Record<CatalogueResearchLane, number>;
  items: CatalogueResearchQueueItem[];
};

export type KnownCatalogueIdentity = {
  productRef: string;
  catalogueStatus: "public-catalogue" | "private-intake";
  category: "Face" | "Hair" | "Body";
  brand: string;
  brandAliases?: string[];
  name: string;
  nameAliases?: string[];
  size: string;
  sizeAliases?: string[];
  /** Verified manufacturer identity only. Retailer-local codes must never populate this field. */
  gtin?: string;
  offers: Array<{ retailer: string; listingUrl: string }>;
};

const laneTargets: Record<CatalogueResearchLane, number> = {
  "sun-protection": 6,
  "gentle-cleansing": 8,
  "moisture-barrier": 10,
  "acne-care": 8,
  "pigment-support": 6,
  "hair-scalp": 6,
  "body-care": 4,
};

const laneWeight: Record<CatalogueResearchLane, number> = {
  "sun-protection": 32,
  "acne-care": 30,
  "gentle-cleansing": 26,
  "moisture-barrier": 24,
  "pigment-support": 20,
  "hair-scalp": 18,
  "body-care": 12,
};

const activePattern =
  /\b(adapalene|azelaic|benzoyl peroxide|ceramide|glycolic|lactic acid|niacinamide|retinol|salicylic|sulfur|sulphur|tranexamic|txa|urea|vitamin c)\b/i;
const claimReviewPattern =
  /\b(bleach|bleaching|intimate|lighten(?:ing)?|platinum white|tone white|white(?:n|ning)?|whitening)\b/i;
const abrasivePattern = /\b(peel|scrub)\b/i;

function reviewedCategoryHint(
  candidate: ScreenedDiscoveryCandidate,
  knownIdentity?: KnownCatalogueIdentity,
): ScreenedDiscoveryCandidate["categoryHint"] {
  if (knownIdentity) {
    return knownIdentity.category === "Face"
      ? "Face care"
      : knownIdentity.category === "Hair"
        ? "Hair & scalp"
        : "Body care";
  }
  if (
    candidate.categoryHint === "Body care" &&
    /\b(?:day|night|face|facial)\s+cream\b/i.test(candidate.title) &&
    !/\bbody\s+cream\b/i.test(candidate.title)
  )
    return "Face care";
  return candidate.categoryHint;
}

function laneFor(
  candidate: ScreenedDiscoveryCandidate,
  knownIdentity?: KnownCatalogueIdentity,
): CatalogueResearchLane | undefined {
  const title = candidate.title;
  const category = reviewedCategoryHint(candidate, knownIdentity);
  if (!["Face care", "Hair & scalp", "Body care"].includes(category))
    return undefined;
  if (category === "Hair & scalp") {
    return knownIdentity
      ? "hair-scalp"
      : /\b(conditioner|hair (?:cream|mask|oil|serum|treatment)|scalp|shampoo)\b/i.test(
            title,
          )
        ? "hair-scalp"
        : undefined;
  }
  if (
    /\b(sun ?screen|sunblock|sun protection|spf\s*\d|sun gel|uv protection)\b/i.test(
      title,
    )
  )
    return "sun-protection";
  if (
    /\b(acne|adapalene|azelaic|benzoyl peroxide|blemish|salicylic)\b/i.test(
      title,
    )
  )
    return "acne-care";
  if (
    category === "Face care" &&
    /\b(cleanser|cleansing|face wash|facial wash)\b/i.test(title)
  )
    return "gentle-cleansing";
  if (
    /\b(balm|body butter|cream|gel cream|lotion|moisturi[sz](?:er|ing)?)\b/i.test(
      title,
    )
  )
    return "moisture-barrier";
  if (
    /\b(alpha arbutin|dark spot|hyperpigment|niacinamide|tranexamic|txa|vitamin c)\b/i.test(
      title,
    )
  )
    return "pigment-support";
  if (knownIdentity?.category === "Face") return "moisture-barrier";
  return category === "Body care" ? "body-care" : undefined;
}

function normalized(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonicalVerifiedGtin(value: string | undefined) {
  const gtin = value?.trim();
  return gtin && isValidGtin(gtin) ? canonicalGtin(gtin) : undefined;
}

function canonicalListingUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error(
      `Catalogue research listing URL is not a safe exact HTTPS route: ${value}.`,
    );
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.hash = "";
  url.searchParams.sort();
  url.pathname = url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "");
  return url.href;
}

export function catalogueResearchOfferKey(
  productRef: string,
  retailer: string,
  listingUrl: string,
) {
  const normalizedProductRef = productRef.trim();
  const normalizedRetailer = normalized(retailer);
  if (!normalizedProductRef || !normalizedRetailer) {
    throw new Error(
      "Catalogue research offer key lacks product or retailer identity.",
    );
  }
  return createHash("sha256")
    .update(
      `jelocare-catalogue-research-offer-v1\n${normalizedProductRef}\n${normalizedRetailer}\n${canonicalListingUrl(listingUrl)}\n`,
    )
    .digest("hex")
    .slice(0, 24);
}

function knownIdentityMatch(
  candidate: ScreenedDiscoveryCandidate,
  identities: readonly KnownCatalogueIdentity[],
) {
  const retailerIdentityLead = canonicalVerifiedGtin(
    candidate.retailerGtinHint,
  );
  const brand = normalized(candidate.brandHint);
  const title = normalized(candidate.title);
  const titleTokens = new Set(title.split(" "));
  const size = normalized(candidate.size).replace(/(\d)\s+(?=[a-z])/g, "$1");
  const possibleMatches = identities.map((identity) => {
    const gtinMatches = Boolean(
      retailerIdentityLead &&
      canonicalVerifiedGtin(identity.gtin) === retailerIdentityLead,
    );
    const brandMatches = [identity.brand, ...(identity.brandAliases ?? [])]
      .map(normalized)
      .includes(brand);
    const nameMatches = [identity.name, ...(identity.nameAliases ?? [])]
      .map(normalized)
      .some((name) => name.split(" ").every((token) => titleTokens.has(token)));
    const sizeMatches = [identity.size, ...(identity.sizeAliases ?? [])]
      .map((value) => normalized(value).replace(/(\d)\s+(?=[a-z])/g, "$1"))
      .some((knownSize) => size.includes(knownSize));
    return {
      identity,
      gtinMatches,
      reviewedAliasMatches: brandMatches && nameMatches && sizeMatches,
    };
  });
  // A verified manufacturer GTIN crosswalk is the stronger reviewed identity
  // signal. Only fall back to title/size aliases when no GTIN identity matches;
  // mixing both classes can manufacture ambiguity from a retailer title that
  // happens to resemble a different product.
  const gtinMatches = possibleMatches.filter((match) => match.gtinMatches);
  const matches = (
    gtinMatches.length
      ? gtinMatches
      : possibleMatches.filter((match) => match.reviewedAliasMatches)
  ).map((match) => ({
    identity: match.identity,
    bindingBasis: match.gtinMatches
      ? ("retailer-code-crosswalk-review" as const)
      : ("reviewed-title-size-alias-review" as const),
  }));
  const matchesByProduct = new Map(
    matches.map((match) => [match.identity.productRef, match]),
  );
  if (matchesByProduct.size > 1) {
    throw new Error(
      `${candidate.discoveryId} ambiguously matches multiple known products: ${Array.from(matchesByProduct.keys()).sort().join(", ")}.`,
    );
  }
  return Array.from(matchesByProduct.values())[0];
}

function authoritativeOfferTarget(
  productRef: string,
  observation: DiscoveryRetailerObservation,
): CatalogueResearchOfferTarget {
  const retailer = retailerByName(observation.retailer);
  if (!retailer && observation.retailerStatus !== "provisional") {
    throw new Error(
      `${observation.retailer} cannot retain directory eligibility outside the reviewed retailer registry.`,
    );
  }
  const retailerName = retailer?.name ?? observation.retailer.trim();
  return {
    offerKey: catalogueResearchOfferKey(
      productRef,
      retailerName,
      observation.listingUrl,
    ),
    retailer: retailerName,
    retailerStatus: retailer?.reviewStatus ?? "provisional",
    listingUrl: observation.listingUrl,
  };
}

function uniqueOfferTargets(
  productRef: string,
  observations: readonly DiscoveryRetailerObservation[],
) {
  const targets = new Map<string, CatalogueResearchOfferTarget>();
  for (const observation of observations) {
    const target = authoritativeOfferTarget(productRef, observation);
    if (!targets.has(target.offerKey)) targets.set(target.offerKey, target);
  }
  return Array.from(targets.values()).sort(
    (left, right) =>
      left.retailer.localeCompare(right.retailer) ||
      left.listingUrl.localeCompare(right.listingUrl),
  );
}

type ResearchCandidate = {
  candidate: ScreenedDiscoveryCandidate;
  researchKind: CatalogueResearchKind;
  offerTargets: CatalogueResearchOfferTarget[];
  knownProduct?: CatalogueResearchQueueItem["knownProduct"];
  knownIdentity?: KnownCatalogueIdentity;
};

function researchPriority(input: ResearchCandidate) {
  const { candidate, knownIdentity, offerTargets } = input;
  const lane = laneFor(candidate, knownIdentity);
  if (!lane) return undefined;
  const directoryRetailerCount = new Set(
    offerTargets
      .filter((target) => target.retailerStatus === "directory-listed")
      .map((target) => normalized(target.retailer)),
  ).size;
  if (input.researchKind === "new-product-identity" && !directoryRetailerCount)
    return undefined;
  const reasons: CatalogueResearchReason[] =
    input.researchKind === "known-product-additional-offer"
      ? ["known-product-additional-offer-observed", "high-consumer-utility"]
      : ["directory-retailer-observed", "high-consumer-utility"];
  if (
    input.researchKind === "known-product-additional-offer" &&
    directoryRetailerCount
  )
    reasons.push("directory-retailer-observed");
  const cautions: CatalogueResearchCaution[] =
    input.researchKind === "known-product-additional-offer"
      ? ["known-product-binding-review"]
      : [];
  if (offerTargets.some((target) => target.retailerStatus === "provisional")) {
    cautions.push("provisional-retailer-offer");
  }
  const targetKeys = new Set(offerTargets.map((target) => target.offerKey));
  const selectedObservations = candidate.retailerObservations.filter(
    (observation) =>
      targetKeys.has(
        catalogueResearchOfferKey(
          knownIdentity?.productRef ?? `discovery:${candidate.discoveryId}`,
          retailerByName(observation.retailer)?.name ?? observation.retailer,
          observation.listingUrl,
        ),
      ),
  ).length;
  const retailerCount = new Set(
    offerTargets.map((target) => normalized(target.retailer)),
  ).size;
  const hasCurrentStock = candidate.retailerObservations.some(
    (observation) =>
      targetKeys.has(
        catalogueResearchOfferKey(
          knownIdentity?.productRef ?? `discovery:${candidate.discoveryId}`,
          retailerByName(observation.retailer)?.name ?? observation.retailer,
          observation.listingUrl,
        ),
      ) &&
      (observation.stock === "in-stock" || observation.stock === "low-stock"),
  );
  let priorityScore =
    candidate.score +
    laneWeight[lane] +
    (input.researchKind === "known-product-additional-offer" ? 48 : 0);

  if (retailerCount > 1) {
    priorityScore += 18;
    reasons.push("multi-retailer-observed");
  } else cautions.push("single-retailer-observation");
  if (candidate.retailerGtinHint) {
    priorityScore += 12;
    reasons.push("gtin-shaped-identity-lead");
    cautions.push("retailer-code-unverified");
  }
  if (hasCurrentStock) {
    priorityScore += 8;
    reasons.push("current-stock-observed");
  } else cautions.push("all-observations-out-of-stock");
  if (activePattern.test(candidate.title)) {
    priorityScore += 10;
    reasons.push("formula-or-active-visible");
  }
  if (claimReviewPattern.test(candidate.title)) {
    priorityScore -= 60;
    cautions.push("claim-language-review");
  }
  if (abrasivePattern.test(candidate.title)) {
    priorityScore -= 8;
    cautions.push("abrasive-or-peel-review");
  }

  return {
    ...input,
    lane,
    priorityScore,
    directoryRetailerCount,
    retailerCount,
    selectedObservationCount: selectedObservations,
    reasons,
    cautions,
  };
}

type RankedCandidate = NonNullable<ReturnType<typeof researchPriority>>;

function compareRanked(left: RankedCandidate, right: RankedCandidate) {
  return (
    right.priorityScore - left.priorityScore ||
    right.directoryRetailerCount - left.directoryRetailerCount ||
    right.retailerCount - left.retailerCount ||
    left.candidate.brandHint.localeCompare(right.candidate.brandHint) ||
    left.candidate.title.localeCompare(right.candidate.title) ||
    left.candidate.discoveryId.localeCompare(right.candidate.discoveryId)
  );
}

function selectedNewProductCandidates(
  ranked: RankedCandidate[],
  targetCount: number,
) {
  const selectedIds = new Set<string>();
  const selected: RankedCandidate[] = [];
  const brandCounts = new Map<string, number>();

  function take(candidate: RankedCandidate) {
    if (selectedIds.has(candidate.candidate.discoveryId)) return false;
    const brandKey = candidate.candidate.brandHint.trim().toLowerCase();
    if ((brandCounts.get(brandKey) ?? 0) >= 3) return false;
    selectedIds.add(candidate.candidate.discoveryId);
    brandCounts.set(brandKey, (brandCounts.get(brandKey) ?? 0) + 1);
    selected.push(candidate);
    return true;
  }

  for (const [lane, target] of Object.entries(laneTargets) as Array<
    [CatalogueResearchLane, number]
  >) {
    let laneCount = 0;
    for (const candidate of ranked) {
      if (candidate.lane !== lane) continue;
      if (take(candidate)) laneCount += 1;
      if (laneCount >= target) break;
    }
  }
  for (const candidate of ranked) {
    if (selected.length >= targetCount) break;
    take(candidate);
  }
  return selected.slice(0, targetCount).sort(compareRanked);
}

function selectedResearchCandidates(
  snapshot: CatalogueDiscoverySnapshot,
  targetCount: number,
  knownIdentities: readonly KnownCatalogueIdentity[],
) {
  const newProducts: RankedCandidate[] = [];
  const additionalOffers: RankedCandidate[] = [];
  for (const candidate of snapshot.candidates) {
    const known = knownIdentityMatch(candidate, knownIdentities);
    if (!known) {
      const priority = researchPriority({
        candidate,
        researchKind: "new-product-identity",
        offerTargets: uniqueOfferTargets(
          `discovery:${candidate.discoveryId}`,
          candidate.retailerObservations,
        ),
      });
      if (priority) newProducts.push(priority);
      continue;
    }

    const existingKeys = new Set(
      known.identity.offers.map((offer) =>
        catalogueResearchOfferKey(
          known.identity.productRef,
          retailerByName(offer.retailer)?.name ?? offer.retailer,
          offer.listingUrl,
        ),
      ),
    );
    const offerTargets = uniqueOfferTargets(
      known.identity.productRef,
      candidate.retailerObservations,
    ).filter((target) => !existingKeys.has(target.offerKey));
    if (!offerTargets.length) continue;
    const priority = researchPriority({
      candidate,
      researchKind: "known-product-additional-offer",
      offerTargets,
      knownIdentity: known.identity,
      knownProduct: {
        productRef: known.identity.productRef,
        canonicalProductSlug:
          known.identity.catalogueStatus === "public-catalogue"
            ? known.identity.productRef
            : null,
        catalogueStatus: known.identity.catalogueStatus,
        bindingBasis: known.bindingBasis,
        authority: "private-review-target-only",
      },
    });
    if (priority) additionalOffers.push(priority);
  }
  return {
    additionalOffers: additionalOffers
      .sort(compareRanked)
      .slice(0, targetCount),
    newProducts: selectedNewProductCandidates(
      newProducts.sort(compareRanked),
      targetCount,
    ),
  };
}

export function buildCatalogueResearchQueue(
  snapshot: CatalogueDiscoverySnapshot,
  sourceSnapshotSha256: string,
  targetCount = 48,
  knownIdentities: readonly KnownCatalogueIdentity[] = [],
): CatalogueResearchQueue {
  auditCatalogueDiscoverySnapshot(snapshot);
  if (!/^[0-9a-f]{64}$/.test(sourceSnapshotSha256))
    throw new Error("Research queue source digest is invalid.");
  if (!Number.isSafeInteger(targetCount) || targetCount <= 0)
    throw new Error("Research queue target must be positive.");
  const selected = selectedResearchCandidates(
    snapshot,
    targetCount,
    knownIdentities,
  );
  const ranked = [...selected.additionalOffers, ...selected.newProducts];
  const items = ranked.map((entry, index): CatalogueResearchQueueItem => ({
    rank: index + 1,
    researchKind: entry.researchKind,
    discoveryId: entry.candidate.discoveryId,
    title: entry.candidate.title,
    brandHint: entry.candidate.brandHint,
    size: entry.candidate.size,
    categoryHint: reviewedCategoryHint(entry.candidate, entry.knownIdentity),
    lane: entry.lane,
    priorityScore: entry.priorityScore,
    retailerObservationCount: entry.selectedObservationCount,
    directoryRetailerCount: entry.directoryRetailerCount,
    offerTargets: entry.offerTargets,
    ...(entry.knownProduct ? { knownProduct: entry.knownProduct } : {}),
    ...(entry.candidate.retailerGtinHint
      ? { identityLead: entry.candidate.retailerGtinHint }
      : {}),
    identityLeadStatus: entry.candidate.retailerGtinHint
      ? "unverified-retailer-code"
      : "missing",
    reasons: entry.reasons,
    cautions: entry.cautions,
    nextAction:
      entry.researchKind === "known-product-additional-offer"
        ? "review-additional-offer-for-known-product"
        : entry.candidate.retailerGtinHint
          ? "confirm-official-manufacturer-identity"
          : "find-official-manufacturer-identity",
    publicationStatus: "private-research-only",
  }));
  const laneCounts = Object.fromEntries(
    Object.keys(laneTargets).map((lane) => [
      lane,
      items.filter((item) => item.lane === lane).length,
    ]),
  ) as Record<CatalogueResearchLane, number>;
  return {
    schemaVersion: catalogueResearchQueueSchemaVersion,
    generatedAt: snapshot.generatedAt,
    policy: catalogueResearchQueuePolicy,
    selectionPolicy: catalogueResearchSelectionPolicy,
    sourceSnapshot: {
      schemaVersion: snapshot.schemaVersion,
      generatedAt: snapshot.generatedAt,
      sha256: sourceSnapshotSha256,
      selectedCount: snapshot.selectedCount,
    },
    targetCount,
    selectedCount: items.length,
    selection: {
      newProductTargetCount: targetCount,
      newProductSelectedCount: selected.newProducts.length,
      additionalOfferTargetCount: targetCount,
      additionalOfferSelectedCount: selected.additionalOffers.length,
      additionalOfferObservationCount: selected.additionalOffers.reduce(
        (count, item) => count + item.offerTargets.length,
        0,
      ),
    },
    laneTargets,
    laneCounts,
    items,
  };
}

export function catalogueResearchQueueDigest(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
