begin;

create table assisted_orders (
  id uuid primary key default gen_random_uuid(),
  request_key_hash text not null unique check (request_key_hash ~ '^[0-9a-f]{64}$'),
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  public_reference text not null unique
    check (public_reference ~ '^JC-[A-Z0-9]{10}$'),
  owner_subject text
    check (owner_subject is null or (nullif(trim(owner_subject), '') is not null and length(owner_subject) <= 320)),
  retailer_name text not null check (nullif(trim(retailer_name), '') is not null),
  currency text not null default 'NGN' check (currency = 'NGN'),
  state text not null default 'requested' check (state in (
    'requested', 'quoting', 'awaiting_approval', 'needs_response',
    'payment_pending', 'paid', 'procurement', 'retailer_confirmed',
    'out_for_delivery', 'delivered', 'cancelled', 'refund_pending', 'refunded'
  )),
  revision integer not null default 1 check (revision > 0),
  contact_name text not null check (length(trim(contact_name)) between 2 and 120),
  contact_email text not null check (length(trim(contact_email)) between 3 and 320),
  contact_phone text not null check (length(trim(contact_phone)) between 7 and 40),
  delivery_address text not null check (length(trim(delivery_address)) between 5 and 500),
  delivery_city text not null check (length(trim(delivery_city)) between 2 and 120),
  delivery_state text not null check (length(trim(delivery_state)) between 2 and 120),
  delivery_instructions text check (delivery_instructions is null or length(delivery_instructions) <= 500),
  whatsapp_consent_at timestamptz,
  whatsapp_consent_policy text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retain_until timestamptz not null default (now() + interval '365 days'),
  constraint assisted_orders_whatsapp_consent_check check (
    (whatsapp_consent_at is null and whatsapp_consent_policy is null)
    or (whatsapp_consent_at is not null and nullif(trim(whatsapp_consent_policy), '') is not null)
  )
);

create index assisted_orders_owner_idx on assisted_orders (owner_subject, created_at desc)
  where owner_subject is not null;
create index assisted_orders_queue_idx on assisted_orders (state, updated_at, id)
  where state not in ('delivered', 'cancelled', 'refunded');

create table assisted_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references assisted_orders(id) on delete restrict,
  product_identity_version_id uuid
    references catalogue_product_identity_versions(identity_version_id) on delete restrict,
  product_slug text not null check (nullif(trim(product_slug), '') is not null),
  product_brand text not null check (nullif(trim(product_brand), '') is not null),
  product_name text not null check (nullif(trim(product_name), '') is not null),
  product_size text not null check (nullif(trim(product_size), '') is not null),
  product_image text not null check (nullif(trim(product_image), '') is not null),
  quantity integer not null check (quantity between 1 and 10),
  observed_unit_price_ngn integer not null check (observed_unit_price_ngn >= 0),
  observed_listing_url text not null check (observed_listing_url ~ '^https://'),
  observed_evidence_reference text not null check (nullif(trim(observed_evidence_reference), '') is not null),
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (order_id, product_identity_version_id)
);

comment on column assisted_order_lines.product_identity_version_id is
  'Normalized catalogue identity version when available. The immutable brand/name/size/image snapshot remains authoritative for legacy public records.';

create unique index assisted_order_lines_order_slug_idx
  on assisted_order_lines (order_id, product_slug);

create index assisted_order_lines_order_idx on assisted_order_lines (order_id, created_at, id);

create table assisted_order_quotes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references assisted_orders(id) on delete restrict,
  version integer not null check (version > 0),
  status text not null default 'awaiting_approval'
    check (status in ('awaiting_approval', 'approved', 'declined', 'expired', 'superseded')),
  currency text not null default 'NGN' check (currency = 'NGN'),
  product_subtotal_ngn integer check (product_subtotal_ngn >= 0),
  retailer_fee_ngn integer check (retailer_fee_ngn >= 0),
  tax_ngn integer check (tax_ngn >= 0),
  jelocare_fee_ngn integer check (jelocare_fee_ngn >= 0),
  delivery_ngn integer check (delivery_ngn >= 0),
  total_ngn integer generated always as (
    product_subtotal_ngn + retailer_fee_ngn + tax_ngn + jelocare_fee_ngn + delivery_ngn
  ) stored,
  evidence_reference text not null check (nullif(trim(evidence_reference), '') is not null),
  notes text check (notes is null or length(notes) <= 1000),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at > issued_at),
  approved_at timestamptz,
  created_by_subject text not null check (nullif(trim(created_by_subject), '') is not null),
  created_at timestamptz not null default now(),
  unique (order_id, version),
  constraint assisted_order_quote_approval_check check (
    (status = 'approved' and approved_at is not null)
    or (status <> 'approved' and approved_at is null)
  ),
  constraint assisted_order_quote_complete_check check (
    status <> 'awaiting_approval'
    or (
      product_subtotal_ngn is not null
      and retailer_fee_ngn is not null
      and tax_ngn is not null
      and jelocare_fee_ngn is not null
      and delivery_ngn is not null
    )
  )
);

create index assisted_order_quotes_order_idx on assisted_order_quotes (order_id, version desc);
create index assisted_order_quotes_expiry_idx on assisted_order_quotes (expires_at, order_id)
  where status = 'awaiting_approval';

create table assisted_order_events (
  sequence_id bigint generated always as identity primary key,
  id uuid not null unique default gen_random_uuid(),
  order_id uuid not null references assisted_orders(id) on delete restrict,
  actor_kind text not null check (actor_kind in ('guest', 'customer', 'operator', 'system')),
  actor_reference text,
  action text not null check (nullif(trim(action), '') is not null),
  from_state text,
  to_state text not null check (to_state in (
    'requested', 'quoting', 'awaiting_approval', 'needs_response',
    'payment_pending', 'paid', 'procurement', 'retailer_confirmed',
    'out_for_delivery', 'delivered', 'cancelled', 'refund_pending', 'refunded'
  )),
  quote_version integer check (quote_version is null or quote_version > 0),
  reason text check (reason is null or length(reason) <= 1000),
  evidence_reference text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index assisted_order_events_order_idx on assisted_order_events (order_id, sequence_id);

create table assisted_order_guest_sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  order_id uuid not null references assisted_orders(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint assisted_order_guest_session_expiry_check check (expires_at > created_at)
);

create index assisted_order_guest_sessions_order_idx on assisted_order_guest_sessions (order_id, expires_at desc);

create table assisted_order_recovery_capabilities (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  order_id uuid not null references assisted_orders(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint assisted_order_recovery_expiry_check check (expires_at > created_at),
  constraint assisted_order_recovery_settlement_check check (
    consumed_at is null or invalidated_at is null
  )
);

create index assisted_order_recovery_order_idx
  on assisted_order_recovery_capabilities (order_id, created_at desc);

create function assisted_order_events_are_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'Assisted order events are append-only.';
end;
$$;

create trigger assisted_order_events_no_update
before update or delete on assisted_order_events
for each row execute function assisted_order_events_are_append_only();

revoke all privileges on table assisted_orders, assisted_order_lines,
  assisted_order_quotes, assisted_order_events, assisted_order_guest_sessions,
  assisted_order_recovery_capabilities from public;

grant select, insert, update on table assisted_orders, assisted_order_quotes,
  assisted_order_guest_sessions, assisted_order_recovery_capabilities to jelocare_app_runtime;
grant select, insert on table assisted_order_lines, assisted_order_events to jelocare_app_runtime;
grant usage, select on sequence assisted_order_events_sequence_id_seq to jelocare_app_runtime;

revoke delete on table assisted_orders, assisted_order_lines, assisted_order_quotes,
  assisted_order_events from jelocare_app_runtime;
revoke update, delete on table assisted_order_lines, assisted_order_events from jelocare_app_runtime;

commit;
