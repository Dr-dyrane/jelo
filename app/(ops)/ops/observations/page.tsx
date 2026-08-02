import { getPostgresClient } from '@/lib/db/postgres';
import {
  findPendingObservation,
  findSettledObservation,
  listPendingObservations,
} from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { listCatalogueProducts } from '@/lib/catalogue/repository';
import {
  observationProductSlug,
  observationReviewItem,
} from '@/lib/moderation/observation-presentation';
import {
  includeSelectedQueueItem,
  selectedQueueUuid,
  type QueueSearchParams,
} from '@/lib/moderation/queue-selection';
import { ObservationsInbox } from './ObservationsInbox';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import './observations-shell.module.css';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

export default async function ObservationsQueue({
  searchParams,
}: {
  searchParams: Promise<QueueSearchParams>;
}) {
  const operator = await requireConsoleOperator();
  const canDecide = can(operator.role, 'observations.decide');
  const canCorrect = can(operator.role, 'observations.correct');
  const selectedId = selectedQueueUuid(await searchParams);
  const sql = getPostgresClient();
  const fetchedRows = await listPendingObservations(sql, LIMIT + 1);
  const recentRows = fetchedRows.slice(0, LIMIT);
  const hasMore = fetchedRows.length > LIMIT;
  const selectedRow = selectedId && !recentRows.some(row => row.id === selectedId)
    ? await findPendingObservation(sql, selectedId)
      ?? await findSettledObservation(sql, selectedId)
    : null;
  const rows = includeSelectedQueueItem(recentRows, selectedRow);
  const catalogue = await listCatalogueProducts();
  const productsBySlug = new Map(catalogue.map(product => [product.slug, product]));
  const reviewItems = rows.map(row => {
    const slug = observationProductSlug(row);
    return observationReviewItem(row, slug ? productsBySlug.get(slug) : undefined);
  });
  const lastQueueRow = recentRows.at(-1);
  const nextCursor = lastQueueRow
    ? { createdAt: lastQueueRow.createdAt, id: lastQueueRow.id }
    : null;

  return (
    <OpsWorkspace title="Observations">
      {rows.length === 0 ? (
        <EmptyState
          title="You’re caught up."
          body="There’s nothing waiting."
          action={{ href: '/ops/activity', label: 'View insights' }}
        />
      ) : (
        <ObservationsInbox
          rows={reviewItems}
          canDecide={canDecide}
          canCorrect={canCorrect}
          initialHasMore={hasMore}
          initialCursor={nextCursor}
        />
      )}
    </OpsWorkspace>
  );
}
