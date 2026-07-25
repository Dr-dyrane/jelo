import { getPostgresClient } from '@/lib/db/postgres';
import { listCommerceSignals } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { findCatalogueProduct } from '@/lib/catalogue/repository';
import { SignalsInbox } from './SignalsInbox';
import opsStyles from '../../ops.module.css';
import styles from '@/components/ops/inbox/inbox.module.css';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

export default async function SignalsView() {
  await requireConsoleOperator();
  const rows = await listCommerceSignals(getPostgresClient(), LIMIT);

  const enrichedRows = await Promise.all(rows.map(async row => {
    const product = await findCatalogueProduct(row.productSlug);
    return { ...row, product };
  }));

  return (
    <>
      <h1 className={opsStyles.h1}>Commerce signals</h1>
      <p className={opsStyles.lede}>store_click measurement, read-only. Never joined to health-shaped behaviour and never an input to store ranking (ADR 0006).</p>

      {enrichedRows.length === 0 ? (
        <EmptyState
          title="No commerce signals"
          body="Shopper click interactions will be displayed here as signals accumulate."
        />
      ) : (
        <>
          <SignalsInbox rows={enrichedRows} />
          {enrichedRows.length === LIMIT ? (
            <p className={styles.partial}>Showing the {LIMIT} most recent — more may be pending.</p>
          ) : null}
        </>
      )}
    </>
  );
}
