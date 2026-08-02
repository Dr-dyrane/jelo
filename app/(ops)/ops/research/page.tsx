import { getPostgresClient } from '@/lib/db/postgres';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import {
  findPendingResearchTask,
  listPendingResearchTasks,
  listResearchAssignmentOptions,
  listResearchCanonicalOptions,
} from '@/lib/moderation/research-tasks';
import {
  includeSelectedQueueItem,
  selectedQueueItemId,
  type QueueSearchParams,
} from '@/lib/moderation/queue-selection';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import { ResearchInbox } from './ResearchInbox';
import { catalogueIntakeCandidates } from '@/data/catalogue-intake';
import { isReleasedIntakeCandidate } from '@/data/published-intake-products';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

export default async function ResearchQueue({
  searchParams,
}: {
  searchParams: Promise<QueueSearchParams>;
}) {
  const operator = await requireConsoleOperator();
  const requestedSelectedId = selectedQueueItemId(await searchParams);
  const selectedId = requestedSelectedId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedSelectedId)
    ? requestedSelectedId
    : null;
  const sql = getPostgresClient();
  const canManage = can(operator.role, 'research.manage');
  const canAssign = can(operator.role, 'research.assign');
  const [fetchedRows, assignmentOptions, canonicalOptions] = await Promise.all([
    listPendingResearchTasks(sql, operator.id, LIMIT + 1),
    canAssign ? listResearchAssignmentOptions(sql) : Promise.resolve([]),
    canManage
      ? listResearchCanonicalOptions(sql)
      : Promise.resolve({ products: [], retailers: [] }),
  ]);
  const recentRows = fetchedRows.slice(0, LIMIT);
  const hasMore = fetchedRows.length > LIMIT;
  const selectedRow = selectedId && !recentRows.some(row => row.id === selectedId)
    ? await findPendingResearchTask(sql, operator.id, selectedId)
    : null;
  const rows = includeSelectedQueueItem(recentRows, selectedRow);
  const lastQueueRow = recentRows.at(-1);
  const nextCursor = lastQueueRow ? {
    workRank: lastQueueRow.workRank,
    signalCount: lastQueueRow.signalCount,
    firstSeenAt: lastQueueRow.firstSeenAt,
    id: lastQueueRow.id,
  } : null;
  const unreleasedCandidates = canManage
    ? catalogueIntakeCandidates
        .filter(candidate => !isReleasedIntakeCandidate(candidate.id))
        .map(candidate => ({
          id: candidate.id,
          label: `${candidate.brand} ${candidate.name} · ${candidate.size}`,
        }))
    : [];

  return (
    <OpsWorkspace title="Research">
      {rows.length === 0 ? (
        <EmptyState
          title="You’re caught up."
          body="There’s nothing waiting."
          action={{ href: '/ops/activity', label: 'View insights' }}
        />
      ) : (
        <ResearchInbox
          rows={rows}
          canManage={canManage}
          canAssign={canAssign}
          assignmentOptions={assignmentOptions}
          canonicalOptions={canonicalOptions}
          initialHasMore={hasMore}
          initialCursor={nextCursor}
          unreleasedCandidates={unreleasedCandidates}
        />
      )}
    </OpsWorkspace>
  );
}
