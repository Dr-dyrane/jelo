'use client';

import { Check, Clock3, PackageCheck, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SafeProductImage } from '@/components/products/safe-product-image';
import {
  CUSTOMER_VISIBLE_ORDER_STATES,
  type AssistedOrderCustomerView,
} from '@/lib/commerce/assisted-procurement-model';
import styles from './member-orders-view.module.css';

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' });

export function MemberOrdersView({ orders }: { orders: AssistedOrderCustomerView[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState('');
  const [error, setError] = useState('');

  async function decide(order: AssistedOrderCustomerView, decision: 'approve' | 'decline') {
    if (!order.quote) return;
    setPendingId(order.id);
    setError('');
    try {
      const response = await fetch('/api/orders/current/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          quoteVersion: order.quote.version,
          orderRevision: order.revision,
          decision,
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) setError(payload.error ?? 'That decision could not be saved.');
      else router.refresh();
    } catch {
      setError('The connection was interrupted. Your decision was not assumed.');
    }
    setPendingId('');
  }

  return (
    <section className={styles.page} aria-labelledby="me-orders-title">
      <header className={styles.heading}>
        <div><p>My orders</p><h1 id="me-orders-title">Track every request.</h1></div>
        <Link href="/products"><ShoppingBag size={17} aria-hidden="true" /> Start a basket</Link>
      </header>
      {orders.length ? (
        <div className={styles.orders}>
          {orders.map(order => {
            const status = CUSTOMER_VISIBLE_ORDER_STATES[order.state];
            return (
              <article key={order.id} className={styles.order}>
                <header>
                  <div><p>{order.reference} · {order.retailer}</p><h2>{status.label}</h2><span>{status.detail}</span></div>
                  <small><Clock3 size={15} aria-hidden="true" /> {date.format(new Date(order.updatedAt))}</small>
                </header>
                <div className={styles.lines}>
                  {order.lines.map(line => (
                    <div key={line.slug}>
                      <span className={styles.image}><SafeProductImage src={line.image} alt="" /></span>
                      <span><strong>{line.name}</strong><small>{line.brand} · {line.size} · Qty {line.quantity}</small></span>
                    </div>
                  ))}
                </div>
                {order.quote ? (
                  <div className={styles.quote}>
                    <span><small>Quote v{order.quote.version}</small><strong>{order.quote.totalNgn == null ? 'Incomplete' : naira.format(order.quote.totalNgn)}</strong></span>
                    {order.state === 'awaiting_approval' && order.quote.status === 'awaiting_approval' ? (
                      <span className={styles.actions}>
                        <button disabled={pendingId === order.id} onClick={() => decide(order, 'approve')}>Approve</button>
                        <button disabled={pendingId === order.id} onClick={() => decide(order, 'decline')}>Change</button>
                      </span>
                    ) : null}
                    {order.state === 'payment_pending' ? <span className={styles.gated}><Check size={15} /> Approved · payment gated</span> : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty}><PackageCheck size={26} /><h2>No order requests yet.</h2><p>A guest basket works without signing in. Signed-in requests appear here automatically.</p><Link href="/products">Explore products</Link></div>
      )}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </section>
  );
}
