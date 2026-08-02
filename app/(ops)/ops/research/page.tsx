import { getPostgresClient } from '@/lib/db/postgres';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { listPendingResearchTasks } from '@/lib/moderation/research-tasks';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import { ResearchInbox } from './ResearchInbox';

export const dynamic = 'force-dynamic';

export default async function ResearchQueue() {
  const operator = await requireConsoleOperator();
  const rows = await listPendingResearchTasks(getPostgresClient());
  const canManage = can(operator.role, 'research.manage');

  return (
    <OpsWorkspace title="Research">
      {rows.length === 0 ? (
        <EmptyState
          title="You’re caught up."
          body="There’s nothing waiting."
          action={{ href: '/ops/activity', label: 'View insights' }}
        />
      ) : <ResearchInbox rows={rows} canManage={canManage} />}
    </OpsWorkspace>
  );
}
