import { createHash } from 'node:crypto';
import {
  open,
  readdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import {
  auditCatalogueIntakeManifest,
  catalogueIntakeSchemaVersion,
  type CatalogueIntakeCandidate,
  type CatalogueIntakeManifest,
} from './intake-readiness';
import { verifyCatalogueIdentityEvidenceArtifacts } from './identity-evidence-artifact';
import { verifyCataloguePublicationDossierManifest } from './publication-dossier';
import { verifyCataloguePublicationReleaseManifest } from './publication-release';

export const catalogueIntakeSourceSchemaVersion = 1 as const;
export const catalogueIntakeSourcePublicationStatus = 'private-research-only' as const;
export const catalogueIntakeMaximumWriteBatch = 12 as const;
export const catalogueIntakeSourceDirectory = 'data/catalogue-intake-candidates' as const;
export const catalogueIntakeLegacyMigrationCount = 35 as const;

const candidateIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const packetIdPattern = /^[0-9a-f]{24}$/;
const sha256Pattern = /^[0-9a-f]{64}$/;

export type CatalogueIntakeSourceOrigin =
  | {
      kind: 'legacy-deliberate-intake';
      reference: string;
    }
  | {
      kind: 'static-research-packet';
      packetId: string;
      discoveryId: string;
      sourceSnapshotSha256: string;
    }
  | {
      kind: 'community-aggregate-packet';
      packetId: string;
      reportSha256: string;
    };

export type CatalogueIntakeSourceRecord = {
  schemaVersion: typeof catalogueIntakeSourceSchemaVersion;
  publicationStatus: typeof catalogueIntakeSourcePublicationStatus;
  updatedAt: string;
  /**
   * Migration-only ordering for the pre-compiler cohort. New packet-bound records
   * are sorted deterministically by candidate ID and must not declare an order.
   */
  order?: number;
  origin: CatalogueIntakeSourceOrigin;
  candidate: CatalogueIntakeCandidate;
};

export type CatalogueIntakeSourceFile = {
  filename: string;
  value: unknown;
};

export type CatalogueIntakeCompilation = {
  manifest: CatalogueIntakeManifest;
  sources: CatalogueIntakeSourceRecord[];
  sourceByCandidateId: ReadonlyMap<string, CatalogueIntakeSourceRecord>;
};

export type CatalogueIntakeProjectionDiff = {
  newCandidateIds: string[];
  changedCandidateIds: string[];
  removedCandidateIds: string[];
  changedOrNewCount: number;
};

export type CatalogueIntakeCompilationValidation = {
  candidateCount: number;
  identityArtifactCount: number;
  dossierCount: number;
  releaseCount: number;
};

export type CatalogueIntakeProjectionWrite = {
  repositoryRoot?: string;
  manifest: CatalogueIntakeManifest;
  expectedProjectionSha256: string;
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

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is missing.`);
  return value;
}

function parsedPastDate(value: unknown, label: string, asOf: number) {
  const source = requiredString(value, label);
  const parsed = Date.parse(source);
  if (!Number.isFinite(parsed) || parsed > asOf + 5 * 60_000) {
    throw new Error(`${label} is invalid or in the future.`);
  }
  return { source, parsed };
}

function parseOrigin(
  value: unknown,
  candidateId: string,
  label: string,
): CatalogueIntakeSourceOrigin {
  const origin = objectRecord(value, label);
  const kind = requiredString(origin.kind, `${label} kind`);

  if (kind === 'legacy-deliberate-intake') {
    exactKeys(origin, ['kind', 'reference'], label);
    const reference = requiredString(origin.reference, `${label} reference`);
    if (reference !== candidateId) {
      throw new Error(`${label} reference must equal candidate ID ${candidateId}.`);
    }
    return { kind, reference };
  }

  if (kind === 'static-research-packet') {
    exactKeys(origin, ['kind', 'packetId', 'discoveryId', 'sourceSnapshotSha256'], label);
    const packetId = requiredString(origin.packetId, `${label} packet ID`);
    const discoveryId = requiredString(origin.discoveryId, `${label} discovery ID`);
    const sourceSnapshotSha256 = requiredString(
      origin.sourceSnapshotSha256,
      `${label} source snapshot hash`,
    );
    if (!packetIdPattern.test(packetId)) throw new Error(`${label} packet ID is invalid.`);
    if (!packetIdPattern.test(discoveryId)) throw new Error(`${label} discovery ID is invalid.`);
    if (!sha256Pattern.test(sourceSnapshotSha256)) {
      throw new Error(`${label} source snapshot hash is invalid.`);
    }
    return { kind, packetId, discoveryId, sourceSnapshotSha256 };
  }

  if (kind === 'community-aggregate-packet') {
    exactKeys(origin, ['kind', 'packetId', 'reportSha256'], label);
    const packetId = requiredString(origin.packetId, `${label} packet ID`);
    const reportSha256 = requiredString(origin.reportSha256, `${label} report hash`);
    if (!packetIdPattern.test(packetId)) throw new Error(`${label} packet ID is invalid.`);
    if (!sha256Pattern.test(reportSha256)) throw new Error(`${label} report hash is invalid.`);
    return { kind, packetId, reportSha256 };
  }

  throw new Error(`${label} kind is unsupported.`);
}

function parseSourceRecord(
  file: CatalogueIntakeSourceFile,
  asOf: number,
): CatalogueIntakeSourceRecord {
  if (path.basename(file.filename) !== file.filename || !file.filename.endsWith('.json')) {
    throw new Error(`Catalogue intake source filename is invalid: ${file.filename}.`);
  }
  const source = objectRecord(file.value, `Catalogue intake source ${file.filename}`);
  exactKeys(
    source,
    ['schemaVersion', 'publicationStatus', 'updatedAt', 'order', 'origin', 'candidate'],
    `Catalogue intake source ${file.filename}`,
  );
  if (source.schemaVersion !== catalogueIntakeSourceSchemaVersion) {
    throw new Error(`Catalogue intake source ${file.filename} has an unsupported schema.`);
  }
  if (source.publicationStatus !== catalogueIntakeSourcePublicationStatus) {
    throw new Error(`Catalogue intake source ${file.filename} must remain private research.`);
  }

  const candidate = objectRecord(
    source.candidate,
    `Catalogue intake source ${file.filename} candidate`,
  ) as CatalogueIntakeCandidate;
  const candidateId = requiredString(candidate.id, `Catalogue intake source ${file.filename} candidate ID`);
  if (!candidateIdPattern.test(candidateId)) {
    throw new Error(`Catalogue intake source ${file.filename} candidate ID is invalid.`);
  }
  if (file.filename !== `${candidateId}.json`) {
    throw new Error(
      `Catalogue intake source filename ${file.filename} does not match candidate ID ${candidateId}.`,
    );
  }

  const { source: updatedAt } = parsedPastDate(
    source.updatedAt,
    `Catalogue intake source ${candidateId} timestamp`,
    asOf,
  );
  const origin = parseOrigin(
    source.origin,
    candidateId,
    `Catalogue intake source ${candidateId} origin`,
  );
  let order: number | undefined;
  if (origin.kind === 'legacy-deliberate-intake') {
    if (!Number.isInteger(source.order) || (source.order as number) < 0) {
      throw new Error(`Legacy catalogue intake source ${candidateId} must declare a non-negative order.`);
    }
    order = source.order as number;
  } else if (source.order !== undefined) {
    throw new Error(`Packet-bound catalogue intake source ${candidateId} cannot declare a legacy order.`);
  }

  const record: CatalogueIntakeSourceRecord = {
    schemaVersion: catalogueIntakeSourceSchemaVersion,
    publicationStatus: catalogueIntakeSourcePublicationStatus,
    updatedAt,
    ...(order === undefined ? {} : { order }),
    origin,
    candidate,
  };

  // The existing manifest auditor is the single candidate-domain validator.
  // A per-file manifest also proves the envelope timestamp covers all evidence.
  auditCatalogueIntakeManifest({
    schemaVersion: catalogueIntakeSchemaVersion,
    updatedAt,
    candidates: [candidate],
  }, asOf);

  return record;
}

function originKey(origin: CatalogueIntakeSourceOrigin) {
  if (origin.kind === 'legacy-deliberate-intake') return `${origin.kind}:${origin.reference}`;
  if (origin.kind === 'static-research-packet') {
    return `${origin.kind}:${origin.packetId}:${origin.discoveryId}:${origin.sourceSnapshotSha256}`;
  }
  return `${origin.kind}:${origin.packetId}:${origin.reportSha256}`;
}

export function stableCatalogueJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableCatalogueJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter(key => record[key] !== undefined)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableCatalogueJson(record[key])}`)
    .join(',')}}`;
}

export function catalogueIntakeBytesSha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

export function catalogueIntakeSourceSnapshotSha256(
  files: readonly CatalogueIntakeSourceFile[],
) {
  return catalogueIntakeBytesSha256(stableCatalogueJson(files));
}

export async function readCatalogueIntakeSourceFiles(
  repositoryRoot = process.cwd(),
): Promise<CatalogueIntakeSourceFile[]> {
  const sourceRoot = path.resolve(repositoryRoot, catalogueIntakeSourceDirectory);
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  if (!entries.length) throw new Error('Catalogue intake source directory is empty.');

  const unsupported = entries.filter(entry => !entry.isFile() || !entry.name.endsWith('.json'));
  if (unsupported.length) {
    throw new Error(
      `Catalogue intake source directory contains unsupported entries: ${unsupported
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

export function compileCatalogueIntakeSources(
  files: readonly CatalogueIntakeSourceFile[],
  asOf = Date.now(),
): CatalogueIntakeCompilation {
  if (!files.length) throw new Error('Catalogue intake compilation requires at least one source.');
  const sources = files.map(file => parseSourceRecord(file, asOf));
  const originKeys = new Set<string>();
  const staticDiscoveryIds = new Set<string>();
  const legacyOrders = new Set<number>();
  const sourceByCandidateId = new Map<string, CatalogueIntakeSourceRecord>();

  for (const source of sources) {
    const candidateId = source.candidate.id;
    if (sourceByCandidateId.has(candidateId)) {
      throw new Error(`Duplicate catalogue intake source candidate: ${candidateId}.`);
    }
    sourceByCandidateId.set(candidateId, source);

    const key = originKey(source.origin);
    if (originKeys.has(key)) throw new Error(`Duplicate catalogue intake source origin: ${key}.`);
    originKeys.add(key);

    if (source.origin.kind === 'static-research-packet') {
      if (staticDiscoveryIds.has(source.origin.discoveryId)) {
        throw new Error(
          `Duplicate catalogue intake static discovery origin: ${source.origin.discoveryId}.`,
        );
      }
      staticDiscoveryIds.add(source.origin.discoveryId);
    }
    if (source.order !== undefined) {
      if (legacyOrders.has(source.order)) {
        throw new Error(`Duplicate catalogue intake legacy order: ${source.order}.`);
      }
      legacyOrders.add(source.order);
    }
  }

  const ordered = [...sources].sort((left, right) => {
    const leftLegacy = left.origin.kind === 'legacy-deliberate-intake';
    const rightLegacy = right.origin.kind === 'legacy-deliberate-intake';
    if (leftLegacy && rightLegacy) return (left.order as number) - (right.order as number);
    if (leftLegacy !== rightLegacy) return leftLegacy ? -1 : 1;
    return left.candidate.id.localeCompare(right.candidate.id);
  });
  const updatedAt = ordered.reduce((latest, source) => (
    Date.parse(source.updatedAt) > Date.parse(latest) ? source.updatedAt : latest
  ), ordered[0].updatedAt);
  const manifest: CatalogueIntakeManifest = {
    schemaVersion: catalogueIntakeSchemaVersion,
    updatedAt,
    candidates: ordered.map(source => source.candidate),
  };
  auditCatalogueIntakeManifest(manifest, asOf);
  const legacySources = ordered.filter(source => (
    source.origin.kind === 'legacy-deliberate-intake'
  ));
  if (
    legacySources.length !== catalogueIntakeLegacyMigrationCount
    || Array.from({ length: catalogueIntakeLegacyMigrationCount }, (_, order) => order)
      .some(order => !legacyOrders.has(order))
  ) {
    throw new Error(
      `Catalogue intake must retain the fixed ${catalogueIntakeLegacyMigrationCount}-record legacy migration cohort.`,
    );
  }

  return {
    manifest,
    sources: ordered,
    sourceByCandidateId,
  };
}

export function catalogueIntakeProjectionDiff(
  current: CatalogueIntakeManifest,
  next: CatalogueIntakeManifest,
): CatalogueIntakeProjectionDiff {
  const currentById = new Map(current.candidates.map(candidate => [candidate.id, candidate]));
  const nextById = new Map(next.candidates.map(candidate => [candidate.id, candidate]));
  const newCandidateIds = [...nextById.keys()]
    .filter(id => !currentById.has(id))
    .sort();
  const removedCandidateIds = [...currentById.keys()]
    .filter(id => !nextById.has(id))
    .sort();
  const changedCandidateIds = [...nextById.entries()]
    .filter(([id, candidate]) => (
      currentById.has(id)
      && stableCatalogueJson(currentById.get(id)) !== stableCatalogueJson(candidate)
    ))
    .map(([id]) => id)
    .sort();
  return {
    newCandidateIds,
    changedCandidateIds,
    removedCandidateIds,
    changedOrNewCount: newCandidateIds.length + changedCandidateIds.length,
  };
}

export function assertCatalogueIntakeWriteBoundary(
  diff: CatalogueIntakeProjectionDiff,
  compilation: CatalogueIntakeCompilation,
) {
  if (diff.removedCandidateIds.length) {
    throw new Error(
      `Catalogue intake compilation cannot remove candidates: ${diff.removedCandidateIds.join(', ')}.`,
    );
  }
  if (diff.changedOrNewCount > catalogueIntakeMaximumWriteBatch) {
    throw new Error(
      `Catalogue intake write changes ${diff.changedOrNewCount} records; maximum is ${catalogueIntakeMaximumWriteBatch}.`,
    );
  }
  const newLegacy = diff.newCandidateIds.filter(candidateId => (
    compilation.sourceByCandidateId.get(candidateId)?.origin.kind === 'legacy-deliberate-intake'
  ));
  if (newLegacy.length) {
    throw new Error(
      `New catalogue intake candidates require a packet-bound origin: ${newLegacy.join(', ')}.`,
    );
  }
}

export async function validateCatalogueIntakeCompilation(
  compilation: CatalogueIntakeCompilation,
  dossierManifest: unknown,
  releaseManifest: unknown,
  repositoryRoot = process.cwd(),
  asOf = Date.now(),
): Promise<CatalogueIntakeCompilationValidation> {
  auditCatalogueIntakeManifest(compilation.manifest, asOf);
  const identityArtifactCount = await verifyCatalogueIdentityEvidenceArtifacts(
    compilation.manifest.candidates,
    repositoryRoot,
  );
  const dossierReport = verifyCataloguePublicationDossierManifest(
    compilation.manifest.candidates,
    dossierManifest,
    asOf,
  );
  const releaseReport = verifyCataloguePublicationReleaseManifest(
    compilation.manifest.candidates,
    dossierManifest,
    releaseManifest,
    asOf,
  );
  return {
    candidateCount: compilation.manifest.candidates.length,
    identityArtifactCount,
    dossierCount: dossierReport.dossierCount,
    releaseCount: releaseReport.releaseCount,
  };
}

/**
 * Writes only the generated runtime projection. All domain validation happens
 * before this boundary. The exclusive lock coordinates compliant compilers;
 * both digests are re-read under that lock so a stale compiler cannot replace
 * newer source or projection work.
 */
export async function writeCatalogueIntakeProjectionAtomically({
  repositoryRoot = process.cwd(),
  manifest,
  expectedProjectionSha256,
  expectedSourceSnapshotSha256,
}: CatalogueIntakeProjectionWrite) {
  const projectionPath = path.resolve(repositoryRoot, 'data/catalogue-intake.json');
  const temporaryPath = path.join(
    path.dirname(projectionPath),
    `.${path.basename(projectionPath)}.${process.pid}.${Date.now()}.tmp`,
  );
  const lockPath = path.join(path.dirname(projectionPath), '.catalogue-intake.compiler.lock');
  let lock: Awaited<ReturnType<typeof open>> | undefined;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    try {
      lock = await open(lockPath, 'wx');
    } catch (error) {
      if (
        error
        && typeof error === 'object'
        && 'code' in error
        && error.code === 'EEXIST'
      ) {
        throw new Error(
          'Catalogue intake compilation lock already exists. Wait for any active compiler; if the lock persists, verify no compiler is running, remove data/.catalogue-intake.compiler.lock, and rerun.',
          { cause: error },
        );
      }
      throw error;
    }
    const [currentProjection, currentSources] = await Promise.all([
      readFile(projectionPath),
      readCatalogueIntakeSourceFiles(repositoryRoot),
    ]);
    if (catalogueIntakeBytesSha256(currentProjection) !== expectedProjectionSha256) {
      throw new Error('Catalogue intake projection changed after compilation; rerun the dry-run.');
    }
    if (
      catalogueIntakeSourceSnapshotSha256(currentSources)
      !== expectedSourceSnapshotSha256
    ) {
      throw new Error('Catalogue intake sources changed after compilation; rerun the dry-run.');
    }
    await rename(temporaryPath, projectionPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  } finally {
    await lock?.close().catch(() => undefined);
    if (lock) await unlink(lockPath).catch(() => undefined);
  }
}
