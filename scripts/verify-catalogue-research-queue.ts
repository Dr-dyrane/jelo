import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildCatalogueResearchQueue,
  catalogueResearchQueueDigest,
} from '@/lib/catalogue/research-priority';
import type { CatalogueDiscoverySnapshot } from '@/lib/catalogue/discovery-screening';
import { products as coreProducts } from '@/data/products';
import { expandedProducts } from '@/data/expanded-products';
import { catalogueIntakeCandidates } from '@/data/catalogue-intake';

async function main() {
  const dataRoot = path.join(process.cwd(), 'data');
  const snapshotBytes = await readFile(path.join(dataRoot, 'catalogue-discovery-screening.json'));
  const queueBytes = await readFile(path.join(dataRoot, 'catalogue-research-queue.json'), 'utf8');
  const snapshot = JSON.parse(snapshotBytes.toString('utf8')) as CatalogueDiscoverySnapshot;
  const stored = JSON.parse(queueBytes) as unknown;
  const knownIdentities = [...coreProducts, ...expandedProducts, ...catalogueIntakeCandidates].map(product => ({
    brand: product.brand,
    ...('brandAliases' in product && Array.isArray(product.brandAliases) ? { brandAliases: product.brandAliases } : {}),
    name: product.name,
    size: product.size,
  }));
  const expected = buildCatalogueResearchQueue(snapshot, catalogueResearchQueueDigest(snapshotBytes), 48, knownIdentities);
  if (JSON.stringify(stored) !== JSON.stringify(expected)) {
    throw new Error('Catalogue research queue is stale or was edited outside the deterministic builder.');
  }
  const coveredLanes = Object.values(expected.laneCounts).filter(Boolean).length;
  console.log(`Verified ${expected.selectedCount} private research priorities across ${coveredLanes} care lanes.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
