begin;

-- Never guess which externally live payment attempt should survive. If the
-- legacy implementation created ambiguity, stop the migration for explicit
-- provider reconciliation instead of silently selecting a row.
do $$
begin
  if exists (
    select 1
    from assisted_order_payments
    where provider = 'paystack' and status = 'pending'
    group by order_id, quote_version
    having count(*) > 1
  ) then
    raise exception 'Payment integrity migration blocked: duplicate active Paystack attempts require provider reconciliation.';
  end if;

  if exists (
    select 1
    from assisted_order_payments
    where provider = 'paystack'
      and status = 'pending'
      and (
        provider_reference is null
        or
        coalesce(provider_metadata->>'phase', '') not in ('reserved', 'ready')
        or nullif(provider_metadata->>'reservedAt', '') is null
        or provider_metadata->>'reservedAt'
          !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$'
        or not pg_input_is_valid(
          provider_metadata->>'reservedAt', 'timestamp with time zone'
        )
        or (
          provider_metadata->>'phase' = 'ready'
          and (
            nullif(provider_metadata->>'authorizationUrl', '') is null
            or nullif(provider_metadata->>'accessCode', '') is null
            or nullif(provider_metadata->>'initializedAt', '') is null
            or not pg_input_is_valid(
              provider_metadata->>'initializedAt', 'timestamp with time zone'
            )
          )
        )
      )
  ) then
    raise exception 'Payment integrity migration blocked: legacy active Paystack attempts require provider reconciliation.';
  end if;

  if exists (
    select 1
    from assisted_order_payments
    where provider = 'paystack' and provider_reference is not null
    group by provider_reference
    having count(*) > 1
  ) then
    raise exception 'Payment integrity migration blocked: duplicate Paystack references require provider reconciliation.';
  end if;

  if exists (
    select 1
    from assisted_order_payments
    where provider = 'manual_bank_transfer' and status = 'verified'
    group by lower(btrim(provider_reference))
    having count(*) > 1
  ) then
    raise exception 'Payment integrity migration blocked: manual bank references are reused.';
  end if;

  if exists (
    select 1 from assisted_order_payments
    where (provider = 'paystack' and provider_reference is null)
       or (provider = 'manual_bank_transfer' and status = 'verified'
           and nullif(btrim(provider_reference), '') is null)
       or (
         status = 'verified'
         and (verified_at is null or nullif(btrim(evidence_reference), '') is null)
       )
  ) then
    raise exception 'Payment integrity migration blocked: malformed payment ledger rows require reconciliation.';
  end if;
end;
$$;

create unique index assisted_order_payments_active_paystack_quote_idx
  on assisted_order_payments (order_id, quote_version)
  where provider = 'paystack' and status = 'pending';

create unique index assisted_order_payments_paystack_reference_idx
  on assisted_order_payments (provider_reference)
  where provider = 'paystack' and provider_reference is not null;

create unique index assisted_order_payments_manual_reference_idx
  on assisted_order_payments (lower(btrim(provider_reference)))
  where provider = 'manual_bank_transfer' and status = 'verified';

alter table assisted_order_payments
  add constraint assisted_order_payments_verified_evidence_check check (
    status <> 'verified'
    or (verified_at is not null and nullif(btrim(evidence_reference), '') is not null)
  ) not valid,
  add constraint assisted_order_payments_paystack_reference_check check (
    provider <> 'paystack' or nullif(btrim(provider_reference), '') is not null
  ) not valid,
  add constraint assisted_order_payments_manual_reference_check check (
    provider <> 'manual_bank_transfer' or status <> 'verified'
    or nullif(btrim(provider_reference), '') is not null
  ) not valid;

alter table assisted_order_payments
  validate constraint assisted_order_payments_verified_evidence_check,
  validate constraint assisted_order_payments_paystack_reference_check,
  validate constraint assisted_order_payments_manual_reference_check;

alter table assisted_order_notifications
  drop constraint assisted_order_notifications_kind_check;

alter table assisted_order_notifications
  add constraint assisted_order_notifications_kind_check check (kind in (
    'quote_ready', 'action_needed', 'cancelled', 'payment_confirmed',
    'payment_issue', 'retailer_confirmed', 'out_for_delivery', 'delivered',
    'refund_update'
  ));

create function enqueue_assisted_order_payment_notification()
returns trigger language plpgsql as $$
declare
  order_record assisted_orders%rowtype;
  notification_kind text;
  notification_title text;
  notification_message text;
begin
  case new.action
    when 'payment_verified' then
      notification_kind := 'payment_confirmed';
      notification_title := 'Payment confirmed.';
      notification_message := 'The exact approved total was verified for your order.';
    when 'payment_failed' then
      notification_kind := 'payment_issue';
      notification_title := 'Payment needs another try.';
      notification_message := 'No payment was confirmed. Your order is still awaiting payment.';
    when 'payment_abandoned' then
      notification_kind := 'payment_issue';
      notification_title := 'Payment was not completed.';
      notification_message := 'No payment was confirmed. Your order is still awaiting payment.';
    else
      return new;
  end case;

  select * into order_record from assisted_orders where id = new.order_id;
  if not found then return new; end if;

  insert into assisted_order_notifications (
    order_id, event_id, owner_subject, kind, title, message, href,
    email_status, retain_until
  ) values (
    order_record.id,
    new.id,
    order_record.owner_subject,
    notification_kind,
    notification_title,
    notification_message,
    case when order_record.owner_subject is null then '/order' else '/me/orders' end,
    case when order_record.email_notifications_consent_at is null then 'suppressed' else 'pending' end,
    order_record.retain_until
  ) on conflict (event_id) do nothing;

  return new;
end;
$$;

create trigger assisted_order_events_enqueue_payment_notification
after insert on assisted_order_events
for each row execute function enqueue_assisted_order_payment_notification();

-- Historic payment events become private in-app records only. Never enqueue a
-- retrospective email during deployment.
insert into assisted_order_notifications (
  order_id, event_id, owner_subject, kind, title, message, href,
  email_status, retain_until, created_at, updated_at
)
select
  orders.id,
  event.id,
  orders.owner_subject,
  case event.action
    when 'payment_verified' then 'payment_confirmed'
    else 'payment_issue'
  end,
  case event.action
    when 'payment_verified' then 'Payment confirmed.'
    when 'payment_failed' then 'Payment needs another try.'
    else 'Payment was not completed.'
  end,
  case event.action
    when 'payment_verified' then 'The exact approved total was verified for your order.'
    else 'No payment was confirmed. Your order is still awaiting payment.'
  end,
  case when orders.owner_subject is null then '/order' else '/me/orders' end,
  'suppressed',
  orders.retain_until,
  event.created_at,
  event.created_at
from assisted_order_events event
join assisted_orders orders on orders.id = event.order_id
where event.action in ('payment_verified', 'payment_failed', 'payment_abandoned')
on conflict (event_id) do nothing;

commit;
