import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assertResearchOfferCaptureManifestMatchesPlan,
  buildResearchOfferCaptureManifest,
  buildResearchOfferCapturePlan,
  captureResearchOfferResponse,
  maximumResearchOfferCapturePackets,
  researchOfferDigest,
  verifyResearchOfferCaptureBundle,
  writeResearchOfferCaptureBundle,
  type CapturedResearchOfferResponse,
  type ResearchOfferCapturePlanItem,
  type ResearchOfferQualityCaution,
} from '@/lib/catalogue/research-offer-capture';
import {
  assertPrivateResearchEvidencePacketProjection,
  catalogueResearchPacketProjectionPath,
  compileStaticResearchPacketSources,
  readStaticResearchPacketShard,
  readStaticResearchPacketSourceFiles,
  staticResearchPacketShardForDiscoveryId,
  type CatalogueResearchEvidencePacketProjection,
} from '@/lib/catalogue/research-evidence-packet-source';
import {
  assertPrivateResearchOfferCaptureProjection,
  compileResearchOfferCaptureSources,
  readResearchOfferCaptureSourceFiles,
  researchOfferCaptureProjectionPath,
  researchOfferCaptureSourceDirectory,
  researchOfferCaptureSourceFile,
  writeResearchOfferCaptureProjectionAtomically,
  type ResearchOfferCaptureProjection,
} from '@/lib/catalogue/research-offer-capture-source';
import {
  auditCatalogueDiscoverySnapshot,
  type CatalogueDiscoverySnapshot,
} from '@/lib/catalogue/discovery-screening';
import researchQueue from '@/data/catalogue-research-queue.json';
import type { CatalogueResearchQueue } from '@/lib/catalogue/research-priority';

const repositoryRoot = process.cwd();
const packetProjectionPath = path.join(repositoryRoot, catalogueResearchPacketProjectionPath);
const snapshotPath = path.join(repositoryRoot, 'data/catalogue-discovery-screening.json');
const queuePath = path.join(repositoryRoot, 'data/catalogue-research-queue.json');
const offerProjectionPath = path.join(repositoryRoot, researchOfferCaptureProjectionPath);
const requestTimeoutMs = 20_000;
const fetchConcurrency = 3;

function option(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (index < 0) return undefined;
  if (!value || value.startsWith('--')) throw new Error(`Missing --${name}.`);
  return value;
}

function batchCount(value: string | undefined, available: number) {
  if (value == null) return available;
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 1 || count > maximumResearchOfferCapturePackets) {
    throw new Error(`--batch must be between 1 and ${maximumResearchOfferCapturePackets}.`);
  }
  if (count > available) throw new Error('--batch exceeds the selected research packet shard.');
  return count;
}

function help() {
  console.log(`Capture exact retailer offer response bytes from one immutable research packet shard.

Dry run (default; fetches and validates but writes nothing):
  npm run catalogue:research:offers -- --shard <index> [--batch <1-${maximumResearchOfferCapturePackets}>]
  npm run catalogue:research:offers -- --static <discovery-id>

Retain exact response bytes and compile the private, non-publishable projection:
  npm run catalogue:research:offers -- --shard <index> --batch <1-${maximumResearchOfferCapturePackets}> --write
  npm run catalogue:research:offers -- --static <discovery-id> --write

Verify every immutable capture source and exact byte file without network requests:
  npm run catalogue:research:offers -- --verify
`);
}

async function loadInputs() {
  const [packetProjectionBytes, snapshotBytes, queueBytes, packetSourceFiles] = await Promise.all([
    readFile(packetProjectionPath),
    readFile(snapshotPath),
    readFile(queuePath),
    readStaticResearchPacketSourceFiles(repositoryRoot),
  ]);
  const packetProjection = JSON.parse(
    packetProjectionBytes.toString('utf8'),
  ) as CatalogueResearchEvidencePacketProjection;
  const snapshot = JSON.parse(snapshotBytes.toString('utf8')) as CatalogueDiscoverySnapshot;
  assertPrivateResearchEvidencePacketProjection(packetProjection);
  auditCatalogueDiscoverySnapshot(snapshot);
  const expectedPacketProjection = compileStaticResearchPacketSources(
    researchQueue as CatalogueResearchQueue,
    snapshot,
    queueBytes,
    snapshotBytes,
    packetSourceFiles,
  );
  if (JSON.stringify(packetProjection) !== JSON.stringify(expectedPacketProjection)) {
    throw new Error('Checked-in research packet projection is stale against its immutable sources.');
  }
  const snapshotSha256 = researchOfferDigest(snapshotBytes);
  if (packetProjection.source.discoverySnapshotSha256 !== snapshotSha256) {
    throw new Error('Checked-in research packet projection is not bound to current discovery bytes.');
  }
  return {
    packetProjectionBytes,
    packetProjection,
    packetSourceFiles,
    snapshot,
    snapshotSha256,
  };
}

function selectedShard(
  projection: CatalogueResearchEvidencePacketProjection,
) {
  const shardOption = option('shard');
  const discoveryId = option('static');
  if (shardOption && discoveryId) throw new Error('--shard and --static are mutually exclusive.');
  const index = discoveryId
    ? staticResearchPacketShardForDiscoveryId(
      researchQueue as CatalogueResearchQueue,
      discoveryId,
    )
    : Number(shardOption ?? 1);
  if (!Number.isSafeInteger(index) || index < 1 || index > projection.shards.length) {
    throw new Error(`--shard must be between 1 and ${projection.shards.length}.`);
  }
  return { descriptor: projection.shards[index - 1]!, discoveryId };
}

async function captureOne(item: ResearchOfferCapturePlanItem) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await captureResearchOfferResponse(item, {
      fetchImpl: (input, init) => fetch(input, { ...init, signal: controller.signal }),
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function concurrentCapture(plan: ResearchOfferCapturePlanItem[]) {
  const captured = new Array<CapturedResearchOfferResponse>(plan.length);
  let cursor = 0;
  async function worker() {
    while (cursor < plan.length) {
      const index = cursor;
      cursor += 1;
      captured[index] = await captureOne(plan[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(fetchConcurrency, plan.length) }, worker));
  return captured;
}

async function compileStored(input: Awaited<ReturnType<typeof loadInputs>>) {
  const captureSourceFiles = await readResearchOfferCaptureSourceFiles(repositoryRoot);
  return compileResearchOfferCaptureSources({
    repositoryRoot,
    packetProjection: input.packetProjection,
    packetProjectionBytes: input.packetProjectionBytes,
    packetSourceFiles: input.packetSourceFiles,
    captureSourceFiles,
    snapshot: input.snapshot,
    discoverySnapshotSha256: input.snapshotSha256,
  });
}

async function verifyStored(input: Awaited<ReturnType<typeof loadInputs>>) {
  const projectionStats = await lstat(offerProjectionPath);
  if (!projectionStats.isFile() || projectionStats.isSymbolicLink()) {
    throw new Error('Retained offer projection is not a regular checked-in file.');
  }
  const projectionBytes = await readFile(offerProjectionPath);
  const stored = JSON.parse(
    projectionBytes.toString('utf8'),
  ) as ResearchOfferCaptureProjection;
  assertPrivateResearchOfferCaptureProjection(stored);
  const expected = await compileStored(input);
  if (JSON.stringify(stored) !== JSON.stringify(expected)) {
    throw new Error('Retained offer projection is stale against its immutable capture sources.');
  }
  const currentSourceNames = new Set(expected.sources.map(source =>
    path.basename(source.sourcePath)));
  const sourceFiles = (await readResearchOfferCaptureSourceFiles(repositoryRoot))
    .filter(file => currentSourceNames.has(file.filename));
  let packetCount = 0;
  let responseCount = 0;
  for (const file of sourceFiles) {
    const packetDescriptor = input.packetProjection.shards.find(shard =>
      shard.sourceSha256 === file.value.source.researchPacketsSha256);
    if (!packetDescriptor) {
      throw new Error(`Retained offer source ${file.filename} has no current packet shard.`);
    }
    assertResearchOfferCaptureManifestMatchesPlan(
      file.value,
      buildResearchOfferCapturePlan(
        (await readStaticResearchPacketShard(
          repositoryRoot,
          packetDescriptor,
        )).value,
        input.snapshot,
        file.value.selection.packetIds,
      ),
    );
    const verified = await verifyResearchOfferCaptureBundle(repositoryRoot, file.value);
    packetCount += verified.packetCount;
    responseCount += verified.responseCount;
  }
  return { packetCount, responseCount, sourceCount: sourceFiles.length };
}

async function retainedQualityCautions(
  captured: CapturedResearchOfferResponse[],
): Promise<ResearchOfferQualityCaution[]> {
  const stored = JSON.parse(
    await readFile(offerProjectionPath, 'utf8'),
  ) as ResearchOfferCaptureProjection;
  assertPrivateResearchOfferCaptureProjection(stored);
  const currentById = new Map(captured.map(item => [
    item.record.id,
    item.record.source.responseSha256,
  ]));
  return stored.qualityCautions.filter(caution =>
    currentById.get(caution.captureId) === caution.responseSha256);
}

async function main() {
  if (process.argv.includes('--help')) return help();
  const write = process.argv.includes('--write');
  const verify = process.argv.includes('--verify');
  if (write && verify) throw new Error('--write and --verify are mutually exclusive.');
  if (verify && (option('batch') || option('shard') || option('static'))) {
    throw new Error('--batch, --shard and --static cannot be combined with --verify.');
  }

  const input = await loadInputs();
  if (verify) {
    const result = await verifyStored(input);
    console.log(JSON.stringify({
      mode: 'verify',
      policy: 'private-retained-offer-source-evidence-only',
      publicationAuthority: 'none',
      ...result,
      projection: researchOfferCaptureProjectionPath,
    }, null, 2));
    return;
  }

  const { descriptor, discoveryId } = selectedShard(input.packetProjection);
  const packetSource = await readStaticResearchPacketShard(repositoryRoot, descriptor);
  let packetIds: string[];
  if (discoveryId) {
    if (option('batch')) throw new Error('--batch cannot be combined with --static.');
    const packet = packetSource.value.packets.find(candidate =>
      candidate.source === 'static-priority'
      && candidate.productLead.discoveryId === discoveryId);
    if (!packet) throw new Error(`Static packet ${discoveryId} is absent from its deterministic shard.`);
    packetIds = [packet.id];
  } else {
    const count = batchCount(option('batch'), packetSource.value.packets.length);
    packetIds = packetSource.value.packets.slice(0, count).map(packet => packet.id);
  }
  const plan = buildResearchOfferCapturePlan(
    packetSource.value,
    input.snapshot,
    packetIds,
  );
  const captured = await concurrentCapture(plan);
  const qualityCautions = write ? await retainedQualityCautions(captured) : [];
  const manifest = buildResearchOfferCaptureManifest({
    researchPacketsSha256: descriptor.sourceSha256,
    discoverySnapshotSha256: input.snapshotSha256,
    packetIds,
    captured,
    qualityCautions,
  });

  let sourcePath: string | null = null;
  let projectionChanged = false;
  if (write) {
    const sourceFile = researchOfferCaptureSourceFile(manifest);
    sourcePath = `${researchOfferCaptureSourceDirectory}/${sourceFile.filename}`;
    await writeResearchOfferCaptureBundle(
      repositoryRoot,
      manifest,
      captured,
      sourcePath,
    );
    const currentProjectionBytes = await readFile(offerProjectionPath);
    const projection = await compileStored(input);
    projectionChanged = JSON.stringify(JSON.parse(currentProjectionBytes.toString('utf8')))
      !== JSON.stringify(projection);
    if (projectionChanged) {
      await writeResearchOfferCaptureProjectionAtomically(
        projection,
        researchOfferDigest(currentProjectionBytes),
        repositoryRoot,
      );
    }
  }

  console.log(JSON.stringify({
    mode: write ? 'write' : 'dry-run',
    policy: manifest.policy,
    publicationAuthority: manifest.publicationAuthority,
    shard: descriptor.index,
    packetCount: manifest.selection.packetCount,
    responseCount: manifest.selection.responseCount,
    evidencePaths: manifest.captures.map(capture => capture.evidencePath),
    immutableSource: sourcePath,
    projectionChanged,
    projection: write ? researchOfferCaptureProjectionPath : null,
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
