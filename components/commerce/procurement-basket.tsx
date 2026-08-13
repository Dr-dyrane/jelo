'use client';

import { ArrowRight, Check, Minus, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { Product } from '@/data/products';
import { ProductCard } from '@/components/products/product-card';
import { findRetailerBasketOptions } from '@/lib/commerce/retailer-basket';
import { useBasket } from './basket-provider';
import {
  CHECKOUT_REQUEST_STORAGE_KEY,
  CHECKOUT_RETAILER_STORAGE_KEY,
} from '@/lib/commerce/basket';
import styles from './procurement.module.css';

export type ProcurementProduct = Pick<Product, 'slug' | 'brand' | 'name' | 'size' | 'image' | 'offers'>;
const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export function ProcurementBasket({ products }: { products: ProcurementProduct[] }) {
  const basket = useBasket();
  const router = useRouter();
  const productBySlug = useMemo(() => new Map(products.map(product => [product.slug, product])), [products]);
  const selectedProducts = useMemo(
    () => basket.items
      .map(item => productBySlug.get(item.slug))
      .filter((product): product is ProcurementProduct => Boolean(product)),
    [basket.items, productBySlug],
  );
  const quantities = useMemo(
    () => new Map(basket.items.map(item => [item.slug, item.quantity])),
    [basket.items],
  );
  const options = useMemo(
    () => findRetailerBasketOptions(selectedProducts, quantities),
    [quantities, selectedProducts],
  );
  const [selectedRetailer, setSelectedRetailer] = useState('');

  if (!basket.ready) return <div className={styles.loading}>Opening your basket…</div>;
  if (selectedProducts.length === 0) {
    return (
      <section className={styles.empty}>
        <p className="eyebrow">Guest basket</p>
        <h1>Your basket is ready when you are.</h1>
        <p>Add an exact product. You do not need an account.</p>
        <Link href="/products">Browse products <ArrowRight size={17} aria-hidden="true" /></Link>
      </section>
    );
  }

  const storedRetailer = localStorage.getItem(CHECKOUT_RETAILER_STORAGE_KEY);
  const retailer = options.some(option => option.retailer === selectedRetailer)
    ? selectedRetailer
    : options.some(option => option.retailer === storedRetailer)
      ? storedRetailer!
      : options[0]?.retailer ?? '';
  const chosen = options.find(option => option.retailer === retailer);

  return (
    <div className={styles.basketLayout}>
      <section className={styles.basketProducts} aria-labelledby="basket-products-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Exact products</p>
            <h2 id="basket-products-title">Your basket.</h2>
          </div>
          <span>{basket.totalQuantity} {basket.totalQuantity === 1 ? 'item' : 'items'}</span>
        </div>
        <div className={`product-grid ${styles.productGrid}`}>
          {selectedProducts.map(product => {
            const quantity = quantities.get(product.slug) ?? 1;
            return (
              <ProductCard
                key={product.slug}
                product={product}
                density="compact"
                footer={
                  <div className={styles.quantity} aria-label={`Quantity for ${product.name}`}>
                    <button type="button" onClick={() => basket.setQuantity(product.slug, quantity - 1)} aria-label={`Remove one ${product.name}`}>
                      {quantity === 1 ? <Trash2 size={16} aria-hidden="true" /> : <Minus size={16} aria-hidden="true" />}
                    </button>
                    <span>{quantity}</span>
                    <button type="button" onClick={() => basket.setQuantity(product.slug, quantity + 1)} aria-label={`Add one ${product.name}`}>
                      <Plus size={16} aria-hidden="true" />
                    </button>
                  </div>
                }
              />
            );
          })}
        </div>
      </section>

      <aside className={styles.retailerChoice} aria-labelledby="retailer-choice-title">
        <p className="eyebrow">One retailer</p>
        <h2 id="retailer-choice-title">Choose where JeloCare checks.</h2>
        <p className={styles.muted}>These are observed product totals—not final checkout quotes. Delivery and fees are verified after your address.</p>
        {options.length ? (
          <fieldset className={styles.retailerOptions}>
            <legend className="sr-only">Choose one retailer</legend>
            {options.map((option, index) => (
              <label key={option.retailer} data-selected={retailer === option.retailer ? 'true' : 'false'}>
                <input
                  type="radio"
                  name="retailer"
                  value={option.retailer}
                  checked={retailer === option.retailer}
                  onChange={() => setSelectedRetailer(option.retailer)}
                />
                <span>
                  <strong>{option.retailer}</strong>
                  <small>{option.allInStock ? 'All exact items listed in stock' : 'An item needs rechecking'}</small>
                </span>
                <b>{naira.format(option.combinedTotal)}</b>
                {index === 0 ? <em>Lowest observed</em> : null}
              </label>
            ))}
          </fieldset>
        ) : (
          <div className={styles.noMatch}>
            <strong>No one-retailer match.</strong>
            <p>Remove one product or choose another. JeloCare will not silently split an order.</p>
          </div>
        )}
        <div className={styles.assurance}>
          <ShieldCheck size={19} aria-hidden="true" />
          <p><strong>No payment now.</strong> You approve one complete, verified quote before anything proceeds.</p>
        </div>
        <button
          type="button"
          className={styles.primaryAction}
          disabled={!chosen || !chosen.allInStock}
          onClick={() => {
            if (!chosen) return;
            localStorage.setItem(CHECKOUT_RETAILER_STORAGE_KEY, chosen.retailer);
            router.push('/checkout');
          }}
        >
          Continue to checkout <ArrowRight size={17} aria-hidden="true" />
        </button>
      </aside>
    </div>
  );
}

export function CheckoutExperience({ products }: { products: ProcurementProduct[] }) {
  const basket = useBasket();
  const router = useRouter();
  const productBySlug = useMemo(() => new Map(products.map(product => [product.slug, product])), [products]);
  const selectedProducts = useMemo(
    () => basket.items
      .map(item => productBySlug.get(item.slug))
      .filter((product): product is ProcurementProduct => Boolean(product)),
    [basket.items, productBySlug],
  );
  const quantities = useMemo(() => new Map(basket.items.map(item => [item.slug, item.quantity])), [basket.items]);
  const options = useMemo(() => findRetailerBasketOptions(selectedProducts, quantities), [quantities, selectedProducts]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!basket.ready) return <div className={styles.loading}>Preparing checkout…</div>;
  const storedRetailer = localStorage.getItem(CHECKOUT_RETAILER_STORAGE_KEY);
  const retailer = options.some(option => option.retailer === storedRetailer)
    ? storedRetailer!
    : options[0]?.retailer ?? '';
  const chosen = options.find(option => option.retailer === retailer);
  if (!chosen || !selectedProducts.length) {
    return (
      <section className={styles.empty}>
        <p className="eyebrow">Checkout</p>
        <h1>Your basket needs another look.</h1>
        <p>Choose exact products and one retailer before checkout.</p>
        <Link href="/basket">Return to basket <ArrowRight size={17} aria-hidden="true" /></Link>
      </section>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const basketSignature = JSON.stringify({ retailer, lines: basket.items });
    let requestRecord: { signature: string; requestId: string } | null = null;
    try {
      requestRecord = JSON.parse(sessionStorage.getItem(CHECKOUT_REQUEST_STORAGE_KEY) ?? 'null');
    } catch {
      // Replace malformed browser state with a new request capability.
    }
    if (!requestRecord || requestRecord.signature !== basketSignature) {
      requestRecord = { signature: basketSignature, requestId: crypto.randomUUID() };
      sessionStorage.setItem(CHECKOUT_REQUEST_STORAGE_KEY, JSON.stringify(requestRecord));
    }
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: requestRecord.requestId,
          retailer,
          lines: basket.items,
          contactName: data.get('contactName'),
          contactEmail: data.get('contactEmail'),
          contactPhone: data.get('contactPhone'),
          deliveryAddress: data.get('deliveryAddress'),
          deliveryCity: data.get('deliveryCity'),
          deliveryState: data.get('deliveryState'),
          deliveryInstructions: data.get('deliveryInstructions'),
          whatsappConsent: data.get('whatsappConsent') === 'on',
          termsAccepted: data.get('termsAccepted') === 'on',
          websiteField: data.get('websiteField'),
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? 'Checkout request could not be saved.');
        setSubmitting(false);
        return;
      }
    } catch {
      setError('The connection was interrupted. Retry to reopen the same request safely.');
      setSubmitting(false);
      return;
    }
    basket.clear();
    localStorage.removeItem(CHECKOUT_RETAILER_STORAGE_KEY);
    sessionStorage.removeItem(CHECKOUT_REQUEST_STORAGE_KEY);
    router.push('/order');
  }

  return (
    <div className={styles.checkoutLayout}>
      <section className={styles.checkoutSummary}>
        <p className="eyebrow">Your retailer</p>
        <h2>{chosen.retailer}</h2>
        <dl>
          {chosen.offers.map(offer => (
            <div key={offer.productSlug}>
              <dt>{offer.productBrand} · {offer.productName} <small>× {quantities.get(offer.productSlug) ?? 1}</small></dt>
              <dd>{naira.format(offer.priceNgn * (quantities.get(offer.productSlug) ?? 1))}</dd>
            </div>
          ))}
          <div className={styles.observedTotal}>
            <dt>Observed product total</dt>
            <dd>{naira.format(chosen.combinedTotal)}</dd>
          </div>
        </dl>
        <div className={styles.quoteSteps}>
          <span><Check size={16} aria-hidden="true" /> Submit this exact basket</span>
          <span><Check size={16} aria-hidden="true" /> Staff verifies every cost</span>
          <span><Check size={16} aria-hidden="true" /> You approve the final quote</span>
        </div>
      </section>

      <form className={styles.checkoutForm} onSubmit={submit}>
        <div>
          <p className="eyebrow">Guest checkout</p>
          <h1>Where should we quote delivery?</h1>
          <p>No account required. We use these details only for this order request.</p>
        </div>
        <input className={styles.honeypot} name="websiteField" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <div className={styles.fieldGrid}>
          <label><span>Name</span><input name="contactName" autoComplete="name" required minLength={2} /></label>
          <label><span>Email</span><input name="contactEmail" type="email" autoComplete="email" required /></label>
          <label><span>Phone</span><input name="contactPhone" type="tel" autoComplete="tel" required /></label>
          <label className={styles.fullField}><span>Delivery address</span><textarea name="deliveryAddress" autoComplete="street-address" required minLength={5} /></label>
          <label><span>City</span><input name="deliveryCity" autoComplete="address-level2" required /></label>
          <label><span>State</span><input name="deliveryState" autoComplete="address-level1" required /></label>
          <label className={styles.fullField}><span>Delivery notes <small>optional</small></span><textarea name="deliveryInstructions" maxLength={500} /></label>
        </div>
        <label className={styles.checkField}>
          <input type="checkbox" name="whatsappConsent" />
          <span>JeloCare may contact this number on WhatsApp about this order. I can continue without WhatsApp.</span>
        </label>
        <label className={styles.checkField}>
          <input type="checkbox" name="termsAccepted" required />
          <span>I understand this is an order request, not payment. The retailer supplies the products and I must approve the complete quote.</span>
        </label>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <button className={styles.primaryAction} type="submit" disabled={submitting}>
          {submitting ? 'Saving request…' : 'Request verified quote'}
          {!submitting ? <ArrowRight size={17} aria-hidden="true" /> : null}
        </button>
        <p className={styles.finePrint}>No payment is taken. Unknown delivery, tax, or fees cannot be treated as zero.</p>
      </form>
    </div>
  );
}
