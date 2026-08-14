"use client";

import {
  Check,
  Clock3,
  Copy,
  CreditCard,
  Landmark,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Truck,
  XCircle,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SafeProductImage } from "@/components/products/safe-product-image";
import { OrderNotificationPreference } from "@/components/commerce/order-notification-preference";
import {
  CUSTOMER_VISIBLE_ORDER_STATES,
  type AssistedOrderCustomerView,
} from "@/lib/commerce/assisted-procurement-model";
import { JELOCARE_WHATSAPP_CONTACT } from "@/lib/commerce/whatsapp-contact";
import { JELOCARE_BANK_ACCOUNT } from "@/lib/commerce/payment-config";
import { formatOrderDateTime } from "@/lib/commerce/order-date";
import styles from "./member-orders-view.module.css";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const date = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" });

export function MemberOrdersView({
  orders,
}: {
  orders: AssistedOrderCustomerView[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState("");
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(
    orders[0]?.id ?? null,
  );

  async function decide(
    order: AssistedOrderCustomerView,
    decision: "approve" | "decline",
  ) {
    if (!order.quote) return;
    setPendingId(order.id);
    setError("");
    try {
      const response = await fetch("/api/orders/current/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          quoteVersion: order.quote.version,
          orderRevision: order.revision,
          decision,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        setError(payload.error ?? "That decision could not be saved.");
      else router.refresh();
    } catch {
      setError("The connection was interrupted. Your decision was not saved.");
    }
    setPendingId("");
  }

  return (
    <section className={styles.page} aria-labelledby="me-orders-title">
      <header className={styles.heading}>
        <div>
          <p>My orders</p>
          <h1 id="me-orders-title">Track every request.</h1>
        </div>
        <Link href="/products">
          <ShoppingBag size={17} aria-hidden="true" /> Start a basket
        </Link>
      </header>
      {orders.length ? (
        <div className={styles.orders}>
          {orders.map((order) => {
            const status = CUSTOMER_VISIBLE_ORDER_STATES[order.state];
            const isExpanded = expandedId === order.id;
            return (
              <article key={order.id} className={styles.order}>
                <button
                  type="button"
                  className={styles.orderToggle}
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  aria-expanded={isExpanded}
                >
                  <header className={styles.orderHeader}>
                    <div>
                      <p>
                        {order.reference} · {order.retailer}
                      </p>
                      <h2>{status.label}</h2>
                      <span>{status.detail}</span>
                    </div>
                    <small>
                      <Clock3 size={15} aria-hidden="true" />{" "}
                      {date.format(new Date(order.updatedAt))}
                    </small>
                  </header>
                  {order.quote ? (
                    <div className={styles.orderTotalBadge}>
                      {order.quote.totalNgn == null
                        ? "Incomplete"
                        : naira.format(order.quote.totalNgn)}
                    </div>
                  ) : null}
                </button>

                {isExpanded ? (
                  <div className={styles.orderBody}>
                    <MemberOrderStepper state={order.state} />

                    {/* Product lines */}
                    <div className={styles.lines}>
                      {order.lines.map((line) => (
                        <div key={line.slug} className={styles.line}>
                          <span className={styles.lineImage}>
                            <SafeProductImage src={line.image} alt="" />
                          </span>
                          <div className={styles.lineInfo}>
                            <strong>{line.name}</strong>
                            <small>
                              {line.brand} · {line.size} · Qty {line.quantity}
                            </small>
                          </div>
                          <b className={styles.linePrice}>
                            {naira.format(
                              line.observedUnitPriceNgn * line.quantity,
                            )}
                          </b>
                        </div>
                      ))}
                    </div>

                    {/* Quote breakdown */}
                    {order.quote ? (
                      <div className={styles.quoteSection}>
                        <div className={styles.quoteHeading}>
                          <h3>Quote v{order.quote.version}</h3>
                          <span>{order.quote.status.replaceAll("_", " ")}</span>
                        </div>
                        <div className={styles.quoteBreakdown}>
                          <p className={styles.breakdownTitle}>
                            Cost breakdown
                          </p>
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
                          <p className={styles.quoteNotes}>
                            {order.quote.notes}
                          </p>
                        ) : null}

                        {/* Approval actions */}
                        {order.state === "awaiting_approval" &&
                        order.quote.status === "awaiting_approval" ? (
                          <>
                            <div className={styles.paymentHint}>
                              <CreditCard size={16} aria-hidden="true" />
                              <span>Pay after approval.</span>
                            </div>
                            <div className={styles.decisions}>
                              <button
                                type="button"
                                disabled={pendingId === order.id}
                                onClick={() => decide(order, "approve")}
                              >
                                Approve quote
                              </button>
                              <button
                                type="button"
                                disabled={pendingId === order.id}
                                onClick={() => decide(order, "decline")}
                              >
                                Request a change
                              </button>
                            </div>
                          </>
                        ) : null}

                        {/* Payment section */}
                        {order.state === "payment_pending" ? (
                          <MemberPaymentSection
                            order={order}
                            onError={(msg) => setError(msg)}
                            onPaid={() => router.refresh()}
                          />
                        ) : null}
                        {order.state === "delivered" ? (
                          <div className={styles.stateBadge}>
                            <Check size={18} aria-hidden="true" />
                            <strong>Delivered</strong>
                            <span>Order complete.</span>
                            <a
                              className={styles.returnLink}
                              href={`${JELOCARE_WHATSAPP_CONTACT.href}?text=${encodeURIComponent(
                                `Hi JeloCare, I have an issue with order ${order.reference}.`,
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageCircle size={14} aria-hidden="true" />{" "}
                              Report an issue
                            </a>
                          </div>
                        ) : null}
                        {order.state === "cancelled" ? (
                          <div className={styles.stateBadgeCancelled}>
                            <XCircle size={18} aria-hidden="true" />
                            <strong>Cancelled</strong>
                            <span>No further action.</span>
                            <Link
                              className={styles.restartLink}
                              href="/products"
                            >
                              <RotateCcw size={14} aria-hidden="true" /> New
                              basket
                            </Link>
                          </div>
                        ) : null}
                        {order.state === "refund_pending" ||
                        order.state === "refunded" ? (
                          <div className={styles.stateBadgeRefund}>
                            <RefreshCw size={18} aria-hidden="true" />
                            <strong>
                              {order.state === "refunded"
                                ? "Refunded"
                                : "Refund pending"}
                            </strong>
                            <span>
                              {order.state === "refunded"
                                ? "Refund complete."
                                : "Being reconciled."}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Order history */}
                    <div className={styles.historySection}>
                      <p className={styles.breakdownTitle}>Order history</p>
                      <ol className={styles.timeline}>
                        {order.events.map((event) => (
                          <li key={event.id}>
                            <span>
                              <Check size={15} aria-hidden="true" />
                            </span>
                            <div>
                              <strong>
                                {
                                  CUSTOMER_VISIBLE_ORDER_STATES[event.toState]
                                    .label
                                }
                              </strong>
                              {event.reason ? <p>{event.reason}</p> : null}
                              <small>
                                {formatOrderDateTime(event.createdAt)}
                              </small>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <OrderNotificationPreference
                      orderId={order.id}
                      enabled={order.emailNotificationsConsent}
                      compact
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty}>
          <PackageCheck size={26} />
          <h2>No orders yet.</h2>
          <p>
            Guest baskets work without signing in. Signed-in orders appear here.
          </p>
          <Link href="/products">Explore products</Link>
        </div>
      )}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function MemberPaymentSection({
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
      // Fallback: manual copy
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("reference") || params.has("trxref")) {
      onPaid();
    }
  }, [onPaid]);

  if (total == null) {
    return (
      <div className={styles.paymentBoundary}>
        <strong>Quote incomplete.</strong>
        <span>Contact JeloCare to resolve.</span>
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
          {pending ? "Redirecting…" : `Pay ${naira.format(total)}`}
        </button>
        <p className={styles.payButtonSubtext}>Card · USSD · Transfer</p>
      </div>

      <div className={styles.paymentDivider}>
        <span>or direct transfer</span>
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
          Use <strong>{order.reference}</strong> as narration.
        </p>
        <a
          className={styles.confirmPaymentLink}
          href={whatsappConfirmLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={16} aria-hidden="true" />
          Confirm on WhatsApp
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

const STEPPER_STAGES: {
  states: string[];
  label: string;
  icon: typeof Check;
}[] = [
  { states: ["requested", "quoting"], label: "Request", icon: PackageCheck },
  {
    states: ["awaiting_approval", "needs_response"],
    label: "Quote",
    icon: Check,
  },
  { states: ["payment_pending"], label: "Pay", icon: CreditCard },
  {
    states: ["paid", "procurement", "retailer_confirmed"],
    label: "Procure",
    icon: RefreshCw,
  },
  { states: ["out_for_delivery", "delivered"], label: "Deliver", icon: Truck },
];

function MemberOrderStepper({ state }: { state: string }) {
  const isCancelled =
    state === "cancelled" || state === "refund_pending" || state === "refunded";
  if (isCancelled) return null;
  const currentIndex = STEPPER_STAGES.findIndex((stage) =>
    stage.states.includes(state),
  );
  return (
    <nav className={styles.stepper} aria-label="Order progress">
      {STEPPER_STAGES.map((stage, index) => {
        const Icon = stage.icon;
        const isComplete = currentIndex > index;
        const isCurrent = currentIndex === index;
        return (
          <div
            key={stage.label}
            className={[
              styles.step,
              isComplete ? styles.stepComplete : "",
              isCurrent ? styles.stepCurrent : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className={styles.stepIcon}>
              {isComplete ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <Icon size={14} aria-hidden="true" />
              )}
            </span>
            <span className={styles.stepLabel}>{stage.label}</span>
            {index < STEPPER_STAGES.length - 1 ? (
              <span className={styles.stepConnector} />
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
