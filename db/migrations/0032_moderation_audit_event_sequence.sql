begin;

-- created_at uses transaction-start time and UUIDs are random, so neither can
-- establish causal order across overlapping transactions. Preserve both as
-- presentation/identity fields and add a database-owned monotonic event order.
create sequence moderation_audit_log_event_sequence_seq as bigint;

alter table moderation_audit_log
  add column event_sequence bigint;

-- Existing rows predate the sequence. Give them one deterministic historical
-- order without changing their IDs, timestamps, or audit content.
with ordered_history as (
  select
    id,
    row_number() over (order by created_at asc, id asc)::bigint as event_sequence
  from moderation_audit_log
)
update moderation_audit_log audit
set event_sequence = ordered_history.event_sequence
from ordered_history
where audit.id = ordered_history.id;

select setval(
  'moderation_audit_log_event_sequence_seq',
  greatest(coalesce((select max(event_sequence) from moderation_audit_log), 0) + 1, 1),
  false
);

alter sequence moderation_audit_log_event_sequence_seq
  owned by moderation_audit_log.event_sequence;

alter table moderation_audit_log
  alter column event_sequence set default nextval('moderation_audit_log_event_sequence_seq'),
  alter column event_sequence set not null,
  add constraint moderation_audit_log_event_sequence_key unique (event_sequence);

create index moderation_audit_log_target_sequence_idx
  on moderation_audit_log (queue, target_ref, event_sequence desc);

commit;
