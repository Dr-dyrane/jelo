import type { CatalogueIntakeCandidate } from './intake-readiness';
import { catalogueCanonicalIdentifierFor } from './canonical-identity';
import alphaRepairEvidenceManifestJson from '@/data/catalogue-packshot-alpha-repair-evidence/manifest.json';

// Reviewed source-pixel isolation records for catalogue publication packshots.
//
// A catalogue packshot may keep the manufacturer's own photographed pixels and
// replace only the background, but only when this record proves the run:
// the immutable source bytes, the pinned deterministic runtime, an audit that
// either shows no foreground was discarded or truthfully binds a reviewed
// repair, the exact output bytes, and two ordered human reviews across the
// three publication surfaces.
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
export const cataloguePackshotAlphaRepairPipelineVersion =
  'deterministic-source-rgb-destructive-alpha-repair-v1' as const;
export const cataloguePackshotIsolationPackageRgbOrigin =
  'identity-master-source-pixels-only' as const;
export const cataloguePackshotIsolationProvider = 'CPUExecutionProvider' as const;
export const cataloguePackshotIsolationSurfaces = ['peach', 'pink', 'dark'] as const;
export const cataloguePackshotIsolationPublicationScope = 'catalogue-publication' as const;
export const cataloguePackshotAlphaRepairEvidenceManifestPath =
  'data/catalogue-packshot-alpha-repair-evidence/manifest.json' as const;
export const cataloguePackshotAlphaRepairEvidenceManifestSha256 =
  'cd89578ee6bb5e2f1eac808ea9d6ff9a1a1f92d3b7322ffea980108a0b3dd2da' as const;
export const cataloguePackshotAlphaRepairReplayScriptPath =
  'scripts/replay-reviewed-alpha-repair.py' as const;

const hashPattern = /^[0-9a-f]{64}$/;

type CataloguePackshotIsolationRecordBase = {
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

type CataloguePackshotIsolationProcessingBase = {
  packageRgbOrigin: typeof cataloguePackshotIsolationPackageRgbOrigin;
  tool: string;
  model: string;
  modelSha256: string;
  provider: typeof cataloguePackshotIsolationProvider;
  runtimeLockPath: string;
  runtimeLockSha256: string;
};

export type CataloguePackshotIsolationV3Record = CataloguePackshotIsolationRecordBase & {
  processing: {
    pipelineVersion: typeof cataloguePackshotIsolationPipelineVersion;
  } & CataloguePackshotIsolationProcessingBase;
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
};

export type CataloguePackshotAlphaRepairMetrics = {
  maskThreshold: 32;
  restoredPrecursorComponentCount: number;
  restoredPrecursorForegroundPixelCount: number;
  finalSourceComponentCount: number;
  finalSourceForegroundPixelCount: number;
  addedForegroundPixelCount: number;
  removedForegroundPixelCount: number;
  removedForegroundFraction: number;
  sourceEdgeContactFractionBefore: number;
  sourceEdgeContactFractionAfter: number;
  sourceAlphaBounds: readonly number[];
  sourceForegroundFraction: number;
  subjectTargetSize: readonly number[];
  subjectScale: number;
  outputAlphaBounds: readonly number[];
  transparentPixelCount: number;
  partialAlphaPixelCount: number;
  opaquePixelCount: number;
  outputComponentCount: number;
  outputHolePixelCount: number;
  outputEdgeAlphaMax: number;
  componentReviewRequired: true;
  componentReviewCompleted: true;
};

export type CataloguePackshotAlphaRepairRecord = CataloguePackshotIsolationRecordBase & {
  processing: {
    pipelineVersion: typeof cataloguePackshotAlphaRepairPipelineVersion;
    repairEvidence: {
      manifestPath: typeof cataloguePackshotAlphaRepairEvidenceManifestPath;
      manifestSha256: string;
      replayScriptPath: typeof cataloguePackshotAlphaRepairReplayScriptPath;
      replayScriptSha256: string;
      prepareScriptPath: string;
      prepareScriptSha256: string;
      sourceInput: { path: string; sha256: string };
      precursorInput: { path: string; sha256: string; auditSha256: string };
      geometryReferenceInput: {
        path: string;
        sha256: string;
        contributesPackageRgb: false;
      } | null;
      rollout: {
        sessionRolloutId: string;
        geometryCallId: string;
        geometryCallInputSha256: string;
        finalPackagingCallId: string;
        finalPackagingCallInputSha256: string;
      };
      outputSha256: string;
      outputColorProfileSha256: string;
      surfaceReviewPath: string;
      surfaceReviewSha256: string;
    };
  } & CataloguePackshotIsolationProcessingBase;
  audit: {
    sha256: string;
    generatedAt: string;
    repairMetrics: CataloguePackshotAlphaRepairMetrics;
  };
};

export type CataloguePackshotIsolationRecord =
  | CataloguePackshotIsolationV3Record
  | CataloguePackshotAlphaRepairRecord;

function pastDate(value: unknown, asOf: number) {
  if (typeof value !== 'string') return undefined;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed > asOf) return undefined;
  return parsed;
}

function positiveInteger(value: unknown) {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function nonNegativeInteger(value: unknown) {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function nonEmpty(value: unknown) {
  return typeof value === 'string' && value.trim().length >= 2;
}

function finiteFraction(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function numberArrayEqual(actual: readonly number[], expected: readonly number[]) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && expected.every((value, index) => actual[index] === value);
}

type AlphaRepairEvidenceRecord = (typeof alphaRepairEvidenceManifestJson.records)[number];

function alphaRepairEvidenceFor(candidateId: string): AlphaRepairEvidenceRecord | undefined {
  const matches = alphaRepairEvidenceManifestJson.records.filter(
    record => record.candidateId === candidateId,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function standardProcessingAndAuditValid(record: CataloguePackshotIsolationV3Record) {
  return Boolean(
    record.processing.pipelineVersion === cataloguePackshotIsolationPipelineVersion
    && record.processing.packageRgbOrigin === cataloguePackshotIsolationPackageRgbOrigin
    && record.processing.provider === cataloguePackshotIsolationProvider
    && nonEmpty(record.processing.tool)
    && nonEmpty(record.processing.model)
    && hashPattern.test(record.processing.modelSha256)
    && nonEmpty(record.processing.runtimeLockPath)
    && hashPattern.test(record.processing.runtimeLockSha256)
    && hashPattern.test(record.audit.sha256)
    && positiveInteger(record.audit.inferredComponentCount)
    && record.audit.retainedComponentCount === record.audit.inferredComponentCount
    && record.audit.removedComponentCount === 0
    && record.audit.removedForegroundFraction === 0
    && record.audit.componentReviewRequired === false
    && record.audit.sourceEdgeContactFraction === 0
  );
}

function alphaRepairMetricsValid(
  actual: CataloguePackshotAlphaRepairMetrics,
  expected: AlphaRepairEvidenceRecord['repair']['metrics'],
) {
  const calculatedRemovedFraction = Math.round(
    (actual.removedForegroundPixelCount
      / actual.restoredPrecursorForegroundPixelCount) * 100_000_000,
  ) / 100_000_000;

  return Boolean(
    actual.maskThreshold === expected.maskThreshold
    && positiveInteger(actual.restoredPrecursorComponentCount)
    && actual.restoredPrecursorComponentCount === expected.restoredPrecursorComponentCount
    && positiveInteger(actual.restoredPrecursorForegroundPixelCount)
    && actual.restoredPrecursorForegroundPixelCount
      === expected.restoredPrecursorForegroundPixelCount
    && positiveInteger(actual.finalSourceComponentCount)
    && actual.finalSourceComponentCount === expected.finalSourceComponentCount
    && positiveInteger(actual.finalSourceForegroundPixelCount)
    && actual.finalSourceForegroundPixelCount === expected.finalSourceForegroundPixelCount
    && nonNegativeInteger(actual.addedForegroundPixelCount)
    && actual.addedForegroundPixelCount === expected.addedForegroundPixelCount
    && nonNegativeInteger(actual.removedForegroundPixelCount)
    && actual.removedForegroundPixelCount === expected.removedForegroundPixelCount
    && actual.finalSourceForegroundPixelCount
      === actual.restoredPrecursorForegroundPixelCount
        + actual.addedForegroundPixelCount
        - actual.removedForegroundPixelCount
    && finiteFraction(actual.removedForegroundFraction)
    && actual.removedForegroundFraction === calculatedRemovedFraction
    && actual.removedForegroundFraction === expected.removedForegroundFraction
    && finiteFraction(actual.sourceEdgeContactFractionBefore)
    && actual.sourceEdgeContactFractionBefore === expected.sourceEdgeContactFractionBefore
    && actual.sourceEdgeContactFractionAfter === 0
    && actual.sourceEdgeContactFractionAfter === expected.sourceEdgeContactFractionAfter
    && numberArrayEqual(actual.sourceAlphaBounds, expected.sourceAlphaBounds)
    && finiteFraction(actual.sourceForegroundFraction)
    && actual.sourceForegroundFraction === expected.sourceForegroundFraction
    && numberArrayEqual(actual.subjectTargetSize, expected.subjectTargetSize)
    && typeof actual.subjectScale === 'number'
    && actual.subjectScale === expected.subjectScale
    && numberArrayEqual(actual.outputAlphaBounds, expected.outputAlphaBounds)
    && nonNegativeInteger(actual.transparentPixelCount)
    && actual.transparentPixelCount === expected.transparentPixelCount
    && nonNegativeInteger(actual.partialAlphaPixelCount)
    && actual.partialAlphaPixelCount === expected.partialAlphaPixelCount
    && nonNegativeInteger(actual.opaquePixelCount)
    && actual.opaquePixelCount === expected.opaquePixelCount
    && actual.transparentPixelCount
      + actual.partialAlphaPixelCount
      + actual.opaquePixelCount === 4_000_000
    && actual.outputComponentCount === 1
    && actual.outputComponentCount === expected.outputComponentCount
    && actual.outputHolePixelCount === 0
    && actual.outputHolePixelCount === expected.outputHolePixelCount
    && actual.outputEdgeAlphaMax === 0
    && actual.outputEdgeAlphaMax === expected.outputEdgeAlphaMax
    && actual.componentReviewRequired === true
    && actual.componentReviewRequired === expected.componentReviewRequired
    && actual.componentReviewCompleted === true
    && actual.componentReviewCompleted === expected.componentReviewCompleted
  );
}

function alphaRepairProcessingAndAuditValid(record: CataloguePackshotAlphaRepairRecord) {
  const manifest = alphaRepairEvidenceManifestJson;
  const expected = alphaRepairEvidenceFor(record.candidateId);
  const binding = record.processing.repairEvidence;
  const metrics = record.audit.repairMetrics;
  if (
    !expected
    || !binding
    || typeof binding !== 'object'
    || !binding.sourceInput
    || typeof binding.sourceInput !== 'object'
    || !binding.precursorInput
    || typeof binding.precursorInput !== 'object'
    || !binding.rollout
    || typeof binding.rollout !== 'object'
    || !metrics
    || typeof metrics !== 'object'
    || !Array.isArray(record.review.surfaces)
  ) return false;

  const expectedReference = expected.geometryReference;
  const referenceValid = expectedReference == null
    ? binding.geometryReferenceInput === null
    : Boolean(
      binding.geometryReferenceInput
      && binding.geometryReferenceInput.path === expectedReference.path
      && binding.geometryReferenceInput.sha256 === expectedReference.sha256
      && binding.geometryReferenceInput.contributesPackageRgb === false
      && expectedReference.contributesPackageRgb === false,
    );

  return Boolean(
    manifest.schemaVersion === 1
    && manifest.scope === 'private-catalogue-packshot-alpha-repair-evidence'
    && manifest.pipelineVersion === cataloguePackshotAlphaRepairPipelineVersion
    && manifest.replay.packageRgbOrigin === cataloguePackshotIsolationPackageRgbOrigin
    && record.processing.pipelineVersion === cataloguePackshotAlphaRepairPipelineVersion
    && record.processing.packageRgbOrigin === manifest.replay.packageRgbOrigin
    && record.processing.tool === manifest.replay.tool
    && record.processing.model === manifest.replay.model
    && record.processing.modelSha256 === manifest.replay.modelSha256
    && record.processing.provider === manifest.replay.provider
    && record.processing.runtimeLockPath === manifest.replay.runtimeLockPath
    && record.processing.runtimeLockSha256 === manifest.replay.runtimeLockSha256
    && binding.manifestPath === cataloguePackshotAlphaRepairEvidenceManifestPath
    && binding.manifestSha256 === cataloguePackshotAlphaRepairEvidenceManifestSha256
    && binding.replayScriptPath === cataloguePackshotAlphaRepairReplayScriptPath
    && binding.replayScriptPath === manifest.replay.scriptPath
    && binding.replayScriptSha256 === manifest.replay.scriptSha256
    && binding.prepareScriptPath === manifest.replay.prepareScriptPath
    && binding.prepareScriptSha256 === manifest.replay.prepareScriptSha256
    && binding.sourceInput.path === expected.source.path
    && binding.sourceInput.sha256 === expected.source.sha256
    && binding.sourceInput.sha256 === record.source.sha256
    && binding.precursorInput.path === expected.precursor.path
    && binding.precursorInput.sha256 === expected.precursor.sha256
    && binding.precursorInput.auditSha256 === expected.precursor.auditSha256
    && referenceValid
    && binding.rollout.sessionRolloutId === manifest.rollout.sessionRolloutId
    && binding.rollout.geometryCallId === expected.repair.geometryCallId
    && binding.rollout.geometryCallInputSha256 === expected.repair.geometryCallInputSha256
    && binding.rollout.finalPackagingCallId === manifest.rollout.finalPackagingCallId
    && binding.rollout.finalPackagingCallInputSha256
      === manifest.rollout.finalPackagingCallInputSha256
    && binding.outputSha256 === expected.output.sha256
    && binding.outputSha256 === record.output.sha256
    && binding.outputColorProfileSha256 === expected.output.colorProfileSha256
    && binding.outputColorProfileSha256 === manifest.replay.colorProfile.sha256
    && binding.surfaceReviewPath === expected.review.surfaceReviewPath
    && binding.surfaceReviewSha256 === expected.review.surfaceReviewSha256
    && binding.surfaceReviewSha256 === record.review.surfaceReviewSha256
    && record.source.url === expected.source.url
    && record.source.sha256 === expected.source.sha256
    && record.source.byteSize === expected.source.byteSize
    && record.source.width === expected.source.width
    && record.source.height === expected.source.height
    && record.audit.sha256 === cataloguePackshotAlphaRepairEvidenceManifestSha256
    && record.audit.generatedAt === expected.generatedAt
    && record.output.sha256 === expected.output.sha256
    && record.output.byteSize === expected.output.byteSize
    && record.output.mimeType === expected.output.mimeType
    && record.output.width === expected.output.width
    && record.output.height === expected.output.height
    && record.output.hasAlpha === expected.output.hasAlpha
    && record.review.identityReviewedAt === expected.review.identityReviewedAt
    && record.review.identityReviewer === expected.review.identityReviewer
    && record.review.artReviewedAt === expected.review.artReviewedAt
    && record.review.artReviewer === expected.review.artReviewer
    && record.review.surfaceReviewSha256 === expected.review.surfaceReviewSha256
    && record.review.surfaces.length === expected.review.surfaces.length
    && expected.review.surfaces.every(
      (surface, index) => record.review.surfaces[index] === surface,
    )
    && record.review.packagingIntact === expected.review.packagingIntact
    && record.review.labelVariantSizeUnchanged === expected.review.labelVariantSizeUnchanged
    && record.review.magazineReady === expected.review.magazineReady
    && alphaRepairMetricsValid(metrics, expected.repair.metrics)
  );
}

function processingAndAuditValid(record: CataloguePackshotIsolationRecord) {
  const reviewedRepair = alphaRepairEvidenceFor(record.candidateId);
  const publishesReviewedRepair = Boolean(
    reviewedRepair
    && record.source.sha256 === reviewedRepair.source.sha256
    && record.output.sha256 === reviewedRepair.output.sha256,
  );
  if (publishesReviewedRepair) {
    return record.processing.pipelineVersion === cataloguePackshotAlphaRepairPipelineVersion
      && alphaRepairProcessingAndAuditValid(record as CataloguePackshotAlphaRepairRecord);
  }
  if (record.processing.pipelineVersion === cataloguePackshotIsolationPipelineVersion) {
    return standardProcessingAndAuditValid(record as CataloguePackshotIsolationV3Record);
  }
  if (record.processing.pipelineVersion === cataloguePackshotAlphaRepairPipelineVersion) {
    return alphaRepairProcessingAndAuditValid(record as CataloguePackshotAlphaRepairRecord);
  }
  return false;
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

    // Ordinary v3 keeps its zero-removal contract. A reviewed repair instead
    // has to match every durable input, retained rollout call and truthful
    // before/after metric in the private evidence manifest.
    && processingAndAuditValid(record)

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
