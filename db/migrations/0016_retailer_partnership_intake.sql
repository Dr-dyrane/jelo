begin;

create type retailer_partnership_status as enum (
  'draft',
  'submitted',
  'approved',
  'declined',
  'expired'
);

create table retailer_partnership_applications (
  id uuid primary key default gen_random_uuid(),
  edit_secret_hash char(64) not null unique check (edit_secret_hash ~ '^[0-9a-f]{64}$'),
  schema_version smallint not null default 1 check (schema_version = 1),
  store_name text not null check (char_length(store_name) between 2 and 120),
  email text not null check (char_length(email) between 3 and 254),
  email_normalized text not null check (email_normalized = lower(email_normalized)),
  email_verified_at timestamptz,
  contact_consent_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  current_step smallint not null default 4 check (current_step between 1 and 8),
  revision integer not null default 0 check (revision >= 0),
  status retailer_partnership_status not null default 'draft',
  magic_link_sent_at timestamptz,
  magic_link_expires_at timestamptz not null default (now() + interval '30 days'),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  retain_until timestamptz not null default (now() + interval '24 months'),
  check ((status in ('submitted', 'approved', 'declined')) = (submitted_at is not null))
);

create table retailer_partnership_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references retailer_partnership_applications(id) on delete cascade,
  event_type text not null check (event_type in (
    'application_created',
    'magic_link_sent',
    'magic_link_opened',
    'draft_saved',
    'application_submitted'
  )),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index retailer_partnership_status_idx
  on retailer_partnership_applications (status, updated_at desc);
create index retailer_partnership_email_idx
  on retailer_partnership_applications (email_normalized, updated_at desc);
create index retailer_partnership_expiry_idx
  on retailer_partnership_applications (magic_link_expires_at)
  where status = 'draft';
create index retailer_partnership_events_idx
  on retailer_partnership_events (application_id, created_at);

commit;
