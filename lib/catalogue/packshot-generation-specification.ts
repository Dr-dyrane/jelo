import {
  evaluateCatalogueIntakeCandidate,
  type CatalogueIntakeCandidate,
} from './intake-readiness';

export const cataloguePackshotGenerationSpecificationSchemaVersion = 1 as const;
export const cataloguePackshotGenerationSpecificationExposure =
  'private-generation-plan-only' as const;

export const cataloguePackshotGenerationCandidateIds = [] as const;

export const cataloguePackshotRequiredProvenanceFields = [
  'asset.rightsStatus',
  'asset.origin',
  'asset.role',
  'asset.generationRecord.schemaVersion',
  'asset.generationRecord.provider',
  'asset.generationRecord.model',
  'asset.generationRecord.prompt',
  'asset.generationRecord.inputs[].url',
  'asset.generationRecord.inputs[].sha256',
  'asset.generationRecord.outputSha256',
  'asset.generationRecord.generatedAt',
  'asset.generationRecord.recordSha256',
  'asset.publicImageUrl',
  'asset.publicImageSha256',
  'asset.publicImageMimeType',
  'asset.publicImageByteSize',
  'asset.width',
  'asset.height',
  'asset.packaging',
  'asset.backgroundTreatment',
  'asset.labelVariantSizeUnchanged',
  'asset.packagingInvented',
  'asset.manualSourceOutputQa',
  'asset.artReviewedAt',
  'asset.artReviewer',
  'asset.presentationQuality',
] as const;

export type CataloguePackshotGenerationSpecification = {
  schemaVersion: typeof cataloguePackshotGenerationSpecificationSchemaVersion;
  candidateId: string;
  publicationEligible: false;
  identity: {
    gtin: string;
    variant: string;
    size: string;
    officialProductUrl: string;
    snapshotPath: string;
    snapshotSha256: string;
  };
  source: {
    url: string;
    sha256: string;
    mimeType: 'image/jpeg' | 'image/png';
    byteSize: number;
    width: number;
    height: number;
    retrievedAt: string;
  };
  request: {
    useCase: 'precise-object-edit';
    target: 'identity-faithful-transparent-packshot';
    canvas: {
      width: 2000;
      height: 2000;
      workingBackground: '#ff00ff';
      finalBackground: 'transparent';
    };
    prompt: string;
    requiredVisibleDetails: string[];
    prohibitedChanges: string[];
  };
  provenanceHandoff: {
    status: 'required-after-output';
    requiredFields: string[];
    prohibitedFields: ['asset.rightsUrl'];
  };
  review: {
    status: 'not-started';
    checklist: string[];
  };
};

export type CataloguePackshotGenerationSpecificationManifest = {
  schemaVersion: typeof cataloguePackshotGenerationSpecificationSchemaVersion;
  exposure: typeof cataloguePackshotGenerationSpecificationExposure;
  updatedAt: string;
  publicationEligible: false;
  specifications: CataloguePackshotGenerationSpecification[];
};

export type CataloguePackshotGenerationSpecificationReport = {
  schemaVersion: typeof cataloguePackshotGenerationSpecificationSchemaVersion;
  exposure: typeof cataloguePackshotGenerationSpecificationExposure;
  specificationCount: number;
  candidateIds: string[];
};

const sha256Pattern = /^[0-9a-f]{64}$/;
const httpsPattern = /^https:\/\//;
const gtinPattern = /^\d{8,14}$/;

function objectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
) {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  if (actual.join('\n') !== canonical.join('\n')) {
    throw new Error(`${label} fields must be exactly: ${canonical.join(', ')}.`);
  }
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function requiredStringArray(value: unknown, label: string, minimum: number) {
  if (
    !Array.isArray(value)
    || value.length < minimum
    || value.some(item => typeof item !== 'string' || !item.trim())
  ) {
    throw new Error(`${label} must contain at least ${minimum} non-empty strings.`);
  }
  if (new Set(value).size !== value.length) {
    throw new Error(`${label} must not contain duplicate entries.`);
  }
  return value as string[];
}

function requiredPositiveInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value as number;
}

function candidateById(
  candidates: readonly CatalogueIntakeCandidate[],
  candidateId: string,
) {
  const candidate = candidates.find(item => item.id === candidateId);
  if (!candidate) throw new Error(`Packshot plan references unknown candidate ${candidateId}.`);
  return candidate;
}

function assertExactBinding(
  actual: unknown,
  expected: unknown,
  label: string,
) {
  if (actual !== expected) {
    throw new Error(`${label} does not match its current intake source.`);
  }
}

function assertCandidateStillFailClosed(
  candidate: CatalogueIntakeCandidate,
  asOf: number,
  dossierCandidateIds: ReadonlySet<string>,
  releaseCandidateIds: ReadonlySet<string>,
) {
  const decision = evaluateCatalogueIntakeCandidate(candidate, asOf);
  if (decision.stage !== 'rights' || decision.approvalDraftReady) {
    throw new Error(
      `${candidate.id} packshot plan requires an unresolved rights-stage candidate.`,
    );
  }
  if (
    candidate.asset.rightsStatus !== 'unresolved'
    || candidate.asset.origin !== undefined
    || candidate.asset.role !== undefined
    || candidate.asset.rightsUrl !== undefined
    || candidate.asset.generationRecord !== undefined
    || candidate.asset.publicImageUrl !== undefined
    || candidate.asset.publicImageSha256 !== undefined
    || candidate.asset.artReviewedAt !== undefined
    || candidate.asset.artReviewer !== undefined
  ) {
    throw new Error(
      `${candidate.id} plan cannot coexist with claimed generation, rights, final art or review.`,
    );
  }
  if (dossierCandidateIds.has(candidate.id) || releaseCandidateIds.has(candidate.id)) {
    throw new Error(`${candidate.id} plan cannot coexist with a dossier or public release.`);
  }
}

function verifySpecification(
  value: unknown,
  candidates: readonly CatalogueIntakeCandidate[],
  asOf: number,
  dossierCandidateIds: ReadonlySet<string>,
  releaseCandidateIds: ReadonlySet<string>,
) {
  const specification = objectRecord(value, 'Packshot specification');
  exactKeys(
    specification,
    [
      'schemaVersion',
      'candidateId',
      'publicationEligible',
      'identity',
      'source',
      'request',
      'provenanceHandoff',
      'review',
    ],
    'Packshot specification',
  );
  if (specification.schemaVersion !== cataloguePackshotGenerationSpecificationSchemaVersion) {
    throw new Error('Packshot specification schema version is unsupported.');
  }
  if (specification.publicationEligible !== false) {
    throw new Error('A packshot generation plan can never be publication eligible.');
  }

  const candidateId = requiredString(specification.candidateId, 'Candidate ID');
  const candidate = candidateById(candidates, candidateId);
  assertCandidateStillFailClosed(
    candidate,
    asOf,
    dossierCandidateIds,
    releaseCandidateIds,
  );

  const identity = objectRecord(specification.identity, `${candidateId} identity`);
  exactKeys(
    identity,
    ['gtin', 'variant', 'size', 'officialProductUrl', 'snapshotPath', 'snapshotSha256'],
    `${candidateId} identity`,
  );
  const officialEvidence = candidate.identity.officialEvidence;
  if (!officialEvidence) throw new Error(`${candidateId} has no official identity evidence.`);
  assertExactBinding(identity.gtin, candidate.identity.gtin, `${candidateId} GTIN`);
  assertExactBinding(identity.variant, candidate.variant, `${candidateId} variant`);
  assertExactBinding(identity.size, candidate.size, `${candidateId} size`);
  assertExactBinding(
    identity.officialProductUrl,
    candidate.identity.officialProductUrl,
    `${candidateId} official URL`,
  );
  assertExactBinding(
    identity.snapshotPath,
    officialEvidence.snapshotPath,
    `${candidateId} identity snapshot path`,
  );
  assertExactBinding(
    identity.snapshotSha256,
    officialEvidence.snapshotSha256,
    `${candidateId} identity snapshot hash`,
  );
  if (
    !gtinPattern.test(requiredString(identity.gtin, `${candidateId} GTIN`))
    || !sha256Pattern.test(requiredString(identity.snapshotSha256, `${candidateId} snapshot hash`))
    || !httpsPattern.test(
      requiredString(identity.officialProductUrl, `${candidateId} official URL`),
    )
  ) {
    throw new Error(`${candidateId} identity binding is malformed.`);
  }

  const source = objectRecord(specification.source, `${candidateId} source`);
  exactKeys(
    source,
    ['url', 'sha256', 'mimeType', 'byteSize', 'width', 'height', 'retrievedAt'],
    `${candidateId} source`,
  );
  assertExactBinding(source.url, candidate.asset.sourceUrl, `${candidateId} source URL`);
  assertExactBinding(
    source.sha256,
    candidate.asset.sourceAssetSha256,
    `${candidateId} source hash`,
  );
  assertExactBinding(
    source.mimeType,
    candidate.asset.sourceAssetMimeType,
    `${candidateId} source MIME type`,
  );
  assertExactBinding(
    source.byteSize,
    candidate.asset.sourceAssetByteSize,
    `${candidateId} source byte size`,
  );
  assertExactBinding(
    source.width,
    candidate.asset.sourceAssetWidth,
    `${candidateId} source width`,
  );
  assertExactBinding(
    source.height,
    candidate.asset.sourceAssetHeight,
    `${candidateId} source height`,
  );
  assertExactBinding(
    source.retrievedAt,
    candidate.asset.sourceAssetRetrievedAt,
    `${candidateId} source retrieval time`,
  );
  if (
    !httpsPattern.test(requiredString(source.url, `${candidateId} source URL`))
    || !sha256Pattern.test(requiredString(source.sha256, `${candidateId} source hash`))
    || !['image/jpeg', 'image/png'].includes(
      requiredString(source.mimeType, `${candidateId} source MIME type`),
    )
    || requiredPositiveInteger(source.byteSize, `${candidateId} source byte size`) < 1
    || requiredPositiveInteger(source.width, `${candidateId} source width`) < 1
    || requiredPositiveInteger(source.height, `${candidateId} source height`) < 1
    || !Number.isFinite(Date.parse(requiredString(source.retrievedAt, `${candidateId} retrieval`)))
  ) {
    throw new Error(`${candidateId} source binding is malformed.`);
  }

  const request = objectRecord(specification.request, `${candidateId} request`);
  exactKeys(
    request,
    [
      'useCase',
      'target',
      'canvas',
      'prompt',
      'requiredVisibleDetails',
      'prohibitedChanges',
    ],
    `${candidateId} request`,
  );
  if (
    request.useCase !== 'precise-object-edit'
    || request.target !== 'identity-faithful-transparent-packshot'
  ) {
    throw new Error(`${candidateId} request must remain an exact-source packshot edit.`);
  }
  const canvas = objectRecord(request.canvas, `${candidateId} canvas`);
  exactKeys(
    canvas,
    ['width', 'height', 'workingBackground', 'finalBackground'],
    `${candidateId} canvas`,
  );
  if (
    canvas.width !== 2000
    || canvas.height !== 2000
    || canvas.workingBackground !== '#ff00ff'
    || canvas.finalBackground !== 'transparent'
  ) {
    throw new Error(`${candidateId} request must produce a transparent 2000 px square.`);
  }
  const prompt = requiredString(request.prompt, `${candidateId} prompt`);
  const requiredVisibleDetails = requiredStringArray(
    request.requiredVisibleDetails,
    `${candidateId} required visible details`,
    5,
  );
  const prohibitedChanges = requiredStringArray(
    request.prohibitedChanges,
    `${candidateId} prohibited changes`,
    5,
  );
  for (const requiredPhrase of [
    'Image 1',
    candidate.variant,
    candidate.size,
    '#ff00ff',
    'no clipping',
  ]) {
    if (!prompt.toLowerCase().includes(requiredPhrase.toLowerCase())) {
      throw new Error(`${candidateId} prompt does not bind ${requiredPhrase}.`);
    }
  }
  const normalizedCandidateSize = candidate.size.replace(/\s/g, '').toLowerCase();
  if (!requiredVisibleDetails.some(detail => (
    detail.replace(/\s/g, '').toLowerCase().includes(normalizedCandidateSize)
  ))) {
    throw new Error(`${candidateId} visible-detail list must preserve the exact printed size.`);
  }
  if (!prohibitedChanges.some(change => /barcode|gtin/i.test(change))) {
    throw new Error(`${candidateId} prohibited-change list must protect barcode identity.`);
  }

  const handoff = objectRecord(
    specification.provenanceHandoff,
    `${candidateId} provenance handoff`,
  );
  exactKeys(
    handoff,
    ['status', 'requiredFields', 'prohibitedFields'],
    `${candidateId} provenance handoff`,
  );
  if (handoff.status !== 'required-after-output') {
    throw new Error(`${candidateId} provenance cannot be claimed before output exists.`);
  }
  const requiredFields = requiredStringArray(
    handoff.requiredFields,
    `${candidateId} required provenance fields`,
    cataloguePackshotRequiredProvenanceFields.length,
  );
  if (
    requiredFields.join('\n')
    !== cataloguePackshotRequiredProvenanceFields.join('\n')
  ) {
    throw new Error(`${candidateId} provenance field contract has drifted.`);
  }
  if (
    !Array.isArray(handoff.prohibitedFields)
    || handoff.prohibitedFields.length !== 1
    || handoff.prohibitedFields[0] !== 'asset.rightsUrl'
  ) {
    throw new Error(`${candidateId} owned-render handoff must prohibit asset.rightsUrl.`);
  }

  const review = objectRecord(specification.review, `${candidateId} review`);
  exactKeys(review, ['status', 'checklist'], `${candidateId} review`);
  if (review.status !== 'not-started') {
    throw new Error(`${candidateId} review cannot be claimed in a generation plan.`);
  }
  const checklist = requiredStringArray(
    review.checklist,
    `${candidateId} review checklist`,
    8,
  );
  for (const requiredCheck of ['full resolution', 'peach', 'pink', 'dark', 'alpha', 'clipping']) {
    if (!checklist.some(check => check.toLowerCase().includes(requiredCheck))) {
      throw new Error(`${candidateId} review checklist is missing ${requiredCheck}.`);
    }
  }

  return candidateId;
}

export function verifyCataloguePackshotGenerationSpecificationManifest(
  value: unknown,
  candidates: readonly CatalogueIntakeCandidate[],
  options: {
    asOf?: number;
    dossierCandidateIds?: Iterable<string>;
    releaseCandidateIds?: Iterable<string>;
  } = {},
): CataloguePackshotGenerationSpecificationReport {
  const manifest = objectRecord(value, 'Packshot generation specification manifest');
  exactKeys(
    manifest,
    ['schemaVersion', 'exposure', 'updatedAt', 'publicationEligible', 'specifications'],
    'Packshot generation specification manifest',
  );
  if (manifest.schemaVersion !== cataloguePackshotGenerationSpecificationSchemaVersion) {
    throw new Error('Packshot generation specification manifest schema is unsupported.');
  }
  if (manifest.exposure !== cataloguePackshotGenerationSpecificationExposure) {
    throw new Error('Packshot generation specifications must remain private plans.');
  }
  if (manifest.publicationEligible !== false) {
    throw new Error('Packshot generation specification manifest cannot publish products.');
  }
  const asOf = options.asOf ?? Date.now();
  const updatedAt = Date.parse(requiredString(manifest.updatedAt, 'Manifest update time'));
  if (!Number.isFinite(updatedAt) || updatedAt > asOf + 5 * 60_000) {
    throw new Error('Packshot generation specification update time is invalid or in the future.');
  }
  if (!Array.isArray(manifest.specifications)) {
    throw new Error('Packshot generation specifications must be an array.');
  }
  const dossierCandidateIds = new Set(options.dossierCandidateIds ?? []);
  const releaseCandidateIds = new Set(options.releaseCandidateIds ?? []);
  const candidateIds = manifest.specifications.map(specification => (
    verifySpecification(
      specification,
      candidates,
      asOf,
      dossierCandidateIds,
      releaseCandidateIds,
    )
  ));
  if (new Set(candidateIds).size !== candidateIds.length) {
    throw new Error('Packshot generation specifications contain duplicate candidates.');
  }
  if (
    candidateIds.join('\n')
    !== cataloguePackshotGenerationCandidateIds.join('\n')
  ) {
    throw new Error(
      'Packshot generation specifications must contain the exact reviewed cohort in canonical order.',
    );
  }

  return {
    schemaVersion: cataloguePackshotGenerationSpecificationSchemaVersion,
    exposure: cataloguePackshotGenerationSpecificationExposure,
    specificationCount: candidateIds.length,
    candidateIds,
  };
}
