begin;

-- Change all NGN money columns from integer to numeric(12,2) so that
-- decimal amounts (e.g. retailer prices with kobo) can be stored and
-- quoted accurately. integer columns silently truncate or reject decimals.

-- 1. assisted_order_lines.observed_unit_price_ngn
alter table assisted_order_lines
  alter column observed_unit_price_ngn type numeric(12,2) using observed_unit_price_ngn::numeric(12,2);

-- 2. assisted_order_quotes: drop the generated total first, alter components, recreate
alter table assisted_order_quotes drop column total_ngn;

alter table assisted_order_quotes
  alter column product_subtotal_ngn type numeric(12,2) using product_subtotal_ngn::numeric(12,2),
  alter column retailer_fee_ngn type numeric(12,2) using retailer_fee_ngn::numeric(12,2),
  alter column tax_ngn type numeric(12,2) using tax_ngn::numeric(12,2),
  alter column jelocare_fee_ngn type numeric(12,2) using jelocare_fee_ngn::numeric(12,2),
  alter column delivery_ngn type numeric(12,2) using delivery_ngn::numeric(12,2);

alter table assisted_order_quotes
  add column total_ngn numeric(12,2) generated always as (
    product_subtotal_ngn + retailer_fee_ngn + tax_ngn + jelocare_fee_ngn + delivery_ngn
  ) stored;

-- 3. assisted_order_line_verifications
alter table assisted_order_line_verifications
  alter column verified_unit_price_ngn type numeric(12,2) using verified_unit_price_ngn::numeric(12,2),
  alter column verified_product_subtotal_ngn type numeric(12,2) using verified_product_subtotal_ngn::numeric(12,2),
  alter column verified_delivery_ngn type numeric(12,2) using verified_delivery_ngn::numeric(12,2),
  alter column verified_tax_ngn type numeric(12,2) using verified_tax_ngn::numeric(12,2),
  alter column verified_retailer_fee_ngn type numeric(12,2) using verified_retailer_fee_ngn::numeric(12,2),
  alter column verified_total_ngn type numeric(12,2) using verified_total_ngn::numeric(12,2);

-- 4. assisted_order_payments.amount_ngn
alter table assisted_order_payments
  alter column amount_ngn type numeric(12,2) using amount_ngn::numeric(12,2);

-- 5. service_fee_policies: flat_fee_ngn, min_fee_ngn, max_fee_ngn
alter table service_fee_policies
  alter column flat_fee_ngn type numeric(12,2) using flat_fee_ngn::numeric(12,2),
  alter column min_fee_ngn type numeric(12,2) using min_fee_ngn::numeric(12,2),
  alter column max_fee_ngn type numeric(12,2) using max_fee_ngn::numeric(12,2);

-- 6. assisted_order_quotes.service_fee_policy_resolved_ngn
alter table assisted_order_quotes
  alter column service_fee_policy_resolved_ngn type numeric(12,2) using service_fee_policy_resolved_ngn::numeric(12,2);

commit;
