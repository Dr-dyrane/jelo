begin;

-- Refund evidence is a ledger alongside, and never a rewrite of, the verified
-- payment. The first release supports one governed full-refund path per order.
create table assisted_order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references assisted_orders(id) on delete restrict,
  payment_id uuid not null references assisted_order_payments(id) on delete restrict,
  amount_ngn numeric(14,2) not null check (amount_ngn > 0 and amount_ngn <= 100000000),
  status text not null default 'pending' check (status in ('pending', 'refunded')),
  source text not null check (source in ('customer_return', 'operator_cancellation')),
  reason text not null check (length(btrim(reason)) between 4 and 1000),
  initiated_evidence_reference text not null
    check (length(btrim(initiated_evidence_reference)) between 8 and 1000),
  initiated_by_subject text not null
    check (length(btrim(initiated_by_subject)) between 1 and 320),
  initiated_at timestamptz not null default now(),
  completion_reference text,
  completion_evidence_reference text,
  completed_by_subject text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assisted_order_refunds_completion_check check (
    (
      status = 'pending'
      and completion_reference is null
      and completion_evidence_reference is null
      and completed_by_subject is null
      and completed_at is null
    ) or (
      status = 'refunded'
      and length(btrim(completion_reference)) between 6 and 200
      and length(btrim(completion_evidence_reference)) between 8 and 1000
      and length(btrim(completed_by_subject)) between 1 and 320
      and completed_at is not null
    )
  )
);

create unique index assisted_order_refunds_completion_reference_idx
  on assisted_order_refunds (lower(btrim(completion_reference)))
  where status = 'refunded';

create index assisted_order_events_return_queue_idx
  on assisted_order_events (order_id, sequence_id desc)
  where action in ('return_requested', 'return_declined', 'refund_pending');

alter table assisted_order_notifications
  drop constraint assisted_order_notifications_kind_check;

alter table assisted_order_notifications
  add constraint assisted_order_notifications_kind_check check (kind in (
    'quote_ready', 'action_needed', 'cancelled', 'payment_confirmed',
    'payment_issue', 'procurement_update', 'retailer_confirmed',
    'out_for_delivery', 'delivered', 'return_update', 'refund_update'
  ));

create function enqueue_assisted_order_lifecycle_notification()
returns trigger language plpgsql as $$
declare
  order_record assisted_orders%rowtype;
  notification_kind text;
  notification_title text;
  notification_message text;
begin
  case new.action
    when 'procurement_started' then
      notification_kind := 'procurement_update';
      notification_title := 'Your purchase is in progress.';
      notification_message := 'JeloCare is placing the exact approved order with the retailer.';
    when 'return_requested' then
      notification_kind := 'return_update';
      notification_title := 'Your return request was received.';
      notification_message := 'Operations will review the request against the recorded order.';
    when 'return_declined' then
      notification_kind := 'return_update';
      notification_title := 'Your return request was reviewed.';
      notification_message := 'Open the private order page to read the recorded decision.';
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

create trigger assisted_order_events_enqueue_lifecycle_notification
after insert on assisted_order_events
for each row execute function enqueue_assisted_order_lifecycle_notification();

revoke all privileges on table assisted_order_refunds from public;
grant select, insert, update on table assisted_order_refunds to jelocare_app_runtime;
revoke delete on table assisted_order_refunds from jelocare_app_runtime;

commit;
