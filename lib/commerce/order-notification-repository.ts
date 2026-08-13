import 'server-only';

import { getPostgresClient } from '@/lib/db/postgres';
import { hasTransactionalEmailConfig, sendAssistedOrderUpdate } from '@/lib/email/mailer';
import { assistedOrderFixtureEnabled } from './assisted-procurement-security';
import {
  notificationCopyForAction,
  type AssistedOrderNotificationCenter,
  type AssistedOrderNotificationDeliverySummary,
  type AssistedOrderNotificationEmailStatus,
  type AssistedOrderNotificationKind,
  type AssistedOrderNotificationView,
} from './order-notification-model';

type FixtureNotification = AssistedOrderNotificationView & {
  ownerSubject: string | null;
  contactEmail: string;
  contactName: string;
  emailAttempts: number;
  emailLastAttemptAt: string | null;
  emailSentAt: string | null;
};

function fixtureStore() {
  const scope = globalThis as typeof globalThis & {
    __jelocareOrderNotifications?: Map<string, FixtureNotification>;
    __jelocareOrderNotificationPreferences?: Map<string, boolean>;
  };
  scope.__jelocareOrderNotifications ??= new Map();
  return scope.__jelocareOrderNotifications;
}

function fixturePreferences() {
  const scope = globalThis as typeof globalThis & {
    __jelocareOrderNotificationPreferences?: Map<string, boolean>;
  };
  scope.__jelocareOrderNotificationPreferences ??= new Map();
  return scope.__jelocareOrderNotificationPreferences;
}

export function resetOrderNotificationDevelopmentFixture() {
  if (!assistedOrderFixtureEnabled()) throw new Error('Development fixture is not enabled.');
  fixtureStore().clear();
  fixturePreferences().clear();
}

export function recordOrderNotificationDevelopmentFixture(input: {
  orderId: string;
  orderReference: string;
  retailer: string;
  ownerSubject: string | null;
  contactEmail: string;
  contactName: string;
  emailEnabled: boolean;
  eventId: string;
  action: string;
  createdAt: string;
}) {
  if (!assistedOrderFixtureEnabled()) return;
  const copy = notificationCopyForAction(input.action);
  if (!copy) return;
  if ([...fixtureStore().values()].some(item => item.id === input.eventId)) return;
  fixturePreferences().set(input.orderId, input.emailEnabled);
  fixtureStore().set(input.eventId, {
    id: input.eventId,
    orderId: input.orderId,
    orderReference: input.orderReference,
    retailer: input.retailer,
    kind: copy.kind,
    title: copy.title,
    message: copy.message,
    href: '/me/orders',
    readAt: null,
    emailStatus: input.emailEnabled ? 'pending' : 'suppressed',
    createdAt: input.createdAt,
    ownerSubject: input.ownerSubject,
    contactEmail: input.contactEmail,
    contactName: input.contactName,
    emailAttempts: 0,
    emailLastAttemptAt: null,
    emailSentAt: null,
  });
}

export async function readAssistedOrderNotificationCenter(
  ownerSubject: string,
): Promise<AssistedOrderNotificationCenter> {
  if (assistedOrderFixtureEnabled()) {
    const notifications = [...fixtureStore().values()]
      .filter(notification => notification.ownerSubject === ownerSubject)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const orderIds = [...new Set(notifications.map(notification => notification.orderId))];
    return {
      notifications: notifications.map(notification => ({
        id: notification.id,
        orderId: notification.orderId,
        orderReference: notification.orderReference,
        retailer: notification.retailer,
        kind: notification.kind,
        title: notification.title,
        message: notification.message,
        href: notification.href,
        readAt: notification.readAt,
        emailStatus: notification.emailStatus,
        createdAt: notification.createdAt,
      })),
      preferences: orderIds.map(orderId => {
        const notification = notifications.find(item => item.orderId === orderId)!;
        return {
          orderId,
          orderReference: notification.orderReference,
          retailer: notification.retailer,
          emailEnabled: fixturePreferences().get(orderId) ?? false,
        };
      }),
      unreadCount: notifications.filter(notification => !notification.readAt).length,
    };
  }

  const sql = getPostgresClient();
  const [notificationRows, preferenceRows] = await Promise.all([
    sql<{
      id: string;
      order_id: string;
      public_reference: string;
      retailer_name: string;
      kind: AssistedOrderNotificationKind;
      title: string;
      message: string;
      read_at: string | null;
      email_status: AssistedOrderNotificationEmailStatus;
      created_at: string;
    }[]>`
      select notification.id, notification.order_id, orders.public_reference,
             orders.retailer_name, notification.kind, notification.title,
             notification.message,
             case when notification.read_at is null then null else notification.read_at::text end as read_at,
             notification.email_status, notification.created_at::text
      from assisted_order_notifications notification
      join assisted_orders orders on orders.id = notification.order_id
      where notification.owner_subject = ${ownerSubject}
        and notification.retain_until > now()
      order by notification.created_at desc, notification.id desc
      limit 100
    `,
    sql<{
      id: string;
      public_reference: string;
      retailer_name: string;
      email_enabled: boolean;
    }[]>`
      select id, public_reference, retailer_name,
             (email_notifications_consent_at is not null) as email_enabled
      from assisted_orders
      where owner_subject = ${ownerSubject} and retain_until > now()
      order by created_at desc
      limit 100
    `,
  ]);

  const notifications = notificationRows.map<AssistedOrderNotificationView>(row => ({
    id: row.id,
    orderId: row.order_id,
    orderReference: row.public_reference,
    retailer: row.retailer_name,
    kind: row.kind,
    title: row.title,
    message: row.message,
    href: '/me/orders',
    readAt: row.read_at,
    emailStatus: row.email_status,
    createdAt: row.created_at,
  }));
  return {
    notifications,
    preferences: preferenceRows.map(row => ({
      orderId: row.id,
      orderReference: row.public_reference,
      retailer: row.retailer_name,
      emailEnabled: row.email_enabled,
    })),
    unreadCount: notifications.filter(notification => !notification.readAt).length,
  };
}

export async function countUnreadAssistedOrderNotifications(ownerSubject: string) {
  if (assistedOrderFixtureEnabled()) {
    return [...fixtureStore().values()].filter(item => item.ownerSubject === ownerSubject && !item.readAt).length;
  }
  const sql = getPostgresClient();
  const [row] = await sql<{ count: number }[]>`
    select count(*)::int as count
    from assisted_order_notifications
    where owner_subject = ${ownerSubject} and read_at is null and retain_until > now()
  `;
  return row?.count ?? 0;
}

export async function markAssistedOrderNotificationRead(input: {
  ownerSubject: string;
  notificationId?: string;
}) {
  if (assistedOrderFixtureEnabled()) {
    const now = new Date().toISOString();
    for (const notification of fixtureStore().values()) {
      if (notification.ownerSubject !== input.ownerSubject) continue;
      if (input.notificationId && notification.id !== input.notificationId) continue;
      notification.readAt = now;
    }
    return;
  }
  const sql = getPostgresClient();
  if (input.notificationId) {
    await sql`
      update assisted_order_notifications set read_at = coalesce(read_at, now()), updated_at = now()
      where id = ${input.notificationId} and owner_subject = ${input.ownerSubject}
    `;
  } else {
    await sql`
      update assisted_order_notifications set read_at = coalesce(read_at, now()), updated_at = now()
      where owner_subject = ${input.ownerSubject} and read_at is null and retain_until > now()
    `;
  }
}

export async function listAssistedOrderNotificationDeliverySummaries(
  orderIds: readonly string[],
): Promise<AssistedOrderNotificationDeliverySummary[]> {
  if (!orderIds.length) return [];
  if (assistedOrderFixtureEnabled()) {
    return orderIds.flatMap(orderId => {
      const latest = [...fixtureStore().values()]
        .filter(item => item.orderId === orderId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
      return latest ? [{
        id: latest.id,
        orderId,
        title: latest.title,
        emailStatus: latest.emailStatus,
        emailAttempts: latest.emailAttempts,
        emailLastAttemptAt: latest.emailLastAttemptAt,
        emailSentAt: latest.emailSentAt,
      }] : [];
    });
  }
  const sql = getPostgresClient();
  const rows = await sql<{
    id: string;
    order_id: string;
    title: string;
    email_status: AssistedOrderNotificationEmailStatus;
    email_attempts: number;
    email_last_attempt_at: string | null;
    email_sent_at: string | null;
  }[]>`
    select distinct on (order_id) id, order_id, title, email_status, email_attempts,
      case when email_last_attempt_at is null then null else email_last_attempt_at::text end as email_last_attempt_at,
      case when email_sent_at is null then null else email_sent_at::text end as email_sent_at
    from assisted_order_notifications
    where order_id in ${sql(orderIds)}
    order by order_id, created_at desc, id desc
  `;
  return rows.map(row => ({
    id: row.id,
    orderId: row.order_id,
    title: row.title,
    emailStatus: row.email_status,
    emailAttempts: row.email_attempts,
    emailLastAttemptAt: row.email_last_attempt_at,
    emailSentAt: row.email_sent_at,
  }));
}

function notificationOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  return configured && /^https:\/\//.test(configured) ? configured : 'https://www.jelocare.com';
}

export async function deliverPendingAssistedOrderNotifications(input: {
  orderId?: string;
  limit?: number;
}) {
  if (assistedOrderFixtureEnabled()) {
    const pending = [...fixtureStore().values()]
      .filter(item => (!input.orderId || item.orderId === input.orderId) && item.emailStatus === 'pending')
      .slice(0, input.limit ?? 10);
    for (const notification of pending) {
      notification.emailStatus = 'sent';
      notification.emailAttempts += 1;
      notification.emailLastAttemptAt = new Date().toISOString();
      notification.emailSentAt = notification.emailLastAttemptAt;
    }
    return { sent: pending.length, failed: 0, pending: 0, unavailable: false };
  }

  const sql = getPostgresClient();
  await sql`
    update assisted_order_notifications
    set email_status = 'failed', email_failure_code = 'delivery_failed',
        email_available_at = now(), updated_at = now()
    where email_status = 'sending'
      and email_last_attempt_at < now() - interval '10 minutes'
      and (${input.orderId ?? null}::uuid is null or order_id = ${input.orderId ?? null}::uuid)
  `;
  await sql`
    update assisted_order_notifications notification
    set email_status = 'suppressed', email_failure_code = 'consent_withdrawn', updated_at = now()
    from assisted_orders orders
    where orders.id = notification.order_id
      and orders.email_notifications_consent_at is null
      and notification.email_status in ('pending', 'failed', 'sending')
      and (${input.orderId ?? null}::uuid is null or notification.order_id = ${input.orderId ?? null}::uuid)
  `;

  if (!hasTransactionalEmailConfig()) {
    const [pending] = await sql<{ count: number }[]>`
      select count(*)::int as count from assisted_order_notifications
      where email_status in ('pending', 'failed')
        and (${input.orderId ?? null}::uuid is null or order_id = ${input.orderId ?? null}::uuid)
    `;
    return { sent: 0, failed: 0, pending: pending?.count ?? 0, unavailable: true };
  }

  const claimed = await sql.begin(async transaction => transaction<{
    id: string;
    order_id: string;
    contact_email: string;
    contact_name: string;
    public_reference: string;
    owner_subject: string | null;
  }[]>`
    with candidates as (
      select notification.id
      from assisted_order_notifications notification
      join assisted_orders orders on orders.id = notification.order_id
      where notification.email_status in ('pending', 'failed')
        and notification.email_available_at <= now()
        and notification.email_attempts < 5
        and orders.email_notifications_consent_at is not null
        and (${input.orderId ?? null}::uuid is null or notification.order_id = ${input.orderId ?? null}::uuid)
      order by notification.email_available_at, notification.created_at, notification.id
      for update of notification skip locked
      limit ${Math.min(Math.max(input.limit ?? 10, 1), 25)}
    )
    update assisted_order_notifications notification
    set email_status = 'sending', email_attempts = email_attempts + 1,
        email_last_attempt_at = now(), email_failure_code = null, updated_at = now()
    from candidates, assisted_orders orders
    where notification.id = candidates.id and orders.id = notification.order_id
    returning notification.id, notification.order_id, orders.contact_email,
              orders.contact_name, orders.public_reference, orders.owner_subject
  `);

  let sent = 0;
  let failed = 0;
  for (const notification of claimed) {
    try {
      await sendAssistedOrderUpdate({
        to: notification.contact_email,
        name: notification.contact_name,
        reference: notification.public_reference,
        statusLink: new URL(notification.owner_subject ? '/me/orders' : '/order', notificationOrigin()).toString(),
      });
      await sql`
        update assisted_order_notifications
        set email_status = 'sent', email_sent_at = now(), email_failure_code = null, updated_at = now()
        where id = ${notification.id} and email_status = 'sending'
      `;
      sent += 1;
    } catch {
      await sql`
        update assisted_order_notifications
        set email_status = 'failed', email_failure_code = 'delivery_failed',
            email_available_at = now() + interval '15 minutes', updated_at = now()
        where id = ${notification.id} and email_status = 'sending'
      `;
      failed += 1;
    }
  }
  return { sent, failed, pending: 0, unavailable: false };
}

export async function retryAssistedOrderNotificationDelivery(input: {
  notificationId: string;
  orderId: string;
}) {
  if (assistedOrderFixtureEnabled()) {
    const notification = fixtureStore().get(input.notificationId);
    if (
      !notification
      || notification.orderId !== input.orderId
      || !['pending', 'failed'].includes(notification.emailStatus)
    ) return false;
    notification.emailStatus = 'pending';
    return true;
  }
  const sql = getPostgresClient();
  const rows = await sql<{ id: string }[]>`
    update assisted_order_notifications notification
    set email_status = 'pending', email_available_at = now(), email_failure_code = null, updated_at = now()
    from assisted_orders orders
    where notification.id = ${input.notificationId}
      and notification.order_id = ${input.orderId}
      and orders.id = notification.order_id
      and orders.email_notifications_consent_at is not null
      and notification.email_status in ('pending', 'failed')
      and notification.email_attempts < 5
    returning notification.id
  `;
  return rows.length === 1;
}

export function setOrderNotificationPreferenceDevelopmentFixture(orderId: string, enabled: boolean) {
  if (!assistedOrderFixtureEnabled()) return;
  fixturePreferences().set(orderId, enabled);
  if (!enabled) {
    for (const notification of fixtureStore().values()) {
      if (notification.orderId === orderId && ['pending', 'failed'].includes(notification.emailStatus)) {
        notification.emailStatus = 'suppressed';
      }
    }
  }
}
