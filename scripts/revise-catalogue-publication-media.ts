import { createHash, randomUUID } from 'node:crypto';
import {
  open,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertStagedProductAssetPromotion,
  resolveStagedProductAssetPath,
  verifyCatalogueIntakePromotionBinding,
  type CataloguePublicationAssetPromotion,
  type StagedProductAssetPromotion,
} from '@/lib/assets/staged-product-asset-promotion';
import {
  assertCatalogueIntakeWriteBoundary,
  catalogueIntakeBytesSha256,
  catalogueIntakeProjectionDiff,
  catalogueIntakeSourceSnapshotSha256,
  compileCatalogueIntakeSources,
  readCatalogueIntakeSourceFiles,
  stableCatalogueJson,
  validateCatalogueIntakeCompilation,
} from '@/lib/catalogue/intake-source';
import {
  cataloguePublicationApprovalScope,
  cataloguePublicationDossierSchemaVersion,
  cataloguePublicationExposure,
  catalogueReferencePublicationApprovalScope,
  createVerifiedCataloguePublicationDossier,
  type CataloguePublicationDossierManifest,
} from '@/lib/catalogue/publication-dossier';
import {
  cataloguePublicationReleaseExposure,
  cataloguePublicationReleaseApprovalScope,
  cataloguePublicationReleaseSchemaVersion,
  createVerifiedCataloguePublicationRelease,
  type CataloguePublicationReleaseManifest,
} from '@/lib/catalogue/publication-release';
import {
  assertCataloguePublicationWriteBoundary,
  cataloguePublicationBytesSha256,
  cataloguePublicationMaximumWriteBatch,
  cataloguePublicationProjectionDiff,
  cataloguePublicationSourceRecord,
  cataloguePublicationSourceSnapshotSha256,
  compileCataloguePublicationSources,
  readCataloguePublicationSourceFiles,
  stableCataloguePublicationJson,
  type CataloguePublicationSourceFile,
  type CataloguePublicationSourceRecord,
} from '@/lib/catalogue/publication-source';
import type {
  CatalogueIntakeCandidate,
  CatalogueIntakeManifest,
} from '@/lib/catalogue/intake-readiness';

// Explicit authority for replacing media on an already released candidate.
// The reviewed manifest is repository-local and has this exact shape:
// {
//   "schemaVersion": 1,
//   "revisions": [{
//     "candidateId": "exact-candidate-id",
//     "expectedCandidateSourceSha256": "<sha256 of edited intake source>",
//     "expectedPublicationSourceSha256": "<sha256 of prior released source>",
//     "identityCorrection": {
//       "from": {
//         "size": "8 oz / 226 mL",
//         "packageVersion": "KP Body Scrub & Mask 8 oz / 226 mL jar",
//         "evidenceSha256": "<sha256 of prior canonical identity evidence>",
//         "evidenceByteSize": 1907
//       },
//       "to": {
//         "size": "8 oz / 226 g",
//         "packageVersion": "KP Body Scrub & Mask 8 oz / 226 g tube",
//         "evidenceSha256": "<sha256 of corrected canonical identity evidence>",
//         "evidenceByteSize": 1916,
//         "reviewedAt": "2026-08-08T14:35:44Z",
//         "reviewer": "JeloCare catalogue identity correction review"
//       },
//       "careReview": {
//         "from": {
//           "reviewedAt": "2026-08-07T13:08:00Z",
//           "reviewer": "JeloCare catalogue evidence review"
//         },
//         "to": {
//           "reviewedAt": "2026-08-08T14:36:00Z",
//           "reviewer": "JeloCare catalogue care recheck"
//         }
//       }
//     },
//     "artReviewedAt": "2026-08-08T15:17:00Z",
//     "approvedAt": "2026-08-08T15:18:00Z",
//     "presentationReviewedAt": "2026-08-08T15:19:00Z",
//     "publishedAt": "2026-08-08T15:20:00Z"
//   }]
// }
const revisionManifestSchemaVersion = 1 as const;
const candidateIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const sha256Pattern = /^[0-9a-f]{64}$/;

type CatalogueIdentityCorrectionEndpoint = {
  size: string;
  packageVersion: string;
  evidenceSha256: string;
  evidenceByteSize: number;
};

type CatalogueReviewMetadata = {
  reviewedAt: string;
  reviewer: string;
};

type CatalogueIdentityCorrection = {
  from: CatalogueIdentityCorrectionEndpoint;
  to: CatalogueIdentityCorrectionEndpoint & CatalogueReviewMetadata;
  careReview?: {
    from: CatalogueReviewMetadata;
    to: CatalogueReviewMetadata;
  };
};

export type CatalogueMediaRevision = {
  candidateId: string;
  expectedCandidateSourceSha256: string;
  expectedPublicationSourceSha256: string;
  identityCorrection?: CatalogueIdentityCorrection;
  artReviewedAt: string;
  approvedAt: string;
  presentationReviewedAt: string;
  publishedAt: string;
};

type CatalogueMediaRevisionManifest = {
  schemaVersion: typeof revisionManifestSchemaVersion;
  revisions: CatalogueMediaRevision[];
};

type Options = {
  manifestPath: string;
  write: boolean;
  json: boolean;
};

type RevisionWrite = {
  repositoryRoot: string;
  revisedSources: readonly CataloguePublicationSourceRecord[];
  intakeManifest: CatalogueIntakeManifest;
  dossierManifest: CataloguePublicationDossierManifest;
  releaseManifest: CataloguePublicationReleaseManifest;
  expectedIntakeProjectionSha256: string;
  expectedIntakeSourceSnapshotSha256: string;
  expectedDossierProjectionSha256: string;
  expectedReleaseProjectionSha256: string;
  expectedPublicationSourceSnapshotSha256: string;
  expectedIsolationManifestSha256: string;
  expectedPromotionManifestSha256: string;
  expectedCandidateSourceSha256ById: ReadonlyMap<string, string>;
  expectedPublicationSourceSha256ById: ReadonlyMap<string, string>;
  expectedStagedAssetById: ReadonlyMap<string, {
    path: string;
    sha256: string;
    byteSize: number;
  }>;
};

type CatalogueMediaRevisionJournal = {
  schemaVersion: 1;
  state: 'prepared' | 'committed';
  pid: number;
  transactionId: string;
  createdAt: string;
  targets: Array<{
    target: string;
    temporary: string;
    rollback: string;
    oldSha256: string;
    newSha256: string;
  }>;
};

function objectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
) {
  const unexpected = Object.keys(value).filter(key => !allowed.includes(key));
  if (unexpected.length) {
    throw new Error(`${label} has unsupported fields: ${unexpected.sort().join(', ')}.`);
  }
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is missing.`);
  }
  return value;
}

function requiredSha256(value: unknown, label: string) {
  const source = requiredString(value, label);
  if (!sha256Pattern.test(source)) throw new Error(`${label} is invalid.`);
  return source;
}

function requiredPositiveInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value as number;
}

function requiredIsoTimestamp(value: unknown, label: string, asOf: number) {
  const source = requiredString(value, label);
  const parsed = Date.parse(source);
  if (
    !Number.isFinite(parsed)
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(source)
    || parsed > asOf + 5 * 60_000
  ) {
    throw new Error(`${label} must be a canonical ISO timestamp that is not in the future.`);
  }
  return { source, parsed };
}

function parsedReviewMetadata(value: unknown, label: string, asOf: number) {
  const record = objectRecord(value, label);
  exactKeys(record, ['reviewedAt', 'reviewer'], label);
  const review = requiredIsoTimestamp(record.reviewedAt, `${label} timestamp`, asOf);
  return {
    value: {
      reviewedAt: review.source,
      reviewer: requiredString(record.reviewer, `${label} reviewer`),
    } satisfies CatalogueReviewMetadata,
    parsed: review.parsed,
  };
}

export function catalogueMediaRevisionOptionsFrom(
  argv: readonly string[],
): Options {
  const allowedFlags = new Set(['--write', '--json']);
  let manifestPath: string | undefined;
  let write = false;
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--manifest') {
      if (manifestPath) throw new Error('Duplicate argument: --manifest');
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('Missing --manifest value.');
      manifestPath = value;
      index += 1;
      continue;
    }
    if (!allowedFlags.has(argument)) throw new Error(`Unknown argument: ${argument}`);
    if (argument === '--write') {
      if (write) throw new Error('Duplicate argument: --write');
      write = true;
    }
    if (argument === '--json') {
      if (json) throw new Error('Duplicate argument: --json');
      json = true;
    }
  }
  if (!manifestPath) throw new Error('Missing --manifest.');
  return { manifestPath, write, json };
}

export function parseCatalogueMediaRevisionManifest(
  value: unknown,
  asOf = Date.now(),
): CatalogueMediaRevisionManifest {
  const manifest = objectRecord(value, 'Catalogue media revision manifest');
  exactKeys(
    manifest,
    ['schemaVersion', 'revisions'],
    'Catalogue media revision manifest',
  );
  if (manifest.schemaVersion !== revisionManifestSchemaVersion) {
    throw new Error('Catalogue media revision manifest has an unsupported schema.');
  }
  if (!Array.isArray(manifest.revisions) || !manifest.revisions.length) {
    throw new Error('Catalogue media revision manifest requires at least one revision.');
  }
  if (manifest.revisions.length > cataloguePublicationMaximumWriteBatch) {
    throw new Error(
      `Catalogue media revision changes ${manifest.revisions.length} records; maximum is ${cataloguePublicationMaximumWriteBatch}.`,
    );
  }

  const seen = new Set<string>();
  const revisions = manifest.revisions.map((raw, index) => {
    const label = `Catalogue media revision ${index + 1}`;
    const record = objectRecord(raw, label);
    exactKeys(record, [
      'candidateId',
      'expectedCandidateSourceSha256',
      'expectedPublicationSourceSha256',
      'identityCorrection',
      'artReviewedAt',
      'approvedAt',
      'presentationReviewedAt',
      'publishedAt',
    ], label);
    const candidateId = requiredString(record.candidateId, `${label} candidate ID`);
    if (!candidateIdPattern.test(candidateId)) {
      throw new Error(`${label} candidate ID is invalid.`);
    }
    if (seen.has(candidateId)) throw new Error(`Duplicate media revision: ${candidateId}.`);
    seen.add(candidateId);

    const art = requiredIsoTimestamp(record.artReviewedAt, `${candidateId} art review`, asOf);
    const approval = requiredIsoTimestamp(record.approvedAt, `${candidateId} approval`, asOf);
    const presentation = requiredIsoTimestamp(
      record.presentationReviewedAt,
      `${candidateId} presentation review`,
      asOf,
    );
    const publication = requiredIsoTimestamp(
      record.publishedAt,
      `${candidateId} publication`,
      asOf,
    );
    if (!(art.parsed < approval.parsed
      && approval.parsed < presentation.parsed
      && presentation.parsed < publication.parsed)) {
      throw new Error(
        `${candidateId} revision times must be strictly ordered: art, approval, presentation, publication.`,
      );
    }

    let identityCorrection: CatalogueIdentityCorrection | undefined;
    if (record.identityCorrection !== undefined) {
      const correction = objectRecord(
        record.identityCorrection,
        `${candidateId} identity correction`,
      );
      exactKeys(
        correction,
        ['from', 'to', 'careReview'],
        `${candidateId} identity correction`,
      );
      const from = objectRecord(correction.from, `${candidateId} prior identity`);
      const to = objectRecord(correction.to, `${candidateId} corrected identity`);
      exactKeys(
        from,
        ['size', 'packageVersion', 'evidenceSha256', 'evidenceByteSize'],
        `${candidateId} prior identity`,
      );
      exactKeys(
        to,
        [
          'size',
          'packageVersion',
          'evidenceSha256',
          'evidenceByteSize',
          'reviewedAt',
          'reviewer',
        ],
        `${candidateId} corrected identity`,
      );
      const priorIdentity: CatalogueIdentityCorrectionEndpoint = {
        size: requiredString(from.size, `${candidateId} prior identity size`),
        packageVersion: requiredString(
          from.packageVersion,
          `${candidateId} prior identity package version`,
        ),
        evidenceSha256: requiredSha256(
          from.evidenceSha256,
          `${candidateId} prior identity evidence hash`,
        ),
        evidenceByteSize: requiredPositiveInteger(
          from.evidenceByteSize,
          `${candidateId} prior identity evidence byte size`,
        ),
      };
      const identityReview = requiredIsoTimestamp(
        to.reviewedAt,
        `${candidateId} identity correction review`,
        asOf,
      );
      const correctedIdentity: CatalogueIdentityCorrection['to'] = {
        size: requiredString(to.size, `${candidateId} corrected identity size`),
        packageVersion: requiredString(
          to.packageVersion,
          `${candidateId} corrected identity package version`,
        ),
        evidenceSha256: requiredSha256(
          to.evidenceSha256,
          `${candidateId} corrected identity evidence hash`,
        ),
        evidenceByteSize: requiredPositiveInteger(
          to.evidenceByteSize,
          `${candidateId} corrected identity evidence byte size`,
        ),
        reviewedAt: identityReview.source,
        reviewer: requiredString(to.reviewer, `${candidateId} identity correction reviewer`),
      };
      if (
        priorIdentity.size === correctedIdentity.size
        || priorIdentity.packageVersion === correctedIdentity.packageVersion
        || priorIdentity.evidenceSha256 === correctedIdentity.evidenceSha256
      ) {
        throw new Error(
          `${candidateId} identity correction must replace the reviewed size, package version, and evidence artifact.`,
        );
      }
      if (identityReview.parsed > art.parsed) {
        throw new Error(`${candidateId} identity correction review must not follow art review.`);
      }
      let careReview: CatalogueIdentityCorrection['careReview'];
      if (correction.careReview !== undefined) {
        const care = objectRecord(
          correction.careReview,
          `${candidateId} care recheck`,
        );
        exactKeys(care, ['from', 'to'], `${candidateId} care recheck`);
        const priorCare = parsedReviewMetadata(
          care.from,
          `${candidateId} prior care review`,
          asOf,
        );
        const correctedCare = parsedReviewMetadata(
          care.to,
          `${candidateId} corrected care review`,
          asOf,
        );
        if (
          correctedCare.parsed <= priorCare.parsed
          || correctedCare.parsed < identityReview.parsed
          || correctedCare.parsed > art.parsed
        ) {
          throw new Error(
            `${candidateId} corrected care review must advance the prior review, not predate the identity correction, and not follow art review.`,
          );
        }
        careReview = {
          from: priorCare.value,
          to: correctedCare.value,
        };
      }
      identityCorrection = {
        from: priorIdentity,
        to: correctedIdentity,
        careReview,
      };
    }

    return {
      candidateId,
      expectedCandidateSourceSha256: requiredSha256(
        record.expectedCandidateSourceSha256,
        `${candidateId} expected candidate source hash`,
      ),
      expectedPublicationSourceSha256: requiredSha256(
        record.expectedPublicationSourceSha256,
        `${candidateId} expected publication source hash`,
      ),
      identityCorrection,
      artReviewedAt: art.source,
      approvedAt: approval.source,
      presentationReviewedAt: presentation.source,
      publishedAt: publication.source,
    };
  });

  return {
    schemaVersion: revisionManifestSchemaVersion,
    revisions: revisions.sort((left, right) => left.candidateId.localeCompare(right.candidateId)),
  };
}

function repositoryFile(root: string, ...parts: string[]) {
  return path.resolve(root, ...parts);
}

function resolvedManifestPath(repositoryRoot: string, value: string) {
  const resolved = path.resolve(repositoryRoot, value);
  if (!resolved.startsWith(`${repositoryRoot}${path.sep}`)) {
    throw new Error('Revision manifest must be inside the repository.');
  }
  return resolved;
}

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function mediaRevisionJournalPath(dataRoot: string) {
  return path.join(dataRoot, '.catalogue-media-revision.transaction.json');
}

function dataRelativePath(dataRoot: string, absolutePath: string) {
  const relative = path.relative(dataRoot, absolutePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Catalogue media revision target escapes the data directory.');
  }
  return relative;
}

function journalTargetPath(dataRoot: string, value: unknown, label: string) {
  const relative = requiredString(value, label);
  if (path.normalize(relative) !== relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} is invalid.`);
  }
  const resolved = path.resolve(dataRoot, relative);
  if (!resolved.startsWith(`${dataRoot}${path.sep}`)) throw new Error(`${label} escapes data.`);
  return resolved;
}

function runningProcess(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

async function readIfPresent(filePath: string) {
  try {
    return await readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function durableJournalWrite(
  journalPath: string,
  journal: CatalogueMediaRevisionJournal,
  replace: boolean,
) {
  const writePath = replace
    ? `${journalPath}.${process.pid}.${randomUUID()}.tmp`
    : journalPath;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(writePath, 'wx');
    await handle.writeFile(`${JSON.stringify(journal, null, 2)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    if (replace) await rename(writePath, journalPath);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await unlink(writePath).catch(() => undefined);
    throw error;
  }
}

export async function recoverCatalogueMediaRevision(repositoryRoot: string) {
  const dataRoot = repositoryFile(repositoryRoot, 'data');
  const journalPath = mediaRevisionJournalPath(dataRoot);
  const journalBytes = await readIfPresent(journalPath);
  if (!journalBytes) return false;
  const raw = objectRecord(
    JSON.parse(journalBytes.toString('utf8')) as unknown,
    'Catalogue media revision recovery journal',
  );
  exactKeys(
    raw,
    ['schemaVersion', 'state', 'pid', 'transactionId', 'createdAt', 'targets'],
    'Catalogue media revision recovery journal',
  );
  if (
    raw.schemaVersion !== 1
    || (raw.state !== 'prepared' && raw.state !== 'committed')
    || !Number.isSafeInteger(raw.pid)
    || (raw.pid as number) <= 0
    || typeof raw.transactionId !== 'string'
    || !/^[a-zA-Z0-9.-]+$/.test(raw.transactionId)
    || typeof raw.createdAt !== 'string'
    || !Array.isArray(raw.targets)
    || !raw.targets.length
  ) {
    throw new Error('Catalogue media revision recovery journal is invalid.');
  }
  if (runningProcess(raw.pid as number)) {
    throw new Error('Catalogue media revision is already running.');
  }
  const targets = raw.targets.map((value, index) => {
    const record = objectRecord(value, `Catalogue media revision recovery target ${index + 1}`);
    exactKeys(
      record,
      ['target', 'temporary', 'rollback', 'oldSha256', 'newSha256'],
      `Catalogue media revision recovery target ${index + 1}`,
    );
    const targetRelative = requiredString(record.target, 'Recovery target');
    const temporaryRelative = requiredString(record.temporary, 'Recovery temporary file');
    const rollbackRelative = requiredString(record.rollback, 'Recovery rollback file');
    if (
      ![
        'catalogue-intake.json',
        'catalogue-publication-dossiers.json',
        'catalogue-publication-releases.json',
      ].includes(targetRelative)
      && !/^catalogue-publication-sources\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(
        targetRelative,
      )
    ) {
      throw new Error('Recovery target is outside the media-revision allowlist.');
    }
    if (
      path.dirname(temporaryRelative) !== '.'
      || !/^\.catalogue-media-revision\.[a-zA-Z0-9.-]+\.\d+\.tmp$/.test(temporaryRelative)
      || path.dirname(rollbackRelative) !== '.'
      || !/^\.catalogue-media-revision\.[a-zA-Z0-9.-]+\.\d+\.rollback$/.test(rollbackRelative)
    ) {
      throw new Error('Recovery temporary or rollback path is invalid.');
    }
    return {
      target: journalTargetPath(dataRoot, targetRelative, 'Recovery target'),
      temporary: journalTargetPath(dataRoot, temporaryRelative, 'Recovery temporary file'),
      rollback: journalTargetPath(dataRoot, rollbackRelative, 'Recovery rollback file'),
      oldSha256: requiredSha256(record.oldSha256, 'Recovery old hash'),
      newSha256: requiredSha256(record.newSha256, 'Recovery new hash'),
    };
  });
  const targetPaths = targets.map(target => target.target);
  if (
    new Set(targetPaths).size !== targetPaths.length
    || new Set(targets.map(target => target.temporary)).size !== targets.length
    || new Set(targets.map(target => target.rollback)).size !== targets.length
  ) {
    throw new Error('Catalogue media revision recovery targets must be unique.');
  }
  for (const projection of [
    'catalogue-intake.json',
    'catalogue-publication-dossiers.json',
    'catalogue-publication-releases.json',
  ]) {
    if (targetPaths.filter(target => target === path.join(dataRoot, projection)).length !== 1) {
      throw new Error(`Catalogue media revision recovery is missing ${projection}.`);
    }
  }
  const sourceTargetCount = targetPaths.filter(target => (
    target.startsWith(`${path.join(dataRoot, 'catalogue-publication-sources')}${path.sep}`)
  )).length;
  if (sourceTargetCount < 1 || sourceTargetCount > cataloguePublicationMaximumWriteBatch) {
    throw new Error('Catalogue media revision recovery source count is invalid.');
  }

  if (raw.state === 'prepared') {
    for (const target of [...targets].reverse()) {
      const rollback = await readIfPresent(target.rollback);
      if (rollback) {
        if (sha256(rollback) !== target.oldSha256) {
          throw new Error(`Recovery bytes changed for ${path.relative(dataRoot, target.target)}.`);
        }
        await rename(target.rollback, target.target);
      }
      const restored = await readFile(target.target);
      if (sha256(restored) !== target.oldSha256) {
        throw new Error(`Recovery could not restore ${path.relative(dataRoot, target.target)}.`);
      }
    }
  } else {
    for (const target of targets) {
      const committed = await readFile(target.target);
      if (sha256(committed) !== target.newSha256) {
        throw new Error(`Committed revision changed for ${path.relative(dataRoot, target.target)}.`);
      }
    }
  }
  await Promise.all(targets.flatMap(target => [
    unlink(target.temporary).catch(() => undefined),
    unlink(target.rollback).catch(() => undefined),
  ]));
  const lockMarker = `catalogue-media-revision:${raw.transactionId}\n`;
  for (const filename of [
    '.catalogue-media-revision.lock',
    '.catalogue-intake.compiler.lock',
    '.catalogue-publication.compiler.lock',
  ]) {
    const lockPath = path.join(dataRoot, filename);
    const lockBytes = await readIfPresent(lockPath);
    if (lockBytes?.toString('utf8') === lockMarker) {
      await unlink(lockPath);
    }
  }
  await unlink(journalPath);
  return true;
}

function sortedEqual(left: readonly string[], right: readonly string[]) {
  return stableCatalogueJson([...left].sort()) === stableCatalogueJson([...right].sort());
}

function candidateWithoutAsset(
  candidate: CatalogueIntakeManifest['candidates'][number],
) {
  const rest: Partial<CatalogueIntakeManifest['candidates'][number]> = {
    ...candidate,
  };
  delete rest.asset;
  return rest;
}

type IdentityCorrectionCandidateFields = {
  candidate: Record<string, unknown>;
  identity: Record<string, unknown>;
  evidence: Record<string, unknown>;
  canonical: Record<string, unknown>;
  sizeField: Record<string, unknown>;
  packageVersionField: Record<string, unknown>;
};

function identityCorrectionCandidateFields(
  candidate: CatalogueIntakeCandidate,
  label: string,
): IdentityCorrectionCandidateFields {
  const candidateRecord = objectRecord(candidate, label);
  const identity = objectRecord(candidateRecord.identity, `${label} identity`);
  const evidence = objectRecord(
    identity.officialEvidence,
    `${label} official identity evidence`,
  );
  const canonical = objectRecord(
    evidence.canonicalExtraction,
    `${label} canonical identity extraction`,
  );
  const fields = objectRecord(canonical.fields, `${label} canonical identity fields`);
  const sizeField = objectRecord(fields.size, `${label} canonical size field`);
  const packageVersionField = objectRecord(
    fields.packageVersion,
    `${label} canonical package-version field`,
  );
  requiredString(sizeField.sourceText, `${label} canonical size source text`);
  requiredString(
    packageVersionField.sourceText,
    `${label} canonical package-version source text`,
  );
  if (identity.checkedAt !== canonical.reviewedAt) {
    throw new Error(`${label} identity check is not bound to its canonical review.`);
  }
  return {
    candidate: candidateRecord,
    identity,
    evidence,
    canonical,
    sizeField,
    packageVersionField,
  };
}

function assertIdentityCorrectionEndpoint(
  candidate: CatalogueIntakeCandidate,
  endpoint: CatalogueIdentityCorrectionEndpoint,
  label: string,
  review?: CatalogueReviewMetadata,
) {
  const fields = identityCorrectionCandidateFields(candidate, label);
  const expectedValues: Array<[unknown, unknown, string]> = [
    [fields.candidate.size, endpoint.size, 'candidate size'],
    [fields.identity.packageVersion, endpoint.packageVersion, 'package version'],
    [fields.evidence.observedSize, endpoint.size, 'observed size'],
    [
      fields.evidence.observedPackageVersion,
      endpoint.packageVersion,
      'observed package version',
    ],
    [fields.evidence.snapshotSha256, endpoint.evidenceSha256, 'evidence hash'],
    [fields.evidence.snapshotByteSize, endpoint.evidenceByteSize, 'evidence byte size'],
    [fields.sizeField.value, endpoint.size, 'canonical size'],
    [
      fields.packageVersionField.value,
      endpoint.packageVersion,
      'canonical package version',
    ],
  ];
  for (const [actual, expected, fieldLabel] of expectedValues) {
    if (actual !== expected) {
      throw new Error(`${label} ${fieldLabel} does not match the reviewed manifest.`);
    }
  }
  if (
    review
    && (
      fields.identity.checkedAt !== review.reviewedAt
      || fields.canonical.reviewedAt !== review.reviewedAt
      || fields.canonical.reviewer !== review.reviewer
    )
  ) {
    throw new Error(`${label} review does not match the reviewed manifest.`);
  }
  return fields;
}

function careReviewCandidateFields(
  candidate: CatalogueIntakeCandidate,
  label: string,
) {
  const candidateRecord = objectRecord(candidate, label);
  return objectRecord(candidateRecord.care, `${label} care`);
}

function assertCareReviewEndpoint(
  candidate: CatalogueIntakeCandidate,
  review: CatalogueReviewMetadata,
  label: string,
) {
  const care = careReviewCandidateFields(candidate, label);
  if (
    care.reviewedAt !== review.reviewedAt
    || care.reviewer !== review.reviewer
  ) {
    throw new Error(`${label} does not match the reviewed manifest.`);
  }
  return care;
}

function normalizedCorrectedIdentityCandidate(
  candidate: CatalogueIntakeCandidate,
  previousCandidate: CatalogueIntakeCandidate,
  correction: CatalogueIdentityCorrection,
) {
  const normalized = structuredClone(candidate);
  const next = identityCorrectionCandidateFields(normalized, `${candidate.id} corrected candidate`);
  const previous = identityCorrectionCandidateFields(
    previousCandidate,
    `${candidate.id} prior candidate`,
  );
  next.candidate.size = previous.candidate.size;
  next.identity.checkedAt = previous.identity.checkedAt;
  next.identity.packageVersion = previous.identity.packageVersion;
  next.evidence.observedSize = previous.evidence.observedSize;
  next.evidence.observedPackageVersion = previous.evidence.observedPackageVersion;
  next.evidence.snapshotSha256 = previous.evidence.snapshotSha256;
  next.evidence.snapshotByteSize = previous.evidence.snapshotByteSize;
  next.canonical.reviewedAt = previous.canonical.reviewedAt;
  next.canonical.reviewer = previous.canonical.reviewer;
  next.sizeField.value = previous.sizeField.value;
  next.sizeField.sourceText = previous.sizeField.sourceText;
  next.packageVersionField.value = previous.packageVersionField.value;
  next.packageVersionField.sourceText = previous.packageVersionField.sourceText;
  if (correction.careReview) {
    const nextCare = careReviewCandidateFields(
      normalized,
      `${candidate.id} corrected candidate`,
    );
    const previousCare = careReviewCandidateFields(
      previousCandidate,
      `${candidate.id} prior candidate`,
    );
    nextCare.reviewedAt = previousCare.reviewedAt;
    nextCare.reviewer = previousCare.reviewer;
  }
  return candidateWithoutAsset(normalized);
}

/**
 * Keeps media replacement as the default boundary. An optional correction is
 * deliberately narrower than a general identity edit: it can replace only a
 * reviewed size/package transcription and its exact canonical evidence bytes.
 */
export function assertCatalogueMediaRevisionCandidateTransition(
  previousCandidate: CatalogueIntakeCandidate,
  candidate: CatalogueIntakeCandidate,
  revision: CatalogueMediaRevision,
  previousPublishedAt: string,
) {
  if (
    previousCandidate.id !== revision.candidateId
    || candidate.id !== revision.candidateId
  ) {
    throw new Error(`${revision.candidateId} revision candidate binding is invalid.`);
  }
  if (!revision.identityCorrection) {
    if (
      stableCatalogueJson(candidateWithoutAsset(candidate))
      !== stableCatalogueJson(candidateWithoutAsset(previousCandidate))
    ) {
      throw new Error(`${revision.candidateId} changes non-media candidate fields.`);
    }
    return;
  }

  const correction = revision.identityCorrection;
  assertIdentityCorrectionEndpoint(
    previousCandidate,
    correction.from,
    `${revision.candidateId} prior identity`,
  );
  assertIdentityCorrectionEndpoint(
    candidate,
    correction.to,
    `${revision.candidateId} corrected identity`,
    correction.to,
  );
  if (correction.careReview) {
    assertCareReviewEndpoint(
      previousCandidate,
      correction.careReview.from,
      `${revision.candidateId} prior care review`,
    );
    assertCareReviewEndpoint(
      candidate,
      correction.careReview.to,
      `${revision.candidateId} corrected care review`,
    );
  }
  if (
    stableCatalogueJson(normalizedCorrectedIdentityCandidate(
      candidate,
      previousCandidate,
      correction,
    ))
    !== stableCatalogueJson(candidateWithoutAsset(previousCandidate))
  ) {
    throw new Error(
      `${revision.candidateId} identity correction changes fields outside the reviewed boundary.`,
    );
  }
  const previousPublication = Date.parse(previousPublishedAt);
  const identityReview = Date.parse(correction.to.reviewedAt);
  const artReview = Date.parse(revision.artReviewedAt);
  if (
    !Number.isFinite(previousPublication)
    || !Number.isFinite(identityReview)
    || !Number.isFinite(artReview)
    || identityReview <= previousPublication
    || identityReview > artReview
  ) {
    throw new Error(
      `${revision.candidateId} identity correction review must follow the prior publication and not follow art review.`,
    );
  }
  if (correction.careReview) {
    const priorCareReview = Date.parse(correction.careReview.from.reviewedAt);
    const correctedCareReview = Date.parse(correction.careReview.to.reviewedAt);
    if (
      !Number.isFinite(priorCareReview)
      || !Number.isFinite(correctedCareReview)
      || correctedCareReview <= priorCareReview
      || correctedCareReview < identityReview
      || correctedCareReview > artReview
    ) {
      throw new Error(
        `${revision.candidateId} corrected care review must advance the prior review, not predate the identity correction, and not follow art review.`,
      );
    }
  }
}

function compareTimestampThenCandidate(
  leftTimestamp: string,
  leftCandidateId: string,
  rightTimestamp: string,
  rightCandidateId: string,
) {
  return Date.parse(leftTimestamp) - Date.parse(rightTimestamp)
    || leftCandidateId.localeCompare(rightCandidateId);
}

/**
 * Proves the checked-in projections still exactly mirror the old immutable
 * sources without replaying those old dossiers against the newly reviewed
 * isolation record. The replacement sources receive the full artifact-aware
 * validation later in this command.
 */
function currentPublicationSources(
  files: readonly CataloguePublicationSourceFile[],
  dossierManifest: CataloguePublicationDossierManifest,
  releaseManifest: CataloguePublicationReleaseManifest,
) {
  const sources = files.map(file => {
    if (path.basename(file.filename) !== file.filename || !file.filename.endsWith('.json')) {
      throw new Error(`Catalogue publication source filename is invalid: ${file.filename}.`);
    }
    const source = objectRecord(file.value, `Catalogue publication source ${file.filename}`);
    exactKeys(
      source,
      ['schemaVersion', 'candidateId', 'dossier', 'release'],
      `Catalogue publication source ${file.filename}`,
    );
    if (source.schemaVersion !== 1) {
      throw new Error(`Catalogue publication source ${file.filename} has an unsupported schema.`);
    }
    const candidateId = requiredString(
      source.candidateId,
      `Catalogue publication source ${file.filename} candidate ID`,
    );
    if (!candidateIdPattern.test(candidateId) || file.filename !== `${candidateId}.json`) {
      throw new Error(`Catalogue publication source ${file.filename} candidate binding is invalid.`);
    }
    const dossier = objectRecord(
      source.dossier,
      `Catalogue publication source ${candidateId} dossier`,
    ) as CataloguePublicationSourceRecord['dossier'];
    if (dossier.candidateId !== candidateId) {
      throw new Error(`${candidateId} publication source dossier binding is invalid.`);
    }
    const release = source.release === null
      ? null
      : objectRecord(
          source.release,
          `Catalogue publication source ${candidateId} release`,
        ) as NonNullable<CataloguePublicationSourceRecord['release']>;
    if (release && (
      release.candidateId !== candidateId
      || release.dossierFingerprint !== dossier.dossierFingerprint
    )) {
      throw new Error(`${candidateId} publication source release binding is invalid.`);
    }
    const { dossierFingerprint, ...dossierPayload } = dossier;
    if (
      !sha256Pattern.test(dossierFingerprint)
      || sha256(
        `jelocare-catalogue-publication-dossier-v${cataloguePublicationDossierSchemaVersion}\n${stableCataloguePublicationJson(dossierPayload)}`,
      ) !== dossierFingerprint
    ) {
      throw new Error(`${candidateId} stored dossier fingerprint is invalid.`);
    }
    if (release) {
      const { releaseFingerprint, ...releasePayload } = release;
      if (
        !sha256Pattern.test(releaseFingerprint)
        || sha256(
          `jelocare-catalogue-publication-release-v${cataloguePublicationReleaseSchemaVersion}\n${stableCataloguePublicationJson(releasePayload)}`,
        ) !== releaseFingerprint
      ) {
        throw new Error(`${candidateId} stored release fingerprint is invalid.`);
      }
    }
    return cataloguePublicationSourceRecord(dossier, release);
  });
  const byCandidateId = new Map<string, CataloguePublicationSourceRecord>();
  for (const source of sources) {
    if (byCandidateId.has(source.candidateId)) {
      throw new Error(`Duplicate catalogue publication source candidate: ${source.candidateId}.`);
    }
    byCandidateId.set(source.candidateId, source);
  }
  const sourceDossiers = sources
    .map(source => source.dossier)
    .sort((left, right) => compareTimestampThenCandidate(
      left.approval.approvedAt,
      left.candidateId,
      right.approval.approvedAt,
      right.candidateId,
    ));
  const sourceReleases = sources
    .flatMap(source => source.release ? [source.release] : [])
    .sort((left, right) => compareTimestampThenCandidate(
      left.publication.publishedAt,
      left.candidateId,
      right.publication.publishedAt,
      right.candidateId,
    ));
  const reconstructedDossiers: CataloguePublicationDossierManifest = {
    schemaVersion: cataloguePublicationDossierSchemaVersion,
    exposure: cataloguePublicationExposure,
    dossiers: sourceDossiers,
  };
  const reconstructedReleases: CataloguePublicationReleaseManifest = {
    schemaVersion: cataloguePublicationReleaseSchemaVersion,
    exposure: cataloguePublicationReleaseExposure,
    releases: sourceReleases,
  };
  if (
    stableCataloguePublicationJson(dossierManifest)
      !== stableCataloguePublicationJson(reconstructedDossiers)
    || stableCataloguePublicationJson(releaseManifest)
      !== stableCataloguePublicationJson(reconstructedReleases)
  ) {
    throw new Error('Catalogue publication sources and projections are stale or mismatched.');
  }
  return { sources, sourceByCandidateId: byCandidateId };
}

async function matchingPromotion(
  candidateId: string,
  promotions: readonly StagedProductAssetPromotion[],
  candidate: CatalogueIntakeManifest['candidates'][number],
  repositoryRoot: string,
) {
  const matches = promotions.filter(promotion => (
    promotion.active
    && 'candidateId' in promotion
    && promotion.candidateId === candidateId
    && 'destination' in promotion
    && promotion.destination === 'publication'
  )) as CataloguePublicationAssetPromotion[];
  if (matches.length !== 1) {
    throw new Error(`${candidateId} must have exactly one active publication promotion.`);
  }
  const promotion = matches[0];
  const target = assertStagedProductAssetPromotion(promotion);
  if (target.kind !== 'catalogue-publication' || target.id !== candidateId) {
    throw new Error(`${candidateId} active promotion target is invalid.`);
  }
  await verifyCatalogueIntakePromotionBinding(promotion, repositoryRoot);
  if (
    promotion.sourceUrl !== candidate.asset.sourceUrl
    || promotion.blobUrl !== candidate.asset.publicImageUrl
    || promotion.contentHash !== candidate.asset.publicImageSha256
    || promotion.contentType !== candidate.asset.publicImageMimeType
    || promotion.byteSize !== candidate.asset.publicImageByteSize
    || promotion.width !== candidate.asset.width
    || promotion.height !== candidate.asset.height
  ) {
    throw new Error(`${candidateId} promotion does not bind the revised candidate image.`);
  }
  const localPath = resolveStagedProductAssetPath(promotion, repositoryRoot);
  const localBytes = await readFile(localPath);
  if (
    localBytes.length !== promotion.byteSize
    || sha256(localBytes) !== promotion.contentHash
  ) {
    throw new Error(`${candidateId} staged image bytes changed after review.`);
  }
  return { promotion, localPath };
}

function lockFailure(error: unknown, label: string) {
  if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
    return new Error(`${label} is already running; retry after it finishes.`);
  }
  return error;
}

async function writeCatalogueMediaRevisionAtomically(input: RevisionWrite) {
  const dataRoot = repositoryFile(input.repositoryRoot, 'data');
  const sourceRoot = path.join(dataRoot, 'catalogue-publication-sources');
  const journalPath = mediaRevisionJournalPath(dataRoot);
  const suffix = `${process.pid}.${randomUUID()}`;
  const lockMarker = `catalogue-media-revision:${suffix}\n`;
  const targetWrites = [
    ...input.revisedSources.map(source => ({
      target: path.join(sourceRoot, `${source.candidateId}.json`),
      bytes: `${JSON.stringify(source, null, 2)}\n`,
    })),
    {
      target: path.join(dataRoot, 'catalogue-intake.json'),
      bytes: `${JSON.stringify(input.intakeManifest, null, 2)}\n`,
    },
    {
      target: path.join(dataRoot, 'catalogue-publication-dossiers.json'),
      bytes: `${JSON.stringify(input.dossierManifest, null, 2)}\n`,
    },
    {
      target: path.join(dataRoot, 'catalogue-publication-releases.json'),
      bytes: `${JSON.stringify(input.releaseManifest, null, 2)}\n`,
    },
  ].map((write, index) => ({
    ...write,
    temporary: path.join(dataRoot, `.catalogue-media-revision.${suffix}.${index}.tmp`),
    rollback: path.join(dataRoot, `.catalogue-media-revision.${suffix}.${index}.rollback`),
  }));
  const lockPaths = [
    path.join(dataRoot, '.catalogue-media-revision.lock'),
    path.join(dataRoot, '.catalogue-intake.compiler.lock'),
    path.join(dataRoot, '.catalogue-publication.compiler.lock'),
  ];
  const locks: Array<{
    handle: Awaited<ReturnType<typeof open>>;
    path: string;
  }> = [];
  const replaced: typeof targetWrites = [];
  const oldSha256ByTarget = new Map<string, string>();
  const failedRollbackPaths = new Set<string>();
  let journalState: 'none' | 'prepared' | 'committed' = 'none';
  async function releaseLocks(preservePaths = false) {
    const acquired = locks.splice(0, locks.length);
    await Promise.all(acquired.map(lock => lock.handle.close().catch(() => undefined)));
    if (!preservePaths) {
      await Promise.all(acquired.map(lock => unlink(lock.path).catch(() => undefined)));
    }
  }
  try {
    for (const write of targetWrites) {
      const current = await readFile(write.target);
      oldSha256ByTarget.set(write.target, sha256(current));
      await Promise.all([
        writeFile(write.temporary, write.bytes, { encoding: 'utf8', flag: 'wx' }),
        writeFile(write.rollback, current, { flag: 'wx' }),
      ]);
    }

    for (const [index, lockPath] of lockPaths.entries()) {
      let handle: Awaited<ReturnType<typeof open>> | undefined;
      try {
        handle = await open(lockPath, 'wx');
        await handle.writeFile(lockMarker, 'utf8');
        await handle.sync();
        locks.push({ handle, path: lockPath });
        handle = undefined;
      } catch (error) {
        await handle?.close().catch(() => undefined);
        if (handle) await unlink(lockPath).catch(() => undefined);
        throw lockFailure(error, index === 0
          ? 'Catalogue media revision'
          : index === 1
            ? 'Catalogue intake compiler'
            : 'Catalogue publication compiler');
      }
    }

    const [
      intakeProjection,
      dossierProjection,
      releaseProjection,
      intakeSources,
      publicationSources,
      isolationManifest,
      promotionManifest,
    ] = await Promise.all([
      readFile(path.join(dataRoot, 'catalogue-intake.json')),
      readFile(path.join(dataRoot, 'catalogue-publication-dossiers.json')),
      readFile(path.join(dataRoot, 'catalogue-publication-releases.json')),
      readCatalogueIntakeSourceFiles(input.repositoryRoot),
      readCataloguePublicationSourceFiles(input.repositoryRoot),
      readFile(path.join(dataRoot, 'catalogue-packshot-isolations.json')),
      readFile(path.join(dataRoot, 'product-asset-promotions.json')),
    ]);
    if (sha256(intakeProjection) !== input.expectedIntakeProjectionSha256) {
      throw new Error('Catalogue intake projection changed after revision validation.');
    }
    if (catalogueIntakeSourceSnapshotSha256(intakeSources)
      !== input.expectedIntakeSourceSnapshotSha256) {
      throw new Error('Catalogue intake sources changed after revision validation.');
    }
    if (sha256(dossierProjection) !== input.expectedDossierProjectionSha256) {
      throw new Error('Catalogue dossier projection changed after revision validation.');
    }
    if (sha256(releaseProjection) !== input.expectedReleaseProjectionSha256) {
      throw new Error('Catalogue release projection changed after revision validation.');
    }
    if (cataloguePublicationSourceSnapshotSha256(publicationSources)
      !== input.expectedPublicationSourceSnapshotSha256) {
      throw new Error('Catalogue publication sources changed after revision validation.');
    }
    if (sha256(isolationManifest) !== input.expectedIsolationManifestSha256) {
      throw new Error('Catalogue isolation records changed after revision validation.');
    }
    if (sha256(promotionManifest) !== input.expectedPromotionManifestSha256) {
      throw new Error('Catalogue promotion records changed after revision validation.');
    }
    for (const [candidateId, expected] of input.expectedCandidateSourceSha256ById) {
      const bytes = await readFile(path.join(
        dataRoot,
        'catalogue-intake-candidates',
        `${candidateId}.json`,
      ));
      if (sha256(bytes) !== expected) {
        throw new Error(`${candidateId} candidate source bytes changed after review.`);
      }
    }
    for (const [candidateId, expected] of input.expectedPublicationSourceSha256ById) {
      const bytes = await readFile(path.join(sourceRoot, `${candidateId}.json`));
      if (sha256(bytes) !== expected) {
        throw new Error(`${candidateId} publication source bytes changed after review.`);
      }
    }
    for (const [candidateId, expected] of input.expectedStagedAssetById) {
      const bytes = await readFile(expected.path);
      if (bytes.length !== expected.byteSize || sha256(bytes) !== expected.sha256) {
        throw new Error(`${candidateId} staged image bytes changed after revision validation.`);
      }
    }

    const journalTargets = targetWrites.map(write => ({
      target: dataRelativePath(dataRoot, write.target),
      temporary: dataRelativePath(dataRoot, write.temporary),
      rollback: dataRelativePath(dataRoot, write.rollback),
      oldSha256: oldSha256ByTarget.get(write.target) as string,
      newSha256: sha256(write.bytes),
    }));
    const journal: CatalogueMediaRevisionJournal = {
      schemaVersion: 1,
      state: 'prepared',
      pid: process.pid,
      transactionId: suffix,
      createdAt: new Date().toISOString(),
      targets: journalTargets,
    };
    await durableJournalWrite(journalPath, journal, false);
    journalState = 'prepared';

    for (const write of targetWrites) {
      await rename(write.temporary, write.target);
      replaced.push(write);
    }
    await durableJournalWrite(journalPath, { ...journal, state: 'committed' }, true);
    journalState = 'committed';
    await Promise.all(targetWrites.map(write => unlink(write.rollback)));
    await releaseLocks();
    await unlink(journalPath);
    journalState = 'none';
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    if (journalState === 'prepared') {
      for (const write of [...replaced].reverse()) {
        try {
          await rename(write.rollback, write.target);
        } catch (rollbackError) {
          failedRollbackPaths.add(write.rollback);
          rollbackErrors.push(rollbackError);
        }
      }
      if (!rollbackErrors.length) {
        await releaseLocks();
        await unlink(journalPath).catch(() => undefined);
        journalState = 'none';
      }
    }
    if (rollbackErrors.length) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        'Catalogue media revision failed and could not completely roll back; '
          + `preserved recovery journal ${journalPath} and backups: `
          + [...failedRollbackPaths].join(', '),
      );
    }
    throw error;
  } finally {
    await Promise.all(targetWrites.map(write => (
      unlink(write.temporary).catch(() => undefined)
    )));
    await Promise.all(targetWrites
      .filter(write => journalState !== 'prepared' || !failedRollbackPaths.has(write.rollback))
      .map(write => unlink(write.rollback).catch(() => undefined)));
    await releaseLocks(journalState === 'prepared');
  }
}

async function main() {
  const repositoryRoot = process.cwd();
  const options = catalogueMediaRevisionOptionsFrom(process.argv.slice(2));
  const recovered = await recoverCatalogueMediaRevision(repositoryRoot);
  const asOf = Date.now();
  const manifestPath = resolvedManifestPath(repositoryRoot, options.manifestPath);
  const dataRoot = repositoryFile(repositoryRoot, 'data');
  const [
    manifestBytes,
    intakeProjectionBytes,
    dossierProjectionBytes,
    releaseProjectionBytes,
    isolationManifestBytes,
    promotionManifestBytes,
    intakeSourceFiles,
    publicationSourceFiles,
  ] = await Promise.all([
    readFile(manifestPath, 'utf8'),
    readFile(path.join(dataRoot, 'catalogue-intake.json'), 'utf8'),
    readFile(path.join(dataRoot, 'catalogue-publication-dossiers.json'), 'utf8'),
    readFile(path.join(dataRoot, 'catalogue-publication-releases.json'), 'utf8'),
    readFile(path.join(dataRoot, 'catalogue-packshot-isolations.json'), 'utf8'),
    readFile(path.join(dataRoot, 'product-asset-promotions.json'), 'utf8'),
    readCatalogueIntakeSourceFiles(repositoryRoot),
    readCataloguePublicationSourceFiles(repositoryRoot),
  ]);
  const manifest = parseCatalogueMediaRevisionManifest(JSON.parse(manifestBytes), asOf);
  const currentIntake = JSON.parse(intakeProjectionBytes) as CatalogueIntakeManifest;
  const currentDossiers = JSON.parse(dossierProjectionBytes) as CataloguePublicationDossierManifest;
  const currentReleases = JSON.parse(releaseProjectionBytes) as CataloguePublicationReleaseManifest;
  const promotions = JSON.parse(promotionManifestBytes) as StagedProductAssetPromotion[];
  const revisionIds = manifest.revisions.map(revision => revision.candidateId);

  const currentPublicationCompilation = currentPublicationSources(
    publicationSourceFiles,
    currentDossiers,
    currentReleases,
  );

  const intakeCompilation = compileCatalogueIntakeSources(intakeSourceFiles, asOf);
  const intakeDiff = catalogueIntakeProjectionDiff(currentIntake, intakeCompilation.manifest);
  assertCatalogueIntakeWriteBoundary(intakeDiff, intakeCompilation);
  if (intakeDiff.newCandidateIds.length || intakeDiff.removedCandidateIds.length) {
    throw new Error('A media revision cannot add or remove catalogue candidates.');
  }
  const unrelatedIntakeChanges = intakeDiff.changedCandidateIds.filter(
    candidateId => !revisionIds.includes(candidateId),
  );
  if (unrelatedIntakeChanges.length) {
    throw new Error(
      `Catalogue intake has unrelated changes: ${unrelatedIntakeChanges.join(', ')}.`,
    );
  }

  const nextSourcesById = new Map(
    currentPublicationCompilation.sources.map(source => [source.candidateId, source]),
  );
  const expectedCandidateSourceSha256ById = new Map<string, string>();
  const expectedPublicationSourceSha256ById = new Map<string, string>();
  const expectedStagedAssetById = new Map<string, {
    path: string;
    sha256: string;
    byteSize: number;
  }>();
  const revisedSources: CataloguePublicationSourceRecord[] = [];
  for (const revision of manifest.revisions) {
    const candidateSourcePath = path.join(
      dataRoot,
      'catalogue-intake-candidates',
      `${revision.candidateId}.json`,
    );
    const publicationSourcePath = path.join(
      dataRoot,
      'catalogue-publication-sources',
      `${revision.candidateId}.json`,
    );
    const [candidateSourceBytes, publicationSourceBytes] = await Promise.all([
      readFile(candidateSourcePath),
      readFile(publicationSourcePath),
    ]);
    if (sha256(candidateSourceBytes) !== revision.expectedCandidateSourceSha256) {
      throw new Error(`${revision.candidateId} candidate source does not match the reviewed manifest.`);
    }
    if (sha256(publicationSourceBytes) !== revision.expectedPublicationSourceSha256) {
      throw new Error(`${revision.candidateId} publication source does not match the reviewed manifest.`);
    }
    expectedCandidateSourceSha256ById.set(
      revision.candidateId,
      revision.expectedCandidateSourceSha256,
    );
    expectedPublicationSourceSha256ById.set(
      revision.candidateId,
      revision.expectedPublicationSourceSha256,
    );

    const candidate = intakeCompilation.sourceByCandidateId.get(revision.candidateId)?.candidate;
    const previous = currentPublicationCompilation.sourceByCandidateId.get(revision.candidateId);
    const previousCandidate = currentIntake.candidates.find(item => (
      item.id === revision.candidateId
    ));
    if (!candidate || !previousCandidate || !previous?.release) {
      throw new Error(`${revision.candidateId} is not an already released catalogue candidate.`);
    }
    assertCatalogueMediaRevisionCandidateTransition(
      previousCandidate,
      candidate,
      revision,
      previous.release.publication.publishedAt,
    );
    if (candidate.asset.artReviewedAt !== revision.artReviewedAt) {
      throw new Error(`${revision.candidateId} art review does not match the revised candidate.`);
    }
    if (candidate.asset.publicImageSha256 === previous.dossier.finalImage.sha256) {
      throw new Error(`${revision.candidateId} does not contain a new reviewed image.`);
    }
    if (
      Date.parse(revision.artReviewedAt)
      <= Date.parse(previous.release.publication.publishedAt)
    ) {
      throw new Error(`${revision.candidateId} media review must follow the prior publication.`);
    }

    const staged = await matchingPromotion(
      revision.candidateId,
      promotions,
      candidate,
      repositoryRoot,
    );
    expectedStagedAssetById.set(revision.candidateId, {
      path: staged.localPath,
      sha256: staged.promotion.contentHash,
      byteSize: staged.promotion.byteSize,
    });
    const dossier = await createVerifiedCataloguePublicationDossier(
      candidate,
      {
        scope: previous.dossier.approval.scope === cataloguePublicationApprovalScope
          ? cataloguePublicationApprovalScope
          : catalogueReferencePublicationApprovalScope,
        reviewer: previous.dossier.approval.reviewer,
        approvedAt: revision.approvedAt,
      },
      { repositoryRoot, asOf },
    );
    const release = await createVerifiedCataloguePublicationRelease(
      candidate,
      dossier,
      {
        ...previous.release.presentation,
        reviewedAt: revision.presentationReviewedAt,
      },
      {
        scope: cataloguePublicationReleaseApprovalScope,
        reviewer: previous.release.publication.reviewer,
        publishedAt: revision.publishedAt,
      },
      { repositoryRoot, asOf },
    );
    const revised = cataloguePublicationSourceRecord(dossier, release);
    nextSourcesById.set(revision.candidateId, revised);
    revisedSources.push(revised);
  }

  const nextPublicationFiles: CataloguePublicationSourceFile[] = publicationSourceFiles.map(file => ({
    filename: file.filename,
    value: nextSourcesById.get(file.filename.replace(/\.json$/, '')) ?? file.value,
  }));
  const nextPublicationCompilation = compileCataloguePublicationSources(
    intakeCompilation.manifest.candidates,
    nextPublicationFiles,
    asOf,
  );
  const publicationDiff = cataloguePublicationProjectionDiff(
    currentDossiers,
    currentReleases,
    nextPublicationCompilation,
  );
  assertCataloguePublicationWriteBoundary(publicationDiff);
  if (
    publicationDiff.newDossierIds.length
    || publicationDiff.removedDossierIds.length
    || publicationDiff.newReleaseIds.length
    || publicationDiff.removedReleaseIds.length
    || !sortedEqual(publicationDiff.changedDossierIds, revisionIds)
    || !sortedEqual(publicationDiff.changedReleaseIds, revisionIds)
  ) {
    throw new Error('Media revision source/projection scope does not match the reviewed candidates.');
  }
  await validateCatalogueIntakeCompilation(
    intakeCompilation,
    nextPublicationCompilation.dossierManifest,
    nextPublicationCompilation.releaseManifest,
    repositoryRoot,
    asOf,
  );

  const changed = (
    stableCatalogueJson(currentIntake) !== stableCatalogueJson(intakeCompilation.manifest)
    || stableCataloguePublicationJson(currentDossiers)
      !== stableCataloguePublicationJson(nextPublicationCompilation.dossierManifest)
    || stableCataloguePublicationJson(currentReleases)
      !== stableCataloguePublicationJson(nextPublicationCompilation.releaseManifest)
  );
  if (!changed) throw new Error('Catalogue media revision produced no changes.');

  if (options.write) {
    await writeCatalogueMediaRevisionAtomically({
      repositoryRoot,
      revisedSources,
      intakeManifest: intakeCompilation.manifest,
      dossierManifest: nextPublicationCompilation.dossierManifest,
      releaseManifest: nextPublicationCompilation.releaseManifest,
      expectedIntakeProjectionSha256: catalogueIntakeBytesSha256(intakeProjectionBytes),
      expectedIntakeSourceSnapshotSha256: catalogueIntakeSourceSnapshotSha256(intakeSourceFiles),
      expectedDossierProjectionSha256: cataloguePublicationBytesSha256(dossierProjectionBytes),
      expectedReleaseProjectionSha256: cataloguePublicationBytesSha256(releaseProjectionBytes),
      expectedPublicationSourceSnapshotSha256:
        cataloguePublicationSourceSnapshotSha256(publicationSourceFiles),
      expectedIsolationManifestSha256: sha256(isolationManifestBytes),
      expectedPromotionManifestSha256: sha256(promotionManifestBytes),
      expectedCandidateSourceSha256ById,
      expectedPublicationSourceSha256ById,
      expectedStagedAssetById,
    });
  }

  const report = {
    mode: options.write ? 'write' : 'dry-run',
    manifest: path.relative(repositoryRoot, manifestPath),
    revisedCandidateIds: revisionIds,
    intakeProjectionChanged: stableCatalogueJson(currentIntake)
      !== stableCatalogueJson(intakeCompilation.manifest),
    dossierFingerprints: Object.fromEntries(revisedSources.map(source => [
      source.candidateId,
      source.dossier.dossierFingerprint,
    ])),
    releaseFingerprints: Object.fromEntries(revisedSources.map(source => [
      source.candidateId,
      source.release?.releaseFingerprint,
    ])),
    wrote: options.write,
    recoveredInterruptedRevision: recovered,
  };
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `${options.write ? 'Revised' : 'Validated'} ${revisionIds.length} released catalogue media record${revisionIds.length === 1 ? '' : 's'}.`,
  );
  console.log(revisionIds.join('\n'));
  console.log(options.write
    ? 'Publication sources and all three projections were replaced under one CAS transaction.'
    : 'Dry-run only. Review the fingerprints, then repeat with --write.');
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
