import 'server-only';

import type { Sql } from 'postgres';
import { listDecisionHistory } from '@/lib/moderation/audit-queries';
import { can, type Capability } from '@/lib/moderation/capabilities';
import type { ModerationRole } from '@/lib/moderation/access';
import {
  buildOverviewBriefing,
  OVERVIEW_QUEUES,
  type OverviewBriefingReadModel,
  type OverviewQueueFact,
  type OverviewQueueKind,
} from './overview-briefing';

const QUEUE_CAPABILITIES: Record<OverviewQueueKind, Capability> = {
  contributions: 'contributions.decide',
  edges: 'edges.decide',
  observations: 'observations.decide',
  vocabulary: 'vocabulary.decide',
  retailers: 'retailers.decide',
};

type OverviewQueueRow = {
  kind: OverviewQueueKind;
  pending_count: number;
  oldest_pending_at: string | null;
};

async function listOverviewQueueFacts(sql: Sql): Promise<OverviewQueueFact[]> {
  const rows = await sql<OverviewQueueRow[]>`
    select 'contributions'::text as kind, count(*)::int as pending_count, min(submitted_at)::text as oldest_pending_at
    from community_contributions
    where moderation_status = 'pending' and retain_until > now()
    union all
    select 'edges'::text as kind, count(*)::int as pending_count, min(edge.created_at)::text as oldest_pending_at
    from community_knowledge_edges as edge
    join community_contributions as contribution on contribution.id = edge.contribution_id
    where edge.moderation_status = 'pending'
      and contribution.moderation_status <> 'rejected'
      and contribution.retain_until > now()
    union all
    select 'observations'::text as kind, count(*)::int as pending_count, min(observation.created_at)::text as oldest_pending_at
    from community_observations as observation
    join community_contributions as contribution on contribution.id = observation.contribution_id
    where observation.moderation_status = 'pending'
      and contribution.moderation_status <> 'rejected'
      and contribution.retain_until > now()
    union all
    select 'vocabulary'::text as kind, count(distinct value.id)::int as pending_count, min(contribution.submitted_at)::text as oldest_pending_at
    from community_moderation_values as value
    join community_moderation_mentions as mention on mention.moderation_value_id = value.id
    join community_contributions as contribution on contribution.id = mention.contribution_id
    where value.status = 'pending'
      and contribution.moderation_status <> 'rejected'
      and contribution.retain_until > now()
    union all
    select 'retailers'::text as kind, count(*)::int as pending_count,
      min(coalesce(submitted_at, updated_at))::text as oldest_pending_at
    from retailer_partnership_applications
    where status = 'submitted'
  `;

  return rows.map(row => ({
    kind: row.kind,
    pendingCount: row.pending_count,
    oldestPendingAt: row.oldest_pending_at,
  }));
}

// The queue projection is one small aggregate read; audit history is independent
// and may fail without making reliable queue counts look partial.
export async function loadOverviewBriefing(sql: Sql, role: ModerationRole): Promise<OverviewBriefingReadModel> {
  const [queueFacts, auditResult] = await Promise.all([
    listOverviewQueueFacts(sql),
    listDecisionHistory(sql, 5).then(
      rows => ({ rows, unavailable: false }),
      error => {
        console.error('Could not load recent operations decisions.', error);
        return { rows: [], unavailable: true };
      },
    ),
  ]);

  return buildOverviewBriefing({
    queueFacts,
    actionableQueueKinds: OVERVIEW_QUEUES
      .filter(queue => can(role, QUEUE_CAPABILITIES[queue.kind]))
      .map(queue => queue.kind),
    recentDecisions: auditResult.rows,
    recentDecisionsUnavailable: auditResult.unavailable,
  });
}
