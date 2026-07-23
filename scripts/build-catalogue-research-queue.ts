import { readFile, writeFile } from 'node:fs/promises';
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
  const repositoryRoot = process.cwd();
  const snapshotPath = path.join(repositoryRoot, 'data/catalogue-discovery-screening.json');
  const outputPath = path.join(repositoryRoot, 'data/catalogue-research-queue.json');
  const sourceBytes = await readFile(snapshotPath);
  const snapshot = JSON.parse(sourceBytes.toString('utf8')) as CatalogueDiscoverySnapshot;
  const knownIdentities = [...coreProducts, ...expandedProducts, ...catalogueIntakeCandidates].map(product => ({
    brand: product.brand,
    ...('brandAliases' in product && Array.isArray(product.brandAliases) ? { brandAliases: product.brandAliases } : {}),
    name: product.name,
    size: product.size,
  }));
  const queue = buildCatalogueResearchQueue(snapshot, catalogueResearchQueueDigest(sourceBytes), 48, knownIdentities);

  if (process.argv.includes('--write')) {
    await writeFile(outputPath, `${JSON.stringify(queue, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify({
    policy: queue.policy,
    selectionPolicy: queue.selectionPolicy,
    selectedCount: queue.selectedCount,
    laneCounts: queue.laneCounts,
    output: process.argv.includes('--write') ? path.relative(repositoryRoot, outputPath) : null,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
