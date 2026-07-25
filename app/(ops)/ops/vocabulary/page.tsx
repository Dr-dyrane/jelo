import { getPostgresClient } from '@/lib/db/postgres';
import { listPendingModerationValues } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { VocabularyInbox } from './VocabularyInbox';
import opsStyles from '../../ops.module.css';
import styles from '@/components/ops/inbox/inbox.module.css';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

export default async function VocabularyQueue() {
  const operator = await requireConsoleOperator();
  const canDecide = can(operator.role, 'vocabulary.decide');
  const rows = await listPendingModerationValues(getPostgresClient(), LIMIT);

  return (
    <>
      <h1 className={opsStyles.h1}>Custom vocabulary</h1>
      <p className={opsStyles.lede}>Values shoppers typed that no canonical entity matched. Approve to accept the term, or reject; mapping to a canonical entity comes next.</p>

      {rows.length === 0 ? (
        <EmptyState
          title="No custom vocabulary pending"
          body="New custom terms typed by contributors will appear here."
        />
      ) : (
        <>
          <VocabularyInbox rows={rows} canDecide={canDecide} />
          {rows.length === LIMIT ? (
            <p className={styles.partial}>Showing the {LIMIT} most recent — more may be pending.</p>
          ) : null}
        </>
      )}
    </>
  );
}
