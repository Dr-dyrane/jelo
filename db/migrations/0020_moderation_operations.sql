begin;

-- Internal moderation and operations console (ADR 0007). Two tables: an operator
-- allowlist and an append-only audit log. This is not a public surface and writes
-- no canonical catalogue records. Operator identity is the Neon Auth subject
-- (neon_auth.users_sync), stored as text so this migration applies before Neon
-- Auth is configured; there is deliberately no hard foreign key to that schema.
create table moderation_operators (
  id uuid primary key default gen_random_uuid(),
  auth_subject text not null unique check (char_length(auth_subject) between 1 and 320),
  email text check (email is null or char_length(email) between 3 and 320),
  display_name text check (display_name is null or char_length(display_name) between 1 and 160),
  role text not null default 'moderator' check (role in ('moderator', 'operator', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Append-only. Every consequential moderation action records who acted, in which
-- queue, on which target, whether it wrote a canonical record, and why. The audit
-- row is written in the same transaction as the action it records (ADR 0007), so a
-- promotion and its trail commit or roll back together.
create table moderation_audit_log (
  id uuid primary key default gen_random_uuid(),
  operator_subject text not null check (char_length(operator_subject) between 1 and 320),
  queue text not null check (queue in (
    'community_contribution', 'community_edge', 'community_observation',
    'community_moderation_value', 'retailer_application', 'commerce_signal'
  )),
  action text not null check (action in ('claim', 'approve', 'reject', 'promote', 'defer', 'note')),
  target_ref text not null check (char_length(target_ref) between 1 and 200),
  canonical_write boolean not null default false,
  rationale text check (rationale is null or char_length(rationale) between 1 and 2000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index moderation_audit_log_queue_idx on moderation_audit_log (queue, created_at desc);
create index moderation_audit_log_operator_idx on moderation_audit_log (operator_subject, created_at desc);

commit;
