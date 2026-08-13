begin;

alter table assisted_orders
  add column email_notifications_consent_at timestamptz,
  add column email_notifications_consent_policy text;

alter table assisted_orders
  add constraint assisted_orders_email_notifications_consent_check check (
    (email_notifications_consent_at is null and email_notifications_consent_policy is null)
    or (
      email_notifications_consent_at is not null
      and nullif(trim(email_notifications_consent_policy), '') is not null
    )
  );

create table assisted_order_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references assisted_orders(id) on delete restrict,
  event_id uuid not null unique references assisted_order_events(id) on delete restrict,
  owner_subject text,
  kind text not null check (kind in (
    'quote_ready', 'action_needed', 'cancelled', 'retailer_confirmed',
    'out_for_delivery', 'delivered', 'refund_update'
  )),
  title text not null check (length(trim(title)) between 2 and 120),
  message text not null check (length(trim(message)) between 2 and 280),
  href text not null check (href in ('/order', '/me/orders')),
  read_at timestamptz,
  email_status text not null default 'suppressed'
    check (email_status in ('pending', 'sending', 'sent', 'failed', 'suppressed')),
  email_attempts integer not null default 0 check (email_attempts between 0 and 10),
  email_available_at timestamptz not null default now(),
  email_last_attempt_at timestamptz,
  email_sent_at timestamptz,
  email_failure_code text check (
    email_failure_code is null or email_failure_code in (
      'delivery_unavailable', 'delivery_failed', 'consent_withdrawn'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retain_until timestamptz not null,
  constraint assisted_order_notifications_owner_check check (
    owner_subject is null or nullif(trim(owner_subject), '') is not null
  ),
  constraint assisted_order_notifications_delivery_check check (
    (email_status = 'sent' and email_sent_at is not null)
    or (email_status <> 'sent' and email_sent_at is null)
  )
);

create index assisted_order_notifications_owner_idx
  on assisted_order_notifications (owner_subject, created_at desc)
  where owner_subject is not null;

create index assisted_order_notifications_delivery_idx
  on assisted_order_notifications (email_available_at, created_at, id)
  where email_status in ('pending', 'failed', 'sending');

create index assisted_order_notifications_order_idx
  on assisted_order_notifications (order_id, created_at desc);

create function enqueue_assisted_order_notification()
returns trigger language plpgsql as $$
declare
  order_record assisted_orders%rowtype;
  notification_kind text;
  notification_title text;
  notification_message text;
begin
  case new.action
    when 'quote_issued' then
      notification_kind := 'quote_ready';
      notification_title := 'Your quote is ready.';
      notification_message := 'Review the complete verified quote before it expires.';
    when 'quote_expired' then
      notification_kind := 'action_needed';
      notification_title := 'Your quote needs another look.';
      notification_message := 'The previous quote expired. JeloCare will verify a fresh version before anything proceeds.';
    when 'order_cancelled' then
      notification_kind := 'cancelled';
      notification_title := 'This request was cancelled.';
      notification_message := 'No further procurement will proceed for this order request.';
    when 'retailer_confirmed' then
      notification_kind := 'retailer_confirmed';
      notification_title := 'The retailer confirmed your order.';
      notification_message := 'The exact approved order has been accepted by the retailer.';
    when 'out_for_delivery' then
      notification_kind := 'out_for_delivery';
      notification_title := 'Your order is out for delivery.';
      notification_message := 'Dispatch evidence has been recorded for the exact approved order.';
    when 'delivered' then
      notification_kind := 'delivered';
      notification_title := 'Delivery was recorded.';
      notification_message := 'JeloCare recorded delivery for this order.';
    when 'refund_pending' then
      notification_kind := 'refund_update';
      notification_title := 'A refund is being reconciled.';
      notification_message := 'The refund remains pending until governed evidence confirms it.';
    when 'refunded' then
      notification_kind := 'refund_update';
      notification_title := 'Your refund was recorded.';
      notification_message := 'Governed refund evidence has been recorded for this order.';
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

create trigger assisted_order_events_enqueue_notification
after insert on assisted_order_events
for each row execute function enqueue_assisted_order_notification();

-- Preserve useful signed-in history without sending retrospective email.
insert into assisted_order_notifications (
  order_id, event_id, owner_subject, kind, title, message, href,
  email_status, retain_until, created_at, updated_at
)
select
  orders.id,
  event.id,
  orders.owner_subject,
  case event.action
    when 'quote_issued' then 'quote_ready'
    when 'quote_expired' then 'action_needed'
    when 'order_cancelled' then 'cancelled'
    when 'retailer_confirmed' then 'retailer_confirmed'
    when 'out_for_delivery' then 'out_for_delivery'
    when 'delivered' then 'delivered'
    else 'refund_update'
  end,
  case event.action
    when 'quote_issued' then 'Your quote is ready.'
    when 'quote_expired' then 'Your quote needs another look.'
    when 'order_cancelled' then 'This request was cancelled.'
    when 'retailer_confirmed' then 'The retailer confirmed your order.'
    when 'out_for_delivery' then 'Your order is out for delivery.'
    when 'delivered' then 'Delivery was recorded.'
    when 'refund_pending' then 'A refund is being reconciled.'
    else 'Your refund was recorded.'
  end,
  case event.action
    when 'quote_issued' then 'Review the complete verified quote before it expires.'
    when 'quote_expired' then 'The previous quote expired. JeloCare will verify a fresh version before anything proceeds.'
    when 'order_cancelled' then 'No further procurement will proceed for this order request.'
    when 'retailer_confirmed' then 'The exact approved order has been accepted by the retailer.'
    when 'out_for_delivery' then 'Dispatch evidence has been recorded for the exact approved order.'
    when 'delivered' then 'JeloCare recorded delivery for this order.'
    when 'refund_pending' then 'The refund remains pending until governed evidence confirms it.'
    else 'Governed refund evidence has been recorded for this order.'
  end,
  '/me/orders',
  'suppressed',
  orders.retain_until,
  event.created_at,
  event.created_at
from assisted_order_events event
join assisted_orders orders on orders.id = event.order_id
where orders.owner_subject is not null
  and event.action in (
    'quote_issued', 'quote_expired', 'order_cancelled', 'retailer_confirmed',
    'out_for_delivery', 'delivered', 'refund_pending', 'refunded'
  )
on conflict (event_id) do nothing;

revoke all privileges on table assisted_order_notifications from public;
grant select, insert, update on table assisted_order_notifications to jelocare_app_runtime;
revoke delete on table assisted_order_notifications from jelocare_app_runtime;

commit;
