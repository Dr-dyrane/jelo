import postgres from 'postgres';
import { parseManualObservationCommand } from '../lib/inventory/manual-observation-command';
import {
  applyManualObservation,
  assertManualObservationScope,
  resolveExactManualObservationOffer,
  resolveManualInventoryOperator,
} from '../lib/inventory/manual-observation';
import { requireAdminDatabaseUrl } from './lib/admin-database';

function connectionString() {
  return requireAdminDatabaseUrl();
}

async function main() {
  const command = parseManualObservationCommand(process.argv.slice(2));
  const sql = postgres(connectionString(), { max: 1, prepare: false });
  try {
    const operator = await resolveManualInventoryOperator(sql);
    const offer = await resolveExactManualObservationOffer(sql, command);
    assertManualObservationScope(offer, command);

    if (!command.apply) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        targetResolved: true,
        wouldRecordPrice: command.priceNaira != null,
        wouldSettleMatchingRefreshJob: true,
      }));
      return;
    }

    const result = await applyManualObservation(sql, offer, command, operator);
    console.log(JSON.stringify({
      mode: 'applied',
      recordedPrice: command.priceNaira != null,
      settledMatchingRefreshJobs: result.settledRefreshJobs,
    }));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Manual inventory observation failed.');
  process.exitCode = 1;
});
