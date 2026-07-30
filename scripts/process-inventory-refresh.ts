import {
  closeInventoryRefreshClient,
  processInventoryRefreshBatch,
} from '../lib/inventory/refresh-worker';

async function main() {
  const requestedLimit = Number.parseInt(process.argv[2] ?? '25', 10);
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 25;

  try {
    const { results } = await processInventoryRefreshBatch(limit);
    const completed = results.filter(result => result.status === 'completed').length;
    const retrying = results.filter(result => result.status === 'retrying').length;
    const failed = results.filter(result => result.status === 'failed').length;
    const discarded = results.filter(result => result.status === 'discarded').length;

    for (const result of results) {
      if (result.status === 'completed') {
        console.log(`✓ ${result.offerId} → ${result.inventoryStatus}`);
      } else if (result.status === 'retrying') {
        console.error(`↻ ${result.offerId}: ${result.error}`);
      } else if (result.status === 'discarded') {
        console.error(`– ${result.offerId}: ${result.error}`);
      } else {
        console.error(`✗ ${result.offerId}: ${result.error}`);
      }
    }

    console.log(
      `Processed ${results.length} inventory jobs: ${completed} completed, ${retrying} retrying, ${failed} failed, ${discarded} discarded.`,
    );

    if (retrying + failed + discarded > 0) process.exitCode = 1;
  } finally {
    await closeInventoryRefreshClient();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
