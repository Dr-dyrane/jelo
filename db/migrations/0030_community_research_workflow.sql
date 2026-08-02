begin;

alter table community_research_tasks
  add column assigned_operator_id uuid references moderation_operators(id) on delete restrict,
  add column work_state text not null default 'ready'
    check (work_state in ('ready', 'assigned', 'blocked', 'retry')),
  add column next_action text check (
    next_action is null or char_length(next_action) between 1 and 2000
  ),
  add column last_reviewed_at timestamptz;

alter table community_research_tasks
  add constraint community_research_tasks_assignment_check check (
    (work_state = 'ready' and assigned_operator_id is null and next_action is null)
    or (
      work_state in ('assigned', 'blocked', 'retry')
      and assigned_operator_id is not null
      and next_action is not null
      and status = 'in-progress'
    )
  );

create index community_research_tasks_work_idx
  on community_research_tasks (status, work_state, updated_at, id)
  where status in ('pending', 'in-progress');

create table community_retailer_research_resolutions (
  task_id uuid primary key,
  entity_kind text not null default 'retailer' check (entity_kind = 'retailer'),
  outcome text not null check (outcome in (
    'existing-canonical-retailer',
    'ambiguous-retailer',
    'dismissed-duplicate'
  )),
  canonical_retailer_slug text references retailers(slug) on delete restrict,
  reviewed_by text not null check (char_length(reviewed_by) between 1 and 320),
  rationale text not null check (char_length(rationale) between 1 and 2000),
  audit_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(audit_metadata) = 'object'),
  reviewed_at timestamptz not null default now(),
  canonical_write boolean not null default false check (canonical_write = false),
  publication_status text not null default 'private-research-only'
    check (publication_status = 'private-research-only'),
  foreign key (task_id, entity_kind)
    references community_research_tasks(id, entity_kind) on delete restrict,
  check (
    (outcome = 'existing-canonical-retailer' and canonical_retailer_slug is not null)
    or (
      outcome in ('ambiguous-retailer', 'dismissed-duplicate')
      and canonical_retailer_slug is null
    )
  )
);

create index community_retailer_research_resolutions_outcome_idx
  on community_retailer_research_resolutions (outcome, reviewed_at desc);

commit;
