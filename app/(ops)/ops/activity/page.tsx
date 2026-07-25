import { getPostgresClient } from '@/lib/db/postgres';
import { listDecisionHistory } from '@/lib/moderation/audit-queries';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import opsStyles from '../../ops.module.css';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

const queueLabels = {
  community_contribution: 'Contribution',
  community_edge: 'Knowledge edge',
  community_observation: 'Observation',
  community_moderation_value: 'Vocabulary',
  retailer_application: 'Retailer',
  commerce_signal: 'Commerce signal',
} as const;

const actionLabels = {
  claim: 'Claimed',
  approve: 'Approved',
  reject: 'Rejected',
  promote: 'Promoted',
  defer: 'Deferred',
  note: 'Noted',
} as const;

export default async function DecisionHistoryPage() {
  await requireConsoleOperator();
  const rows = await listDecisionHistory(getPostgresClient(), LIMIT);

  return (
    <>
      <h1 className={opsStyles.h1}>Decision history</h1>
      <p className={opsStyles.lede}>Every review action is recorded with its operator, target, rationale, and time.</p>

      {rows.length === 0 ? (
        <EmptyState
          title="No decisions recorded"
          body="Completed reviews will appear here with their supporting rationale."
        />
      ) : (
        <div className={opsStyles.ledger}>
          {rows.map(row => (
            <article className={opsStyles.ledgerRow} key={row.id}>
              <div className={opsStyles.ledgerSummary}>
                <span className={opsStyles.ledgerAction}>{actionLabels[row.action]}</span>
                <span className={opsStyles.ledgerQueue}>{queueLabels[row.queue]}</span>
                <code className={opsStyles.ledgerTarget}>{row.targetRef}</code>
              </div>
              <div className={opsStyles.ledgerMeta}>
                <span>{row.operatorName}</span>
                <RelativeTime iso={row.createdAt} />
              </div>
              {row.rationale ? <p className={opsStyles.ledgerRationale}>{row.rationale}</p> : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
