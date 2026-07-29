import type { CatalogueIntakeCandidate } from './intake-readiness';
import { catalogueCanonicalIdentifierFor } from './canonical-identity';

// Reviewed source-pixel isolation records for catalogue publication packshots.
//
// A catalogue packshot may keep the manufacturer's own photographed pixels and
// replace only the background, but only when this record proves the run:
// the immutable source bytes, the pinned deterministic runtime, an audit that
// shows no foreground was discarded, the exact output bytes, and two ordered
// human reviews across the three publication surfaces.
//
// This is deliberately stricter than the legacy foundational isolation manifest
// (`data/foundational-packshot-isolations.json`), which predates the catalogue
// publication gate and carries `rightsStatus: 'not-verified'`. A catalogue
// record binds the candidate's canonical identifier and requires documented
// rights, because it publishes into the public catalogue rather than the
// legacy foundational display.
export const cataloguePackshotIsolationSchemaVersion = 1 as const;
export const cataloguePackshotIsolationPipelineVersion =
  'exact-sku-source-pixel-isolation-v3' as const;
export const cataloguePackshotIsolationPackageRgbOrigin =
  'identity-master-source-pixels-only' as const;
export const cataloguePackshotIsolationProvider = 'CPUExecutionProvider' as const;
export const cataloguePackshotIsolationSurfaces = ['peach', 'pink', 'dark'] as const;
export const cataloguePackshotIsolationPublicationScope = 'catalogue-publication' as const;

const hashPattern = /^[0-9a-f]{64}$/;

export type CataloguePackshotIsolationRecord = {
  schemaVersion: typeof cataloguePackshotIsolationSchemaVersion;
  candidateId: string;
  publicationScope: typeof cataloguePackshotIsolationPublicationScope;
  source: {
    url: string;
    sha256: string;
    byteSize: number;
    width: number;
    height: number;
    retrievedAt: string;
  };
  identity: {
    canonicalIdentifier: { kind: 'gtin' | 'manufacturer-sku'; value: string };
    officialProductUrl: string;
  };
  processing: {
    pipelineVersion: typeof cataloguePackshotIsolationPipelineVersion;
    packageRgbOrigin: typeof cataloguePackshotIsolationPackageRgbOrigin;
    tool: string;
    model: string;
    modelSha256: string;
    provider: typeof cataloguePackshotIsolationProvider;
    runtimeLockPath: string;
    runtimeLockSha256: string;
  };
  audit: {
    sha256: string;
    generatedAt: string;
    inferredComponentCount: number;
    retainedComponentCount: number;
    removedComponentCount: number;
    removedForegroundFraction: number;
    componentReviewRequired: boolean;
    sourceEdgeContactFraction: number;
  };
  output: {
    sha256: string;
    byteSize: number;
    mimeType: 'image/png';
    width: number;
    height: number;
    hasAlpha: true;
  };
  review: {
    identityReviewedAt: string;
    identityReviewer: string;
    artReviewedAt: string;
    artReviewer: string;
    surfaces: readonly string[];
    surfaceReviewSha256: string;
    packagingIntact: true;
    labelVariantSizeUnchanged: true;
    magazineReady: true;
  };
};

function pastDate(value: unknown, asOf: number) {
  if (typeof value !== 'string') return undefined;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed > asOf) return undefined;
  return parsed;
}

function positiveInteger(value: unknown) {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function nonEmpty(value: unknown) {
  return typeof value === 'string' && value.trim().length >= 2;
}

/**
 * True only when the record proves this candidate's isolation run end to end.
 *
 * Every binding is exact: a record that matches a different candidate, a
 * different source, a different runtime, or a different output cannot satisfy
 * the packshot it is presented for.
 */
export function cataloguePackshotIsolationRecordValid(
  record: CataloguePackshotIsolationRecord | undefined,
  candidate: CatalogueIntakeCandidate,
  asOf: number,
): boolean {
  if (!record || typeof record !== 'object') return false;

  const canonicalIdentifier = catalogueCanonicalIdentifierFor(candidate.identity);
  if (!canonicalIdentifier) return false;

  const asset = candidate.asset;
  const retrievedAt = pastDate(record.source.retrievedAt, asOf);
  const generatedAt = pastDate(record.audit.generatedAt, asOf);
  const identityReviewedAt = pastDate(record.review.identityReviewedAt, asOf);
  const artReviewedAt = pastDate(record.review.artReviewedAt, asOf);

  return Boolean(
    record.schemaVersion === cataloguePackshotIsolationSchemaVersion
    && record.publicationScope === cataloguePackshotIsolationPublicationScope
    && record.candidateId === candidate.id

    // The record must describe the same immutable source the candidate binds.
    && record.source.url === asset.sourceUrl
    && hashPattern.test(record.source.sha256)
    && record.source.sha256 === asset.sourceAssetSha256
    && record.source.byteSize === asset.sourceAssetByteSize
    && record.source.width === asset.sourceAssetWidth
    && record.source.height === asset.sourceAssetHeight

    // ...and the same manufacturer identity the dossier will publish.
    && record.identity.canonicalIdentifier.kind === canonicalIdentifier.kind
    && record.identity.canonicalIdentifier.value === canonicalIdentifier.value
    && record.identity.officialProductUrl === candidate.identity.officialProductUrl

    // The run must be the pinned deterministic pipeline, keeping source pixels.
    && record.processing.pipelineVersion === cataloguePackshotIsolationPipelineVersion
    && record.processing.packageRgbOrigin === cataloguePackshotIsolationPackageRgbOrigin
    && record.processing.provider === cataloguePackshotIsolationProvider
    && nonEmpty(record.processing.tool)
    && nonEmpty(record.processing.model)
    && hashPattern.test(record.processing.modelSha256)
    && nonEmpty(record.processing.runtimeLockPath)
    && hashPattern.test(record.processing.runtimeLockSha256)

    // The audit must prove nothing of the package was discarded.
    && hashPattern.test(record.audit.sha256)
    && positiveInteger(record.audit.inferredComponentCount)
    && record.audit.retainedComponentCount === record.audit.inferredComponentCount
    && record.audit.removedComponentCount === 0
    && record.audit.removedForegroundFraction === 0
    && record.audit.componentReviewRequired === false
    && record.audit.sourceEdgeContactFraction === 0

    // The output must be the exact bytes the candidate publishes.
    && hashPattern.test(record.output.sha256)
    && record.output.sha256 === asset.publicImageSha256
    && record.output.byteSize === asset.publicImageByteSize
    && record.output.mimeType === 'image/png'
    && record.output.mimeType === asset.publicImageMimeType
    && record.output.width === asset.width
    && record.output.height === asset.height
    && record.output.hasAlpha === true

    // The record's timeline is the candidate's timeline, not a parallel one.
    // Without this the dossier could publish an art review dated before the
    // isolation run that produced the very bytes being reviewed, which is what
    // "unreviewed automated output cannot pass" exists to prevent.
    && record.source.retrievedAt === asset.sourceAssetRetrievedAt
    && record.review.artReviewedAt === asset.artReviewedAt
    && record.review.artReviewer === asset.artReviewer

    // Two ordered human reviews across all three publication surfaces.
    && nonEmpty(record.review.identityReviewer)
    && nonEmpty(record.review.artReviewer)
    && hashPattern.test(record.review.surfaceReviewSha256)
    && Array.isArray(record.review.surfaces)
    && record.review.surfaces.length === cataloguePackshotIsolationSurfaces.length
    && cataloguePackshotIsolationSurfaces.every(
      (surface, index) => record.review.surfaces[index] === surface,
    )
    && record.review.packagingIntact === true
    && record.review.labelVariantSizeUnchanged === true
    && record.review.magazineReady === true

    // Chronology: retrieved, then processed, then identity-reviewed, then art-reviewed.
    && retrievedAt != null
    && generatedAt != null
    && identityReviewedAt != null
    && artReviewedAt != null
    && retrievedAt < generatedAt
    && generatedAt <= identityReviewedAt
    && identityReviewedAt <= artReviewedAt,
  );
}

export function cataloguePackshotIsolationRecordFor(
  records: readonly CataloguePackshotIsolationRecord[],
  candidateId: string,
) {
  const matches = records.filter(record => record.candidateId === candidateId);
  // A duplicate candidate binding is ambiguous, so it never satisfies the gate.
  return matches.length === 1 ? matches[0] : undefined;
}
