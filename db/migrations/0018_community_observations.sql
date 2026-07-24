begin;

-- First-class, queryable community price and outcome observations (ADR 0005).
-- Moderation input only: these rows never become canonical catalogue records, and
-- carry no contributor-identifying columns by construction. Price and outcome are
-- the two facts that live only as blob fields and ephemeral edges today.
create table community_observations (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references community_contributions(id) on delete cascade,
  observation_kind text not null check (observation_kind in ('price', 'outcome')),
  subject_kind text not null check (subject_kind in ('product', 'anonymous_contribution')),
  subject_ref text not null check (char_length(subject_ref) between 1 and 160),
  amount_ngn integer check (amount_ngn is null or amount_ngn between 100 and 10000000),
  outcome text check (outcome is null or outcome in ('love-it', 'helped', 'unsure', 'didnt-help')),
  observed_on date,
  confidence_state text not null default 'community_reported' check (confidence_state = 'community_reported'),
  moderation_status community_moderation_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (contribution_id, observation_kind, subject_kind, subject_ref),
  check (
    (observation_kind = 'price' and amount_ngn is not null and outcome is null)
    or (observation_kind = 'outcome' and outcome is not null and amount_ngn is null)
  )
);

create index community_observations_queue_idx
  on community_observations (moderation_status, observation_kind, created_at);

commit;
