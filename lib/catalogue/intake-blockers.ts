import cataloguePackshotIsolations from "@/data/catalogue-packshot-isolations.json";
import { nigeriaRetailers } from "@/data/retailers";
import { reviewedBrandSellerEvidenceValid } from "./brand-seller-evidence";
import {
  cataloguePackshotIsolationRecordFor,
  cataloguePackshotIsolationRecordValid,
  type CataloguePackshotIsolationRecord,
} from "./packshot-isolation-record";
import {
  assertCataloguePublicationImageLocation,
  cataloguePublicationImageMaxBytes,
  cataloguePublicationImageMaxSide,
  cataloguePublicationImageMinSide,
  isCataloguePublicationImageMimeType,
  type CataloguePublicationImageMimeType,
} from "./publication-image-policy";
import { catalogueCanonicalIdentifierFor } from "./canonical-identity";
import type {
  CatalogueIntakeCandidate,
  CatalogueIntakeOffer,
  CatalogueIntakeBlocker,
  CatalogueIntakeStage,
  CatalogueNigeriaMarketRoute,
} from "./intake-types";
import {
  validHttps,
  validPastDate,
  hashPattern,
  measurableSize,
  packshotEligibleOrigins,
  officialIdentityEvidenceValid,
  catalogueBrandAuthorizationSourceValid,
  candidateScopedManufacturerCareSource,
  reviewedIndependentClinicalGuidanceUrls,
  sameUrl,
  normalized,
} from "./intake-identity-evidence";
import { generationRecordValid } from "./intake-market-evidence";

export function identityBlockers(
  candidate: CatalogueIntakeCandidate,
  asOf: number,
): CatalogueIntakeBlocker[] {
  const blockers: CatalogueIntakeBlocker[] = [];
  const canonicalIdentifier = catalogueCanonicalIdentifierFor(
    candidate.identity,
  );
  if (!canonicalIdentifier) {
    blockers.push(
      candidate.identity.canonicalIdentifier?.kind === "manufacturer-sku"
        ? "identity-manufacturer-sku-missing-or-invalid"
        : "identity-gtin-missing-or-invalid",
    );
  }
  if (
    candidate.identity.basis !== "official-brand" ||
    !validHttps(candidate.identity.officialProductUrl)
  )
    blockers.push("identity-official-source-missing");
  if (!validPastDate(candidate.identity.checkedAt, asOf))
    blockers.push("identity-check-missing-or-future");
  if (!officialIdentityEvidenceValid(candidate, asOf))
    blockers.push("identity-official-evidence-invalid");
  if (!measurableSize.test(candidate.size))
    blockers.push("identity-size-not-measurable");
  return blockers;
}

export function careBlockers(
  candidate: CatalogueIntakeCandidate,
  asOf: number,
): CatalogueIntakeBlocker[] {
  const blockers: CatalogueIntakeBlocker[] = [];
  const manufacturerEvidenceUrl = candidate.care.manufacturerEvidenceUrl;
  const independentClinicalGuidanceUrl =
    candidate.care.independentClinicalGuidanceUrl;
  const careReviewedAt = Date.parse(candidate.care.reviewedAt ?? "");
  const identityCheckedAt = Date.parse(candidate.identity.checkedAt ?? "");
  if (
    candidate.care.status !== "reviewed" ||
    !candidate.care.formulaArchetype?.trim() ||
    !["daily-care", "targeted-care", "professional-referral"].includes(
      candidate.care.careTier ?? "",
    ) ||
    candidate.care.reviewScope !== "catalogue-supportive-care" ||
    !candidate.care.reviewer?.trim() ||
    !validPastDate(candidate.care.reviewedAt, asOf) ||
    !Number.isFinite(identityCheckedAt) ||
    careReviewedAt < identityCheckedAt
  )
    blockers.push("care-review-missing");
  if (
    !candidate.care.evidenceUrls.length ||
    candidate.care.evidenceUrls.some((url) => !validHttps(url))
  )
    blockers.push("care-evidence-missing");
  if (
    !candidate.care.advisoryBoundary?.trim() ||
    candidate.care.advisoryBoundary.trim().length < 24
  ) {
    blockers.push("care-advisory-boundary-missing");
  }
  try {
    const manufacturer = new URL(manufacturerEvidenceUrl ?? "");
    const clinical = new URL(independentClinicalGuidanceUrl ?? "");
    const evidence = new Set(
      candidate.care.evidenceUrls.map((url) => new URL(url).href),
    );
    if (
      manufacturer.protocol !== "https:" ||
      clinical.protocol !== "https:" ||
      !candidateScopedManufacturerCareSource(candidate, manufacturer.href) ||
      manufacturer.hostname === clinical.hostname ||
      !reviewedIndependentClinicalGuidanceUrls.has(clinical.href) ||
      !evidence.has(manufacturer.href) ||
      !evidence.has(clinical.href)
    )
      blockers.push("care-independent-guidance-missing");
  } catch {
    blockers.push("care-independent-guidance-missing");
  }
  return blockers;
}

export function resolveNigeriaMarketRoute(
  candidate: CatalogueIntakeCandidate,
  offers: CatalogueIntakeOffer[],
  asOf: number,
): CatalogueNigeriaMarketRoute | undefined {
  const hasTierAClaim =
    candidate.nigeria.tierAIdentityEvidenceUrl !== undefined;
  const hasBrandClaim =
    candidate.nigeria.brandAuthorizationEvidenceUrl !== undefined;
  if (hasTierAClaim === hasBrandClaim) return undefined;
  const independentOffers = offers.filter(
    (offer) => offer.retailerStatus === "directory-listed",
  );
  const retailers = new Set(
    independentOffers.map((offer) => offer.retailer.trim().toLowerCase()),
  );
  const hosts = new Set(
    independentOffers.map((offer) =>
      new URL(offer.listingUrl).hostname.replace(/^www\./, ""),
    ),
  );
  const tierARoute =
    sameUrl(
      candidate.nigeria.tierAIdentityEvidenceUrl,
      candidate.identity.officialProductUrl,
    ) &&
    retailers.size >= 2 &&
    hosts.size >= 2;
  if (hasTierAClaim) return tierARoute ? "tier-a" : undefined;
  const brandAuthorizedOffers = independentOffers.filter((offer) => {
    const retailer = nigeriaRetailers.find(
      (item) => normalized(item.name) === normalized(offer.retailer),
    );
    return retailer
      ? reviewedBrandSellerEvidenceValid(
          retailer,
          candidate.nigeria.brandAuthorizationEvidenceUrl,
          asOf,
        )
      : false;
  });
  const brandRoute =
    catalogueBrandAuthorizationSourceValid(
      candidate,
      candidate.nigeria.brandAuthorizationEvidenceUrl,
    ) && brandAuthorizedOffers.length >= 1;
  return brandRoute ? "brand-authorized" : undefined;
}

export function nigeriaBlockers(
  candidate: CatalogueIntakeCandidate,
  offers: CatalogueIntakeOffer[],
  asOf: number,
  marketRoute: CatalogueNigeriaMarketRoute | undefined,
) {
  const blockers: CatalogueIntakeBlocker[] = [];
  if (!offers.length) blockers.push("nigeria-exact-offer-missing");
  if (
    (candidate.nigeria.exactOffers.length > 0 ||
      candidate.nigeria.excludedObservations.length > 0) &&
    !offers.length
  )
    blockers.push("nigeria-offer-identity-unbound");
  if (!marketRoute) blockers.push("nigeria-market-route-insufficient");
  return blockers;
}

export function rightsBlockers(
  candidate: CatalogueIntakeCandidate,
  asOf: number,
): CatalogueIntakeBlocker[] {
  const blockers: CatalogueIntakeBlocker[] = [];
  if (candidate.asset.rightsStatus !== "documented" || !candidate.asset.origin)
    blockers.push("asset-rights-missing");
  if (
    candidate.asset.origin &&
    !packshotEligibleOrigins.includes(
      candidate.asset.origin as (typeof packshotEligibleOrigins)[number],
    )
  )
    blockers.push("asset-origin-ineligible");
  if (
    candidate.asset.origin !== "owned-identity-verified-render" &&
    !validHttps(candidate.asset.rightsUrl)
  )
    blockers.push("asset-rights-source-missing");
  if (
    candidate.asset.origin === "owned-identity-verified-render" &&
    candidate.asset.rightsUrl !== undefined
  )
    blockers.push("asset-rights-source-missing");
  if (
    !validHttps(candidate.asset.sourceUrl) ||
    !candidate.asset.sourceAssetSha256 ||
    !hashPattern.test(candidate.asset.sourceAssetSha256) ||
    !["image/avif", "image/jpeg", "image/png", "image/webp"].includes(
      candidate.asset.sourceAssetMimeType ?? "",
    ) ||
    !Number.isInteger(candidate.asset.sourceAssetByteSize) ||
    (candidate.asset.sourceAssetByteSize ?? 0) <= 0 ||
    !Number.isInteger(candidate.asset.sourceAssetWidth) ||
    !Number.isInteger(candidate.asset.sourceAssetHeight) ||
    (candidate.asset.sourceAssetWidth ?? 0) <= 0 ||
    (candidate.asset.sourceAssetHeight ?? 0) <= 0 ||
    !validPastDate(candidate.asset.sourceAssetRetrievedAt, asOf)
  )
    blockers.push("asset-source-snapshot-invalid");
  if (
    candidate.asset.backgroundTreatment === "source-pixel-isolation" &&
    !cataloguePackshotIsolationRecordValid(
      cataloguePackshotIsolationRecordFor(
        cataloguePackshotIsolations as readonly CataloguePackshotIsolationRecord[],
        candidate.id,
      ),
      candidate,
      asOf,
    )
  ) {
    blockers.push("asset-isolation-record-missing");
  }
  if (
    candidate.asset.origin === "owned-identity-verified-render" &&
    !generationRecordValid(candidate, asOf)
  )
    blockers.push("asset-generation-record-missing");
  if (
    candidate.asset.origin !== "owned-identity-verified-render" &&
    candidate.asset.generationRecord
  )
    blockers.push("asset-generation-record-missing");
  return blockers;
}

export function editorialBlockers(
  candidate: CatalogueIntakeCandidate,
  asOf: number,
): CatalogueIntakeBlocker[] {
  const blockers: CatalogueIntakeBlocker[] = [];
  if (candidate.asset.role !== "packshot")
    blockers.push("asset-final-image-role-invalid");
  if (!validHttps(candidate.asset.publicImageUrl))
    blockers.push("asset-final-image-missing");
  const validMimeType = isCataloguePublicationImageMimeType(
    candidate.asset.publicImageMimeType,
  );
  if (
    !candidate.asset.publicImageSha256 ||
    !hashPattern.test(candidate.asset.publicImageSha256) ||
    !validMimeType ||
    !Number.isInteger(candidate.asset.publicImageByteSize) ||
    (candidate.asset.publicImageByteSize ?? 0) <= 0 ||
    (candidate.asset.publicImageByteSize ?? 0) >
      cataloguePublicationImageMaxBytes
  )
    blockers.push("asset-final-image-invalid");
  if (
    !Number.isInteger(candidate.asset.width) ||
    !Number.isInteger(candidate.asset.height) ||
    Math.min(candidate.asset.width ?? 0, candidate.asset.height ?? 0) <
      cataloguePublicationImageMinSide ||
    Math.max(candidate.asset.width ?? 0, candidate.asset.height ?? 0) >
      cataloguePublicationImageMaxSide
  )
    blockers.push("asset-final-image-too-small");
  if (validHttps(candidate.asset.publicImageUrl) && validMimeType) {
    try {
      assertCataloguePublicationImageLocation(
        candidate.id,
        candidate.asset.publicImageUrl ?? "",
        candidate.asset
          .publicImageMimeType as CataloguePublicationImageMimeType,
        candidate.asset.publicImageSha256 ?? "",
      );
    } catch {
      blockers.push("asset-final-image-untrusted-location");
    }
  }
  if (candidate.asset.backgroundTreatment === "automated-removal")
    blockers.push("asset-automated-cutout");
  if (
    !["none", "source-pixel-isolation", "identity-verified-render"].includes(
      candidate.asset.backgroundTreatment ?? "",
    )
  ) {
    blockers.push("asset-background-treatment-unresolved");
  }
  if (candidate.asset.packaging !== "intact")
    blockers.push("asset-packaging-not-intact");
  const sourceRetrievedAt = Date.parse(
    candidate.asset.sourceAssetRetrievedAt ?? "",
  );
  const generatedAt = Date.parse(
    candidate.asset.generationRecord?.generatedAt ?? "",
  );
  const artReviewedAt = Date.parse(candidate.asset.artReviewedAt ?? "");
  const identityCheckedAt = Date.parse(candidate.identity.checkedAt ?? "");
  if (
    (Number.isFinite(sourceRetrievedAt) &&
      Number.isFinite(artReviewedAt) &&
      artReviewedAt < sourceRetrievedAt) ||
    (candidate.asset.origin === "owned-identity-verified-render" &&
      Number.isFinite(generatedAt) &&
      Number.isFinite(artReviewedAt) &&
      artReviewedAt < generatedAt) ||
    (Number.isFinite(identityCheckedAt) &&
      Number.isFinite(artReviewedAt) &&
      artReviewedAt < identityCheckedAt)
  )
    blockers.push("asset-review-chronology-invalid");
  if (
    candidate.asset.labelVariantSizeUnchanged !== true ||
    candidate.asset.packagingInvented !== false ||
    candidate.asset.manualSourceOutputQa !== true ||
    !candidate.asset.artReviewer?.trim() ||
    !validPastDate(candidate.asset.artReviewedAt, asOf) ||
    (candidate.asset.origin === "owned-identity-verified-render"
      ? candidate.asset.backgroundTreatment !== "identity-verified-render"
      : candidate.asset.backgroundTreatment === "identity-verified-render")
  )
    blockers.push("asset-identity-qa-missing");
  if (candidate.asset.presentationQuality !== "magazine-ready")
    blockers.push("asset-not-magazine-ready");
  return blockers;
}

export const actionForStage: Record<CatalogueIntakeStage, string> = {
  identity:
    "Lock the exact manufacturer identifier, variant, size and package to a checked-in reviewed extraction and source digest.",
  care: "Review the formula role and advisory boundaries from primary evidence.",
  nigeria:
    "Verify a fresh exact Nigerian product page and bind its current price.",
  rights: "Document permission or another valid image-rights basis.",
  editorial:
    "Finish and manually compare the exact package in its final editorial image.",
  "approval-ready": "Draft the identity-bound publication approval.",
};
