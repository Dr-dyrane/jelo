import { processInventoryRefreshBatch } from '../lib/inventory/refresh-worker';

async function main() {
const requestedLimit = Number.parseInt(process.argv[2] ?? '25', 10);
const limit = Number.isFinite(requestedLimit) ? requestedLimit : 25;

const results = await processInventoryRefreshBatch(limit);
const completed = results.filter(result => result.status === 'completed').length;
const failed = results.length - completed;

for (const result of results) {
  if (result.status === 'completed') {
    console.log(`✓ ${result.offerId} → ${result.inventoryStatus}`);
  } else {
    console.error(`✗ ${result.offerId}: ${result.error}`);
  }
}

console.log(`Processed ${results.length} inventory jobs: ${completed} completed, ${failed} retried/failed.`);

if (failed > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
