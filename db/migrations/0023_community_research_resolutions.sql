begin;

-- A research signal is not a catalogue record. This one-to-one resolution
-- records what a reviewer learned without creating or changing a product,
-- intake candidate, dossier, release, or public asset.
alter table community_research_tasks
  add constraint community_research_tasks_id_entity_kind_key unique (id, entity_kind);

create table community_product_research_resolutions (
  task_id uuid primary key,
  entity_kind text not null default 'product' check (entity_kind = 'product'),
  outcome text not null check (outcome in (
    'existing-canonical-product',
    'deliberate-intake-candidate',
    'ambiguous-family',
    'bundle',
    'dismissed-duplicate'
  )),
  canonical_product_slug text references products(slug) on delete restrict,
  candidate_id text check (
    candidate_id is null
    or (
      char_length(candidate_id) between 1 and 160
      and candidate_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    )
  ),
  reviewed_by text not null check (char_length(reviewed_by) between 1 and 320),
  rationale text not null check (char_length(rationale) between 1 and 2000),
  audit_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(audit_metadata) = 'object'),
  reviewed_at timestamptz not null default now(),
  canonical_write boolean not null default false check (canonical_write = false),
  publication_status text not null default 'private-research-only'
    check (publication_status = 'private-research-only'),
  foreign key (task_id, entity_kind)
    references community_research_tasks(id, entity_kind) on delete restrict,
  check (
    (
      outcome = 'existing-canonical-product'
      and canonical_product_slug is not null
      and candidate_id is null
    )
    or (
      outcome = 'deliberate-intake-candidate'
      and canonical_product_slug is null
      and candidate_id is not null
    )
    or (
      outcome in ('ambiguous-family', 'bundle')
      and canonical_product_slug is null
      and candidate_id is null
    )
    or (
      outcome = 'dismissed-duplicate'
      and not (canonical_product_slug is not null and candidate_id is not null)
    )
  )
);

create index community_product_research_resolutions_outcome_idx
  on community_product_research_resolutions (outcome, reviewed_at desc);

commit;
