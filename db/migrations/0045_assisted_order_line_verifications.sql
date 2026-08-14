begin;

-- Order-time verification captures fresh price, stock, delivery, and full
-- cost-breakdown data for each line in an assisted order. The extraction runs
-- immediately after order creation (Woo cart API, HTTP, Playwright, or AI
-- Gateway) and stores the result here so operators see pre-filled data instead
-- of manually browsing every retailer.
--
-- One row per order line per verification attempt. The latest verification per
-- line is the active one (is_latest = true); older attempts are retained for
-- audit but marked is_latest = false.
create table assisted_order_line_verifications (
  id uuid primary key default gen_random_uuid(),
  order_line_id uuid not null references assisted_order_lines(id) on delete restrict,
  order_id uuid not null references assisted_orders(id) on delete restrict,
  attempt integer not null check (attempt between 1 and 5),
  is_latest boolean not null default true,

  -- Price and stock verification (existing extraction chain)
  verified_unit_price_ngn integer check (verified_unit_price_ngn is null or verified_unit_price_ngn >= 0),
  verified_inventory_status text check (
    verified_inventory_status is null
    or verified_inventory_status in ('in_stock', 'low_stock', 'out_of_stock', 'unknown')
  ),
  verified_currency_code text not null default 'NGN' check (verified_currency_code = 'NGN'),

  -- Full cost breakdown (from Woo cart API, Playwright cart simulation, or AI extraction)
  verified_product_subtotal_ngn integer check (verified_product_subtotal_ngn is null or verified_product_subtotal_ngn >= 0),
  verified_delivery_ngn integer check (verified_delivery_ngn is null or verified_delivery_ngn >= 0),
  verified_tax_ngn integer check (verified_tax_ngn is null or verified_tax_ngn >= 0),
  verified_retailer_fee_ngn integer check (verified_retailer_fee_ngn is null or verified_retailer_fee_ngn >= 0),
  verified_total_ngn integer check (verified_total_ngn is null or verified_total_ngn >= 0),

  -- Extraction metadata
  verification_method text not null check (
    verification_method in ('woo-store-api', 'woo-cart-api', 'retailer_page', 'browser_cart', 'ai_extraction', 'ai_cart_extraction', 'manual')
  ),
  verification_confidence integer not null default 0 check (verification_confidence between 0 and 100),
  verification_evidence jsonb not null default '[]'::jsonb,
  verification_delivery_note text check (verification_delivery_note is null or length(verification_delivery_note) <= 500),
  verification_error text,

  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique (order_line_id, attempt)
);

create index assisted_order_line_verifications_order_idx
  on assisted_order_line_verifications (order_id, created_at, id);

create index assisted_order_line_verifications_latest_idx
  on assisted_order_line_verifications (order_line_id)
  where is_latest = true;

-- Backfill: no existing verifications. All existing orders have no
-- verification data; operators will see observed prices only until a
-- verification is triggered.

revoke all privileges on table assisted_order_line_verifications from public;
grant select, insert, update on table assisted_order_line_verifications to jelocare_app_runtime;
revoke delete on table assisted_order_line_verifications from jelocare_app_runtime;

commit;
