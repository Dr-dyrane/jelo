import { notFound } from 'next/navigation';
import { getPostgresClient } from '@/lib/db/postgres';
import { can } from '@/lib/moderation/capabilities';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { listConsoleOperators } from '@/lib/moderation/operators';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import opsStyles from '../../ops.module.css';

export const dynamic = 'force-dynamic';

function operatorLabel(displayName: string | null, email: string | null) {
  return displayName ?? email ?? 'Unlabelled operator';
}

export default async function OperatorsPage() {
  const operator = await requireConsoleOperator();
  if (!can(operator.role, 'operators.manage')) notFound();

  const rows = await listConsoleOperators(getPostgresClient());

  return (
    <>
      <h1 className={opsStyles.h1}>Operators</h1>
      <p className={opsStyles.lede}>Active console access and recent decision activity. Access changes remain outside this read-only view.</p>

      {rows.length === 0 ? (
        <EmptyState
          title="No operators configured"
          body="Allowlisted operators will appear here once access has been provisioned."
        />
      ) : (
        <div className={opsStyles.operatorDirectory}>
          {rows.map(row => (
            <article className={opsStyles.operatorRecord} key={row.id}>
              <div className={opsStyles.operatorRecordIdentity}>
                <span className={row.active ? opsStyles.operatorRecordStatus : opsStyles.operatorRecordInactive} aria-hidden="true" />
                <div>
                  <strong>{operatorLabel(row.displayName, row.email)}</strong>
                  <span>{row.email ?? 'No operator email recorded'}</span>
                </div>
              </div>
              <span className={opsStyles.operatorRecordRole}>{row.role}</span>
              <div className={opsStyles.operatorRecordActivity}>
                <span>{row.decisionsToday} today</span>
                <span>{row.lastActionAt ? <RelativeTime iso={row.lastActionAt} /> : 'No decisions yet'}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
