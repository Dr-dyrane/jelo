import { readFile } from 'node:fs/promises';
import path from 'node:path';
import discoverySnapshot from '@/data/catalogue-discovery-screening.json';
import researchQueue from '@/data/catalogue-research-queue.json';
import type { CatalogueResearchQueue } from '@/lib/catalogue/research-priority';
import type { CatalogueDiscoverySnapshot } from '@/lib/catalogue/discovery-screening';
import {
  assertPrivateResearchEvidencePacketProjection,
  catalogueResearchPacketProjectionPath,
  compileStaticResearchPacketSources,
  readStaticResearchPacketSourceFiles,
  type CatalogueResearchEvidencePacketProjection,
} from '@/lib/catalogue/research-evidence-packet-source';

async function main() {
  const root = process.cwd();
  const [snapshotBytes, queueBytes, projectionBytes, sourceFiles] = await Promise.all([
    readFile(path.join(root, 'data/catalogue-discovery-screening.json')),
    readFile(path.join(root, 'data/catalogue-research-queue.json')),
    readFile(path.join(root, catalogueResearchPacketProjectionPath)),
    readStaticResearchPacketSourceFiles(root),
  ]);
  const stored = JSON.parse(
    projectionBytes.toString('utf8'),
  ) as CatalogueResearchEvidencePacketProjection;
  const expected = compileStaticResearchPacketSources(
    researchQueue as CatalogueResearchQueue,
    discoverySnapshot as CatalogueDiscoverySnapshot,
    queueBytes,
    snapshotBytes,
    sourceFiles,
  );
  assertPrivateResearchEvidencePacketProjection(stored);
  if (JSON.stringify(stored) !== JSON.stringify(expected)) {
    throw new Error(
      'Research evidence packet projection is stale or was edited outside the deterministic shard compiler.',
    );
  }
  console.log(
    `Verified ${stored.sharding.packetCount} private static research evidence packets across `
      + `${stored.sharding.shardCount} immutable shards.`,
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
