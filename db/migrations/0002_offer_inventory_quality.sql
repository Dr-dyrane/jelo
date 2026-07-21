begin;

create type inventory_status as enum ('in_stock', 'low_stock', 'out_of_stock', 'unknown');
create type verification_method as enum ('manual', 'retailer_page', 'api', 'import');

alter table offers
  add column inventory_status inventory_status not null default 'unknown',
  add column inventory_quantity integer check (inventory_quantity is null or inventory_quantity >= 0),
  add column verification_method verification_method not null default 'import',
  add column verification_note text,
  add column last_verified_at timestamptz,
  add column verification_expires_at timestamptz;

update offers
set
  inventory_status = case when available then 'in_stock'::inventory_status else 'out_of_stock'::inventory_status end,
  verification_method = 'import',
  last_verified_at = coalesce(checked_at, updated_at, created_at),
  verification_expires_at = coalesce(checked_at, updated_at, created_at) + interval '7 days';

create index offers_inventory_status_idx on offers (inventory_status);
create index offers_verification_expiry_idx on offers (verification_expires_at);

commit;
