'use client';

import { CheckCircle2, Clock3, PackageCheck, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import type { AssistedOrderPrivateView } from '@/lib/commerce/assisted-procurement-repository';
import { CUSTOMER_VISIBLE_ORDER_STATES } from '@/lib/commerce/assisted-procurement-model';
import { submitOrderQuoteAction, transitionOrderAction } from './actions';
import styles from './orders.module.css';

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' });

export function OrdersQueue({ orders, canManage }: { orders: AssistedOrderPrivateView[]; canManage: boolean }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(orders[0]?.id ?? '');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const selected = orders.find(order => order.id === selectedId) ?? orders[0];
  const sections = useMemo(() => ({
    waiting: orders.filter(order => ['requested', 'needs_response'].includes(order.state)),
    active: orders.filter(order => !['requested', 'needs_response', 'payment_pending'].includes(order.state)),
    approved: orders.filter(order => order.state === 'payment_pending'),
  }), [orders]);

  if (!selected) return <div className={styles.empty}><PackageCheck size={24} /><h2>You’re caught up.</h2><p>No assisted orders are waiting.</p></div>;

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError('');
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? 'The action failed.');
      else router.refresh();
    });
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.queue}>
        <QueueSection label="Needs a verified step" orders={sections.waiting} selectedId={selected.id} onSelect={setSelectedId} />
        <QueueSection label="In progress" orders={sections.active} selectedId={selected.id} onSelect={setSelectedId} />
        <QueueSection label="Quote approved · payment gated" orders={sections.approved} selectedId={selected.id} onSelect={setSelectedId} />
      </div>

      <aside className={styles.inspector}>
        <header>
          <div><p>Order {selected.reference}</p><h2>{selected.contactName}</h2></div>
          <span>{CUSTOMER_VISIBLE_ORDER_STATES[selected.state].label}</span>
        </header>
        <div className={styles.privateData}>
          <strong>{selected.retailer}</strong>
          <span>{selected.contactEmail}</span>
          <span>{selected.contactPhone}</span>
          <span>{selected.deliveryAddress}, {selected.deliveryCity}, {selected.deliveryState}</span>
          {selected.deliveryInstructions ? <span>{selected.deliveryInstructions}</span> : null}
          <small>{selected.whatsappConsent ? 'WhatsApp consent recorded' : 'Do not initiate WhatsApp contact'}</small>
        </div>
        <div className={styles.lines}>
          {selected.lines.map(line => (
            <div key={line.slug}><span>{line.brand} · {line.name}<small>{line.size} × {line.quantity}</small></span><b>{naira.format(line.observedUnitPriceNgn * line.quantity)}</b></div>
          ))}
        </div>

        {selected.state === 'requested' || selected.state === 'needs_response' ? (
          <div className={styles.decision}>
            <p><Clock3 size={17} /> Next governed step</p>
            <h3>Begin a fresh verification.</h3>
            <p>Check exact products and every cost component. Do not substitute.</p>
            <button disabled={!canManage || pending} onClick={() => run(() => transitionOrderAction({ orderId: selected.id, revision: selected.revision, transition: 'quoting' }))}>Start quoting</button>
          </div>
        ) : null}

        {selected.state === 'quoting' ? (
          <QuoteForm
            order={selected}
            disabled={!canManage || pending}
            onSubmit={input => run(() => submitOrderQuoteAction(input))}
          />
        ) : null}

        {selected.state === 'awaiting_approval' ? (
          <div className={styles.decision}><p><CheckCircle2 size={17} /> Customer decision</p><h3>Quote version {selected.quote?.version} is waiting.</h3><p>It expires {selected.quote ? date.format(new Date(selected.quote.expiresAt)) : 'soon'}. A changed cost requires a new quote.</p></div>
        ) : null}

        {selected.state === 'payment_pending' ? (
          <div className={styles.paymentGate}><CheckCircle2 size={18} /><p><strong>Approval recorded.</strong> Paid and procurement remain unavailable until the separate payment-evidence release is accepted.</p></div>
        ) : null}

        {canManage && ['requested', 'quoting', 'awaiting_approval', 'needs_response', 'payment_pending'].includes(selected.state) ? (
          <button className={styles.cancel} disabled={pending} onClick={() => run(() => transitionOrderAction({ orderId: selected.id, revision: selected.revision, transition: 'cancelled', reason: 'Cancelled by Operations.' }))}><XCircle size={16} /> Cancel order request</button>
        ) : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
      </aside>
    </div>
  );
}

function QueueSection({ label, orders, selectedId, onSelect }: { label: string; orders: AssistedOrderPrivateView[]; selectedId: string; onSelect: (id: string) => void }) {
  if (!orders.length) return null;
  return <section><h2>{label}<span>{orders.length}</span></h2><div>{orders.map(order => <button key={order.id} type="button" data-active={order.id === selectedId ? 'true' : 'false'} onClick={() => onSelect(order.id)}><span><strong>{order.reference}</strong><small>{order.retailer}</small></span><span><b>{order.lines.length} lines</b><small>{date.format(new Date(order.updatedAt))}</small></span></button>)}</div></section>;
}

function QuoteForm({ order, disabled, onSubmit }: { order: AssistedOrderPrivateView; disabled: boolean; onSubmit: (input: unknown) => void }) {
  const observed = order.lines.reduce((sum, line) => sum + line.observedUnitPriceNgn * line.quantity, 0);
  return (
    <form className={styles.quoteForm} onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      onSubmit({
        orderId: order.id,
        revision: order.revision,
        productSubtotalNgn: Number(data.get('productSubtotalNgn')),
        retailerFeeNgn: Number(data.get('retailerFeeNgn')),
        taxNgn: Number(data.get('taxNgn')),
        jelocareFeeNgn: Number(data.get('jelocareFeeNgn')),
        deliveryNgn: Number(data.get('deliveryNgn')),
        evidenceReference: data.get('evidenceReference'),
        notes: data.get('notes'),
        expiresAt: new Date(String(data.get('expiresAt'))).toISOString(),
      });
    }}>
      <p className={styles.quoteEyebrow}>Complete quote · unknown cannot be zero</p>
      <div className={styles.moneyGrid}>
        <label><span>Products</span><input name="productSubtotalNgn" type="number" min="0" defaultValue={observed} required /></label>
        <label><span>Retailer fee</span><input name="retailerFeeNgn" type="number" min="0" required /></label>
        <label><span>Observed tax</span><input name="taxNgn" type="number" min="0" required /></label>
        <label><span>JeloCare fee</span><input name="jelocareFeeNgn" type="number" min="0" required /></label>
        <label><span>Delivery</span><input name="deliveryNgn" type="number" min="0" required /></label>
        <label><span>Expires</span><input name="expiresAt" type="datetime-local" required /></label>
      </div>
      <label><span>Evidence reference</span><input name="evidenceReference" required minLength={8} placeholder="Retailer quote or staff evidence reference" /></label>
      <label><span>Customer note</span><textarea name="notes" maxLength={1000} /></label>
      <button disabled={disabled} type="submit">Issue exact quote</button>
    </form>
  );
}
