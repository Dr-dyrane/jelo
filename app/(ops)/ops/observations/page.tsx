import { getPostgresClient } from '@/lib/db/postgres';
import { listPendingObservations } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { findCatalogueProduct } from '@/lib/catalogue/repository';
import { ObservationsInbox } from './ObservationsInbox';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
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

  const workspace = (
    <>
      {enrichedRows.length === 0 ? (
        <EmptyState
          title="Nothing awaiting review"
          body="Pending observations will appear here as they are submitted."
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

  return (
    <OpsWorkspace title="Observations">
      {workspace}
    </OpsWorkspace>
  );
}
