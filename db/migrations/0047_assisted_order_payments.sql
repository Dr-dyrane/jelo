begin;

-- Payment records for assisted orders. Each record tracks one payment attempt
-- for an approved quote. The provider field distinguishes Paystack (automatic
-- webhook verification) from manual bank transfers (operator-verified).
-- An order transitions to 'paid' only when a payment record reaches 'verified'
-- status with evidence that matches the approved quote total.
create table assisted_order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references assisted_orders(id) on delete restrict,
  quote_version integer not null check (quote_version > 0),
  amount_ngn integer not null check (amount_ngn > 0 and amount_ngn <= 100_000_000),
  provider text not null check (provider in ('paystack', 'manual_bank_transfer')),
  provider_reference text check (
    provider_reference is null or length(provider_reference) <= 200
  ),
  status text not null default 'pending' check (status in (
    'pending', 'verified', 'failed', 'abandoned'
  )),
  evidence_reference text check (
    evidence_reference is null or length(evidence_reference) <= 1000
  ),
  verified_by_subject text check (
    verified_by_subject is null or length(verified_by_subject) <= 320
  ),
  verified_at timestamptz,
  provider_metadata jsonb check (
    provider_metadata is null or jsonb_typeof(provider_metadata) = 'object'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assisted_order_payments_order_idx
  on assisted_order_payments (order_id, created_at);

create index assisted_order_payments_verified_idx
  on assisted_order_payments (order_id)
  where status = 'verified';

create unique index assisted_order_payments_one_verified_per_order
  on assisted_order_payments (order_id)
  where status = 'verified';

revoke all privileges on table assisted_order_payments from public;
grant select, insert, update on table assisted_order_payments to jelocare_app_runtime;
revoke delete on table assisted_order_payments from jelocare_app_runtime;

commit;
