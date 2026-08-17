begin;

-- Add 'stripe' as a valid payment provider alongside the legacy 'paystack'
-- and the existing 'manual_bank_transfer'. New payments use Stripe Checkout;
-- historical Paystack rows remain valid for audit and reconciliation.
alter table assisted_order_payments
  drop constraint if exists assisted_order_payments_provider_check;

alter table assisted_order_payments
  add constraint assisted_order_payments_provider_check
  check (provider in ('paystack', 'stripe', 'manual_bank_transfer'));

-- Mirror the Paystack integrity indexes for Stripe so the reservation system
-- enforces one active attempt per (order, quote) and unique provider references.
create unique index if not exists active_stripe_quote_idx
  on assisted_order_payments (order_id, quote_version)
  where provider = 'stripe' and status = 'pending';

create unique index if not exists stripe_reference_idx
  on assisted_order_payments (provider_reference)
  where provider = 'stripe' and provider_reference is not null;

commit;
