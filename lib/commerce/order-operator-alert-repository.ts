import 'server-only';

import { getPostgresClient } from '@/lib/db/postgres';
import { hasTransactionalEmailConfig, sendAssistedOrderOperatorAlert } from '@/lib/email/mailer';
import { assistedOrderFixtureEnabled } from './assisted-procurement-security';

export type AssistedOrderOperatorAlertSummary = {
  orderId: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  lastAttemptAt: string | null;
};

function opsOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  return configured && /^https:\/\//.test(configured) ? configured : 'https://www.jelocare.com';
}

export async function listAssistedOrderOperatorAlertSummaries(
  orderIds: readonly string[],
): Promise<AssistedOrderOperatorAlertSummary[]> {
  if (!orderIds.length || assistedOrderFixtureEnabled()) return [];
  const sql = getPostgresClient();
  const rows = await sql<{
    order_id: string;
    recipient_count: number;
    sent_count: number;
    failed_count: number;
    pending_count: number;
    last_attempt_at: string | null;
  }[]>`
    select alert.order_id,
      count(delivery.id)::int as recipient_count,
      count(delivery.id) filter (where delivery.status = 'sent')::int as sent_count,
      count(delivery.id) filter (where delivery.status = 'failed')::int as failed_count,
      count(delivery.id) filter (where delivery.status in ('pending', 'sending'))::int as pending_count,
      case when max(delivery.last_attempt_at) is null then null
        else max(delivery.last_attempt_at)::text end as last_attempt_at
    from assisted_order_operator_alerts alert
    left join assisted_order_operator_alert_deliveries delivery on delivery.alert_id = alert.id
    where alert.order_id in ${sql(orderIds)}
    group by alert.order_id
  `;
  return rows.map(row => ({
    orderId: row.order_id,
    recipientCount: row.recipient_count,
    sentCount: row.sent_count,
    failedCount: row.failed_count,
    pendingCount: row.pending_count,
    lastAttemptAt: row.last_attempt_at,
  }));
}

export async function deliverAssistedOrderOperatorAlerts(input: {
  orderId: string;
  limit?: number;
}) {
  if (assistedOrderFixtureEnabled()) {
    return { sent: 0, failed: 0, pending: 0, recipients: 0, unavailable: false };
  }
  const sql = getPostgresClient();
  await sql`
    update assisted_order_operator_alert_deliveries delivery
    set status = 'failed', failure_code = 'delivery_failed', available_at = now(), updated_at = now()
    from assisted_order_operator_alerts alert
    where alert.id = delivery.alert_id and alert.order_id = ${input.orderId}
      and delivery.status = 'sending'
      and delivery.last_attempt_at < now() - interval '10 minutes'
  `;
  if (!hasTransactionalEmailConfig()) {
    await sql`
      update assisted_order_operator_alert_deliveries delivery
      set status = 'failed', failure_code = 'delivery_unavailable',
          available_at = now() + interval '15 minutes', updated_at = now()
      from assisted_order_operator_alerts alert
      where alert.id = delivery.alert_id and alert.order_id = ${input.orderId}
        and delivery.status in ('pending', 'failed')
    `;
    return { sent: 0, failed: 0, pending: 0, recipients: 0, unavailable: true };
  }

  const claimed = await sql.begin(async transaction => transaction<{
    id: string;
    recipient_email: string;
    public_reference: string;
    retailer_name: string;
    line_count: number;
  }[]>`
    with candidates as (
      select delivery.id
      from assisted_order_operator_alert_deliveries delivery
      join assisted_order_operator_alerts alert on alert.id = delivery.alert_id
      join moderation_operators operator on operator.id = delivery.operator_id
        and operator.active = true and operator.role in ('operator', 'admin')
        and operator.email is not null
        and lower(btrim(operator.email)) = delivery.recipient_email
      where alert.order_id = ${input.orderId}
        and delivery.status in ('pending', 'failed')
        and delivery.available_at <= now() and delivery.attempts < 5
      order by delivery.available_at, delivery.created_at, delivery.id
      for update of delivery skip locked
      limit ${Math.min(Math.max(input.limit ?? 10, 1), 25)}
    )
    update assisted_order_operator_alert_deliveries delivery
    set status = 'sending', attempts = attempts + 1, last_attempt_at = now(),
        failure_code = null, updated_at = now()
    from candidates, assisted_order_operator_alerts alert, assisted_orders orders
    where delivery.id = candidates.id and alert.id = delivery.alert_id
      and orders.id = alert.order_id
    returning delivery.id, delivery.recipient_email, orders.public_reference,
      orders.retailer_name,
      (select count(*)::int from assisted_order_lines line where line.order_id = orders.id) as line_count
  `);

  let sent = 0;
  let failed = 0;
  for (const delivery of claimed) {
    try {
      await sendAssistedOrderOperatorAlert({
        to: delivery.recipient_email,
        reference: delivery.public_reference,
        retailer: delivery.retailer_name,
        itemCount: delivery.line_count,
        opsLink: new URL('/ops/orders', opsOrigin()).toString(),
      });
      await sql`
        update assisted_order_operator_alert_deliveries
        set status = 'sent', sent_at = now(), failure_code = null, updated_at = now()
        where id = ${delivery.id} and status = 'sending'
      `;
      sent += 1;
    } catch {
      await sql`
        update assisted_order_operator_alert_deliveries
        set status = 'failed', failure_code = 'delivery_failed',
            available_at = now() + interval '15 minutes', updated_at = now()
        where id = ${delivery.id} and status = 'sending'
      `;
      failed += 1;
    }
  }
  const [remaining] = await sql<{ recipients: number; pending: number }[]>`
    select count(delivery.id)::int as recipients,
      count(delivery.id) filter (where delivery.status in ('pending', 'sending'))::int as pending
    from assisted_order_operator_alert_deliveries delivery
    join assisted_order_operator_alerts alert on alert.id = delivery.alert_id
    where alert.order_id = ${input.orderId}
  `;
  return {
    sent,
    failed,
    pending: remaining?.pending ?? 0,
    recipients: remaining?.recipients ?? 0,
    unavailable: false,
  };
}

export async function retryAssistedOrderOperatorAlerts(orderId: string) {
  if (assistedOrderFixtureEnabled()) return true;
  const sql = getPostgresClient();
  const rows = await sql<{ id: string }[]>`
    update assisted_order_operator_alert_deliveries delivery
    set status = 'pending', available_at = now(), failure_code = null, updated_at = now()
    from assisted_order_operator_alerts alert
    where alert.id = delivery.alert_id and alert.order_id = ${orderId}
      and delivery.status in ('pending', 'failed') and delivery.attempts < 5
    returning delivery.id
  `;
  return rows.length > 0;
}
