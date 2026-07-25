import { getPostgresClient } from '@/lib/db/postgres';
import { listPendingObservations } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { findCatalogueProduct } from '@/lib/catalogue/repository';
import { ObservationsInbox } from './ObservationsInbox';
import opsStyles from '../../ops.module.css';
import styles from '@/components/ops/inbox/inbox.module.css';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

export default async function ObservationsQueue() {
  const operator = await requireConsoleOperator();
  const canDecide = can(operator.role, 'observations.decide');
  const rows = await listPendingObservations(getPostgresClient(), LIMIT);

  const enrichedRows = await Promise.all(rows.map(async row => {
    if (row.subjectKind === 'product') {
      const slug = row.subjectRef.startsWith('product:') ? row.subjectRef.slice(8) : row.subjectRef;
      const product = await findCatalogueProduct(slug);
      return { ...row, product };
    }
    return row;
  }));

  return (
    <>
      <h1 className={opsStyles.h1}>Community observations</h1>
      <p className={opsStyles.lede}>Reported prices and outcomes awaiting review. Nothing here writes to the catalogue; every decision is logged.</p>

      {enrichedRows.length === 0 ? (
        <EmptyState
          title="Nothing awaiting review"
          body="Reported prices and outcomes will appear here as contributors submit them."
        />
      ) : (
        <>
          <ObservationsInbox rows={enrichedRows} canDecide={canDecide} />
          {enrichedRows.length === LIMIT ? (
            <p className={styles.partial}>Showing the {LIMIT} most recent — more may be pending.</p>
          ) : null}
        </>
      )}
    </>
  );
}
