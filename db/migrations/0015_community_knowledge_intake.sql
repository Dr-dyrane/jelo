begin;

create type community_contribution_kind as enum ('product', 'routine', 'store');
create type community_intake_draft_status as enum ('draft', 'submitted', 'expired');
create type community_moderation_status as enum ('pending', 'mapped', 'approved', 'rejected');
create type community_input_mode as enum ('tap', 'search', 'type', 'custom');

create table community_intake_drafts (
  id uuid primary key default gen_random_uuid(),
  edit_secret_hash char(64) not null unique check (edit_secret_hash ~ '^[0-9a-f]{64}$'),
  schema_version smallint not null default 1 check (schema_version = 1),
  contribution_kind community_contribution_kind not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  current_step smallint not null default 1 check (current_step between 1 and 9),
  revision integer not null default 0 check (revision >= 0),
  status community_intake_draft_status not null default 'draft',
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  submitted_at timestamptz,
  check ((status = 'submitted') = (submitted_at is not null))
);

create table community_contributions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null unique references community_intake_drafts(id) on delete restrict,
  schema_version smallint not null default 1 check (schema_version = 1),
  contribution_kind community_contribution_kind not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  confidence_state text not null default 'community_reported' check (confidence_state = 'community_reported'),
  moderation_status community_moderation_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  retain_until timestamptz not null default (now() + interval '24 months')
);

create table community_moderation_values (
  id uuid primary key default gen_random_uuid(),
  value_kind text not null check (value_kind in ('purpose', 'product', 'brand', 'retailer')),
  raw_value text not null check (char_length(raw_value) between 1 and 120),
  normalized_value text not null check (char_length(normalized_value) between 1 and 120),
  status community_moderation_status not null default 'pending',
  canonical_entity_kind text,
  canonical_entity_ref text,
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer text,
  review_note text,
  unique (value_kind, normalized_value)
);

create table community_moderation_mentions (
  moderation_value_id uuid not null references community_moderation_values(id) on delete cascade,
  contribution_id uuid not null references community_contributions(id) on delete cascade,
  field_path text not null,
  selected_context jsonb not null default '{}'::jsonb check (jsonb_typeof(selected_context) = 'object'),
  created_at timestamptz not null default now(),
  primary key (moderation_value_id, contribution_id, field_path)
);

create table community_intake_events (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references community_intake_drafts(id) on delete cascade,
  client_event_id uuid not null,
  event_type text not null check (event_type in ('step_viewed', 'selection_changed', 'draft_restored')),
  step smallint not null check (step between 1 and 9),
  input_mode community_input_mode,
  results_count smallint check (results_count is null or results_count between 0 and 100),
  created_at timestamptz not null default now(),
  unique (draft_id, client_event_id)
);

create table community_knowledge_edges (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references community_contributions(id) on delete cascade,
  subject_kind text not null,
  subject_ref text not null,
  predicate text not null,
  object_kind text not null,
  object_ref text not null,
  confidence_state text not null default 'community_reported' check (confidence_state = 'community_reported'),
  moderation_status community_moderation_status not null default 'pending',
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (contribution_id, subject_kind, subject_ref, predicate, object_kind, object_ref)
);

create index community_intake_drafts_expiry_idx
  on community_intake_drafts (expires_at) where status = 'draft';
create index community_contributions_moderation_idx
  on community_contributions (moderation_status, submitted_at);
create index community_moderation_values_queue_idx
  on community_moderation_values (status, last_seen_at desc);
create index community_intake_events_type_idx
  on community_intake_events (event_type, created_at);
create index community_knowledge_edges_queue_idx
  on community_knowledge_edges (moderation_status, predicate, created_at);

commit;
