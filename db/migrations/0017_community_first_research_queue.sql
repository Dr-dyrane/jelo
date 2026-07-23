begin;

create table community_research_tasks (
  id uuid primary key default gen_random_uuid(),
  task_kind text not null check (task_kind in (
    'product-identity',
    'product-retail-refresh',
    'retailer-identity',
    'retailer-refresh'
  )),
  entity_kind text not null check (entity_kind in ('product', 'retailer')),
  entity_ref text not null check (char_length(entity_ref) between 1 and 160),
  entity_label text not null check (char_length(entity_label) between 1 and 120),
  entity_source text not null check (entity_source in ('canonical', 'custom')),
  priority_lane text not null default 'community-first' check (priority_lane = 'community-first'),
  priority_rank smallint not null default 0 check (priority_rank = 0),
  signal_count integer not null default 0 check (signal_count >= 0),
  confidence_state text not null default 'community_reported' check (confidence_state = 'community_reported'),
  publication_status text not null default 'private-research-only' check (publication_status = 'private-research-only'),
  status text not null default 'pending' check (status in ('pending', 'in-progress', 'completed', 'dismissed')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_kind, entity_ref)
);

create table community_research_task_mentions (
  task_id uuid not null references community_research_tasks(id) on delete cascade,
  contribution_id uuid not null references community_contributions(id) on delete cascade,
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  created_at timestamptz not null default now(),
  primary key (task_id, contribution_id)
);

create index community_research_tasks_priority_idx
  on community_research_tasks (priority_rank, status, signal_count desc, last_seen_at desc);
create index community_research_task_mentions_contribution_idx
  on community_research_task_mentions (contribution_id);

with retained_mentions as (
  select
    contribution.id as contribution_id,
    contribution.submitted_at,
    case when value ->> 'source' = 'custom' then 'product-identity' else 'product-retail-refresh' end as task_kind,
    'product' as entity_kind,
    value ->> 'id' as entity_ref,
    value ->> 'label' as entity_label,
    case when value ->> 'source' = 'custom' then 'custom' else 'canonical' end as entity_source
  from community_contributions contribution
  cross join lateral jsonb_array_elements(coalesce(contribution.payload -> 'products', '[]'::jsonb)) value
  where contribution.retain_until > now() and contribution.moderation_status <> 'rejected'

  union all

  select
    contribution.id,
    contribution.submitted_at,
    case when value ->> 'source' = 'custom' then 'retailer-identity' else 'retailer-refresh' end,
    'retailer',
    value ->> 'id',
    value ->> 'label',
    case when value ->> 'source' = 'custom' then 'custom' else 'canonical' end
  from community_contributions contribution
  cross join lateral jsonb_array_elements(coalesce(contribution.payload -> 'retailers', '[]'::jsonb)) value
  where contribution.retain_until > now() and contribution.moderation_status <> 'rejected'
)
insert into community_research_tasks (
  task_kind, entity_kind, entity_ref, entity_label, entity_source,
  signal_count, first_seen_at, last_seen_at
)
select
  task_kind, entity_kind, entity_ref, max(entity_label), entity_source,
  count(distinct contribution_id)::integer, min(submitted_at), max(submitted_at)
from retained_mentions
where entity_ref is not null and entity_label is not null
group by task_kind, entity_kind, entity_ref, entity_source
on conflict (task_kind, entity_ref) do update
set entity_label = excluded.entity_label,
    entity_source = excluded.entity_source,
    signal_count = excluded.signal_count,
    first_seen_at = least(community_research_tasks.first_seen_at, excluded.first_seen_at),
    last_seen_at = greatest(community_research_tasks.last_seen_at, excluded.last_seen_at),
    updated_at = now();

with retained_mentions as (
  select
    contribution.id as contribution_id,
    contribution.payload,
    case when value ->> 'source' = 'custom' then 'product-identity' else 'product-retail-refresh' end as task_kind,
    value ->> 'id' as entity_ref
  from community_contributions contribution
  cross join lateral jsonb_array_elements(coalesce(contribution.payload -> 'products', '[]'::jsonb)) value
  where contribution.retain_until > now() and contribution.moderation_status <> 'rejected'

  union all

  select
    contribution.id,
    contribution.payload,
    case when value ->> 'source' = 'custom' then 'retailer-identity' else 'retailer-refresh' end,
    value ->> 'id'
  from community_contributions contribution
  cross join lateral jsonb_array_elements(coalesce(contribution.payload -> 'retailers', '[]'::jsonb)) value
  where contribution.retain_until > now() and contribution.moderation_status <> 'rejected'
)
insert into community_research_task_mentions (task_id, contribution_id, context)
select task.id, mention.contribution_id, jsonb_build_object(
  'contributionKind', mention.payload ->> 'kind',
  'brands', coalesce(mention.payload -> 'brands', '[]'::jsonb),
  'purposes', coalesce(mention.payload -> 'purposes', '[]'::jsonb),
  'products', coalesce(mention.payload -> 'products', '[]'::jsonb),
  'retailers', coalesce(mention.payload -> 'retailers', '[]'::jsonb)
)
from retained_mentions mention
join community_research_tasks task
  on task.task_kind = mention.task_kind and task.entity_ref = mention.entity_ref
on conflict (task_id, contribution_id) do nothing;

commit;
