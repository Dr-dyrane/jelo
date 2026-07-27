begin;

-- Operator access begins with an email invitation, but becomes active only after
-- Neon Auth verifies that exact mailbox and supplies its stable user id. Pending
-- invitations therefore never synthesize or stand in for an authenticated subject.
create table moderation_operator_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (
    char_length(email) between 3 and 254
    and email = lower(btrim(email))
    and email like '%_@_%.__%'
  ),
  role text not null default 'admin'
    check (role in ('moderator', 'operator', 'admin')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked')),
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'failed', 'not_configured')),
  invited_by_subject text not null
    check (char_length(invited_by_subject) between 1 and 320),
  accepted_operator_id uuid references moderation_operators(id) on delete restrict,
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  last_sent_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (status = 'pending' and accepted_operator_id is null and accepted_at is null and revoked_at is null)
    or (status = 'accepted' and accepted_operator_id is not null and accepted_at is not null and revoked_at is null)
    or (status = 'revoked' and accepted_operator_id is null and accepted_at is null and revoked_at is not null)
  )
);

create unique index moderation_operator_invitations_pending_email_idx
  on moderation_operator_invitations (lower(email))
  where status = 'pending';

create unique index moderation_operator_invitations_accepted_operator_idx
  on moderation_operator_invitations (accepted_operator_id)
  where accepted_operator_id is not null;

create index moderation_operator_invitations_status_idx
  on moderation_operator_invitations (status, invited_at desc);

-- The transition layer already rejects an invitation for any existing operator
-- email. This index additionally prevents concurrent activation from producing two
-- active identities for one mailbox.
do $$
begin
  if exists (
    select lower(btrim(email))
    from moderation_operators
    where active = true and email is not null
    group by lower(btrim(email))
    having count(*) > 1
  ) then
    raise exception 'Active operator emails must be unique before migration 0025.'
      using errcode = '23505';
  end if;
end
$$;

update moderation_operators
set
  email = lower(btrim(email)),
  updated_at = now()
where email is not null
  and email is distinct from lower(btrim(email));

alter table moderation_operators
  add constraint moderation_operators_normalized_email_check
  check (email is null or email = lower(btrim(email)));

create unique index moderation_operators_active_email_idx
  on moderation_operators (lower(email))
  where active = true and email is not null;

-- Access decisions have a separate append-only trail. They are privileged account
-- lifecycle events, not community moderation decisions, so they should not be
-- forced into a catalogue or community queue.
create table moderation_operator_access_audit (
  id uuid primary key default gen_random_uuid(),
  actor_subject text not null
    check (char_length(actor_subject) between 1 and 320),
  target_kind text not null
    check (target_kind in ('operator', 'invitation')),
  target_ref uuid not null,
  target_email text check (
    target_email is null or char_length(target_email) between 3 and 254
  ),
  action text not null check (action in (
    'invite', 'send', 'accept', 'change_role',
    'deactivate', 'reactivate', 'revoke'
  )),
  previous_role text check (
    previous_role is null or previous_role in ('moderator', 'operator', 'admin')
  ),
  next_role text check (
    next_role is null or next_role in ('moderator', 'operator', 'admin')
  ),
  previous_status text check (
    previous_status is null or previous_status in ('pending', 'active', 'inactive', 'accepted', 'revoked')
  ),
  next_status text check (
    next_status is null or next_status in ('pending', 'active', 'inactive', 'accepted', 'revoked')
  ),
  note text check (note is null or char_length(note) between 1 and 1000),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index moderation_operator_access_audit_target_idx
  on moderation_operator_access_audit (target_kind, target_ref, created_at desc);

create index moderation_operator_access_audit_actor_idx
  on moderation_operator_access_audit (actor_subject, created_at desc);

commit;
