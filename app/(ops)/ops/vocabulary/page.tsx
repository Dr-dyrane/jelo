import { getPostgresClient } from '@/lib/db/postgres';
import {
  findPendingModerationValue,
  listCanonicalVocabularyTargets,
  listPendingModerationValues,
} from '@/lib/moderation/queues';
import {
  includeSelectedQueueItem,
  selectedQueueItemId,
  type QueueSearchParams,
} from '@/lib/moderation/queue-selection';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import {
  vocabularyReviewItem,
  type VocabularyTarget,
} from '@/lib/moderation/vocabulary-presentation';
import { listCatalogueProducts } from '@/lib/catalogue/repository';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import { VocabularyInbox } from './VocabularyInbox';
import './vocabulary-shell.module.css';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

function mergeTargets(targets: VocabularyTarget[]) {
  const byIdentity = new Map<string, VocabularyTarget>();
  targets.forEach(target => {
    byIdentity.set(`${target.kind}:${target.ref}`, target);
  });
  return [...byIdentity.values()].sort((left, right) => (
    left.kind.localeCompare(right.kind, 'en-NG')
    || left.label.localeCompare(right.label, 'en-NG')
  ));
}

export default async function VocabularyQueue({
  searchParams,
}: {
  searchParams: Promise<QueueSearchParams>;
}) {
  const operator = await requireConsoleOperator();
  const canDecide = can(operator.role, 'vocabulary.decide');
  const canMap = can(operator.role, 'vocabulary.map');
  const selectedId = selectedQueueItemId(await searchParams);
  const sql = getPostgresClient();
  const [fetchedRows, databaseTargets, publicProducts] = await Promise.all([
    listPendingModerationValues(sql, LIMIT + 1),
    canMap ? listCanonicalVocabularyTargets(sql) : Promise.resolve([]),
    canMap ? listCatalogueProducts() : Promise.resolve([]),
  ]);
  const targets = mergeTargets([
    ...databaseTargets,
    ...publicProducts.map(product => ({
      kind: 'product' as const,
      ref: product.slug,
      label: product.name,
      detail: `${product.brand} · ${product.size}`,
    })),
  ]);
  const recentRows = fetchedRows.slice(0, LIMIT);
  const hasMore = fetchedRows.length > LIMIT;
  const selectedRow = selectedId && !recentRows.some(row => row.id === selectedId)
    ? await findPendingModerationValue(sql, selectedId)
    : null;
  const rows = includeSelectedQueueItem(recentRows, selectedRow);
  const reviewItems = rows.map(vocabularyReviewItem);
  const lastQueueRow = recentRows.at(-1);
  const nextCursor = lastQueueRow
    ? {
        activeMentionCount: lastQueueRow.activeMentionCount,
        firstSeenAt: lastQueueRow.firstSeenAt,
        id: lastQueueRow.id,
      }
    : null;

  return (
    <OpsWorkspace title="Vocabulary">
      {rows.length === 0 ? (
        <EmptyState
          title="You’re caught up."
          body="There’s nothing waiting."
          action={{ href: '/ops/activity', label: 'View insights' }}
        />
      ) : (
        <VocabularyInbox
          rows={reviewItems}
          targets={targets}
          canDecide={canDecide}
          canMap={canMap}
          initialHasMore={hasMore}
          initialCursor={nextCursor}
        />
      )}
    </OpsWorkspace>
  );
}
