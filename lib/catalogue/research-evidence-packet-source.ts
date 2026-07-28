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
import {
  assertPrivateResearchEvidencePacketManifest,
  buildStaticResearchEvidencePacketManifest,
  catalogueResearchEvidencePacketPolicy,
  catalogueResearchEvidencePacketPublicationStatus,
  maximumCatalogueResearchPacketBatch,
  type CatalogueResearchEvidencePacketManifest,
} from './research-evidence-packet';
import {
  catalogueResearchQueueDigest,
  type CatalogueResearchQueue,
} from './research-priority';
import type { CatalogueDiscoverySnapshot } from './discovery-screening';

export const catalogueResearchPacketProjectionSchemaVersion = 2 as const;
export const catalogueResearchPacketShardStrategy = 'queue-rank-contiguous-v1' as const;
export const catalogueResearchPacketSourceDirectory =
  'data/catalogue-research-evidence-packet-sources' as const;
export const catalogueResearchPacketProjectionPath =
  'data/catalogue-research-evidence-packets.json' as const;

const digestPattern = /^[0-9a-f]{64}$/;
const shortDigestPattern = /^[0-9a-f]{24}$/;

export type CatalogueResearchPacketSourceFile = {
  filename: string;
  bytes: Buffer;
  value: CatalogueResearchEvidencePacketManifest;
};

export type CatalogueResearchPacketShardProjection = {
  index: number;
  sourcePath: string;
  sourceSha256: string;
  packetCount: number;
  firstRank: number;
  lastRank: number;
  packetIds: string[];
  discoveryIds: string[];
};

export type CatalogueResearchEvidencePacketProjection = {
  schemaVersion: typeof catalogueResearchPacketProjectionSchemaVersion;
  policy: typeof catalogueResearchEvidencePacketPolicy;
  publicationStatus: typeof catalogueResearchEvidencePacketPublicationStatus;
  generatedAt: string;
  source: {
    staticQueueSha256: string;
    discoverySnapshotSha256: string;
  };
  sharding: {
    strategy: typeof catalogueResearchPacketShardStrategy;
    maximumPacketsPerShard: typeof maximumCatalogueResearchPacketBatch;
    packetCount: number;
    shardCount: number;
  };
  shards: CatalogueResearchPacketShardProjection[];
};

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function manifestBytes(value: CatalogueResearchEvidencePacketManifest) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sourceFilename(bytes: Buffer) {
  return `${sha256(bytes)}.json`;
}

function expectedShardCount(queue: CatalogueResearchQueue) {
  return Math.ceil(queue.items.length / maximumCatalogueResearchPacketBatch);
}

export function buildStaticResearchPacketShard(
  queue: CatalogueResearchQueue,
  snapshot: CatalogueDiscoverySnapshot,
  queueSha256: string,
  snapshotSha256: string,
  index: number,
) {
  const shardCount = expectedShardCount(queue);
  if (!Number.isSafeInteger(index) || index < 1 || index > shardCount) {
    throw new Error(`Research packet shard must be between 1 and ${shardCount}.`);
  }
  const offset = (index - 1) * maximumCatalogueResearchPacketBatch;
  const count = Math.min(maximumCatalogueResearchPacketBatch, queue.items.length - offset);
  return buildStaticResearchEvidencePacketManifest(
    queue,
    snapshot,
    queueSha256,
    snapshotSha256,
    { mode: 'batch', count, offset },
  );
}

export function staticResearchPacketShardForDiscoveryId(
  queue: CatalogueResearchQueue,
  discoveryId: string,
) {
  const offset = queue.items.findIndex(item => item.discoveryId === discoveryId);
  if (offset < 0) throw new Error(`Static research priority ${discoveryId} was not found.`);
  return Math.floor(offset / maximumCatalogueResearchPacketBatch) + 1;
}

export function expectedStaticResearchPacketSourceFiles(
  queue: CatalogueResearchQueue,
  snapshot: CatalogueDiscoverySnapshot,
  queueBytes: string | Buffer,
  snapshotBytes: string | Buffer,
) {
  const queueSha256 = catalogueResearchQueueDigest(queueBytes);
  const snapshotSha256 = catalogueResearchQueueDigest(snapshotBytes);
  return Array.from({ length: expectedShardCount(queue) }, (_, offset) => {
    const value = buildStaticResearchPacketShard(
      queue,
      snapshot,
      queueSha256,
      snapshotSha256,
      offset + 1,
    );
    const bytes = manifestBytes(value);
    return {
      filename: sourceFilename(bytes),
      bytes,
      value,
    } satisfies CatalogueResearchPacketSourceFile;
  });
}

export function compileStaticResearchPacketSources(
  queue: CatalogueResearchQueue,
  snapshot: CatalogueDiscoverySnapshot,
  queueBytes: string | Buffer,
  snapshotBytes: string | Buffer,
  files: readonly CatalogueResearchPacketSourceFile[],
): CatalogueResearchEvidencePacketProjection {
  const expected = expectedStaticResearchPacketSourceFiles(
    queue,
    snapshot,
    queueBytes,
    snapshotBytes,
  );
  if (files.length < expected.length) {
    throw new Error(
      `Research packet source set has ${files.length} shards; expected at least ${expected.length}.`,
    );
  }
  const actualByFilename = new Map<string, CatalogueResearchPacketSourceFile>();
  for (const file of files) {
    if (
      path.basename(file.filename) !== file.filename
      || !digestPattern.test(file.filename.replace(/\.json$/, ''))
      || file.filename !== sourceFilename(file.bytes)
    ) {
      throw new Error(`Research packet source filename is not content-addressed: ${file.filename}.`);
    }
    if (actualByFilename.has(file.filename)) {
      throw new Error(`Research packet source is duplicated: ${file.filename}.`);
    }
    assertPrivateResearchEvidencePacketManifest(file.value);
    if (JSON.stringify(file.value) !== JSON.stringify(JSON.parse(file.bytes.toString('utf8')))) {
      throw new Error(`Research packet source bytes do not match parsed value: ${file.filename}.`);
    }
    actualByFilename.set(file.filename, file);
  }

  const queueSha256 = catalogueResearchQueueDigest(queueBytes);
  const snapshotSha256 = catalogueResearchQueueDigest(snapshotBytes);
  const shards = expected.map((expectedFile, offset) => {
    const actual = actualByFilename.get(expectedFile.filename);
    if (!actual || !actual.bytes.equals(expectedFile.bytes)) {
      throw new Error(`Research packet shard ${offset + 1} is missing or stale.`);
    }
    const staticPackets = actual.value.packets.map(packet => {
      if (packet.source !== 'static-priority') {
        throw new Error(`Research packet shard ${offset + 1} is not static priority evidence.`);
      }
      return packet;
    });
    const ranks = staticPackets.map(packet => packet.research.rank);
    const descriptor: CatalogueResearchPacketShardProjection = {
      index: offset + 1,
      sourcePath: `${catalogueResearchPacketSourceDirectory}/${actual.filename}`,
      sourceSha256: sha256(actual.bytes),
      packetCount: staticPackets.length,
      firstRank: Math.min(...ranks),
      lastRank: Math.max(...ranks),
      packetIds: staticPackets.map(packet => packet.id),
      discoveryIds: staticPackets.map(packet => packet.productLead.discoveryId),
    };
    return descriptor;
  });

  const packetIds = shards.flatMap(shard => shard.packetIds);
  const discoveryIds = shards.flatMap(shard => shard.discoveryIds);
  if (
    packetIds.length !== queue.items.length
    || new Set(packetIds).size !== packetIds.length
    || new Set(discoveryIds).size !== discoveryIds.length
    || discoveryIds.some((id, index) => id !== queue.items[index]?.discoveryId)
  ) {
    throw new Error('Research packet shards do not form the exact ordered static priority projection.');
  }

  return {
    schemaVersion: catalogueResearchPacketProjectionSchemaVersion,
    policy: catalogueResearchEvidencePacketPolicy,
    publicationStatus: catalogueResearchEvidencePacketPublicationStatus,
    generatedAt: queue.generatedAt,
    source: {
      staticQueueSha256: queueSha256,
      discoverySnapshotSha256: snapshotSha256,
    },
    sharding: {
      strategy: catalogueResearchPacketShardStrategy,
      maximumPacketsPerShard: maximumCatalogueResearchPacketBatch,
      packetCount: packetIds.length,
      shardCount: shards.length,
    },
    shards,
  };
}

export function assertPrivateResearchEvidencePacketProjection(
  value: CatalogueResearchEvidencePacketProjection,
) {
  if (
    value.schemaVersion !== catalogueResearchPacketProjectionSchemaVersion
    || value.policy !== catalogueResearchEvidencePacketPolicy
    || value.publicationStatus !== catalogueResearchEvidencePacketPublicationStatus
    || !Number.isFinite(Date.parse(value.generatedAt))
    || !digestPattern.test(value.source.staticQueueSha256)
    || !digestPattern.test(value.source.discoverySnapshotSha256)
    || value.sharding.strategy !== catalogueResearchPacketShardStrategy
    || value.sharding.maximumPacketsPerShard !== maximumCatalogueResearchPacketBatch
    || !Number.isSafeInteger(value.sharding.packetCount)
    || value.sharding.packetCount < 1
    || !Number.isSafeInteger(value.sharding.shardCount)
    || value.sharding.shardCount !== value.shards.length
  ) throw new Error('Research packet projection is invalid or publishable.');

  const sourcePaths = new Set<string>();
  const packetIds = new Set<string>();
  const discoveryIds = new Set<string>();
  let expectedRank = 1;
  for (const [offset, shard] of value.shards.entries()) {
    if (
      shard.index !== offset + 1
      || shard.packetCount < 1
      || shard.packetCount > maximumCatalogueResearchPacketBatch
      || shard.firstRank !== expectedRank
      || shard.lastRank !== shard.firstRank + shard.packetCount - 1
      || !digestPattern.test(shard.sourceSha256)
      || shard.sourcePath !== `${catalogueResearchPacketSourceDirectory}/${shard.sourceSha256}.json`
      || shard.packetIds.length !== shard.packetCount
      || shard.discoveryIds.length !== shard.packetCount
      || sourcePaths.has(shard.sourcePath)
      || shard.packetIds.some(id => !shortDigestPattern.test(id) || packetIds.has(id))
      || shard.discoveryIds.some(id => !shortDigestPattern.test(id) || discoveryIds.has(id))
    ) throw new Error('Research packet projection shard is invalid or overlapping.');
    sourcePaths.add(shard.sourcePath);
    shard.packetIds.forEach(id => packetIds.add(id));
    shard.discoveryIds.forEach(id => discoveryIds.add(id));
    expectedRank = shard.lastRank + 1;
  }
  if (packetIds.size !== value.sharding.packetCount) {
    throw new Error('Research packet projection count does not match its shards.');
  }
  return value;
}

export async function readStaticResearchPacketSourceFiles(
  repositoryRoot = process.cwd(),
): Promise<CatalogueResearchPacketSourceFile[]> {
  const sourceRoot = path.resolve(repositoryRoot, catalogueResearchPacketSourceDirectory);
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  const unsupported = entries.filter(entry => !entry.isFile() || !entry.name.endsWith('.json'));
  if (unsupported.length) {
    throw new Error(`Research packet source directory contains unsupported entries: ${
      unsupported.map(entry => entry.name).sort().join(', ')
    }.`);
  }
  return Promise.all(entries.map(entry => entry.name).sort().map(async filename => {
    const bytes = await readFile(path.join(sourceRoot, filename));
    return {
      filename,
      bytes,
      value: JSON.parse(bytes.toString('utf8')) as CatalogueResearchEvidencePacketManifest,
    };
  }));
}

export async function readStaticResearchPacketShard(
  repositoryRoot: string,
  descriptor: CatalogueResearchPacketShardProjection,
) {
  const filename = path.resolve(repositoryRoot, descriptor.sourcePath);
  const bytes = await readFile(filename);
  if (sha256(bytes) !== descriptor.sourceSha256) {
    throw new Error(`Research packet shard ${descriptor.index} does not match its projection digest.`);
  }
  const value = JSON.parse(bytes.toString('utf8')) as CatalogueResearchEvidencePacketManifest;
  assertPrivateResearchEvidencePacketManifest(value);
  if (
    value.packets.length !== descriptor.packetCount
    || JSON.stringify(value.packets.map(packet => packet.id)) !== JSON.stringify(descriptor.packetIds)
  ) throw new Error(`Research packet shard ${descriptor.index} does not match its projection.`);
  return { bytes, value };
}

export async function writeStaticResearchPacketSourceImmutably(
  file: CatalogueResearchPacketSourceFile,
  repositoryRoot = process.cwd(),
) {
  if (file.filename !== sourceFilename(file.bytes)) {
    throw new Error('Research packet source is not content-addressed.');
  }
  const sourceRoot = path.resolve(repositoryRoot, catalogueResearchPacketSourceDirectory);
  await mkdir(sourceRoot, { recursive: true });
  const sourcePath = path.join(sourceRoot, file.filename);
  const temporary = path.join(
    path.dirname(sourceRoot),
    `.research-packet-source.${process.pid}.${randomUUID()}.tmp`,
  );
  await writeFile(temporary, file.bytes, { flag: 'wx' });
  try {
    await link(temporary, sourcePath);
    return { created: true as const, sourcePath };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const existing = await readFile(sourcePath);
    if (!existing.equals(file.bytes)) {
      throw new Error(`Research packet source ${file.filename} is immutable and differs.`);
    }
    return { created: false as const, sourcePath };
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}

export async function writeStaticResearchPacketProjectionAtomically(
  projection: CatalogueResearchEvidencePacketProjection,
  expectedProjectionSha256: string,
  repositoryRoot = process.cwd(),
) {
  assertPrivateResearchEvidencePacketProjection(projection);
  const projectionPath = path.resolve(repositoryRoot, catalogueResearchPacketProjectionPath);
  const lockPath = path.join(path.dirname(projectionPath), '.research-packet-projection.lock');
  const temporary = `${projectionPath}.${process.pid}.${randomUUID()}.tmp`;
  let lock: Awaited<ReturnType<typeof open>> | undefined;
  try {
    await writeFile(temporary, `${JSON.stringify(projection, null, 2)}\n`, { flag: 'wx' });
    try {
      lock = await open(lockPath, 'wx');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new Error('Research packet compiler is already running; retry after it finishes.');
      }
      throw error;
    }
    const current = await readFile(projectionPath);
    if (sha256(current) !== expectedProjectionSha256) {
      throw new Error('Research packet projection changed after compilation; rerun the dry-run.');
    }
    await rename(temporary, projectionPath);
  } finally {
    await unlink(temporary).catch(() => undefined);
    await lock?.close().catch(() => undefined);
    if (lock) await unlink(lockPath).catch(() => undefined);
  }
}

export function researchPacketSourceDigest(value: string | Buffer) {
  return sha256(value);
}
