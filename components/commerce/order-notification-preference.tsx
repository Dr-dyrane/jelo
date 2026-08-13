'use client';

import { BellRing, MailCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './order-notification-preference.module.css';

export function OrderNotificationPreference({
  orderId,
  enabled,
  compact = false,
}: {
  orderId?: string;
  enabled: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [local, setLocal] = useState({ source: enabled, value: enabled });
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const checked = local.source === enabled ? local.value : enabled;

  async function update(next: boolean) {
    if (pending) return;
    setPending(true);
    setFeedback('');
    try {
      const response = await fetch('/api/orders/current/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, enabled: next }),
      });
      const payload = await response.json() as {
        emailNotificationsConsent?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? 'Preference not saved.');
      const saved = payload.emailNotificationsConsent === true;
      setLocal({ source: saved, value: saved });
      setFeedback(saved ? 'Email order updates are on.' : 'Email order updates are off.');
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Preference not saved.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.preference} data-compact={compact ? 'true' : 'false'}>
      <span className={styles.icon} aria-hidden="true">
        {checked ? <MailCheck size={18} /> : <BellRing size={18} />}
      </span>
      <span className={styles.copy}>
        <strong>Email order updates</strong>
        {!compact ? <small>Quote and order-state changes only. No marketing.</small> : null}
      </span>
      <label className={styles.switch}>
        <span className="sr-only">Email order updates</span>
        <input
          type="checkbox"
          checked={checked}
          disabled={pending}
          onChange={event => void update(event.target.checked)}
        />
        <span aria-hidden="true" />
      </label>
      <p className={styles.feedback} role="status" aria-live="polite">{feedback}</p>
    </div>
  );
}
