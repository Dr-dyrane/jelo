begin;

create type customer_saved_location_kind as enum ('delivery', 'billing');

create table customer_saved_locations (
  id uuid primary key default gen_random_uuid(),
  owner_subject text not null
    check (nullif(pg_catalog.btrim(owner_subject), '') is not null and pg_catalog.length(owner_subject) <= 320),
  kind customer_saved_location_kind not null,
  label text not null
    check (pg_catalog.length(pg_catalog.btrim(label)) between 2 and 60),
  address_line text not null
    check (pg_catalog.length(pg_catalog.btrim(address_line)) between 5 and 500),
  city text not null
    check (pg_catalog.length(pg_catalog.btrim(city)) between 2 and 120),
  state text not null
    check (pg_catalog.length(pg_catalog.btrim(state)) between 2 and 120),
  postal_code text
    check (postal_code is null or pg_catalog.length(pg_catalog.btrim(postal_code)) between 1 and 20),
  is_default boolean not null default false,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_subject, id)
);

create unique index customer_saved_locations_default_idx
  on customer_saved_locations (owner_subject, kind)
  where is_default;

create index customer_saved_locations_owner_idx
  on customer_saved_locations (owner_subject, kind, updated_at desc, id);

alter table customer_saved_locations enable row level security;
alter table customer_saved_locations force row level security;

create policy customer_saved_locations_owner_policy
on customer_saved_locations
for all
using (owner_subject = pg_catalog.current_setting('app.customer_subject', true))
with check (owner_subject = pg_catalog.current_setting('app.customer_subject', true));

revoke all privileges on table public.customer_saved_locations from public;
revoke all privileges on table public.customer_saved_locations from jelocare_app_runtime;
revoke all privileges on table public.customer_saved_locations from jelocare_shelf_runtime;

grant usage on type public.customer_saved_location_kind to jelocare_shelf_runtime;
grant select, insert, update, delete on table public.customer_saved_locations to jelocare_shelf_runtime;

commit;
