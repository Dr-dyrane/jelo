import dossierManifest from "@/data/catalogue-publication-dossiers.json";
import releaseManifest from "@/data/catalogue-publication-releases.json";

export type CampaignProductIdentifier =
  | { kind: "gtin"; value: string; label: "GTIN" }
  | {
      kind: "manufacturer-sku";
      value: string;
      label: "SKU" | "Manufacturer SKU" | "Product code";
    };

export type PublishedCampaignProductEvidence = {
  slug: string;
  publicationScope: "neutral-reference" | "recommendation-eligible";
  identifier: CampaignProductIdentifier;
  brand: string;
  name: string;
  size: string;
  packageVersion: string;
  careBoundary: string;
  finalImage: {
    url: string;
    sha256: string;
    mimeType: string;
    width: number;
    height: number;
  };
  dossierFingerprint: string;
  releaseFingerprint: string;
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function identifier(value: unknown): CampaignProductIdentifier | null {
  const candidate = record(value);
  const kind = text(candidate?.kind);
  const identifierValue = text(candidate?.value);
  if (!identifierValue) return null;
  if (kind === "gtin" && /^\d{8,14}$/.test(identifierValue)) {
    return { kind, value: identifierValue, label: "GTIN" };
  }
  const label = text(candidate?.label);
  if (
    kind === "manufacturer-sku" &&
    (label === "SKU" ||
      label === "Manufacturer SKU" ||
      label === "Product code")
  ) {
    return { kind, value: identifierValue, label };
  }
  return null;
}

/**
 * Projects only the already-verified publication fields needed by the campaign
 * lane. Absence or drift fails closed instead of letting a public product bypass
 * the dossier/release identity and media gate.
 */
export function publishedCampaignProductEvidence(
  slug: string,
): PublishedCampaignProductEvidence | null {
  const dossiers = record(dossierManifest)?.dossiers;
  const releases = record(releaseManifest)?.releases;
  if (!Array.isArray(dossiers) || !Array.isArray(releases)) return null;

  const dossier = dossiers
    .map(record)
    .find((item) => item?.candidateId === slug);
  const release = releases
    .map(record)
    .find((item) => item?.candidateId === slug);
  if (!dossier || !release) return null;
  if (
    release.exposure !== "public-catalogue" ||
    release.publicationStatus !== "published"
  ) {
    return null;
  }

  const publicationScope = text(release.publicationScope);
  if (
    publicationScope !== "neutral-reference" &&
    publicationScope !== "recommendation-eligible"
  ) {
    return null;
  }

  const identity = record(dossier.identity);
  const care = record(dossier.care);
  const finalImage = record(dossier.finalImage);
  const resolvedIdentifier = identifier(identity?.canonicalIdentifier);
  const brand = text(identity?.brand);
  const name = text(identity?.name);
  const size = text(identity?.size);
  const packageVersion = text(identity?.packageVersion);
  const careBoundary = text(care?.advisoryBoundary);
  const imageUrl = text(finalImage?.url);
  const imageSha256 = text(finalImage?.sha256);
  const imageMimeType = text(finalImage?.mimeType);
  const imageWidth = positiveInteger(finalImage?.width);
  const imageHeight = positiveInteger(finalImage?.height);
  const dossierFingerprint = text(dossier.dossierFingerprint);
  const releaseFingerprint = text(release.releaseFingerprint);

  if (
    !resolvedIdentifier ||
    !brand ||
    !name ||
    !size ||
    !packageVersion ||
    !careBoundary ||
    !imageUrl ||
    !/^https:\/\//.test(imageUrl) ||
    !imageSha256 ||
    !/^[0-9a-f]{64}$/.test(imageSha256) ||
    imageMimeType !== "image/png" ||
    !imageWidth ||
    !imageHeight ||
    !dossierFingerprint ||
    !/^[0-9a-f]{64}$/.test(dossierFingerprint) ||
    !releaseFingerprint ||
    !/^[0-9a-f]{64}$/.test(releaseFingerprint)
  ) {
    return null;
  }

  return {
    slug,
    publicationScope,
    identifier: resolvedIdentifier,
    brand,
    name,
    size,
    packageVersion,
    careBoundary,
    finalImage: {
      url: imageUrl,
      sha256: imageSha256,
      mimeType: imageMimeType,
      width: imageWidth,
      height: imageHeight,
    },
    dossierFingerprint,
    releaseFingerprint,
  };
}
