import { createHash, randomUUID } from 'node:crypto';
import {
  link,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import type { CatalogueIntakeCandidate } from './intake-readiness';
import {
  cataloguePublicationDossierSchemaVersion,
  cataloguePublicationExposure,
  verifyCataloguePublicationDossierManifest,
  type CataloguePublicationDossier,
  type CataloguePublicationDossierManifest,
} from './publication-dossier';
import {
  cataloguePublicationReleaseExposure,
  cataloguePublicationReleaseSchemaVersion,
  verifyCataloguePublicationReleaseManifest,
  type CataloguePublicationRelease,
  type CataloguePublicationReleaseManifest,
} from './publication-release';

export const cataloguePublicationSourceSchemaVersion = 1 as const;
export const cataloguePublicationSourceDirectory = 'data/catalogue-publication-sources' as const;
export const cataloguePublicationMaximumWriteBatch = 12 as const;

const candidateIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type CataloguePublicationSourceRecord = {
  schemaVersion: typeof cataloguePublicationSourceSchemaVersion;
  candidateId: string;
  dossier: CataloguePublicationDossier;
  release: CataloguePublicationRelease | null;
};

export type CataloguePublicationSourceFile = {
  filename: string;
  value: unknown;
};

export type CataloguePublicationCompilation = {
  dossierManifest: CataloguePublicationDossierManifest;
  releaseManifest: CataloguePublicationReleaseManifest;
  sources: CataloguePublicationSourceRecord[];
  sourceByCandidateId: ReadonlyMap<string, CataloguePublicationSourceRecord>;
};

export type CataloguePublicationProjectionDiff = {
  newDossierIds: string[];
  changedDossierIds: string[];
  removedDossierIds: string[];
  newReleaseIds: string[];
  changedReleaseIds: string[];
  removedReleaseIds: string[];
  changedOrNewCount: number;
};

export type CataloguePublicationProjectionWrite = {
  repositoryRoot?: string;
  dossierManifest: CataloguePublicationDossierManifest;
  releaseManifest: CataloguePublicationReleaseManifest;
  expectedDossierProjectionSha256: string;
  expectedReleaseProjectionSha256: string;
  expectedSourceSnapshotSha256: string;
};

function objectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
) {
  const unexpected = Object.keys(record).filter(key => !allowed.includes(key));
  if (unexpected.length) {
    throw new Error(`${label} has unsupported fields: ${unexpected.sort().join(', ')}.`);
  }
}

function requiredCandidateId(value: unknown, label: string) {
  if (typeof value !== 'string' || !candidateIdPattern.test(value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

export function stableCataloguePublicationJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableCataloguePublicationJson).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter(key => record[key] !== undefined)
    .sort()
    .map(key => (
      `${JSON.stringify(key)}:${stableCataloguePublicationJson(record[key])}`
    ))
    .join(',')}}`;
}

export function cataloguePublicationBytesSha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

export function cataloguePublicationSourceSnapshotSha256(
  files: readonly CataloguePublicationSourceFile[],
) {
  return cataloguePublicationBytesSha256(stableCataloguePublicationJson(
    [...files].sort((left, right) => left.filename.localeCompare(right.filename)),
  ));
}

function parseSourceRecord(
  file: CataloguePublicationSourceFile,
): CataloguePublicationSourceRecord {
  if (
    path.basename(file.filename) !== file.filename
    || !file.filename.endsWith('.json')
  ) {
    throw new Error(`Catalogue publication source filename is invalid: ${file.filename}.`);
  }
  const source = objectRecord(
    file.value,
    `Catalogue publication source ${file.filename}`,
  );
  exactKeys(
    source,
    ['schemaVersion', 'candidateId', 'dossier', 'release'],
    `Catalogue publication source ${file.filename}`,
  );
  if (source.schemaVersion !== cataloguePublicationSourceSchemaVersion) {
    throw new Error(`Catalogue publication source ${file.filename} has an unsupported schema.`);
  }
  const candidateId = requiredCandidateId(
    source.candidateId,
    `Catalogue publication source ${file.filename} candidate ID`,
  );
  if (file.filename !== `${candidateId}.json`) {
    throw new Error(
      `Catalogue publication source filename ${file.filename} does not match candidate ID ${candidateId}.`,
    );
  }
  const dossier = objectRecord(
    source.dossier,
    `Catalogue publication source ${candidateId} dossier`,
  ) as CataloguePublicationDossier;
  if (dossier.candidateId !== candidateId) {
    throw new Error(`${candidateId} publication source dossier binding is invalid.`);
  }
  let release: CataloguePublicationRelease | null = null;
  if (source.release !== null) {
    release = objectRecord(
      source.release,
      `Catalogue publication source ${candidateId} release`,
    ) as CataloguePublicationRelease;
    if (release.candidateId !== candidateId) {
      throw new Error(`${candidateId} publication source release binding is invalid.`);
    }
    if (release.dossierFingerprint !== dossier.dossierFingerprint) {
      throw new Error(`${candidateId} publication source release is not bound to its dossier.`);
    }
  }
  return {
    schemaVersion: cataloguePublicationSourceSchemaVersion,
    candidateId,
    dossier,
    release,
  };
}

export async function readCataloguePublicationSourceFiles(
  repositoryRoot = process.cwd(),
): Promise<CataloguePublicationSourceFile[]> {
  const sourceRoot = path.resolve(repositoryRoot, cataloguePublicationSourceDirectory);
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  if (!entries.length) throw new Error('Catalogue publication source directory is empty.');
  const unsupported = entries.filter(entry => (
    !entry.isFile() || !entry.name.endsWith('.json')
  ));
  if (unsupported.length) {
    throw new Error(
      `Catalogue publication source directory contains unsupported entries: ${unsupported
        .map(entry => entry.name)
        .sort()
        .join(', ')}.`,
    );
  }
  return Promise.all(entries
    .map(entry => entry.name)
    .sort()
    .map(async filename => ({
      filename,
      value: JSON.parse(await readFile(path.join(sourceRoot, filename), 'utf8')) as unknown,
    })));
}

function compareTimestampThenCandidate(
  leftTimestamp: string,
  leftCandidateId: string,
  rightTimestamp: string,
  rightCandidateId: string,
) {
  const timestampOrder = Date.parse(leftTimestamp) - Date.parse(rightTimestamp);
  return timestampOrder || leftCandidateId.localeCompare(rightCandidateId);
}

export function compileCataloguePublicationSources(
  candidates: readonly CatalogueIntakeCandidate[],
  files: readonly CataloguePublicationSourceFile[],
  asOf = Date.now(),
): CataloguePublicationCompilation {
  if (!files.length) {
    throw new Error('Catalogue publication compilation requires at least one source.');
  }
  const sources = files.map(parseSourceRecord);
  const sourceByCandidateId = new Map<string, CataloguePublicationSourceRecord>();
  for (const source of sources) {
    if (sourceByCandidateId.has(source.candidateId)) {
      throw new Error(`Duplicate catalogue publication source candidate: ${source.candidateId}.`);
    }
    sourceByCandidateId.set(source.candidateId, source);
  }

  const orderedDossiers = sources
    .map(source => source.dossier)
    .sort((left, right) => compareTimestampThenCandidate(
      left.approval.approvedAt,
      left.candidateId,
      right.approval.approvedAt,
      right.candidateId,
    ));
  const orderedReleases = sources
    .flatMap(source => source.release ? [source.release] : [])
    .sort((left, right) => compareTimestampThenCandidate(
      left.publication.publishedAt,
      left.candidateId,
      right.publication.publishedAt,
      right.candidateId,
    ));
  const dossierManifest: CataloguePublicationDossierManifest = {
    schemaVersion: cataloguePublicationDossierSchemaVersion,
    exposure: cataloguePublicationExposure,
    dossiers: orderedDossiers,
  };
  const releaseManifest: CataloguePublicationReleaseManifest = {
    schemaVersion: cataloguePublicationReleaseSchemaVersion,
    exposure: cataloguePublicationReleaseExposure,
    releases: orderedReleases,
  };

  // These existing domain validators remain the canonical collision, freshness,
  // fingerprint, image-reuse, GTIN and release-binding gates.
  verifyCataloguePublicationDossierManifest(candidates, dossierManifest, asOf);
  verifyCataloguePublicationReleaseManifest(
    candidates,
    dossierManifest,
    releaseManifest,
    asOf,
  );

  return {
    dossierManifest,
    releaseManifest,
    sources: [...sources].sort((left, right) => (
      left.candidateId.localeCompare(right.candidateId)
    )),
    sourceByCandidateId,
  };
}

function recordsByCandidate<T extends { candidateId: string }>(
  records: readonly T[],
) {
  return new Map(records.map(record => [record.candidateId, record]));
}

function recordDiff<T extends { candidateId: string }>(
  current: readonly T[],
  next: readonly T[],
) {
  const currentById = recordsByCandidate(current);
  const nextById = recordsByCandidate(next);
  const added = [...nextById.keys()].filter(id => !currentById.has(id)).sort();
  const removed = [...currentById.keys()].filter(id => !nextById.has(id)).sort();
  const changed = [...nextById.entries()]
    .filter(([id, value]) => (
      currentById.has(id)
      && stableCataloguePublicationJson(currentById.get(id))
        !== stableCataloguePublicationJson(value)
    ))
    .map(([id]) => id)
    .sort();
  return { added, removed, changed };
}

export function cataloguePublicationProjectionDiff(
  currentDossiers: CataloguePublicationDossierManifest,
  currentReleases: CataloguePublicationReleaseManifest,
  next: CataloguePublicationCompilation,
): CataloguePublicationProjectionDiff {
  const dossiers = recordDiff(
    currentDossiers.dossiers,
    next.dossierManifest.dossiers,
  );
  const releases = recordDiff(
    currentReleases.releases,
    next.releaseManifest.releases,
  );
  return {
    newDossierIds: dossiers.added,
    changedDossierIds: dossiers.changed,
    removedDossierIds: dossiers.removed,
    newReleaseIds: releases.added,
    changedReleaseIds: releases.changed,
    removedReleaseIds: releases.removed,
    changedOrNewCount: new Set([
      ...dossiers.added,
      ...dossiers.changed,
      ...releases.added,
      ...releases.changed,
    ]).size,
  };
}

export function assertCataloguePublicationWriteBoundary(
  diff: CataloguePublicationProjectionDiff,
) {
  const removed = new Set([
    ...diff.removedDossierIds,
    ...diff.removedReleaseIds,
  ]);
  if (removed.size) {
    throw new Error(
      `Catalogue publication compilation cannot remove records: ${[...removed].sort().join(', ')}.`,
    );
  }
  if (diff.changedOrNewCount > cataloguePublicationMaximumWriteBatch) {
    throw new Error(
      `Catalogue publication write changes ${diff.changedOrNewCount} records; maximum is ${cataloguePublicationMaximumWriteBatch}.`,
    );
  }
}

export function assertCataloguePublicationProjectionMatches(
  currentDossiers: CataloguePublicationDossierManifest,
  currentReleases: CataloguePublicationReleaseManifest,
  compilation: CataloguePublicationCompilation,
) {
  if (
    stableCataloguePublicationJson(currentDossiers)
      !== stableCataloguePublicationJson(compilation.dossierManifest)
    || stableCataloguePublicationJson(currentReleases)
      !== stableCataloguePublicationJson(compilation.releaseManifest)
  ) {
    throw new Error(
      'Catalogue publication projections are stale. Run catalogue:publication:build, review, then use --write.',
    );
  }
}

export function cataloguePublicationSourceRecord(
  dossier: CataloguePublicationDossier,
  release: CataloguePublicationRelease | null,
): CataloguePublicationSourceRecord {
  if (
    release
    && (
      release.candidateId !== dossier.candidateId
      || release.dossierFingerprint !== dossier.dossierFingerprint
    )
  ) {
    throw new Error(`${dossier.candidateId} release is not bound to its publication dossier.`);
  }
  return {
    schemaVersion: cataloguePublicationSourceSchemaVersion,
    candidateId: dossier.candidateId,
    dossier,
    release,
  };
}

export async function writeCataloguePublicationSourceAtomically(
  record: CataloguePublicationSourceRecord,
  repositoryRoot = process.cwd(),
) {
  parseSourceRecord({
    filename: `${record.candidateId}.json`,
    value: record,
  });
  const sourceRoot = path.resolve(repositoryRoot, cataloguePublicationSourceDirectory);
  await mkdir(sourceRoot, { recursive: true });
  const filename = `${record.candidateId}.json`;
  const sourcePath = path.join(sourceRoot, filename);
  const temporaryPath = path.join(
    path.dirname(sourceRoot),
    `.catalogue-publication-source.${record.candidateId}.${process.pid}.${randomUUID()}.tmp`,
  );
  const bytes = `${JSON.stringify(record, null, 2)}\n`;
  await writeFile(temporaryPath, bytes, { encoding: 'utf8', flag: 'wx' });
  try {
    await link(temporaryPath, sourcePath);
    return { created: true as const, sourcePath };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const existing = JSON.parse(await readFile(sourcePath, 'utf8')) as unknown;
    if (
      stableCataloguePublicationJson(existing)
      !== stableCataloguePublicationJson(record)
    ) {
      throw new Error(
        `${record.candidateId} already has a different immutable publication source.`,
      );
    }
    return { created: false as const, sourcePath };
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}

function compilerPath(repositoryRoot: string, filename: string) {
  return path.resolve(repositoryRoot, 'data', filename);
}

/**
 * Replaces both generated projections only after taking an exclusive compiler
 * lock and re-reading all three expected digests. A stale compiler therefore
 * cannot overwrite newer source, dossier or release work.
 */
export async function writeCataloguePublicationProjectionsAtomically({
  repositoryRoot = process.cwd(),
  dossierManifest,
  releaseManifest,
  expectedDossierProjectionSha256,
  expectedReleaseProjectionSha256,
  expectedSourceSnapshotSha256,
}: CataloguePublicationProjectionWrite) {
  const dossierPath = compilerPath(repositoryRoot, 'catalogue-publication-dossiers.json');
  const releasePath = compilerPath(repositoryRoot, 'catalogue-publication-releases.json');
  const dataRoot = path.dirname(dossierPath);
  const suffix = `${process.pid}.${randomUUID()}`;
  const dossierTemporaryPath = path.join(
    dataRoot,
    `.catalogue-publication-dossiers.${suffix}.tmp`,
  );
  const releaseTemporaryPath = path.join(
    dataRoot,
    `.catalogue-publication-releases.${suffix}.tmp`,
  );
  const dossierRollbackPath = path.join(
    dataRoot,
    `.catalogue-publication-dossiers.${suffix}.rollback`,
  );
  const lockPath = path.join(dataRoot, '.catalogue-publication.compiler.lock');
  let lockHandle: Awaited<ReturnType<typeof open>> | undefined;
  let currentDossier: Buffer | undefined;
  try {
    await Promise.all([
      writeFile(
        dossierTemporaryPath,
        `${JSON.stringify(dossierManifest, null, 2)}\n`,
        { encoding: 'utf8', flag: 'wx' },
      ),
      writeFile(
        releaseTemporaryPath,
        `${JSON.stringify(releaseManifest, null, 2)}\n`,
        { encoding: 'utf8', flag: 'wx' },
      ),
    ]);
    try {
      lockHandle = await open(lockPath, 'wx');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new Error('Catalogue publication compiler is already running; retry after it finishes.');
      }
      throw error;
    }
    const [dossierBytes, releaseBytes, sourceFiles] = await Promise.all([
      readFile(dossierPath),
      readFile(releasePath),
      readCataloguePublicationSourceFiles(repositoryRoot),
    ]);
    currentDossier = dossierBytes;
    if (
      cataloguePublicationBytesSha256(dossierBytes)
      !== expectedDossierProjectionSha256
    ) {
      throw new Error(
        'Catalogue publication dossier projection changed after compilation; rerun the dry-run.',
      );
    }
    if (
      cataloguePublicationBytesSha256(releaseBytes)
      !== expectedReleaseProjectionSha256
    ) {
      throw new Error(
        'Catalogue publication release projection changed after compilation; rerun the dry-run.',
      );
    }
    if (
      cataloguePublicationSourceSnapshotSha256(sourceFiles)
      !== expectedSourceSnapshotSha256
    ) {
      throw new Error(
        'Catalogue publication sources changed after compilation; rerun the dry-run.',
      );
    }

    await rename(dossierTemporaryPath, dossierPath);
    try {
      await rename(releaseTemporaryPath, releasePath);
    } catch (error) {
      await writeFile(dossierRollbackPath, currentDossier, { flag: 'wx' });
      await rename(dossierRollbackPath, dossierPath);
      throw error;
    }
  } finally {
    await Promise.all([
      unlink(dossierTemporaryPath).catch(() => undefined),
      unlink(releaseTemporaryPath).catch(() => undefined),
      unlink(dossierRollbackPath).catch(() => undefined),
    ]);
    await lockHandle?.close().catch(() => undefined);
    if (lockHandle) await unlink(lockPath).catch(() => undefined);
  }
}
