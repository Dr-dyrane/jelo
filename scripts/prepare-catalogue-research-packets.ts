import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import discoverySnapshot from '@/data/catalogue-discovery-screening.json';
import researchQueue from '@/data/catalogue-research-queue.json';
import {
  assertPrivateResearchEvidencePacketManifest,
  buildCommunityResearchEvidencePacketManifest,
  buildStaticResearchEvidencePacketManifest,
  maximumCatalogueResearchPacketBatch,
  type CatalogueResearchEvidencePacketManifest,
  type CommunityAggregateResearchReport,
  type CommunityResearchPacketRequest,
} from '@/lib/catalogue/research-evidence-packet';
import { catalogueResearchQueueDigest, type CatalogueResearchQueue } from '@/lib/catalogue/research-priority';
import type { CatalogueDiscoverySnapshot } from '@/lib/catalogue/discovery-screening';
import {
  catalogueResearchPacketProjectionPath,
  compileStaticResearchPacketSources,
  expectedStaticResearchPacketSourceFiles,
  readStaticResearchPacketSourceFiles,
  researchPacketSourceDigest,
  staticResearchPacketShardForDiscoveryId,
  writeStaticResearchPacketProjectionAtomically,
  writeStaticResearchPacketSourceImmutably,
} from '@/lib/catalogue/research-evidence-packet-source';

const repositoryRoot = process.cwd();
const staticProjectionPath = path.join(repositoryRoot, catalogueResearchPacketProjectionPath);

function option(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (index < 0) return undefined;
  if (!value || value.startsWith('--')) throw new Error(`Missing --${name}.`);
  return value;
}

function positiveCount(value: string | undefined) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 1 || count > maximumCatalogueResearchPacketBatch) {
    throw new Error(`--batch must be an integer between 1 and ${maximumCatalogueResearchPacketBatch}.`);
  }
  return count;
}

function help() {
  console.log(`Prepare immutable private research packet shards. This never writes intake, dossier, release, or public catalogue files.

Static priority:
  npm run catalogue:research:packets -- --static <discovery-id>
  npm run catalogue:research:packets -- --shard <positive-index> [--write]

Each deterministic shard contains at most ${maximumCatalogueResearchPacketBatch} queue priorities.
--write creates its content-addressed source and recompiles the checked-in projection.

Community aggregate report (no contributor identifiers are retained):
  npm run catalogue:research:packets -- --community-report <report.json> --community-label <label>
  npm run catalogue:research:packets -- --community-report <report.json> --batch <1-${maximumCatalogueResearchPacketBatch}> --write --out .cache/community-packets.json
`);
}

function communityRequest(): CommunityResearchPacketRequest {
  const label = option('community-label');
  const batch = option('batch');
  if (Boolean(label) === Boolean(batch)) throw new Error('Provide exactly one of --community-label or --batch.');
  return label ? { mode: 'single', label } : { mode: 'batch', count: positiveCount(batch) };
}

async function writeAtomically(filename: string, value: unknown) {
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, filename);
}

function ensureWritableCommunityOutput(filename: string) {
  const resolved = path.resolve(repositoryRoot, filename);
  const cacheRoot = path.join(repositoryRoot, '.cache');
  if (!resolved.startsWith(`${cacheRoot}${path.sep}`)) {
    throw new Error('Community aggregate packets may be written only below .cache and are never checked in.');
  }
  return resolved;
}

async function staticInputs() {
  const [snapshotBytes, queueBytes] = await Promise.all([
    readFile(path.join(repositoryRoot, 'data/catalogue-discovery-screening.json')),
    readFile(path.join(repositoryRoot, 'data/catalogue-research-queue.json')),
  ]);
  return { snapshotBytes, queueBytes };
}

function positiveShard(value: string | undefined, shardCount: number) {
  const index = Number(value);
  if (!Number.isSafeInteger(index) || index < 1 || index > shardCount) {
    throw new Error(`--shard must be an integer between 1 and ${shardCount}.`);
  }
  return index;
}

async function prepareStatic(write: boolean) {
  if (option('out')) throw new Error('--out is available only for community aggregate packets.');
  const { snapshotBytes, queueBytes } = await staticInputs();
  const queue = researchQueue as CatalogueResearchQueue;
  const snapshot = discoverySnapshot as CatalogueDiscoverySnapshot;
  const expectedSources = expectedStaticResearchPacketSourceFiles(
    queue,
    snapshot,
    queueBytes,
    snapshotBytes,
  );
  const discoveryId = option('static');
  const shardOption = option('shard');
  const legacyBatch = option('batch');
  if ([discoveryId, shardOption, legacyBatch].filter(Boolean).length !== 1) {
    throw new Error('Provide exactly one of --static, --shard, or --batch.');
  }
  let shardIndex: number;
  let prepared: CatalogueResearchEvidencePacketManifest;
  if (discoveryId) {
    shardIndex = staticResearchPacketShardForDiscoveryId(queue, discoveryId);
    prepared = buildStaticResearchEvidencePacketManifest(
      queue,
      snapshot,
      catalogueResearchQueueDigest(queueBytes),
      catalogueResearchQueueDigest(snapshotBytes),
      { mode: 'single', discoveryId },
    );
  } else if (shardOption) {
    shardIndex = positiveShard(shardOption, expectedSources.length);
    prepared = expectedSources[shardIndex - 1]!.value;
  } else {
    const count = positiveCount(legacyBatch);
    shardIndex = 1;
    if (write && count !== expectedSources[0]!.value.packets.length) {
      throw new Error(
        `A durable static source is a complete deterministic shard; use --shard 1 (currently ${expectedSources[0]!.value.packets.length} packets).`,
      );
    }
    prepared = buildStaticResearchEvidencePacketManifest(
      queue,
      snapshot,
      catalogueResearchQueueDigest(queueBytes),
      catalogueResearchQueueDigest(snapshotBytes),
      { mode: 'batch', count },
    );
  }
  assertPrivateResearchEvidencePacketManifest(prepared);

  let sourceCreated = false;
  let projectionChanged = false;
  if (write) {
    const selectedSource = expectedSources[shardIndex - 1]!;
    sourceCreated = (await writeStaticResearchPacketSourceImmutably(
      selectedSource,
      repositoryRoot,
    )).created;
    const sourceFiles = await readStaticResearchPacketSourceFiles(repositoryRoot);
    const projection = compileStaticResearchPacketSources(
      queue,
      snapshot,
      queueBytes,
      snapshotBytes,
      sourceFiles,
    );
    const currentBytes = await readFile(staticProjectionPath);
    projectionChanged = JSON.stringify(JSON.parse(currentBytes.toString('utf8')))
      !== JSON.stringify(projection);
    if (projectionChanged) {
      await writeStaticResearchPacketProjectionAtomically(
        projection,
        researchPacketSourceDigest(currentBytes),
        repositoryRoot,
      );
    }
  }
  return {
    prepared,
    shardIndex,
    sourceCreated,
    projectionChanged,
    sourcePath: expectedSources[shardIndex - 1]
      ? `data/catalogue-research-evidence-packet-sources/${expectedSources[shardIndex - 1]!.filename}`
      : null,
  };
}

async function main() {
  if (process.argv.includes('--help')) return help();
  const communityReportPath = option('community-report');
  const write = process.argv.includes('--write');
  let prepared: CatalogueResearchEvidencePacketManifest;
  let staticResult: Awaited<ReturnType<typeof prepareStatic>> | undefined;
  if (communityReportPath) {
    if (option('static') || option('shard')) {
      throw new Error('--static and --shard cannot be combined with --community-report.');
    }
    const rawReport = await readFile(path.resolve(repositoryRoot, communityReportPath));
    const report = JSON.parse(rawReport.toString('utf8')) as CommunityAggregateResearchReport;
    prepared = buildCommunityResearchEvidencePacketManifest(report, rawReport, communityRequest());
  } else {
    staticResult = await prepareStatic(write);
    prepared = staticResult.prepared;
  }
  assertPrivateResearchEvidencePacketManifest(prepared);

  if (write && communityReportPath) {
    const output = ensureWritableCommunityOutput(option('out') ?? '');
    await writeAtomically(output, prepared);
  }

  console.log(JSON.stringify({
    policy: prepared.policy,
    publicationStatus: prepared.publicationStatus,
    source: prepared.selection.source,
    packetCount: prepared.packets.length,
    packetIds: prepared.packets.map(packet => packet.id),
    shard: staticResult?.shardIndex ?? null,
    immutableSource: write ? staticResult?.sourcePath ?? null : null,
    sourceCreated: staticResult?.sourceCreated ?? false,
    projectionChanged: staticResult?.projectionChanged ?? false,
    output: write ? (communityReportPath ? option('out') : catalogueResearchPacketProjectionPath) : null,
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
