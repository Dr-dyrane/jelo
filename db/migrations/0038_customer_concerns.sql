begin;

create type customer_concern_origin as enum (
  'customer',
  'synthetic-development'
);

create table customer_concerns (
  id uuid primary key default gen_random_uuid(),
  owner_subject text not null
    check (
      nullif(pg_catalog.btrim(owner_subject), '') is not null
      and pg_catalog.length(owner_subject) <= 320
    ),
  concern_slug text not null
    check (
      nullif(pg_catalog.btrim(concern_slug), '') is not null
      and pg_catalog.length(concern_slug) <= 80
    ),
  origin customer_concern_origin not null default 'customer',
  saved_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (owner_subject, concern_slug, removed_at)
);

create unique index customer_concerns_owner_slug_active_idx
  on customer_concerns (owner_subject, concern_slug)
  where removed_at is null;

create index customer_concerns_owner_saved_idx
  on customer_concerns (owner_subject, saved_at desc);

alter table customer_concerns enable row level security;
alter table customer_concerns force row level security;

create policy customer_concerns_owner_policy
on customer_concerns
for all
using (owner_subject = pg_catalog.current_setting('app.customer_subject', true))
with check (owner_subject = pg_catalog.current_setting('app.customer_subject', true));

revoke all privileges on table public.customer_concerns from public;
revoke all privileges on table public.customer_concerns from jelocare_app_runtime;
revoke all privileges on table public.customer_concerns from jelocare_shelf_runtime;

grant usage on type public.customer_concern_origin to jelocare_shelf_runtime;
grant select, insert, update on table public.customer_concerns to jelocare_shelf_runtime;

commit;
