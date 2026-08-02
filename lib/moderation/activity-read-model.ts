import 'server-only';

import type { Sql } from 'postgres';
import { nigeriaRetailers } from '@/data/retailers';
import {
  communityOptionId,
  communityPurposeOptions,
} from '@/lib/community-intake/canonical-options';
import type { ModerationAction } from './schema';
import { resolveOpsProductImages } from './ops-product-visuals';

const communityRetailerOptions = nigeriaRetailers.map(retailer => ({
  id: communityOptionId('retailer', retailer.name),
  label: retailer.name,
}));

const uuidPattern = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';

function boundedLimit(limit: number) {
  return Math.min(Math.max(Math.trunc(limit), 1), 200);
}

export type ActivityCount = {
  label: string;
  count: number;
};

export type ActivityDecision = {
  id: string;
  operatorName: string;
  queue: ModerationAction['queue'];
  action: ModerationAction['action'];
  targetLabel: string;
  targetRef: string;
  productRef: string | null;
  image: string | null;
  canonicalWrite: boolean;
  rationale: string | null;
  createdAt: string;
};

export type ActivityInference = {
  generatedAt: string;
  community: {
    approvedNotes: number;
    productNotes: number;
    routineNotes: number;
    storeNotes: number;
    experienceNotes: number;
    priceNotes: number;
    activeDays: number;
    firstNoteAt: string | null;
    lastNoteAt: string | null;
    topPurposes: ActivityCount[];
    topRetailers: ActivityCount[];
  };
  research: {
    productLeads: number;
    retailerLeads: number;
    resolvedProductResearch: number;
    pendingRetailerResearch: number;
    matchedExisting: number;
    intakeCandidates: number;
    needClarity: number;
    sets: number;
    dismissedDuplicates: number;
  };
  evidence: {
    approvedRelationships: number;
    pendingRelationships: number;
    approvedObservations: number;
    pendingObservations: number;
  };
  audit: {
    totalDecisions: number;
    decisionsToday: number;
    decisions: ActivityDecision[];
  };
};

export async function getActivityInference(
  sql: Sql,
  decisionLimit = 100,
): Promise<ActivityInference> {
  const [
    communityRows,
    purposeRows,
    retailerRows,
    researchRows,
    outcomeRows,
    evidenceRows,
    auditRows,
    decisionRows,
  ] = await Promise.all([
    sql<{
      generated_at: string;
      approved_notes: number;
      product_notes: number;
      routine_notes: number;
      store_notes: number;
      experience_notes: number;
      price_notes: number;
      active_days: number;
      first_note_at: string | null;
      last_note_at: string | null;
    }[]>`
      select
        now()::text as generated_at,
        count(*)::int as approved_notes,
        count(*) filter (where contribution_kind = 'product')::int as product_notes,
        count(*) filter (where contribution_kind = 'routine')::int as routine_notes,
        count(*) filter (where contribution_kind = 'store')::int as store_notes,
        (
          select count(distinct observation.contribution_id)::int
          from community_observations observation
          join community_contributions observed_contribution
            on observed_contribution.id = observation.contribution_id
          where observation.observation_kind = 'outcome'
            and observation.outcome in ('love-it', 'helped', 'unsure', 'didnt-help')
            and observed_contribution.moderation_status = 'approved'
            and observed_contribution.retain_until > now()
        ) as experience_notes,
        (
          select count(distinct observation.contribution_id)::int
          from community_observations observation
          join community_contributions observed_contribution
            on observed_contribution.id = observation.contribution_id
          where observation.observation_kind = 'price'
            and observation.amount_ngn between 100 and 10000000
            and observed_contribution.moderation_status = 'approved'
            and observed_contribution.retain_until > now()
        ) as price_notes,
        count(distinct (submitted_at at time zone 'UTC')::date)::int as active_days,
        min(submitted_at)::text as first_note_at,
        max(submitted_at)::text as last_note_at
      from community_contributions
      where moderation_status = 'approved'
        and retain_until > now()
    `,
    sql<{
      label: string;
      mention_count: number;
    }[]>`
      with canonical_options as (
        select option.id, option.label
        from jsonb_to_recordset(${sql.json(communityPurposeOptions)}::jsonb)
          as option(id text, label text)
      ),
      safe_mentions as (
        select
          contribution.id as contribution_id,
          option.id as entity_key,
          option.label
        from community_contributions contribution
        cross join lateral jsonb_array_elements(
          coalesce(contribution.payload -> 'purposes', '[]'::jsonb)
        ) purpose
        join canonical_options option
          on purpose ->> 'source' = 'canonical'
          and purpose ->> 'id' = option.id
        where contribution.moderation_status = 'approved'
          and contribution.retain_until > now()

        union all

        select
          contribution.id,
          case
            when value.status = 'mapped'
              then 'purpose:' || value.canonical_entity_ref
            else 'custom:' || value.id::text
          end,
          case
            when value.status = 'mapped'
              then coalesce(concern.name, value.raw_value)
            else value.raw_value
          end
        from community_moderation_mentions mention
        join community_moderation_values value
          on value.id = mention.moderation_value_id
        join community_contributions contribution
          on contribution.id = mention.contribution_id
        left join concerns concern
          on value.status = 'mapped'
          and value.canonical_entity_kind = 'purpose'
          and concern.slug = value.canonical_entity_ref
        where mention.field_path = 'purposes'
          and value.value_kind = 'purpose'
          and (
            value.status = 'approved'
            or (
              value.status = 'mapped'
              and value.canonical_entity_kind = 'purpose'
              and nullif(value.canonical_entity_ref, '') is not null
            )
          )
          and contribution.moderation_status = 'approved'
          and contribution.retain_until > now()
      )
      select max(label) as label, count(distinct contribution_id)::int as mention_count
      from safe_mentions
      group by entity_key
      having count(distinct contribution_id) >= 3
      order by mention_count desc, label asc
      limit 6
    `,
    sql<{
      label: string;
      mention_count: number;
    }[]>`
      with canonical_options as (
        select option.id, option.label
        from jsonb_to_recordset(${sql.json(communityRetailerOptions)}::jsonb)
          as option(id text, label text)
      ),
      safe_mentions as (
        select
          contribution.id as contribution_id,
          option.id as entity_key,
          option.label
        from community_contributions contribution
        cross join lateral jsonb_array_elements(
          coalesce(contribution.payload -> 'retailers', '[]'::jsonb)
        ) retailer
        join canonical_options option
          on retailer ->> 'source' = 'canonical'
          and retailer ->> 'id' = option.id
        where contribution.moderation_status = 'approved'
          and contribution.retain_until > now()

        union all

        select
          contribution.id,
          case
            when value.status = 'mapped'
              then 'retailer:' || value.canonical_entity_ref
            else 'custom:' || value.id::text
          end,
          case
            when value.status = 'mapped'
              then coalesce(canonical_retailer.name, value.raw_value)
            else value.raw_value
          end
        from community_moderation_mentions mention
        join community_moderation_values value
          on value.id = mention.moderation_value_id
        join community_contributions contribution
          on contribution.id = mention.contribution_id
        left join retailers canonical_retailer
          on value.status = 'mapped'
          and value.canonical_entity_kind = 'retailer'
          and canonical_retailer.slug = value.canonical_entity_ref
        where mention.field_path = 'retailers'
          and value.value_kind = 'retailer'
          and (
            value.status = 'approved'
            or (
              value.status = 'mapped'
              and value.canonical_entity_kind = 'retailer'
              and nullif(value.canonical_entity_ref, '') is not null
            )
          )
          and contribution.moderation_status = 'approved'
          and contribution.retain_until > now()
      )
      select max(label) as label, count(distinct contribution_id)::int as mention_count
      from safe_mentions
      group by entity_key
      having count(distinct contribution_id) >= 3
      order by mention_count desc, label asc
      limit 5
    `,
    sql<{
      product_leads: number;
      retailer_leads: number;
      pending_retailer_research: number;
    }[]>`
      select
        count(*) filter (where entity_kind = 'product')::int as product_leads,
        count(*) filter (where entity_kind = 'retailer')::int as retailer_leads,
        count(*) filter (
          where entity_kind = 'retailer'
            and status in ('pending', 'in-progress')
            and signal_count > 0
        )::int as pending_retailer_research
      from community_research_tasks
    `,
    sql<{
      outcome: string;
      outcome_count: number;
    }[]>`
      select outcome, count(*)::int as outcome_count
      from community_product_research_resolutions
      group by outcome
    `,
    sql<{
      approved_relationships: number;
      pending_relationships: number;
      approved_observations: number;
      pending_observations: number;
    }[]>`
      select
        (
          select count(*)::int
          from community_knowledge_edges edge
          join community_contributions contribution on contribution.id = edge.contribution_id
          where edge.moderation_status = 'approved'
            and contribution.moderation_status = 'approved'
            and contribution.retain_until > now()
        ) as approved_relationships,
        (
          select count(*)::int
          from community_knowledge_edges edge
          join community_contributions contribution on contribution.id = edge.contribution_id
          where edge.moderation_status = 'pending'
            and contribution.moderation_status = 'approved'
            and contribution.retain_until > now()
        ) as pending_relationships,
        (
          select count(*)::int
          from community_observations observation
          join community_contributions contribution on contribution.id = observation.contribution_id
          where observation.moderation_status = 'approved'
            and contribution.moderation_status = 'approved'
            and contribution.retain_until > now()
        ) as approved_observations,
        (
          select count(*)::int
          from community_observations observation
          join community_contributions contribution on contribution.id = observation.contribution_id
          where observation.moderation_status = 'pending'
            and contribution.moderation_status = 'approved'
            and contribution.retain_until > now()
        ) as pending_observations
    `,
    sql<{
      total_decisions: number;
      decisions_today: number;
    }[]>`
      select
        count(*)::int as total_decisions,
        count(*) filter (
          where created_at >= date_trunc('day', now())
        )::int as decisions_today
      from moderation_audit_log
    `,
    sql<{
      id: string;
      operator_name: string;
      queue: ModerationAction['queue'];
      action: ModerationAction['action'];
      target_ref: string;
      target_label: string;
      product_ref: string | null;
      canonical_write: boolean;
      rationale: string | null;
      created_at: string;
    }[]>`
      select
        audit.id,
        coalesce(operator.display_name, operator.email, 'Operator') as operator_name,
        audit.queue,
        audit.action,
        audit.target_ref,
        coalesce(
          case
            when audit.queue = 'community_contribution' then (
              select coalesce(
                contribution.payload -> 'products' -> 0 ->> 'label',
                contribution.payload -> 'retailers' -> 0 ->> 'label',
                contribution.payload -> 'brands' -> 0 ->> 'label',
                initcap(contribution.contribution_kind::text) || ' note'
              )
              from community_contributions contribution
              where contribution.id = case
                when audit.target_ref ~* ${uuidPattern} then audit.target_ref::uuid
                else null
              end
            )
            when audit.queue = 'community_observation' then (
              select coalesce(
                contribution.payload -> 'products' -> 0 ->> 'label',
                observation.subject_ref
              )
              from community_observations observation
              join community_contributions contribution
                on contribution.id = observation.contribution_id
              where observation.id = case
                when audit.target_ref ~* ${uuidPattern} then audit.target_ref::uuid
                else null
              end
            )
            when audit.queue = 'community_edge' then (
              select coalesce(
                contribution.payload -> 'products' -> 0 ->> 'label',
                edge.subject_ref
              )
              from community_knowledge_edges edge
              join community_contributions contribution
                on contribution.id = edge.contribution_id
              where edge.id = case
                when audit.target_ref ~* ${uuidPattern} then audit.target_ref::uuid
                else null
              end
            )
            when audit.queue = 'community_moderation_value' then (
              select value.raw_value
              from community_moderation_values value
              where value.id = case
                when audit.target_ref ~* ${uuidPattern} then audit.target_ref::uuid
                else null
              end
            )
            when audit.queue = 'community_research_task' then (
              select task.entity_label
              from community_research_tasks task
              where task.id = case
                when audit.target_ref ~* ${uuidPattern} then audit.target_ref::uuid
                else null
              end
            )
            when audit.queue = 'retailer_application' then (
              select application.store_name
              from retailer_partnership_applications application
              where application.id = case
                when audit.target_ref ~* ${uuidPattern} then audit.target_ref::uuid
                else null
              end
            )
            when audit.queue = 'commerce_signal' then (
              select coalesce(product.name, event.product_slug)
              from commerce_events event
              left join products product on product.slug = event.product_slug
              where event.id = case
                when audit.target_ref ~* ${uuidPattern} then audit.target_ref::uuid
                else null
              end
            )
          end,
          case audit.queue
            when 'community_contribution' then 'Community note'
            when 'community_edge' then 'Community relationship'
            when 'community_observation' then 'Community observation'
            when 'community_moderation_value' then 'Community term'
            when 'community_research_task' then 'Research lead'
            when 'retailer_application' then 'Retailer application'
            when 'commerce_signal' then 'Commerce signal'
          end
        ) as target_label,
        case
          when audit.queue = 'community_contribution' then (
            select case
              when contribution.payload #>> '{products,0,source}' = 'canonical'
                then contribution.payload #>> '{products,0,id}'
              else null
            end
            from community_contributions contribution
            where contribution.id = case
              when audit.target_ref ~* ${uuidPattern} then audit.target_ref::uuid
              else null
            end
          )
          when audit.queue = 'community_observation' then (
            select case
              when observation.subject_kind = 'product'
                and contribution.payload #>> '{products,0,source}' = 'canonical'
                and observation.subject_ref = contribution.payload #>> '{products,0,id}'
                then observation.subject_ref
              else null
            end
            from community_observations observation
            join community_contributions contribution
              on contribution.id = observation.contribution_id
            where observation.id = case
              when audit.target_ref ~* ${uuidPattern} then audit.target_ref::uuid
              else null
            end
          )
          when audit.queue = 'community_edge' then (
            select case
              when contribution.payload #>> '{products,0,source}' = 'canonical'
                then contribution.payload #>> '{products,0,id}'
              else null
            end
            from community_knowledge_edges edge
            join community_contributions contribution
              on contribution.id = edge.contribution_id
            where edge.id = case
              when audit.target_ref ~* ${uuidPattern} then audit.target_ref::uuid
              else null
            end
          )
          when audit.queue = 'community_moderation_value' then (
            select case
              when value.status = 'mapped'
                and value.canonical_entity_kind = 'product'
                then value.canonical_entity_ref
              else null
            end
            from community_moderation_values value
            where value.id = case
              when audit.target_ref ~* ${uuidPattern} then audit.target_ref::uuid
              else null
            end
          )
          when audit.queue = 'community_research_task' then (
            select coalesce(
              case
                when resolution.canonical_product_slug is not null
                  then 'product:' || resolution.canonical_product_slug
                else null
              end,
              case
                when task.entity_kind = 'product' and task.entity_source = 'canonical'
                  then task.entity_ref
                else null
              end
            )
            from community_research_tasks task
            left join community_product_research_resolutions resolution
              on resolution.task_id = task.id
            where task.id = case
              when audit.target_ref ~* ${uuidPattern} then audit.target_ref::uuid
              else null
            end
          )
          when audit.queue = 'commerce_signal' then (
            select event.product_slug
            from commerce_events event
            where event.id = case
              when audit.target_ref ~* ${uuidPattern} then audit.target_ref::uuid
              else null
            end
          )
          else null
        end as product_ref,
        audit.canonical_write,
        audit.rationale,
        audit.created_at::text as created_at
      from moderation_audit_log audit
      left join moderation_operators operator
        on operator.auth_subject = audit.operator_subject
      order by audit.created_at desc, audit.id desc
      limit ${boundedLimit(decisionLimit)}
    `,
  ]);

  const community = communityRows[0];
  const research = researchRows[0];
  const evidence = evidenceRows[0];
  const audit = auditRows[0];
  const productImages = await resolveOpsProductImages(
    decisionRows.map(row => row.product_ref),
  );
  const outcomeCounts = new Map(
    outcomeRows.map(row => [row.outcome, row.outcome_count]),
  );

  return {
    generatedAt: community?.generated_at ?? new Date().toISOString(),
    community: {
      approvedNotes: community?.approved_notes ?? 0,
      productNotes: community?.product_notes ?? 0,
      routineNotes: community?.routine_notes ?? 0,
      storeNotes: community?.store_notes ?? 0,
      experienceNotes: community?.experience_notes ?? 0,
      priceNotes: community?.price_notes ?? 0,
      activeDays: community?.active_days ?? 0,
      firstNoteAt: community?.first_note_at ?? null,
      lastNoteAt: community?.last_note_at ?? null,
      topPurposes: purposeRows.map(row => ({
        label: row.label,
        count: row.mention_count,
      })),
      topRetailers: retailerRows.map(row => ({
        label: row.label,
        count: row.mention_count,
      })),
    },
    research: {
      productLeads: research?.product_leads ?? 0,
      retailerLeads: research?.retailer_leads ?? 0,
      resolvedProductResearch: outcomeRows.reduce((sum, row) => sum + row.outcome_count, 0),
      pendingRetailerResearch: research?.pending_retailer_research ?? 0,
      matchedExisting: outcomeCounts.get('existing-canonical-product') ?? 0,
      intakeCandidates: outcomeCounts.get('deliberate-intake-candidate') ?? 0,
      needClarity: outcomeCounts.get('ambiguous-family') ?? 0,
      sets: outcomeCounts.get('bundle') ?? 0,
      dismissedDuplicates: outcomeCounts.get('dismissed-duplicate') ?? 0,
    },
    evidence: {
      approvedRelationships: evidence?.approved_relationships ?? 0,
      pendingRelationships: evidence?.pending_relationships ?? 0,
      approvedObservations: evidence?.approved_observations ?? 0,
      pendingObservations: evidence?.pending_observations ?? 0,
    },
    audit: {
      totalDecisions: audit?.total_decisions ?? 0,
      decisionsToday: audit?.decisions_today ?? 0,
      decisions: decisionRows.map(row => ({
        id: row.id,
        operatorName: row.operator_name,
        queue: row.queue,
        action: row.action,
        targetLabel: row.target_label,
        targetRef: row.target_ref,
        productRef: row.product_ref,
        image: row.product_ref ? productImages.get(row.product_ref) ?? null : null,
        canonicalWrite: row.canonical_write,
        rationale: row.rationale,
        createdAt: row.created_at,
      })),
    },
  };
}
