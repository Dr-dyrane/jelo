import {
  closeInventoryRefreshClient,
  processInventoryRefreshBatch,
} from '../lib/inventory/refresh-worker';
import { parseInventoryWorkerOptions } from '../lib/inventory/queue-options';

async function main() {
  const options = parseInventoryWorkerOptions(process.argv.slice(2));

  try {
    const { results } = await processInventoryRefreshBatch(options.limit, {
      marketCode: options.market,
    });
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
      `Processed ${results.length}${options.market ? ` ${options.market}` : ''} inventory jobs: ${completed} completed, ${retrying} retrying, ${failed} failed, ${discarded} discarded.`,
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
