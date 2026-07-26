begin;

-- Make operator intent explicit in the append-only trail. Mapping an alias and
-- reconciling a materialized research counter are not approvals and should not be
-- recorded as if they were.
alter table moderation_audit_log
  drop constraint moderation_audit_log_queue_check;
alter table moderation_audit_log
  add constraint moderation_audit_log_queue_check check (queue in (
    'community_contribution', 'community_edge', 'community_observation',
    'community_moderation_value', 'community_research_task',
    'retailer_application', 'commerce_signal'
  ));

alter table moderation_audit_log
  drop constraint moderation_audit_log_action_check;
alter table moderation_audit_log
  add constraint moderation_audit_log_action_check check (action in (
    'claim', 'approve', 'reject', 'map', 'promote', 'reconcile', 'defer', 'note'
  ));

-- Migration 0018 introduced first-class observation rows after intake was live,
-- but deliberately did not alter older immutable contributions. Recover those
-- already-submitted price and outcome facts into the same strict, PII-free shape
-- used by current writes. ON CONFLICT keeps the backfill idempotent.
insert into community_observations (
  contribution_id,
  observation_kind,
  subject_kind,
  subject_ref,
  amount_ngn,
  outcome,
  observed_on,
  moderation_status,
  created_at
)
select
  contribution.id,
  'outcome',
  case
    when nullif(contribution.payload -> 'products' -> 0 ->> 'id', '') is null
      then 'anonymous_contribution'
    else 'product'
  end,
  coalesce(
    nullif(contribution.payload -> 'products' -> 0 ->> 'id', ''),
    contribution.id::text
  ),
  null,
  contribution.payload ->> 'outcome',
  null,
  (
    case when contribution.moderation_status = 'rejected' then 'rejected' else 'pending' end
  )::community_moderation_status,
  contribution.submitted_at
from community_contributions contribution
where contribution.payload ->> 'outcome' in ('love-it', 'helped', 'unsure', 'didnt-help')
on conflict (contribution_id, observation_kind, subject_kind, subject_ref) do nothing;

insert into community_observations (
  contribution_id,
  observation_kind,
  subject_kind,
  subject_ref,
  amount_ngn,
  outcome,
  observed_on,
  moderation_status,
  created_at
)
select
  contribution.id,
  'price',
  case
    when nullif(contribution.payload -> 'products' -> 0 ->> 'id', '') is null
      then 'anonymous_contribution'
    else 'product'
  end,
  coalesce(
    nullif(contribution.payload -> 'products' -> 0 ->> 'id', ''),
    contribution.id::text
  ),
  (contribution.payload ->> 'priceNgn')::integer,
  null,
  case
    when contribution.payload ->> 'purchaseDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      then (contribution.payload ->> 'purchaseDate')::date
    else null
  end,
  (
    case when contribution.moderation_status = 'rejected' then 'rejected' else 'pending' end
  )::community_moderation_status,
  contribution.submitted_at
from community_contributions contribution
where contribution.payload ->> 'priceNgn' ~ '^[0-9]+$'
  and (contribution.payload ->> 'priceNgn')::bigint between 100 and 10000000
on conflict (contribution_id, observation_kind, subject_kind, subject_ref) do nothing;

-- A rejected parent cannot leave reviewable child facts behind. Preserve every
-- row for audit and retention purposes; only its moderation state changes.
update community_knowledge_edges edge
set moderation_status = 'rejected'
from community_contributions contribution
where contribution.id = edge.contribution_id
  and contribution.moderation_status = 'rejected'
  and edge.moderation_status = 'pending';

update community_observations observation
set moderation_status = 'rejected'
from community_contributions contribution
where contribution.id = observation.contribution_id
  and contribution.moderation_status = 'rejected'
  and observation.moderation_status = 'pending';

-- signal_count is a materialized scheduling hint, never a trust score. Rebuild it
-- from retained, non-rejected mentions so expired or rejected reports cannot keep
-- a task artificially high in the private research lane.
with active_signals as (
  select
    task.id as task_id,
    count(distinct contribution.id)::integer as signal_count,
    min(contribution.submitted_at) as first_seen_at,
    max(contribution.submitted_at) as last_seen_at
  from community_research_tasks task
  left join community_research_task_mentions mention on mention.task_id = task.id
  left join community_contributions contribution
    on contribution.id = mention.contribution_id
    and contribution.moderation_status <> 'rejected'
    and contribution.retain_until > now()
  group by task.id
)
update community_research_tasks task
set
  signal_count = active_signals.signal_count,
  first_seen_at = coalesce(active_signals.first_seen_at, task.first_seen_at),
  last_seen_at = coalesce(active_signals.last_seen_at, task.last_seen_at),
  updated_at = now()
from active_signals
where task.id = active_signals.task_id
  and (
    task.signal_count <> active_signals.signal_count
    or (active_signals.first_seen_at is not null and task.first_seen_at <> active_signals.first_seen_at)
    or (active_signals.last_seen_at is not null and task.last_seen_at <> active_signals.last_seen_at)
  );

commit;
