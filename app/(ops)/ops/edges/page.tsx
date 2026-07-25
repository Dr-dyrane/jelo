import { getPostgresClient } from '@/lib/db/postgres';
import { listPendingEdges } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { EdgesInbox } from './EdgesInbox';
import opsStyles from '../../ops.module.css';
import styles from '@/components/ops/inbox/inbox.module.css';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

export default async function EdgesQueue() {
  const operator = await requireConsoleOperator();
  const canDecide = can(operator.role, 'edges.decide');
  const rows = await listPendingEdges(getPostgresClient(), LIMIT);

  return (
    <>
      <h1 className={opsStyles.h1}>Knowledge edges</h1>
      <p className={opsStyles.lede}>Typed triples derived from contributions, pending review. Community-reported until an operator approves.</p>

      {rows.length === 0 ? (
        <EmptyState
          title="No pending edges"
          body="Triples connecting products, ingredients, concerns, or brands will appear here."
        />
      ) : (
        <>
          <EdgesInbox rows={rows} canDecide={canDecide} />
          {rows.length === LIMIT ? (
            <p className={styles.partial}>Showing the {LIMIT} most recent — more may be pending.</p>
          ) : null}
        </>
      )}
    </>
  );
}
