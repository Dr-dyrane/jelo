begin;

create type customer_routine_origin as enum (
  'customer',
  'legacy_pages_v1_0'
);

create type customer_routine_step_reference_state as enum (
  'none',
  'catalogue',
  'product_request',
  'unresolved'
);

create table customer_routines (
  id uuid primary key default gen_random_uuid(),
  owner_subject text not null
    check (
      nullif(pg_catalog.btrim(owner_subject), '') is not null
      and pg_catalog.length(owner_subject) <= 320
    ),
  revision integer not null default 0 check (revision >= 0),
  name text not null
    check (
      nullif(pg_catalog.btrim(name), '') is not null
      and pg_catalog.length(name) <= 80
    ),
  origin customer_routine_origin not null default 'customer',
  origin_reference text
    check (
      origin_reference is null
      or (
        origin = 'legacy_pages_v1_0'
        and origin_reference ~ '^pages-v1\.0:(?:morning|evening|hair-wash)$'
      )
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_subject, id),
  check (
    (origin = 'customer' and origin_reference is null)
    or (origin = 'legacy_pages_v1_0' and origin_reference is not null)
  )
);

create index customer_routines_owner_updated_idx
  on customer_routines (owner_subject, updated_at desc, id);

create unique index customer_routines_legacy_origin_idx
  on customer_routines (owner_subject, origin_reference)
  where origin_reference is not null;

create table customer_routine_steps (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null,
  owner_subject text not null,
  position smallint not null check (position between 1 and 20),
  label text not null
    check (
      nullif(pg_catalog.btrim(label), '') is not null
      and pg_catalog.length(label) <= 160
    ),
  instruction text not null default ''
    check (pg_catalog.length(instruction) <= 400),
  reference_state customer_routine_step_reference_state not null default 'none',
  product_identity_version_id uuid
    references catalogue_product_identity_versions(identity_version_id) on delete restrict,
  product_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (routine_id, position),
  foreign key (owner_subject, routine_id)
    references customer_routines(owner_subject, id) on delete cascade,
  foreign key (owner_subject, product_request_id)
    references customer_product_requests(owner_subject, id) on delete restrict,
  check (
    (reference_state = 'catalogue' and product_identity_version_id is not null and product_request_id is null)
    or (reference_state = 'product_request' and product_identity_version_id is null and product_request_id is not null)
    or (reference_state in ('none', 'unresolved') and product_identity_version_id is null and product_request_id is null)
  )
);

create index customer_routine_steps_owner_routine_idx
  on customer_routine_steps (owner_subject, routine_id, position);

alter table customer_routines enable row level security;
alter table customer_routines force row level security;
alter table customer_routine_steps enable row level security;
alter table customer_routine_steps force row level security;

create policy customer_routines_owner_policy
on customer_routines
for all
using (owner_subject = pg_catalog.current_setting('app.customer_subject', true))
with check (owner_subject = pg_catalog.current_setting('app.customer_subject', true));

create policy customer_routine_steps_owner_policy
on customer_routine_steps
for all
using (owner_subject = pg_catalog.current_setting('app.customer_subject', true))
with check (owner_subject = pg_catalog.current_setting('app.customer_subject', true));

alter table customer_shelf_import_receipts
  add column routine_count integer not null default 0
    check (routine_count >= 0),
  add column routine_step_count integer not null default 0
    check (routine_step_count >= 0);

revoke all privileges on table public.customer_routines from public;
revoke all privileges on table public.customer_routine_steps from public;
revoke all privileges on table public.customer_routines from jelocare_app_runtime;
revoke all privileges on table public.customer_routine_steps from jelocare_app_runtime;
revoke all privileges on table public.customer_routines from jelocare_shelf_runtime;
revoke all privileges on table public.customer_routine_steps from jelocare_shelf_runtime;

grant usage on type public.customer_routine_origin to jelocare_shelf_runtime;
grant usage on type public.customer_routine_step_reference_state to jelocare_shelf_runtime;
grant select, insert, update, delete on table public.customer_routines to jelocare_shelf_runtime;
grant select, insert, update, delete on table public.customer_routine_steps to jelocare_shelf_runtime;

commit;
