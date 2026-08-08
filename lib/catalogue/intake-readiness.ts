// Re-export the public API from the focused modules.
// This file is now the orchestrator + backwards-compatible barrel.
export * from "./intake-types";
export {
  catalogueIdentityExtractionCanonicalJson,
  catalogueIdentityExtractionSha256,
  catalogueIdentityExtractionByteSize,
  catalogueGenerationRecordSha256,
  catalogueBrandAuthorizationSourceValid,
  officialIdentityEvidenceValid,
} from "./intake-identity-evidence";
export {
  generationRecordContent,
  canonicalRetailerOffer,
  reviewedOfferTitleAlias,
  marketObservationValid,
  retainedOfficialManufacturerBrandAliases,
  matchingOffer,
} from "./intake-market-evidence";
export {
  identityBlockers,
  careBlockers,
  resolveNigeriaMarketRoute,
  nigeriaBlockers,
  rightsBlockers,
  editorialBlockers,
} from "./intake-blockers";

import { canonicalGtin, isValidGtin } from "./gtin";
import {
  catalogueCanonicalIdentifierFor,
  catalogueCanonicalIdentifierKey,
  catalogueGtinForIdentity,
  catalogueOfficialProductPackageKey,
  catalogueOfficialProductCrosswalkRouteClass,
  catalogueOfficialProductRoutePackageKey,
} from "./canonical-identity";
import {
  catalogueIntakeSchemaVersion,
  type CatalogueIntakeCandidate,
  type CatalogueIntakeDecision,
  type CatalogueIntakeManifest,
  type CatalogueIntakePriority,
  type CatalogueIntakeStage,
  type CatalogueIntakeBlocker,
} from "./intake-types";
import {
  validHttps,
  validPastDate,
  regulatorySearchObservationValid,
  normalizedIdentity,
} from "./intake-identity-evidence";
import {
  matchingOffer,
  marketObservationValid,
} from "./intake-market-evidence";
import {
  identityBlockers,
  careBlockers,
  resolveNigeriaMarketRoute,
  nigeriaBlockers,
  rightsBlockers,
  editorialBlockers,
  actionForStage,
} from "./intake-blockers";

const priorityOrder: Record<CatalogueIntakePriority, number> = {
  essential: 0,
  important: 1,
  exploratory: 2,
};
const stageProgress: Record<CatalogueIntakeStage, number> = {
  identity: 0,
  care: 1,
  nigeria: 2,
  rights: 3,
  editorial: 4,
  "approval-ready": 5,
};

export function evaluateCatalogueIntakeCandidate(
  candidate: CatalogueIntakeCandidate,
  asOf = Date.now(),
): CatalogueIntakeDecision {
  const freshExactOffers = candidate.nigeria.exactOffers.flatMap((offer) => {
    const match = matchingOffer(candidate, offer, asOf);
    return match ? [match] : [];
  });
  const nigeriaMarketRoute = resolveNigeriaMarketRoute(
    candidate,
    freshExactOffers,
    asOf,
  );
  const excludedMarketObservations =
    candidate.nigeria.excludedObservations.filter((observation) =>
      marketObservationValid(candidate, observation, asOf),
    );
  const unresolvedRegulatorySearches = (
    candidate.nigeria.regulatorySearches ?? []
  ).filter((observation) =>
    regulatorySearchObservationValid(candidate, observation, asOf),
  );
  const groups: Array<
    [Exclude<CatalogueIntakeStage, "approval-ready">, CatalogueIntakeBlocker[]]
  > = [
    ["identity", identityBlockers(candidate, asOf)],
    ["care", careBlockers(candidate, asOf)],
    [
      "nigeria",
      nigeriaBlockers(candidate, freshExactOffers, asOf, nigeriaMarketRoute),
    ],
    ["rights", rightsBlockers(candidate, asOf)],
    ["editorial", editorialBlockers(candidate, asOf)],
  ];
  const blockers = groups.flatMap(([, values]) => values);
  const stage =
    groups.find(([, values]) => values.length)?.[0] ?? "approval-ready";
  return {
    candidate,
    stage,
    blockers,
    nextAction: actionForStage[stage],
    approvalDraftReady: stage === "approval-ready",
    freshExactOffers,
    excludedMarketObservations,
    unresolvedRegulatorySearches,
    ...(nigeriaMarketRoute ? { nigeriaMarketRoute } : {}),
  };
}

export function auditCatalogueIntakeCandidates(
  candidates: readonly CatalogueIntakeCandidate[],
  asOf = Date.now(),
) {
  const ids = new Set<string>();
  const gtins = new Set<string>();
  const canonicalIdentifiers = new Set<string>();
  const officialProductCrosswalks = new Set<string>();
  const officialProductRoutePackages = new Map<
    string,
    "manufacturer-sku" | "official-route"
  >();
  const identities = new Set<string>();
  for (const candidate of candidates) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.id))
      throw new Error(`Invalid catalogue intake id: ${candidate.id}`);
    if (ids.has(candidate.id))
      throw new Error(`Duplicate catalogue intake id: ${candidate.id}`);
    ids.add(candidate.id);
    const candidateGtin = catalogueGtinForIdentity(candidate.identity);
    if (candidateGtin) {
      const gtinKey = isValidGtin(candidateGtin)
        ? canonicalGtin(candidateGtin)
        : candidateGtin;
      if (gtins.has(gtinKey))
        throw new Error(`Duplicate catalogue intake GTIN: ${candidateGtin}`);
      gtins.add(gtinKey);
    }
    const canonicalIdentifier = catalogueCanonicalIdentifierFor(
      candidate.identity,
    );
    if (canonicalIdentifier) {
      const keys =
        canonicalIdentifier.kind === "manufacturer-sku"
          ? [candidate.brand, ...(candidate.brandAliases ?? [])].map((brand) =>
              catalogueCanonicalIdentifierKey(brand, canonicalIdentifier),
            )
          : [
              catalogueCanonicalIdentifierKey(
                candidate.brand,
                canonicalIdentifier,
              ),
            ];
      if (keys.some((key) => canonicalIdentifiers.has(key))) {
        throw new Error(
          canonicalIdentifier.kind === "manufacturer-sku"
            ? `Duplicate catalogue intake manufacturer SKU: ${candidate.brand} ${canonicalIdentifier.value}`
            : `Duplicate catalogue intake GTIN: ${canonicalIdentifier.value}`,
        );
      }
      keys.forEach((key) => canonicalIdentifiers.add(key));
    }
    const officialProductCrosswalk =
      candidate.identity.officialProductCrosswalk;
    if (officialProductCrosswalk) {
      const crosswalkKey = catalogueOfficialProductPackageKey(
        officialProductCrosswalk,
      );
      if (!crosswalkKey) {
        throw new Error(
          `Catalogue intake ${candidate.id} has an invalid official product crosswalk.`,
        );
      }
      if (officialProductCrosswalks.has(crosswalkKey)) {
        throw new Error(
          `Duplicate catalogue intake official product/package crosswalk: ${candidate.id}`,
        );
      }
      officialProductCrosswalks.add(crosswalkKey);

      const routePackageKey = catalogueOfficialProductRoutePackageKey(
        officialProductCrosswalk,
      );
      const routeClass = catalogueOfficialProductCrosswalkRouteClass(
        officialProductCrosswalk,
      );
      if (!routePackageKey || !routeClass) {
        throw new Error(
          `Catalogue intake ${candidate.id} has an invalid official route/package.`,
        );
      }
      const existingRouteClass =
        officialProductRoutePackages.get(routePackageKey);
      if (
        existingRouteClass &&
        (existingRouteClass !== "manufacturer-sku" ||
          routeClass !== "manufacturer-sku")
      ) {
        throw new Error(
          `Duplicate catalogue intake official route/package across identity routes: ${candidate.id}`,
        );
      }
      officialProductRoutePackages.set(routePackageKey, routeClass);
    }
    const identity = normalizedIdentity(candidate);
    if (identities.has(identity))
      throw new Error(
        `Duplicate catalogue intake identity: ${candidate.brand} ${candidate.name} ${candidate.size}`,
      );
    identities.add(identity);
    if (
      !candidate.brand.trim() ||
      !candidate.name.trim() ||
      !candidate.variant.trim() ||
      !candidate.reason.trim()
    ) {
      throw new Error(
        `Catalogue intake ${candidate.id} is missing its deliberate research context.`,
      );
    }
    if (!candidate.gapIds.length)
      throw new Error(
        `Catalogue intake ${candidate.id} must name at least one coverage gap.`,
      );
    if (
      !candidate.demandEvidenceUrls.length ||
      candidate.demandEvidenceUrls.some((url) => !validHttps(url))
    ) {
      throw new Error(
        `Catalogue intake ${candidate.id} must cite HTTPS demand evidence.`,
      );
    }
    for (const offer of candidate.nigeria.exactOffers) {
      if (!["directory-listed", "provisional"].includes(offer.retailerStatus)) {
        throw new Error(
          `Catalogue intake ${candidate.id} has an invalid retailer status.`,
        );
      }
    }
    for (const observation of candidate.nigeria.excludedObservations) {
      if (!marketObservationValid(candidate, observation, asOf)) {
        throw new Error(
          `Catalogue intake ${candidate.id} has an invalid excluded market observation.`,
        );
      }
    }
    for (const observation of candidate.nigeria.regulatorySearches ?? []) {
      if (candidate.nigeria.regulatoryStatus !== "pending") {
        throw new Error(
          `Catalogue intake ${candidate.id} cannot retain an unresolved registry search after regulatory clearance.`,
        );
      }
      if (!regulatorySearchObservationValid(candidate, observation, asOf)) {
        throw new Error(
          `Catalogue intake ${candidate.id} has an invalid regulatory search observation.`,
        );
      }
    }
  }
  return candidates.map((candidate) =>
    evaluateCatalogueIntakeCandidate(candidate, asOf),
  );
}

export function auditCatalogueIntakeManifest(
  manifest: CatalogueIntakeManifest,
  asOf = Date.now(),
) {
  if (manifest.schemaVersion !== catalogueIntakeSchemaVersion)
    throw new Error("Unsupported catalogue intake schema.");
  if (!validPastDate(manifest.updatedAt, asOf))
    throw new Error("Catalogue intake timestamp is invalid or in the future.");
  const manifestUpdatedAt = Date.parse(manifest.updatedAt);
  for (const candidate of manifest.candidates) {
    const activityTimestamps = [
      candidate.identity.checkedAt,
      candidate.identity.officialEvidence?.retrievedAt,
      candidate.identity.officialEvidence?.canonicalExtraction?.retrievedAt,
      candidate.identity.officialEvidence?.canonicalExtraction?.reviewedAt,
      candidate.care.reviewedAt,
      candidate.nigeria.regulatoryEvidence?.retrievedAt,
      candidate.nigeria.regulatoryEvidence?.observedAt,
      candidate.nigeria.regulatoryEvidence?.reviewedAt,
      ...(candidate.nigeria.regulatorySearches ?? []).flatMap((observation) => [
        observation.retrievedAt,
        observation.reviewedAt,
      ]),
      ...candidate.nigeria.exactOffers.map((offer) => offer.observedAt),
      ...candidate.nigeria.exactOffers.flatMap((offer) => [
        offer.evidence?.retrievedAt,
        offer.evidence?.reviewedAt,
      ]),
      ...candidate.nigeria.excludedObservations.flatMap((observation) => [
        observation.observedAt,
        observation.evidence.retrievedAt,
        observation.evidence.reviewedAt,
      ]),
      candidate.asset.sourceAssetRetrievedAt,
      candidate.asset.generationRecord?.generatedAt,
      candidate.asset.artReviewedAt,
    ];
    if (
      activityTimestamps.some((timestamp) => {
        const parsed = Date.parse(timestamp ?? "");
        return Number.isFinite(parsed) && parsed > manifestUpdatedAt;
      })
    ) {
      throw new Error(
        `Catalogue intake timestamp predates evidence or review activity for ${candidate.id}.`,
      );
    }
  }
  return auditCatalogueIntakeCandidates(manifest.candidates, asOf);
}

export function rankCatalogueIntake(
  decisions: readonly CatalogueIntakeDecision[],
) {
  return [...decisions].sort(
    (left, right) =>
      priorityOrder[left.candidate.priority] -
        priorityOrder[right.candidate.priority] ||
      stageProgress[right.stage] - stageProgress[left.stage] ||
      right.candidate.gapIds.length - left.candidate.gapIds.length ||
      left.candidate.id.localeCompare(right.candidate.id),
  );
}
