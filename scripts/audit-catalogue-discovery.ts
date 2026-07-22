import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { auditCatalogueDiscoverySnapshot } from '@/lib/catalogue/discovery-screening';

async function main() {
  const snapshotPath = path.resolve(process.cwd(), 'data/catalogue-discovery-screening.json');
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as unknown;
  const result = auditCatalogueDiscoverySnapshot(snapshot);
  console.log(`Private discovery screen: ${result.selectedCount} leads from ${result.sourceProductCount} retailer records across ${result.responseCount} response captures.`);
  console.table(result.categoryCounts);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
