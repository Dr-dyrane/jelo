import { randomUUID } from 'node:crypto';
import {
  open,
  readdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import type { CatalogueDiscoverySnapshot } from './discovery-screening';
import {
  assertPrivateResearchEvidencePacketProjection,
  catalogueResearchPacketProjectionPath,
  catalogueResearchPacketSourceDirectory,
  readStaticResearchPacketShard,
  researchPacketSourceDigest,
  type CatalogueResearchEvidencePacketProjection,
  type CatalogueResearchPacketSourceFile,
} from './research-evidence-packet-source';
import {
  assertPrivateResearchOfferCaptureManifest,
  assertResearchOfferCaptureManifestMatchesPlan,
  buildResearchOfferCapturePlan,
  researchOfferCapturePolicy,
  researchOfferCapturePublicationAuthority,
  researchOfferCapturePublicationStatus,
  researchOfferDigest,
  type ResearchOfferCaptureManifest,
  type ResearchOfferCaptureRecord,
  type ResearchOfferQualityCaution,
} from './research-offer-capture';

export const researchOfferCaptureProjectionSchemaVersion = 3 as const;
export const researchOfferCaptureSourceDirectory =
  'data/catalogue-research-offer-capture-sources' as const;
export const researchOfferCaptureProjectionPath =
  'data/catalogue-research-offer-captures.json' as const;

const digestPattern = /^[0-9a-f]{64}$/;

export type ResearchOfferCaptureSourceFile = {
  filename: string;
  bytes: Buffer;
  value: ResearchOfferCaptureManifest;
};

export type ResearchOfferCaptureSourceProjection = {
  sourcePath: string;
  sourceSha256: string;
  researchPacketSourcePath: string;
  researchPacketSourceSha256: string;
  packetCount: number;
  packetIds: string[];
  responseCount: number;
};

export type ResearchOfferCaptureProjection = {
  schemaVersion: typeof researchOfferCaptureProjectionSchemaVersion;
  policy: typeof researchOfferCapturePolicy;
  publicationStatus: typeof researchOfferCapturePublicationStatus;
  publicationAuthority: typeof researchOfferCapturePublicationAuthority;
  generatedAt: string;
  source: {
    researchPacketProjectionSha256: string;
    discoverySnapshotSha256: string;
  };
  selection: {
    packetCount: number;
    packetIds: string[];
    responseCount: number;
  };
  sources: ResearchOfferCaptureSourceProjection[];
  qualityCautions: ResearchOfferQualityCaution[];
  captures: ResearchOfferCaptureRecord[];
};

function captureSourceFilename(bytes: Buffer) {
  return `${researchOfferDigest(bytes)}.json`;
}

function stableSourceOrder(
  left: ResearchOfferCaptureSourceFile,
  right: ResearchOfferCaptureSourceFile,
) {
  return left.value.selection.packetIds[0]!.localeCompare(right.value.selection.packetIds[0]!)
    || left.filename.localeCompare(right.filename);
}

export async function readResearchOfferCaptureSourceFiles(
  repositoryRoot = process.cwd(),
): Promise<ResearchOfferCaptureSourceFile[]> {
  const sourceRoot = path.resolve(repositoryRoot, researchOfferCaptureSourceDirectory);
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  const unsupported = entries.filter(entry => !entry.isFile() || !entry.name.endsWith('.json'));
  if (unsupported.length) {
    throw new Error(`Research offer capture source directory contains unsupported entries: ${
      unsupported.map(entry => entry.name).sort().join(', ')
    }.`);
  }
  return Promise.all(entries.map(entry => entry.name).sort().map(async filename => {
    const bytes = await readFile(path.join(sourceRoot, filename));
    return {
      filename,
      bytes,
      value: JSON.parse(bytes.toString('utf8')) as ResearchOfferCaptureManifest,
    };
  }));
}

export async function compileResearchOfferCaptureSources(input: {
  repositoryRoot?: string;
  packetProjection: CatalogueResearchEvidencePacketProjection;
  packetProjectionBytes: string | Buffer;
  packetSourceFiles: readonly CatalogueResearchPacketSourceFile[];
  captureSourceFiles: readonly ResearchOfferCaptureSourceFile[];
  snapshot: CatalogueDiscoverySnapshot;
  discoverySnapshotSha256: string;
}) {
  const repositoryRoot = input.repositoryRoot ?? process.cwd();
  assertPrivateResearchEvidencePacketProjection(input.packetProjection);
  if (input.packetProjection.source.discoverySnapshotSha256 !== input.discoverySnapshotSha256) {
    throw new Error('Research offer capture projection input is stale against discovery.');
  }
  if (!input.captureSourceFiles.length) {
    throw new Error('Research offer capture compilation requires at least one immutable source.');
  }
  const packetSources = new Map(input.packetSourceFiles.map(file => [
    researchPacketSourceDigest(file.bytes),
    file,
  ]));
  const packetDescriptors = new Map(input.packetProjection.shards.map(shard => [
    shard.sourceSha256,
    shard,
  ]));
  const captureIds = new Set<string>();
  const evidencePaths = new Set<string>();
  const packetIds = new Set<string>();
  const cautionKeys = new Set<string>();
  const sources: ResearchOfferCaptureSourceProjection[] = [];
  const captures: ResearchOfferCaptureRecord[] = [];
  const cautions: ResearchOfferQualityCaution[] = [];

  for (const file of [...input.captureSourceFiles].sort(stableSourceOrder)) {
    if (
      path.basename(file.filename) !== file.filename
      || !digestPattern.test(file.filename.replace(/\.json$/, ''))
      || file.filename !== captureSourceFilename(file.bytes)
    ) {
      throw new Error(`Research offer capture source is not content-addressed: ${file.filename}.`);
    }
    if (JSON.stringify(file.value) !== JSON.stringify(JSON.parse(file.bytes.toString('utf8')))) {
      throw new Error(`Research offer capture source bytes do not match parsed value: ${file.filename}.`);
    }
    const manifest = assertPrivateResearchOfferCaptureManifest(file.value);
    const descriptor = packetDescriptors.get(manifest.source.researchPacketsSha256);
    const packetSource = packetSources.get(manifest.source.researchPacketsSha256);
    if (!packetSource) {
      throw new Error(`Research offer capture source ${file.filename} has no packet shard.`);
    }
    // Content-addressed historical sources stay in place. Only sources bound to
    // the current discovery snapshot and current shard projection participate
    // in the checked-in projection.
    if (
      manifest.source.discoverySnapshotSha256 !== input.discoverySnapshotSha256
      || !descriptor
    ) continue;
    const reopened = await readStaticResearchPacketShard(repositoryRoot, descriptor);
    if (!reopened.bytes.equals(packetSource.bytes)) {
      throw new Error(`Research offer capture source ${file.filename} packet shard bytes changed.`);
    }
    const availablePacketIds = new Set(packetSource.value.packets.map(packet => packet.id));
    if (manifest.selection.packetIds.some(id => !availablePacketIds.has(id))) {
      throw new Error(`Research offer capture source ${file.filename} is outside its packet shard.`);
    }
    const plan = buildResearchOfferCapturePlan(
      packetSource.value,
      input.snapshot,
      manifest.selection.packetIds,
    );
    assertResearchOfferCaptureManifestMatchesPlan(manifest, plan);

    for (const id of manifest.selection.packetIds) {
      if (packetIds.has(id)) {
        throw new Error(`Research offer capture packet ${id} appears in more than one immutable source.`);
      }
      packetIds.add(id);
    }
    for (const capture of manifest.captures) {
      if (captureIds.has(capture.id) || evidencePaths.has(capture.evidencePath)) {
        throw new Error('Research offer capture projection contains duplicated evidence.');
      }
      captureIds.add(capture.id);
      evidencePaths.add(capture.evidencePath);
      captures.push(capture);
    }
    for (const caution of manifest.qualityCautions) {
      const key = `${caution.captureId}:${caution.kind}`;
      if (cautionKeys.has(key)) {
        throw new Error('Research offer capture projection contains a duplicated caution.');
      }
      cautionKeys.add(key);
      cautions.push(caution);
    }
    sources.push({
      sourcePath: `${researchOfferCaptureSourceDirectory}/${file.filename}`,
      sourceSha256: researchOfferDigest(file.bytes),
      researchPacketSourcePath:
        `${catalogueResearchPacketSourceDirectory}/${manifest.source.researchPacketsSha256}.json`,
      researchPacketSourceSha256: manifest.source.researchPacketsSha256,
      packetCount: manifest.selection.packetCount,
      packetIds: [...manifest.selection.packetIds],
      responseCount: manifest.selection.responseCount,
    });
  }

  if (!sources.length) {
    throw new Error('Research offer capture sources have no current packet-shard bindings.');
  }
  captures.sort((left, right) =>
    left.packetId.localeCompare(right.packetId)
    || left.retailer.localeCompare(right.retailer)
    || left.id.localeCompare(right.id));
  cautions.sort((left, right) =>
    left.captureId.localeCompare(right.captureId)
    || left.kind.localeCompare(right.kind));
  const generatedAt = [...input.captureSourceFiles]
    .map(file => file.value.generatedAt)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0]!;
  const projection: ResearchOfferCaptureProjection = {
    schemaVersion: researchOfferCaptureProjectionSchemaVersion,
    policy: researchOfferCapturePolicy,
    publicationStatus: researchOfferCapturePublicationStatus,
    publicationAuthority: researchOfferCapturePublicationAuthority,
    generatedAt,
    source: {
      researchPacketProjectionSha256: researchOfferDigest(input.packetProjectionBytes),
      discoverySnapshotSha256: input.discoverySnapshotSha256,
    },
    selection: {
      packetCount: packetIds.size,
      packetIds: sources.flatMap(source => source.packetIds),
      responseCount: captures.length,
    },
    sources,
    qualityCautions: cautions,
    captures,
  };
  return assertPrivateResearchOfferCaptureProjection(projection);
}

export function assertPrivateResearchOfferCaptureProjection(
  value: ResearchOfferCaptureProjection,
) {
  if (
    value.schemaVersion !== researchOfferCaptureProjectionSchemaVersion
    || value.policy !== researchOfferCapturePolicy
    || value.publicationStatus !== researchOfferCapturePublicationStatus
    || value.publicationAuthority !== researchOfferCapturePublicationAuthority
    || !Number.isFinite(Date.parse(value.generatedAt))
    || !digestPattern.test(value.source.researchPacketProjectionSha256)
    || !digestPattern.test(value.source.discoverySnapshotSha256)
    || !Array.isArray(value.sources)
    || value.sources.length < 1
    || !Array.isArray(value.captures)
    || !Array.isArray(value.qualityCautions)
    || value.selection.packetCount !== value.selection.packetIds.length
    || value.selection.responseCount !== value.captures.length
  ) throw new Error('Research offer capture projection is invalid or has publication authority.');
  const sourcePaths = new Set<string>();
  const sourcePacketIds = value.sources.flatMap(source => {
    if (
      !digestPattern.test(source.sourceSha256)
      || source.sourcePath !== `${researchOfferCaptureSourceDirectory}/${source.sourceSha256}.json`
      || !digestPattern.test(source.researchPacketSourceSha256)
      || source.researchPacketSourcePath
        !== `${catalogueResearchPacketSourceDirectory}/${source.researchPacketSourceSha256}.json`
      || source.packetCount < 1
      || source.packetCount > 12
      || source.packetIds.length !== source.packetCount
      || source.responseCount < source.packetCount
      || sourcePaths.has(source.sourcePath)
    ) throw new Error('Research offer capture projection source is invalid.');
    sourcePaths.add(source.sourcePath);
    return source.packetIds;
  });
  if (
    new Set(sourcePacketIds).size !== sourcePacketIds.length
    || JSON.stringify(sourcePacketIds) !== JSON.stringify(value.selection.packetIds)
  ) throw new Error('Research offer capture projection packet selection is duplicated or stale.');
  const captureIds = new Set(value.captures.map(capture => capture.id));
  if (
    captureIds.size !== value.captures.length
    || value.captures.some(capture => (
      capture.publicationAuthority !== researchOfferCapturePublicationAuthority
      || capture.publicationStatus !== researchOfferCapturePublicationStatus
      || !sourcePacketIds.includes(capture.packetId)
    ))
    || value.qualityCautions.some(caution => !captureIds.has(caution.captureId))
  ) throw new Error('Research offer capture projection evidence is invalid or publishable.');
  return value;
}

export async function writeResearchOfferCaptureProjectionAtomically(
  projection: ResearchOfferCaptureProjection,
  expectedProjectionSha256: string,
  repositoryRoot = process.cwd(),
) {
  assertPrivateResearchOfferCaptureProjection(projection);
  const projectionPath = path.resolve(repositoryRoot, researchOfferCaptureProjectionPath);
  const lockPath = path.join(path.dirname(projectionPath), '.research-offer-projection.lock');
  const temporary = `${projectionPath}.${process.pid}.${randomUUID()}.tmp`;
  let lock: Awaited<ReturnType<typeof open>> | undefined;
  try {
    await writeFile(temporary, `${JSON.stringify(projection, null, 2)}\n`, { flag: 'wx' });
    try {
      lock = await open(lockPath, 'wx');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new Error('Research offer compiler is already running; retry after it finishes.');
      }
      throw error;
    }
    const current = await readFile(projectionPath);
    if (researchOfferDigest(current) !== expectedProjectionSha256) {
      throw new Error('Research offer projection changed after compilation; rerun the dry-run.');
    }
    await rename(temporary, projectionPath);
  } finally {
    await unlink(temporary).catch(() => undefined);
    await lock?.close().catch(() => undefined);
    if (lock) await unlink(lockPath).catch(() => undefined);
  }
}

export function researchOfferCaptureSourceFile(manifest: ResearchOfferCaptureManifest) {
  assertPrivateResearchOfferCaptureManifest(manifest);
  const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return {
    filename: captureSourceFilename(bytes),
    bytes,
    value: manifest,
  } satisfies ResearchOfferCaptureSourceFile;
}

export const researchOfferCapturePacketProjectionPath = catalogueResearchPacketProjectionPath;
