import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import staticResearchQueue from '@/data/catalogue-research-queue.json';
import {
  buildGlobalResearchSchedule,
  type CommunityResearchPriorityTask,
} from '@/lib/catalogue/global-research-scheduler';
import type { CatalogueResearchQueue } from '@/lib/catalogue/research-priority';
import { firstSubmittedBrandLabel } from '@/lib/community-intake/research-signals';

type CountRow = { count: number };
type ContributionKindRow = { kind: 'product' | 'routine' | 'store'; count: number };
type MentionRow = { ref: string; label: string; mentions: number };
type PriceRow = {
  product_ref: string;
  observations: number;
  lowest_ngn: number;
  highest_ngn: number;
  median_ngn: number;
};
type UnknownRow = { kind: string; value: string; occurrences: number; last_seen_at: Date };
type AttributionRow = {
  source: string;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  drafts_started: number;
  contributions_received: number;
};
type ResearchTaskRow = {
  task_kind: CommunityResearchPriorityTask['taskKind'];
  entity_kind: CommunityResearchPriorityTask['entityKind'];
  entity_ref: string;
  entity_label: string;
  entity_source: 'canonical' | 'custom';
  priority_lane: 'community-first';
  signal_count: number;
  status: string;
  last_seen_at: Date;
  canonical_slug: string | null;
  canonical_brand: string | null;
  submitted_brand_values: unknown;
  identity_name: string | null;
  identity_size: string | null;
};

function option(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (index < 0) return undefined;
  if (!value || value.startsWith('--')) throw new Error(`Missing --${name}.`);
  return value;
}

async function writeCacheReport(filename: string, value: unknown) {
  const repositoryRoot = process.cwd();
  const cacheRoot = path.join(repositoryRoot, '.cache');
  const resolved = path.resolve(repositoryRoot, filename);
  if (!resolved.startsWith(`${cacheRoot}${path.sep}`)) {
    throw new Error('Community aggregate reports may be written only below .cache and are never checked in.');
  }
  await mkdir(path.dirname(resolved), { recursive: true });
  const temporary = `${resolved}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, resolved);
}

function connectionString() {
  const value = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!/^postgres(?:ql)?:\/\//.test(value ?? '')) throw new Error('DATABASE_URL or POSTGRES_URL is required.');
  return value!;
}

async function readCommunityResearchSignals(limit = 100) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Signal limit must be between 1 and 100.');
  const sql = postgres(connectionString(), { max: 1, prepare: false });
  try {
    const [[summary], [pending], kinds] = await Promise.all([
      sql<CountRow[]>`
        select count(*)::integer as count
        from community_contributions
        where retain_until > now() and moderation_status <> 'rejected'
      `,
      sql<CountRow[]>`select count(*)::integer as count from community_contributions where retain_until > now() and moderation_status = 'pending'`,
      sql<ContributionKindRow[]>`
        select contribution_kind as kind, count(*)::integer as count
        from community_contributions
        where retain_until > now() and moderation_status <> 'rejected'
        group by contribution_kind order by count desc, contribution_kind
      `,
    ]);
    const mentions = (predicate: 'reported_product' | 'reported_retailer' | 'reported_for') => sql<MentionRow[]>`
      select object_ref as ref, coalesce(max(metadata ->> 'label'), object_ref) as label,
             count(distinct contribution_id)::integer as mentions
      from community_knowledge_edges edge
      join community_contributions contribution on contribution.id = edge.contribution_id
      where edge.predicate = ${predicate}
        and edge.moderation_status <> 'rejected'
        and contribution.moderation_status <> 'rejected'
        and contribution.retain_until > now()
      group by object_ref order by mentions desc, label limit ${limit}
    `;
    const [products, retailers, purposes, prices, unknownValues, researchQueue, attribution] = await Promise.all([
      mentions('reported_product'),
      mentions('reported_retailer'),
      mentions('reported_for'),
      sql<PriceRow[]>`
        select subject_ref as product_ref, count(*)::integer as observations,
               min(object_ref::integer)::integer as lowest_ngn,
               max(object_ref::integer)::integer as highest_ngn,
               percentile_disc(0.5) within group (order by object_ref::integer)::integer as median_ngn
        from community_knowledge_edges edge
        join community_contributions contribution on contribution.id = edge.contribution_id
        where edge.predicate = 'reported_price'
          and edge.moderation_status <> 'rejected'
          and contribution.moderation_status <> 'rejected'
          and contribution.retain_until > now()
          and edge.object_ref ~ '^[0-9]+$'
        group by edge.subject_ref order by observations desc, product_ref limit ${limit}
      `,
      sql<UnknownRow[]>`
        select value.value_kind as kind, value.raw_value as value,
               count(distinct mention.contribution_id)::integer as occurrences,
               max(contribution.submitted_at) as last_seen_at
        from community_moderation_values value
        join community_moderation_mentions mention on mention.moderation_value_id = value.id
        join community_contributions contribution on contribution.id = mention.contribution_id
        where value.status = 'pending'
          and contribution.moderation_status <> 'rejected'
          and contribution.retain_until > now()
        group by value.id, value.value_kind, value.raw_value
        order by occurrences desc, last_seen_at desc limit ${limit}
      `,
      sql<ResearchTaskRow[]>`
        select task.task_kind, task.entity_kind, task.entity_ref, task.entity_label,
               task.entity_source, task.priority_lane,
               count(distinct mention.contribution_id)::integer as signal_count,
               task.status, max(contribution.submitted_at) as last_seen_at,
               max(canonical_product.slug) as canonical_slug,
               max(canonical_brand.name) as canonical_brand,
               jsonb_agg(mention.context -> 'brands' -> 0 order by contribution.submitted_at desc)
                 filter (where mention.context -> 'brands' -> 0 is not null) as submitted_brand_values,
               max(canonical_product.name) as identity_name,
               max(canonical_product.size) as identity_size
        from community_research_tasks task
        join community_research_task_mentions mention on mention.task_id = task.id
        join community_contributions contribution on contribution.id = mention.contribution_id
        left join products canonical_product
          on task.entity_kind = 'product'
          and task.entity_source = 'canonical'
          and canonical_product.slug = regexp_replace(task.entity_ref, '^product:', '')
        left join brands canonical_brand on canonical_brand.id = canonical_product.brand_id
        where task.status in ('pending', 'in-progress')
          and contribution.moderation_status <> 'rejected'
          and contribution.retain_until > now()
        group by task.id
        order by task.priority_rank, signal_count desc, last_seen_at desc, task.entity_label
        limit ${limit}
      `,
      sql<AttributionRow[]>`
        select attribution.source, attribution.medium, attribution.campaign, attribution.content,
               count(distinct attribution.draft_id)::integer as drafts_started,
               count(distinct contribution.id)::integer as contributions_received
        from community_intake_attributions attribution
        left join community_contributions contribution
          on contribution.draft_id = attribution.draft_id
          and contribution.moderation_status <> 'rejected'
          and contribution.retain_until > now()
        where attribution.retain_until > now()
        group by attribution.source, attribution.medium, attribution.campaign, attribution.content
        order by contributions_received desc, drafts_started desc, attribution.source
      `,
    ]);
    return {
      generatedAt: new Date().toISOString(),
      confidenceState: 'community_reported' as const,
      moderationBoundary: 'research-priority-only' as const,
      submittedContributionCount: summary?.count ?? 0,
      pendingModerationCount: pending?.count ?? 0,
      attribution,
      contributionKinds: kinds,
      products,
      retailers,
      purposes,
      prices: prices.map(row => ({
        productRef: row.product_ref,
        observations: row.observations,
        lowestNgn: row.lowest_ngn,
        highestNgn: row.highest_ngn,
        medianNgn: row.median_ngn,
      })),
      unknownValues: unknownValues.map(row => ({
        kind: row.kind,
        value: row.value,
        occurrences: row.occurrences,
        lastSeenAt: row.last_seen_at.toISOString(),
      })),
      researchQueue: researchQueue.map(row => ({
        taskKind: row.task_kind,
        entityKind: row.entity_kind,
        entityRef: row.entity_ref,
        entityLabel: row.entity_label,
        entitySource: row.entity_source,
        priorityLane: row.priority_lane,
        signalCount: row.signal_count,
        status: row.status,
        lastSeenAt: row.last_seen_at.toISOString(),
        publicationStatus: 'private-research-only' as const,
        identity: {
          canonicalSlug: row.canonical_slug,
          brand: row.canonical_brand ?? firstSubmittedBrandLabel(row.submitted_brand_values),
          name: row.identity_name,
          size: row.identity_size,
        },
      })),
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  const signals = await readCommunityResearchSignals(100);
  const globalResearchSchedule = buildGlobalResearchSchedule(
    signals.researchQueue,
    staticResearchQueue as CatalogueResearchQueue,
  );
  const report = { ...signals, globalResearchSchedule };
  const output = option('out');
  if (output) await writeCacheReport(output, report);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log('Community research signals');
  console.table({
    submitted: signals.submittedContributionCount,
    pendingModeration: signals.pendingModerationCount,
    boundary: signals.moderationBoundary,
  });
  console.log('Anonymous contribution sources');
  console.table(signals.attribution);
  console.log('Products');
  console.table(signals.products);
  console.log('Retailers');
  console.table(signals.retailers);
  console.log('Purposes');
  console.table(signals.purposes);
  console.log('Community-reported prices');
  console.table(signals.prices);
  console.log('Community-first research queue');
  console.table(signals.researchQueue);
  console.log('Global private research schedule');
  console.table(globalResearchSchedule.items.slice(0, 25).map(item => item.source === 'community'
    ? {
      rank: item.rank,
      source: item.source,
      task: item.task.taskKind,
      label: item.task.entityLabel,
      signals: item.score.signalCount,
      lastSeenAt: item.score.lastSeenAt,
    }
    : {
      rank: item.rank,
      source: item.source,
      task: item.task.nextAction,
      label: item.task.title,
      signals: null,
      lastSeenAt: null,
    }));
  if (signals.unknownValues.length) {
    console.log('Pending vocabulary');
    console.table(signals.unknownValues);
  }
  if (output) console.log(`Private aggregate report written to ${output}.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
