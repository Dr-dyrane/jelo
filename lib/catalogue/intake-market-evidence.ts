import { nigeriaRetailers } from "@/data/retailers";
import { assertRetailerResponseScope } from "@/modules/retail-intelligence/response-scope";
import { isValidGtin } from "./gtin";
import { reviewedExactOfferEvidenceValid } from "./market-evidence";
import {
  catalogueCanonicalIdentifierFor,
  catalogueGtinForIdentity,
} from "./canonical-identity";
import {
  catalogueManufacturerSkuIdentityExtractionSchemaVersion,
  catalogueGenerationRecordSchemaVersion,
  catalogueMarketObservationSchemaVersion,
  type CatalogueIntakeCandidate,
  type CatalogueIntakeOffer,
  type CatalogueMarketObservation,
  type CatalogueMarketObservationExclusionReason,
  type CatalogueGenerationRecord,
  type CatalogueGenerationRecordContent,
} from "./intake-types";
import {
  validHttps,
  validPastDate,
  sameGtin,
  normalized,
  normalizedSize,
  hashPattern,
  catalogueGenerationRecordSha256,
  sameUrl,
} from "./intake-identity-evidence";

export function generationRecordContent(
  record: CatalogueGenerationRecord,
): CatalogueGenerationRecordContent {
  return {
    schemaVersion: record.schemaVersion,
    provider: record.provider,
    model: record.model,
    prompt: record.prompt,
    inputs: record.inputs.map((input) => ({ ...input })),
    outputSha256: record.outputSha256,
    generatedAt: record.generatedAt,
  };
}

export function generationRecordValid(
  candidate: CatalogueIntakeCandidate,
  asOf: number,
) {
  const record = candidate.asset.generationRecord;
  if (
    !record ||
    record.schemaVersion !== catalogueGenerationRecordSchemaVersion ||
    typeof record.provider !== "string" ||
    !record.provider.trim() ||
    typeof record.model !== "string" ||
    !record.model.trim() ||
    typeof record.prompt !== "string" ||
    !record.prompt.trim() ||
    !Array.isArray(record.inputs) ||
    !record.inputs.length ||
    typeof record.outputSha256 !== "string" ||
    !hashPattern.test(record.outputSha256) ||
    typeof record.recordSha256 !== "string" ||
    !hashPattern.test(record.recordSha256) ||
    typeof record.generatedAt !== "string" ||
    !validPastDate(record.generatedAt, asOf)
  )
    return false;

  const inputKeys = new Set<string>();
  for (const input of record.inputs) {
    if (
      !input ||
      typeof input.url !== "string" ||
      !validHttps(input.url) ||
      typeof input.sha256 !== "string" ||
      !hashPattern.test(input.sha256)
    )
      return false;
    inputKeys.add(`${input.url}\n${input.sha256}`);
  }
  if (inputKeys.size !== record.inputs.length) return false;
  if (
    !candidate.asset.sourceUrl ||
    !candidate.asset.sourceAssetSha256 ||
    !record.inputs.some(
      (input) =>
        input.url === candidate.asset.sourceUrl &&
        input.sha256 === candidate.asset.sourceAssetSha256,
    ) ||
    record.inputs.some((input) => input.sha256 === record.outputSha256) ||
    record.outputSha256 !== candidate.asset.publicImageSha256
  )
    return false;

  const sourceRetrievedAt = Date.parse(
    candidate.asset.sourceAssetRetrievedAt ?? "",
  );
  const generatedAt = Date.parse(record.generatedAt);
  if (!Number.isFinite(sourceRetrievedAt) || generatedAt < sourceRetrievedAt)
    return false;

  return (
    catalogueGenerationRecordSha256(generationRecordContent(record)) ===
    record.recordSha256
  );
}

export function canonicalRetailerOffer(offer: CatalogueIntakeOffer) {
  const retailer = nigeriaRetailers.find(
    (item) => normalized(item.name) === normalized(offer.retailer),
  );
  if (!retailer) return undefined;

  const listing = new URL(offer.listingUrl);
  const homepage = new URL(retailer.homepage);
  const host = (value: URL) =>
    value.hostname.replace(/^www\./, "").toLowerCase();
  if (host(listing) !== host(homepage)) return undefined;

  return {
    ...offer,
    retailer: retailer.name,
    retailerStatus: retailer.reviewStatus,
  } satisfies CatalogueIntakeOffer;
}

export function reviewedOfferTitleAlias(
  candidate: CatalogueIntakeCandidate,
  offer: CatalogueIntakeOffer,
) {
  const alias = offer.reviewedTitleAlias?.trim();
  if (!alias) return undefined;

  const tokens = (value: string) =>
    normalized(value)
      .split(" ")
      .filter((token) => token.length >= 3);
  const candidateTokens = new Set(
    tokens(`${candidate.name} ${candidate.variant}`),
  );
  const aliasTokens = Array.from(new Set(tokens(alias)));
  const observedTokens = new Set(tokens(offer.observedTitle));

  return aliasTokens.length >= 3 &&
    aliasTokens.every((token) => candidateTokens.has(token)) &&
    aliasTokens.every((token) => observedTokens.has(token))
    ? alias
    : undefined;
}

const marketObservationExclusionReasons: readonly CatalogueMarketObservationExclusionReason[] =
  [
    "retailer-identifier-only",
    "retailer-identifier-conflicts-with-candidate",
    "manufacturer-identifier-mismatch",
    "package-barcode-missing",
    "package-variant-conflict",
    "retailer-provisional",
    "listing-no-longer-current",
    "marketplace-seller-unverified",
  ];

export function marketObservationValid(
  candidate: CatalogueIntakeCandidate,
  observation: CatalogueMarketObservation,
  asOf: number,
) {
  const evidence = observation.evidence;
  const observedAt = Date.parse(observation.observedAt);
  const retrievedAt = Date.parse(evidence?.retrievedAt ?? "");
  const reviewedAt = Date.parse(evidence?.reviewedAt ?? "");
  const reasons = new Set(observation.exclusionReasons);
  const retailer = nigeriaRetailers.find(
    (item) => normalized(item.name) === normalized(observation.retailer),
  );
  let listing: URL;
  let homepage: URL;
  try {
    listing = new URL(observation.listingUrl);
    homepage = new URL(retailer?.homepage ?? "");
  } catch {
    return false;
  }
  const host = (value: URL) =>
    value.hostname.replace(/^www\./, "").toLowerCase();
  if (
    !retailer ||
    retailer.reviewStatus !== observation.retailerStatus ||
    listing.protocol !== "https:" ||
    host(listing) !== host(homepage) ||
    observation.disposition !== "excluded-from-exact-comparison" ||
    !observation.exclusionReasons.length ||
    reasons.size !== observation.exclusionReasons.length ||
    observation.exclusionReasons.some(
      (reason) => !marketObservationExclusionReasons.includes(reason),
    ) ||
    !Number.isFinite(observedAt) ||
    !Number.isFinite(retrievedAt) ||
    !Number.isFinite(reviewedAt) ||
    observedAt !== retrievedAt ||
    reviewedAt < retrievedAt ||
    reviewedAt > asOf + 5 * 60_000 ||
    !Number.isFinite(observation.priceNgn) ||
    observation.priceNgn <= 0 ||
    !["in-stock", "low-stock", "out-of-stock"].includes(observation.stock) ||
    evidence.schemaVersion !== catalogueMarketObservationSchemaVersion ||
    evidence.method !== "reviewed-retailer-observation" ||
    !sameUrl(observation.listingUrl, evidence.responseUrl) ||
    evidence.responseDigestScope !== "decoded-response-body" ||
    evidence.responseMimeType !== "text/html" ||
    !hashPattern.test(evidence.responseSha256) ||
    !Number.isInteger(evidence.responseByteSize) ||
    evidence.responseByteSize <= 0 ||
    !evidence.reviewer.trim() ||
    normalized(evidence.fields.title.value) !==
      normalized(observation.observedTitle) ||
    normalizedSize(evidence.fields.size.value) !==
      normalizedSize(observation.observedSize) ||
    evidence.fields.price.value !== observation.priceNgn ||
    evidence.fields.price.currency !== "NGN" ||
    evidence.fields.stock.value !== observation.stock ||
    [
      evidence.fields.title,
      evidence.fields.size,
      evidence.fields.price,
      evidence.fields.stock,
    ].some((field) => !field.locator.trim() || !field.sourceText.trim())
  )
    return false;

  const identifier = evidence.fields.retailerIdentifier;
  if (
    identifier &&
    (!identifier.value.trim() ||
      !identifier.locator.trim() ||
      !identifier.sourceText.trim())
  )
    return false;
  if (reasons.has("retailer-identifier-only") && identifier?.label !== "SKU")
    return false;
  if (
    reasons.has("retailer-identifier-conflicts-with-candidate") &&
    (identifier?.label !== "SKU" ||
      sameGtin(identifier.value, catalogueGtinForIdentity(candidate.identity)))
  )
    return false;
  if (
    reasons.has("manufacturer-identifier-mismatch") &&
    (!identifier ||
      !["EAN", "GTIN", "UPC"].includes(identifier.label) ||
      !isValidGtin(identifier.value) ||
      sameGtin(identifier.value, catalogueGtinForIdentity(candidate.identity)))
  )
    return false;
  if (
    reasons.has("package-variant-conflict") &&
    !evidence.fields.packageVariantConflict?.sourceText.trim()
  )
    return false;
  if (
    reasons.has("retailer-provisional") &&
    observation.retailerStatus !== "provisional"
  )
    return false;
  return true;
}

export function retainedOfficialManufacturerBrandAliases(
  candidate: CatalogueIntakeCandidate,
) {
  const extraction = candidate.identity.officialEvidence?.canonicalExtraction;
  if (
    !extraction ||
    extraction.schemaVersion !==
      catalogueManufacturerSkuIdentityExtractionSchemaVersion
  )
    return [] as string[];
  return (extraction.fields.manufacturerBrandAliases ?? []).map(
    (alias) => alias.value,
  );
}

export function matchingOffer(
  candidate: CatalogueIntakeCandidate,
  offer: CatalogueIntakeOffer,
  asOf: number,
) {
  const observedAt = Date.parse(offer.observedAt);
  const identityCheckedAt = Date.parse(candidate.identity.checkedAt ?? "");
  const offerReviewedAt = Date.parse(offer.evidence?.reviewedAt ?? "");
  const exactVariantAndSize =
    offer.observedGtinBasis === "exact-variant-and-size";
  const canonicalIdentifier = catalogueCanonicalIdentifierFor(
    candidate.identity,
  );
  if (
    !canonicalIdentifier ||
    !offer.retailer.trim() ||
    !validHttps(offer.listingUrl) ||
    (canonicalIdentifier?.kind === "manufacturer-sku"
      ? !exactVariantAndSize || offer.observedGtin != null
      : exactVariantAndSize
        ? offer.observedGtin != null
        : !sameGtin(
            offer.observedGtin,
            catalogueGtinForIdentity(candidate.identity),
          )) ||
    ![
      "explicit-gtin",
      "explicit-ean",
      "explicit-upc",
      "exact-variant-and-size",
    ].includes(offer.observedGtinBasis ?? "") ||
    (candidate.identity.packageVersion != null &&
      normalized(offer.observedPackageVersion ?? "") !==
        normalized(candidate.identity.packageVersion)) ||
    !Number.isFinite(observedAt) ||
    observedAt < asOf - 7 * 86_400_000 ||
    observedAt > asOf + 5 * 60_000 ||
    !Number.isFinite(offer.priceNgn) ||
    offer.priceNgn <= 0 ||
    !reviewedExactOfferEvidenceValid(
      offer,
      canonicalIdentifier.kind === "manufacturer-sku"
        ? {
            ...canonicalIdentifier,
            officialProductUrl: candidate.identity.officialProductUrl ?? "",
            officialIdentitySnapshotPath:
              candidate.identity.officialEvidence?.snapshotPath ?? "",
            officialIdentitySnapshotSha256:
              candidate.identity.officialEvidence?.snapshotSha256 ?? "",
            brand: candidate.brand,
            officialBrandAliases:
              retainedOfficialManufacturerBrandAliases(candidate),
            variant: candidate.variant,
          }
        : canonicalIdentifier,
      asOf,
    ) ||
    !Number.isFinite(identityCheckedAt) ||
    !Number.isFinite(offerReviewedAt) ||
    offerReviewedAt < identityCheckedAt
  )
    return undefined;

  const canonicalOffer = canonicalRetailerOffer(offer);
  if (!canonicalOffer) return undefined;
  const reviewedTitleAlias = reviewedOfferTitleAlias(candidate, canonicalOffer);
  if (canonicalOffer.reviewedTitleAlias && !reviewedTitleAlias)
    return undefined;

  try {
    assertRetailerResponseScope({
      requestedUrl: canonicalOffer.listingUrl,
      responseUrl: canonicalOffer.listingUrl,
      expectedTitle: candidate.variant,
      expectedTitleAliases: [
        ...(normalized(candidate.name) === normalized(candidate.variant)
          ? []
          : [candidate.name]),
        ...(reviewedTitleAlias ? [reviewedTitleAlias] : []),
      ],
      expectedSize: candidate.size,
      observedTitle: canonicalOffer.observedTitle,
      observedSize: canonicalOffer.observedSize,
      marketCode: "NG",
      currencyCode: "NGN",
    });
    return canonicalOffer;
  } catch {
    return undefined;
  }
}
