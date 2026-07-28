import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assertPrivateResearchOfferCaptureManifest,
  assertResearchOfferCaptureManifestMatchesPlan,
  buildResearchOfferCaptureManifest,
  buildResearchOfferCapturePlan,
  captureResearchOfferResponse,
  maximumResearchOfferCapturePackets,
  researchOfferCaptureManifestPath,
  researchOfferDigest,
  verifyResearchOfferCaptureBundle,
  writeResearchOfferCaptureBundle,
  type CapturedResearchOfferResponse,
  type ResearchOfferCaptureManifest,
  type ResearchOfferCapturePlanItem,
} from '@/lib/catalogue/research-offer-capture';
import {
  assertPrivateResearchEvidencePacketManifest,
  type CatalogueResearchEvidencePacketManifest,
} from '@/lib/catalogue/research-evidence-packet';
import {
  auditCatalogueDiscoverySnapshot,
  type CatalogueDiscoverySnapshot,
} from '@/lib/catalogue/discovery-screening';

const repositoryRoot = process.cwd();
const packetPath = path.join(repositoryRoot, 'data/catalogue-research-evidence-packets.json');
const snapshotPath = path.join(repositoryRoot, 'data/catalogue-discovery-screening.json');
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
  if (value == null) return Math.min(available, maximumResearchOfferCapturePackets);
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 1 || count > maximumResearchOfferCapturePackets) {
    throw new Error(`--batch must be between 1 and ${maximumResearchOfferCapturePackets}.`);
  }
  if (count > available) throw new Error('--batch exceeds the checked-in research packet count.');
  return count;
}

function help() {
  console.log(`Capture exact retailer offer response bytes for checked-in private research packets.

Dry run (default; fetches and validates but writes nothing):
  npm run catalogue:research:offers -- [--batch <1-${maximumResearchOfferCapturePackets}>]

Retain exact response bytes and the private, non-publishable capture manifest:
  npm run catalogue:research:offers -- --batch <1-${maximumResearchOfferCapturePackets}> --write

Verify checked-in retained bytes without making network requests:
  npm run catalogue:research:offers -- --verify
`);
}

async function loadInputs() {
  const [packetBytes, snapshotBytes] = await Promise.all([
    readFile(packetPath),
    readFile(snapshotPath),
  ]);
  const packets = JSON.parse(packetBytes.toString('utf8')) as CatalogueResearchEvidencePacketManifest;
  const snapshot = JSON.parse(snapshotBytes.toString('utf8')) as CatalogueDiscoverySnapshot;
  assertPrivateResearchEvidencePacketManifest(packets);
  auditCatalogueDiscoverySnapshot(snapshot);
  const snapshotSha256 = researchOfferDigest(snapshotBytes);
  if (packets.source.discoverySnapshotSha256 !== snapshotSha256) {
    throw new Error('Checked-in research packets are not bound to the current discovery snapshot bytes.');
  }
  return {
    packetBytes,
    snapshotBytes,
    packets,
    snapshot,
    packetSha256: researchOfferDigest(packetBytes),
    snapshotSha256,
  };
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
      captured[index] = await captureOne(plan[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(fetchConcurrency, plan.length) }, worker));
  return captured;
}

async function verifyStored(input: Awaited<ReturnType<typeof loadInputs>>) {
  const manifestFilename = path.join(repositoryRoot, researchOfferCaptureManifestPath);
  const manifestStats = await lstat(manifestFilename);
  if (!manifestStats.isFile() || manifestStats.isSymbolicLink()) {
    throw new Error('Retained offer manifest is not a regular checked-in file.');
  }
  const manifestBytes = await readFile(manifestFilename);
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as ResearchOfferCaptureManifest;
  assertPrivateResearchOfferCaptureManifest(manifest);
  if (
    manifest.source.researchPacketsSha256 !== input.packetSha256
    || manifest.source.discoverySnapshotSha256 !== input.snapshotSha256
  ) throw new Error('Retained offer manifest is stale against its checked-in private sources.');
  const availablePacketIds = new Set(input.packets.packets.map(packet => packet.id));
  if (manifest.selection.packetIds.some(id => !availablePacketIds.has(id))) {
    throw new Error('Retained offer manifest references a packet outside the checked-in selection.');
  }
  const expectedPacketIds = input.packets.packets
    .slice(0, manifest.selection.packetCount)
    .map(packet => packet.id);
  if (
    JSON.stringify(manifest.selection.packetIds)
    !== JSON.stringify(expectedPacketIds)
  ) {
    throw new Error('Retained offer manifest is not the exact checked-in packet prefix.');
  }
  const plan = buildResearchOfferCapturePlan(
    input.packets,
    input.snapshot,
    manifest.selection.packetCount,
  );
  assertResearchOfferCaptureManifestMatchesPlan(manifest, plan);
  return verifyResearchOfferCaptureBundle(repositoryRoot, manifest);
}

async function main() {
  if (process.argv.includes('--help')) return help();
  const write = process.argv.includes('--write');
  const verify = process.argv.includes('--verify');
  if (write && verify) throw new Error('--write and --verify are mutually exclusive.');
  if (verify && option('batch')) throw new Error('--batch cannot be combined with --verify.');

  const input = await loadInputs();
  if (verify) {
    const result = await verifyStored(input);
    console.log(JSON.stringify({
      mode: 'verify',
      policy: 'private-retained-offer-source-evidence-only',
      publicationAuthority: 'none',
      ...result,
      manifest: researchOfferCaptureManifestPath,
    }, null, 2));
    return;
  }

  const count = batchCount(option('batch'), input.packets.packets.length);
  const plan = buildResearchOfferCapturePlan(input.packets, input.snapshot, count);
  const captured = await concurrentCapture(plan);
  const packetIds = input.packets.packets.slice(0, count).map(packet => packet.id);
  const manifest = buildResearchOfferCaptureManifest({
    researchPacketsSha256: input.packetSha256,
    discoverySnapshotSha256: input.snapshotSha256,
    packetIds,
    captured,
  });
  if (write) await writeResearchOfferCaptureBundle(repositoryRoot, manifest, captured);

  console.log(JSON.stringify({
    mode: write ? 'write' : 'dry-run',
    policy: manifest.policy,
    publicationAuthority: manifest.publicationAuthority,
    packetCount: manifest.selection.packetCount,
    responseCount: manifest.selection.responseCount,
    evidencePaths: manifest.captures.map(capture => capture.evidencePath),
    manifest: write ? researchOfferCaptureManifestPath : null,
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
