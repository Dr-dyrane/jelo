begin;

-- Service fee policies determine the JeloCare service fee for each assisted
-- order quote. Policies are matched by retailer and/or delivery state, with
-- the highest-priority active match winning. The operator can still override
-- the resolved fee at quote time; both the resolved and actual values are
-- stored for audit.
create table service_fee_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (
    nullif(trim(name), '') is not null and length(trim(name)) <= 120
  ),
  retailer_slug text check (retailer_slug is null or length(retailer_slug) <= 120),
  delivery_state text check (
    delivery_state is null or length(delivery_state) <= 60
  ),
  fee_model text not null check (
    fee_model in ('flat', 'percentage', 'pct_with_cap')
  ),
  flat_fee_ngn integer check (
    (fee_model = 'flat' and flat_fee_ngn is not null and flat_fee_ngn >= 0)
    or fee_model <> 'flat'
  ),
  percentage_rate numeric(5,2) check (
    (fee_model in ('percentage', 'pct_with_cap') and percentage_rate is not null and percentage_rate > 0 and percentage_rate <= 100)
    or fee_model = 'flat'
  ),
  min_fee_ngn integer check (min_fee_ngn is null or min_fee_ngn >= 0),
  max_fee_ngn integer check (max_fee_ngn is null or max_fee_ngn >= 0),
  priority integer not null default 0 check (priority between 0 and 1000),
  is_active boolean not null default true,
  notes text check (notes is null or length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_fee_policy_pct_cap_check check (
    fee_model <> 'pct_with_cap'
    or (min_fee_ngn is not null and max_fee_ngn is not null and min_fee_ngn <= max_fee_ngn)
  ),
  constraint service_fee_policy_scope_check check (
    -- At least one scope dimension must be set or the policy is a catch-all.
    -- Both null is allowed (catch-all); both set is allowed (specific retailer + state).
    retailer_slug is not null or delivery_state is not null or true
  )
);

create index service_fee_policies_match_idx
  on service_fee_policies (priority desc, id)
  where is_active = true;

-- Audit columns on assisted_order_quotes: which policy was resolved and what
-- it suggested, vs. what the operator actually entered.
alter table assisted_order_quotes
  add column service_fee_policy_id uuid references service_fee_policies(id) on delete set null,
  add column service_fee_policy_resolved_ngn integer check (
    service_fee_policy_resolved_ngn is null or service_fee_policy_resolved_ngn >= 0
  );

-- Seed a sensible default catch-all policy so every order gets a fee without
-- operator guessing. 5% of product subtotal, floored at 500 NGN, capped at
-- 5,000 NGN.
insert into service_fee_policies (
  name, retailer_slug, delivery_state, fee_model,
  percentage_rate, min_fee_ngn, max_fee_ngn, priority, is_active, notes
) values (
  'Default', null, null, 'pct_with_cap',
  5.00, 500, 5000, 0, true,
  'Catch-all: 5% of product subtotal, min 500 NGN, max 5,000 NGN.'
);

revoke all privileges on table service_fee_policies from public;
grant select, insert, update on table service_fee_policies to jelocare_app_runtime;
revoke delete on table service_fee_policies from jelocare_app_runtime;

commit;
