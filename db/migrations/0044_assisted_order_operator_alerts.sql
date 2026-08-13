begin;

-- Internal alerts are independent of customer notification consent. One alert is
-- created for each new assisted order and fan-outs to the active operators who
-- can manage orders at that moment. Per-recipient rows make retries idempotent.
create table assisted_order_operator_alerts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references assisted_orders(id) on delete restrict,
  created_at timestamptz not null default now(),
  retain_until timestamptz not null
);

create table assisted_order_operator_alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references assisted_order_operator_alerts(id) on delete restrict,
  operator_id uuid not null references moderation_operators(id) on delete restrict,
  recipient_email text not null check (
    char_length(recipient_email) between 3 and 254
    and recipient_email = lower(btrim(recipient_email))
  ),
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 10),
  available_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  failure_code text check (
    failure_code is null or failure_code in ('delivery_unavailable', 'delivery_failed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (alert_id, operator_id),
  constraint assisted_order_operator_alert_delivery_check check (
    (status = 'sent' and sent_at is not null)
    or (status <> 'sent' and sent_at is null)
  )
);

create index assisted_order_operator_alert_delivery_queue_idx
  on assisted_order_operator_alert_deliveries (available_at, created_at, id)
  where status in ('pending', 'sending', 'failed');

-- Existing retained work becomes visible but is not emailed automatically.
insert into assisted_order_operator_alerts (order_id, retain_until)
select orders.id, orders.retain_until
from assisted_orders orders
where orders.state not in ('delivered', 'cancelled', 'refunded')
  and orders.retain_until > now()
on conflict (order_id) do nothing;

insert into assisted_order_operator_alert_deliveries (
  alert_id, operator_id, recipient_email
)
select alert.id, operator.id, lower(btrim(operator.email))
from assisted_order_operator_alerts alert
join moderation_operators operator on operator.active = true
  and operator.role in ('operator', 'admin') and operator.email is not null
on conflict (alert_id, operator_id) do nothing;

revoke all privileges on table assisted_order_operator_alerts from public;
revoke all privileges on table assisted_order_operator_alert_deliveries from public;
grant select, insert on table assisted_order_operator_alerts to jelocare_app_runtime;
grant select, insert, update on table assisted_order_operator_alert_deliveries to jelocare_app_runtime;
revoke delete on table assisted_order_operator_alerts from jelocare_app_runtime;
revoke delete on table assisted_order_operator_alert_deliveries from jelocare_app_runtime;

commit;
