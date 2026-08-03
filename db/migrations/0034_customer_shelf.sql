begin;

create type customer_shelf_save_origin as enum (
  'customer',
  'legacy_pages_v1_0'
);

create table customer_shelf_items (
  owner_subject text not null
    check (nullif(trim(owner_subject), '') is not null and length(owner_subject) <= 320),
  product_identity_version_id uuid not null
    references catalogue_product_identity_versions(identity_version_id) on delete restrict,
  saved_at timestamptz not null default now(),
  save_origin customer_shelf_save_origin not null default 'customer',
  primary key (owner_subject, product_identity_version_id)
);

create index customer_shelf_items_owner_saved_idx
  on customer_shelf_items (owner_subject, saved_at desc, product_identity_version_id);

alter table customer_shelf_items enable row level security;
alter table customer_shelf_items force row level security;

create policy customer_shelf_items_owner_policy
on customer_shelf_items
for all
using (
  owner_subject = pg_catalog.current_setting('app.customer_subject', true)
)
with check (
  owner_subject = pg_catalog.current_setting('app.customer_subject', true)
);

commit;
