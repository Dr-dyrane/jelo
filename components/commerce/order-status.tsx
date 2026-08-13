'use client';

import { Check, Clock3, LockKeyhole, MessageCircle, PackageCheck, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { OrderNotificationPreference } from './order-notification-preference';
import { JELOCARE_WHATSAPP_CONTACT } from '@/lib/commerce/whatsapp-contact';
import { formatOrderDateTime } from '@/lib/commerce/order-date';
import {
  CUSTOMER_VISIBLE_ORDER_STATES,
  type AssistedOrderCustomerView,
} from '@/lib/commerce/assisted-procurement-model';
import styles from './order-status.module.css';

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export function OrderStatus({ order }: { order: AssistedOrderCustomerView }) {
  const router = useRouter();
  const [decisionPending, setDecisionPending] = useState(false);
  const [error, setError] = useState('');
  const presentation = CUSTOMER_VISIBLE_ORDER_STATES[order.state];

  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch('/api/orders/current', { cache: 'no-store' });
        if (!response.ok) return;
        const current = await response.json() as { revision: number };
        if (current.revision !== order.revision) router.refresh();
      } catch {
        // The status remains visible; the next bounded poll retries.
      }
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [order.revision, router]);

  async function decide(decision: 'approve' | 'decline') {
    if (!order.quote) return;
    setDecisionPending(true);
    setError('');
    try {
      const response = await fetch('/api/orders/current/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteVersion: order.quote.version,
          orderRevision: order.revision,
          decision,
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? 'That decision could not be saved.');
        setDecisionPending(false);
        return;
      }
    } catch {
      setError('The connection was interrupted. Your decision was not assumed. Refresh and try again.');
      setDecisionPending(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <p className="eyebrow">Order request · {order.reference}</p>
          <h1>{presentation.label}.</h1>
          <p>{presentation.detail}</p>
        </div>
        <div className={styles.heroMeta}>
          <span><PackageCheck size={17} aria-hidden="true" /> {order.retailer}</span>
          <span><Clock3 size={17} aria-hidden="true" /> Updated {formatOrderDateTime(order.updatedAt)}</span>
        </div>
      </header>

      <div className={styles.layout}>
        <main>
          <section className={styles.card} aria-labelledby="order-items-title">
            <div className={styles.cardHeading}>
              <div><p className="eyebrow">No substitutions</p><h2 id="order-items-title">Exact products.</h2></div>
              <span>{order.lines.reduce((total, line) => total + line.quantity, 0)} items</span>
            </div>
            <div className={styles.lines}>
              {order.lines.map(line => (
                <article key={line.slug}>
                  <div className={styles.lineImage}><SafeProductImage src={line.image} alt="" /></div>
                  <div><span>{line.brand}</span><strong>{line.name}</strong><small>{line.size} · Quantity {line.quantity}</small></div>
                  <b>{naira.format(line.observedUnitPriceNgn * line.quantity)}</b>
                </article>
              ))}
            </div>
            <p className={styles.observedNote}>Observed product prices started this request. The payable amount comes only from a complete, current quote.</p>
          </section>

          <section className={styles.card} aria-labelledby="order-history-title">
            <div className={styles.cardHeading}><div><p className="eyebrow">Canonical record</p><h2 id="order-history-title">Order history.</h2></div></div>
            <ol className={styles.timeline}>
              {order.events.map(event => (
                <li key={event.id}>
                  <span><Check size={15} aria-hidden="true" /></span>
                  <div><strong>{CUSTOMER_VISIBLE_ORDER_STATES[event.toState].label}</strong>{event.reason ? <p>{event.reason}</p> : null}<small>{formatOrderDateTime(event.createdAt)}</small></div>
                </li>
              ))}
            </ol>
          </section>
        </main>

        <aside className={styles.quoteCard}>
          <p className="eyebrow">Verified quote</p>
          {order.quote ? (
            <>
              <div className={styles.quoteHeading}><h2>Version {order.quote.version}</h2><span>{order.quote.status.replaceAll('_', ' ')}</span></div>
              <dl>
                <QuoteLine label="Products" value={order.quote.components.productSubtotalNgn} />
                <QuoteLine label="Retailer fee" value={order.quote.components.retailerFeeNgn} />
                <QuoteLine label="Observed tax" value={order.quote.components.taxNgn} />
                <QuoteLine label="JeloCare fee" value={order.quote.components.jelocareFeeNgn} />
                <QuoteLine label="Delivery" value={order.quote.components.deliveryNgn} />
                <div className={styles.quoteTotal}><dt>Total</dt><dd>{order.quote.totalNgn == null ? 'Incomplete' : naira.format(order.quote.totalNgn)}</dd></div>
              </dl>
              <p className={styles.quoteExpiry}>Expires {formatOrderDateTime(order.quote.expiresAt)}</p>
              {order.quote.notes ? <p className={styles.quoteNotes}>{order.quote.notes}</p> : null}
              {order.state === 'awaiting_approval' && order.quote.status === 'awaiting_approval' ? (
                <div className={styles.decisions}>
                  <button type="button" disabled={decisionPending} onClick={() => decide('approve')}>Approve exact quote</button>
                  <button type="button" disabled={decisionPending} onClick={() => decide('decline')}>Request a change</button>
                </div>
              ) : null}
              {order.state === 'payment_pending' ? (
                <div className={styles.paymentBoundary}>
                  <LockKeyhole size={19} aria-hidden="true" />
                  <p><strong>No payment button yet.</strong> Your approval is recorded, but JeloCare cannot claim payment until the governed payment release exists.</p>
                </div>
              ) : null}
            </>
          ) : (
            <div className={styles.quoteWaiting}>
              <RefreshCw size={22} aria-hidden="true" />
              <h2>Being prepared.</h2>
              <p>Products, fees, tax, and delivery are each checked. Unknown costs stay unknown.</p>
            </div>
          )}
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <OrderNotificationPreference enabled={order.emailNotificationsConsent} />
          <a
            className={styles.whatsappContact}
            href={JELOCARE_WHATSAPP_CONTACT.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={18} aria-hidden="true" />
            <span>
              <strong>Message JeloCare</strong>
              <small>{JELOCARE_WHATSAPP_CONTACT.display}</small>
            </span>
          </a>
          <div className={styles.privateNote}><LockKeyhole size={16} aria-hidden="true" /><span>This private page is available on this device for 30 days.</span></div>
          <Link className={styles.continueShopping} href="/products">Continue browsing</Link>
        </aside>
      </div>
    </div>
  );
}

function QuoteLine({ label, value }: { label: string; value: number | null }) {
  return <div><dt>{label}</dt><dd>{value == null ? 'Unknown' : naira.format(value)}</dd></div>;
}
