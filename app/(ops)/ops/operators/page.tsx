import { notFound } from 'next/navigation';
import { operatorSignInUrl } from '@/lib/auth/operator-sign-in-url';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { getPostgresClient } from '@/lib/db/postgres';
import { hasTransactionalEmailConfig } from '@/lib/email/mailer';
import { can } from '@/lib/moderation/capabilities';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { listConsoleOperators } from '@/lib/moderation/operators';
import { OperatorsDirectory } from './OperatorsDirectory';

export const dynamic = 'force-dynamic';

export default async function OperatorsPage() {
  const operator = await requireConsoleOperator();
  if (!can(operator.role, 'operators.manage')) notFound();

  const directory = await listConsoleOperators(getPostgresClient());

  return (
    <OpsWorkspace title="Operators">
      {directory.rows.length === 0 ? (
        <EmptyState
          title="No team access yet."
          body="Admins will appear here."
        />
      ) : (
        <OperatorsDirectory
          rows={directory.rows}
          currentOperatorId={operator.id}
          accessLifecycleReady={directory.accessLifecycleReady}
          emailDeliveryReady={hasTransactionalEmailConfig()}
          signInHref={operatorSignInUrl()}
        />
      )}
    </OpsWorkspace>
  );
}
