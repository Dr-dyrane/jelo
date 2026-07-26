import { readFile } from 'node:fs/promises';
import path from 'node:path';
import discoverySnapshot from '@/data/catalogue-discovery-screening.json';
import researchQueue from '@/data/catalogue-research-queue.json';
import {
  assertPrivateResearchEvidencePacketManifest,
  buildStaticResearchEvidencePacketManifest,
  type CatalogueResearchEvidencePacketManifest,
} from '@/lib/catalogue/research-evidence-packet';
import { catalogueResearchQueueDigest, type CatalogueResearchQueue } from '@/lib/catalogue/research-priority';
import type { CatalogueDiscoverySnapshot } from '@/lib/catalogue/discovery-screening';

async function main() {
  const root = process.cwd();
  const [snapshotBytes, queueBytes, manifestBytes] = await Promise.all([
    readFile(path.join(root, 'data/catalogue-discovery-screening.json')),
    readFile(path.join(root, 'data/catalogue-research-queue.json')),
    readFile(path.join(root, 'data/catalogue-research-evidence-packets.json')),
  ]);
  const stored = JSON.parse(manifestBytes.toString('utf8')) as CatalogueResearchEvidencePacketManifest;
  const expected = buildStaticResearchEvidencePacketManifest(
    researchQueue as CatalogueResearchQueue,
    discoverySnapshot as CatalogueDiscoverySnapshot,
    catalogueResearchQueueDigest(queueBytes),
    catalogueResearchQueueDigest(snapshotBytes),
    { mode: 'batch', count: 8 },
  );
  assertPrivateResearchEvidencePacketManifest(stored);
  if (JSON.stringify(stored) !== JSON.stringify(expected)) {
    throw new Error('Research evidence packet manifest is stale or was edited outside the deterministic preparer.');
  }
  console.log(`Verified ${stored.packets.length} private static research evidence packets.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
