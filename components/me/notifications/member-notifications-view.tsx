'use client';

import { BellCheck, CheckCheck, Clock3, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type MouseEvent, useTransition } from 'react';
import {
  markAllOrderNotificationsReadAction,
  markOrderNotificationReadAction,
} from '@/app/(customer)/me/notification-actions';
import { OrderNotificationPreference } from '@/components/commerce/order-notification-preference';
import type { AssistedOrderNotificationCenter } from '@/lib/commerce/order-notification-model';
import styles from './member-notifications-view.module.css';

const date = new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' });

export function MemberNotificationsView({ center }: { center: AssistedOrderNotificationCenter }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function openNotification(event: MouseEvent<HTMLAnchorElement>, id: string, href: string) {
    event.preventDefault();
    startTransition(async () => {
      await markOrderNotificationReadAction(id);
      router.push(href);
    });
  }

  function markAll() {
    startTransition(async () => {
      await markAllOrderNotificationsReadAction();
      router.refresh();
    });
  }

  return (
    <section className={styles.page} aria-labelledby="me-notifications-title">
      <header className={styles.heading}>
        <div>
          <p>Order notifications</p>
          <h1 id="me-notifications-title">Nothing important gets lost.</h1>
          <span>Verified quote and order-state changes only. Never marketing.</span>
        </div>
        {center.unreadCount ? (
          <button type="button" disabled={pending} onClick={markAll}>
            <CheckCheck size={17} aria-hidden="true" /> Mark all read
          </button>
        ) : null}
      </header>

      {center.notifications.length ? (
        <div className={styles.feed} aria-label="Order notification history">
          {center.notifications.map(notification => (
            <article key={notification.id} data-unread={notification.readAt ? 'false' : 'true'}>
              <span className={styles.marker} aria-hidden="true"><BellCheck size={19} /></span>
              <div className={styles.copy}>
                <p>{notification.orderReference} · {notification.retailer}</p>
                <h2>{notification.title}</h2>
                <span>{notification.message}</span>
                <small><Clock3 size={14} aria-hidden="true" /> {date.format(new Date(notification.createdAt))}</small>
              </div>
              <Link
                href={notification.href}
                aria-disabled={pending}
                onClick={event => openNotification(event, notification.id, notification.href)}
              >
                Open order
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <BellCheck size={28} aria-hidden="true" />
          <h2>You’re up to date.</h2>
          <p>New verified quote or order-state changes will appear here.</p>
          <Link href="/me/orders">View my orders</Link>
        </div>
      )}

      {center.preferences.length ? (
        <section className={styles.preferences} aria-labelledby="notification-preferences-title">
          <header>
            <span aria-hidden="true"><Mail size={20} /></span>
            <div>
              <p>Email delivery</p>
              <h2 id="notification-preferences-title">Choose each order.</h2>
              <small>Off means no new service emails. Your private in-app history remains available.</small>
            </div>
          </header>
          <div>
            {center.preferences.map(preference => (
              <article key={preference.orderId}>
                <span><strong>{preference.orderReference}</strong><small>{preference.retailer}</small></span>
                <OrderNotificationPreference
                  orderId={preference.orderId}
                  enabled={preference.emailEnabled}
                  compact
                />
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
