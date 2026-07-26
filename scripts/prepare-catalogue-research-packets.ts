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
  type StaticResearchPacketRequest,
} from '@/lib/catalogue/research-evidence-packet';
import { catalogueResearchQueueDigest, type CatalogueResearchQueue } from '@/lib/catalogue/research-priority';
import type { CatalogueDiscoverySnapshot } from '@/lib/catalogue/discovery-screening';

const repositoryRoot = process.cwd();
const staticManifestPath = path.join(repositoryRoot, 'data/catalogue-research-evidence-packets.json');

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
  console.log(`Prepare a private research evidence packet. This never writes intake, dossier, release, or public catalogue files.

Static priority:
  npm run catalogue:research:packets -- --static <discovery-id>
  npm run catalogue:research:packets -- --batch <1-${maximumCatalogueResearchPacketBatch}> [--write]

Community aggregate report (no contributor identifiers are retained):
  npm run catalogue:research:packets -- --community-report <report.json> --community-label <label>
  npm run catalogue:research:packets -- --community-report <report.json> --batch <1-${maximumCatalogueResearchPacketBatch}> --write --out .cache/community-packets.json
`);
}

function staticRequest(): StaticResearchPacketRequest {
  const discoveryId = option('static');
  const batch = option('batch');
  if (Boolean(discoveryId) === Boolean(batch)) throw new Error('Provide exactly one of --static or --batch.');
  return discoveryId ? { mode: 'single', discoveryId } : { mode: 'batch', count: positiveCount(batch) };
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

function ensureWritableOutput(filename: string, community: boolean) {
  const resolved = path.resolve(repositoryRoot, filename);
  if (community) {
    const cacheRoot = path.join(repositoryRoot, '.cache');
    if (!resolved.startsWith(`${cacheRoot}${path.sep}`)) {
      throw new Error('Community aggregate packets may be written only below .cache and are never checked in.');
    }
    return resolved;
  }
  if (resolved !== staticManifestPath) {
    throw new Error('Static packet output is fixed to data/catalogue-research-evidence-packets.json.');
  }
  return resolved;
}

async function staticManifest(request: StaticResearchPacketRequest) {
  const [snapshotBytes, queueBytes] = await Promise.all([
    readFile(path.join(repositoryRoot, 'data/catalogue-discovery-screening.json')),
    readFile(path.join(repositoryRoot, 'data/catalogue-research-queue.json')),
  ]);
  return buildStaticResearchEvidencePacketManifest(
    researchQueue as CatalogueResearchQueue,
    discoverySnapshot as CatalogueDiscoverySnapshot,
    catalogueResearchQueueDigest(queueBytes),
    catalogueResearchQueueDigest(snapshotBytes),
    request,
  );
}

async function main() {
  if (process.argv.includes('--help')) return help();
  const communityReportPath = option('community-report');
  const write = process.argv.includes('--write');
  let prepared: CatalogueResearchEvidencePacketManifest;
  if (communityReportPath) {
    if (option('static')) throw new Error('--static cannot be combined with --community-report.');
    const rawReport = await readFile(path.resolve(repositoryRoot, communityReportPath));
    const report = JSON.parse(rawReport.toString('utf8')) as CommunityAggregateResearchReport;
    prepared = buildCommunityResearchEvidencePacketManifest(report, rawReport, communityRequest());
  } else {
    prepared = await staticManifest(staticRequest());
  }
  assertPrivateResearchEvidencePacketManifest(prepared);

  if (write) {
    const output = ensureWritableOutput(
      option('out') ?? (communityReportPath ? '' : path.relative(repositoryRoot, staticManifestPath)),
      Boolean(communityReportPath),
    );
    await writeAtomically(output, prepared);
  }

  console.log(JSON.stringify({
    policy: prepared.policy,
    publicationStatus: prepared.publicationStatus,
    source: prepared.selection.source,
    packetCount: prepared.packets.length,
    packetIds: prepared.packets.map(packet => packet.id),
    output: write ? (communityReportPath ? option('out') : path.relative(repositoryRoot, staticManifestPath)) : null,
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
