"use client";

import {
  Check,
  Clock3,
  Copy,
  CreditCard,
  Landmark,
  LockKeyhole,
  MessageCircle,
  PackageCheck,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SafeProductImage } from "@/components/products/safe-product-image";
import { OrderNotificationPreference } from "./order-notification-preference";
import { JELOCARE_WHATSAPP_CONTACT } from "@/lib/commerce/whatsapp-contact";
import { JELOCARE_BANK_ACCOUNT } from "@/lib/commerce/payment-config";
import { formatOrderDateTime } from "@/lib/commerce/order-date";
import {
  CUSTOMER_VISIBLE_ORDER_STATES,
  type AssistedOrderCustomerView,
} from "@/lib/commerce/assisted-procurement-model";
import styles from "./order-status.module.css";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export function OrderStatus({ order }: { order: AssistedOrderCustomerView }) {
  const router = useRouter();
  const [decisionPending, setDecisionPending] = useState(false);
  const [error, setError] = useState("");
  const presentation = CUSTOMER_VISIBLE_ORDER_STATES[order.state];

  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch("/api/orders/current", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const current = (await response.json()) as { revision: number };
        if (current.revision !== order.revision) router.refresh();
      } catch {
        // The status remains visible; the next bounded poll retries.
      }
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [order.revision, router]);

  async function decide(decision: "approve" | "decline") {
    if (!order.quote) return;
    setDecisionPending(true);
    setError("");
    try {
      const response = await fetch("/api/orders/current/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteVersion: order.quote.version,
          orderRevision: order.revision,
          decision,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "That decision could not be saved.");
        setDecisionPending(false);
        return;
      }
    } catch {
      setError(
        "The connection was interrupted. Your decision was not assumed. Refresh and try again.",
      );
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
          <span>
            <PackageCheck size={17} aria-hidden="true" /> {order.retailer}
          </span>
          <span>
            <Clock3 size={17} aria-hidden="true" /> Updated{" "}
            {formatOrderDateTime(order.updatedAt)}
          </span>
        </div>
      </header>

      <div className={styles.layout}>
        <main>
          <section className={styles.card} aria-labelledby="order-items-title">
            <div className={styles.cardHeading}>
              <div>
                <p className="eyebrow">No substitutions</p>
                <h2 id="order-items-title">Exact products.</h2>
              </div>
              <span>
                {order.lines.reduce((total, line) => total + line.quantity, 0)}{" "}
                items
              </span>
            </div>
            <div className={styles.lines}>
              {order.lines.map((line) => (
                <article key={line.slug}>
                  <div className={styles.lineImage}>
                    <SafeProductImage src={line.image} alt="" />
                  </div>
                  <div>
                    <span>{line.brand}</span>
                    <strong>{line.name}</strong>
                    <small>
                      {line.size} · Quantity {line.quantity}
                    </small>
                  </div>
                  <b>
                    {naira.format(line.observedUnitPriceNgn * line.quantity)}
                  </b>
                </article>
              ))}
            </div>
            <p className={styles.observedNote}>
              Observed product prices started this request. The payable amount
              comes only from a complete, current quote.
            </p>
          </section>

          <section
            className={styles.card}
            aria-labelledby="order-history-title"
          >
            <div className={styles.cardHeading}>
              <div>
                <p className="eyebrow">Canonical record</p>
                <h2 id="order-history-title">Order history.</h2>
              </div>
            </div>
            <ol className={styles.timeline}>
              {order.events.map((event) => (
                <li key={event.id}>
                  <span>
                    <Check size={15} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>
                      {CUSTOMER_VISIBLE_ORDER_STATES[event.toState].label}
                    </strong>
                    {event.reason ? <p>{event.reason}</p> : null}
                    <small>{formatOrderDateTime(event.createdAt)}</small>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </main>

        <aside className={styles.quoteCard}>
          <p className="eyebrow">Verified quote</p>
          {order.quote ? (
            <>
              <div className={styles.quoteHeading}>
                <h2>Version {order.quote.version}</h2>
                <span>{order.quote.status.replaceAll("_", " ")}</span>
              </div>
              <div className={styles.quoteBreakdown}>
                <p className={styles.breakdownTitle}>Cost breakdown</p>
                <dl>
                  <QuoteLine
                    label="Products"
                    value={order.quote.components.productSubtotalNgn}
                  />
                  <QuoteLine
                    label="Retailer fee"
                    value={order.quote.components.retailerFeeNgn}
                  />
                  <QuoteLine
                    label="Observed tax"
                    value={order.quote.components.taxNgn}
                  />
                  <QuoteLine
                    label="JeloCare fee"
                    value={order.quote.components.jelocareFeeNgn}
                  />
                  <QuoteLine
                    label="Delivery"
                    value={order.quote.components.deliveryNgn}
                  />
                </dl>
                <div className={styles.quoteTotal}>
                  <dt>Total to pay</dt>
                  <dd>
                    {order.quote.totalNgn == null
                      ? "Incomplete"
                      : naira.format(order.quote.totalNgn)}
                  </dd>
                </div>
              </div>
              <p className={styles.quoteExpiry}>
                Expires {formatOrderDateTime(order.quote.expiresAt)}
              </p>
              {order.quote.notes ? (
                <p className={styles.quoteNotes}>{order.quote.notes}</p>
              ) : null}
              {order.state === "awaiting_approval" &&
              order.quote.status === "awaiting_approval" ? (
                <>
                  <div className={styles.paymentHint}>
                    <CreditCard size={16} aria-hidden="true" />
                    <span>
                      After approval, pay by card, USSD, or bank transfer.
                      Procurement begins once payment is confirmed.
                    </span>
                  </div>
                  <div className={styles.decisions}>
                    <button
                      type="button"
                      disabled={decisionPending}
                      onClick={() => decide("approve")}
                    >
                      Approve exact quote
                    </button>
                    <button
                      type="button"
                      disabled={decisionPending}
                      onClick={() => decide("decline")}
                    >
                      Request a change
                    </button>
                  </div>
                </>
              ) : null}
              {order.state === "payment_pending" ? (
                <PaymentSection
                  order={order}
                  onError={(msg) => setError(msg)}
                  onPaid={() => router.refresh()}
                />
              ) : null}{" "}
            </>
          ) : (
            <div className={styles.quoteWaiting}>
              <RefreshCw size={22} aria-hidden="true" />
              <h2>Being prepared.</h2>
              <p>
                Products, fees, tax, and delivery are each checked. Unknown
                costs stay unknown.
              </p>
            </div>
          )}
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <OrderNotificationPreference
            enabled={order.emailNotificationsConsent}
          />
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
          <div className={styles.privateNote}>
            <LockKeyhole size={16} aria-hidden="true" />
            <span>
              This private page is available on this device for 30 days.
            </span>
          </div>
          <Link className={styles.continueShopping} href="/products">
            Continue browsing
          </Link>
        </aside>
      </div>
    </div>
  );
}

function PaymentSection({
  order,
  onError,
  onPaid,
}: {
  order: AssistedOrderCustomerView;
  onError: (msg: string) => void;
  onPaid: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const total = order.quote?.totalNgn;

  async function payWithPaystack() {
    if (!total) return;
    setPending(true);
    onError("");
    try {
      const response = await fetch("/api/orders/current/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = (await response.json()) as {
        authorizationUrl?: string;
        error?: string;
      };
      if (!response.ok || !data.authorizationUrl) {
        onError(data.error ?? "Payment could not be started.");
        setPending(false);
        return;
      }
      window.location.assign(data.authorizationUrl);
    } catch {
      onError("Payment could not be started. Please try again.");
      setPending(false);
    }
  }

  async function copyAccountNumber() {
    try {
      await navigator.clipboard.writeText(JELOCARE_BANK_ACCOUNT.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text manually
    }
  }

  // After returning from Paystack, the order may have been marked paid
  // by the webhook. Refresh to check.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("reference") || params.has("trxref")) {
      onPaid();
    }
  }, [onPaid]);

  if (total == null) {
    return (
      <div className={styles.paymentBoundary}>
        <LockKeyhole size={19} aria-hidden="true" />
        <p>
          <strong>Quote total is incomplete.</strong> Contact JeloCare to
          resolve the missing cost component before payment.
        </p>
      </div>
    );
  }

  const whatsappConfirmLink = `${JELOCARE_WHATSAPP_CONTACT.href}?text=${encodeURIComponent(
    `Hello JeloCare, I've paid ${naira.format(total)} for order ${order.reference}. My transfer reference is: `,
  )}`;

  return (
    <div className={styles.paymentSection}>
      <div className={styles.paymentHeader}>
        <Check size={20} aria-hidden="true" />
        <div>
          <strong>Pay {naira.format(total)}</strong>
          <p>Your quote is approved. Pay to begin procurement.</p>
        </div>
      </div>

      <div className={styles.paymentOptions}>
        <button
          type="button"
          className={styles.payButton}
          disabled={pending}
          onClick={payWithPaystack}
        >
          <CreditCard size={18} aria-hidden="true" />
          {pending ? "Redirecting…" : `Pay ${naira.format(total)} online`}
        </button>
        <p className={styles.payButtonSubtext}>
          Card, USSD, or bank transfer via Paystack
        </p>
      </div>

      <div className={styles.paymentDivider}>
        <span>or pay by direct bank transfer</span>
      </div>

      <div className={styles.bankTransferInfo}>
        <div className={styles.bankTransferHeader}>
          <Landmark size={18} aria-hidden="true" />
          <strong>Transfer to JeloCare</strong>
        </div>
        <dl>
          <div>
            <dt>Bank</dt>
            <dd>{JELOCARE_BANK_ACCOUNT.bankName}</dd>
          </div>
          <div>
            <dt>Account name</dt>
            <dd>{JELOCARE_BANK_ACCOUNT.accountName}</dd>
          </div>
          <div className={styles.accountNumberRow}>
            <dt>Account number</dt>
            <dd>
              <span className={styles.accountNumber}>
                {JELOCARE_BANK_ACCOUNT.accountNumber}
              </span>
              <button
                type="button"
                className={styles.copyButton}
                onClick={copyAccountNumber}
                aria-label="Copy account number"
              >
                {copied ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <Copy size={15} aria-hidden="true" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </dd>
          </div>
          <div>
            <dt>Amount</dt>
            <dd>{naira.format(total)}</dd>
          </div>
          <div>
            <dt>Reference</dt>
            <dd>{order.reference}</dd>
          </div>
        </dl>
        <p className={styles.bankTransferNote}>
          Use <strong>{order.reference}</strong> as the transfer narration so we
          can match your payment quickly.
        </p>
        <a
          className={styles.confirmPaymentLink}
          href={whatsappConfirmLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={16} aria-hidden="true" />
          Send payment confirmation on WhatsApp
        </a>
      </div>
    </div>
  );
}

function QuoteLine({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value == null ? "Unknown" : naira.format(value)}</dd>
    </div>
  );
}
