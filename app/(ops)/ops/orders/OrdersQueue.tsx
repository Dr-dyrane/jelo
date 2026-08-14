"use client";

import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  CreditCard,
  ExternalLink,
  FileCheck2,
  HandCoins,
  Inbox,
  MailCheck,
  PackageCheck,
  PackageSearch,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  Store,
  Truck,
  UserRoundCheck,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import type { AssistedOrderPrivateView } from "@/lib/commerce/assisted-procurement-repository";
import { CUSTOMER_VISIBLE_ORDER_STATES } from "@/lib/commerce/assisted-procurement-model";
import type { AssistedOrderNotificationDeliverySummary } from "@/lib/commerce/order-notification-model";
import type { AssistedOrderOperatorAlertSummary } from "@/lib/commerce/order-operator-alert-repository";
import {
  resolveOrderOperationsJourney,
  type OrderOperationsJourneyId,
} from "@/lib/commerce/order-operations-journey";
import {
  retryOrderNotificationAction,
  retryOrderOperatorAlertAction,
  reverifyOrderAction,
  submitOrderQuoteAction,
  transitionOrderAction,
} from "./actions";
import styles from "./orders.module.css";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});
const date = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function OrdersQueue({
  orders,
  notificationDeliveries,
  operatorAlerts,
  canManage,
}: {
  orders: AssistedOrderPrivateView[];
  notificationDeliveries: AssistedOrderNotificationDeliverySummary[];
  operatorAlerts: AssistedOrderOperatorAlertSummary[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(orders[0]?.id ?? "");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [pending, startTransition] = useTransition();
  const selected = orders.find((order) => order.id === selectedId) ?? orders[0];
  const selectedDelivery = notificationDeliveries.find(
    (delivery) => delivery.orderId === selected?.id,
  );
  const selectedOperatorAlert = operatorAlerts.find(
    (alert) => alert.orderId === selected?.id,
  );
  const sections = useMemo(
    () => ({
      waiting: orders.filter((order) =>
        ["requested", "needs_response"].includes(order.state),
      ),
      active: orders.filter(
        (order) =>
          !["requested", "needs_response", "payment_pending"].includes(
            order.state,
          ),
      ),
      approved: orders.filter((order) => order.state === "payment_pending"),
    }),
    [orders],
  );

  if (!selected)
    return (
      <div className={styles.empty}>
        <PackageCheck size={24} />
        <h2>You’re caught up.</h2>
        <p>No assisted orders are waiting.</p>
      </div>
    );

  function run(
    action: () => Promise<{
      ok: boolean;
      error?: string;
      delivery?: "sent" | "pending" | "failed" | "none";
    }>,
  ) {
    setError("");
    setFeedback("");
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "The action failed.");
      else {
        if (result.delivery === "sent")
          setFeedback(
            "Customer email delivered. The in-app update is also recorded.",
          );
        if (result.delivery === "pending")
          setFeedback(
            "The in-app update is recorded. Email delivery is pending.",
          );
        if (result.delivery === "failed")
          setFeedback(
            "The in-app update is recorded. Email delivery needs attention.",
          );
        router.refresh();
      }
    });
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.queue}>
        <QueueSection
          label="Needs a verified step"
          orders={sections.waiting}
          selectedId={selected.id}
          onSelect={setSelectedId}
        />
        <QueueSection
          label="In progress"
          orders={sections.active}
          selectedId={selected.id}
          onSelect={setSelectedId}
        />
        <QueueSection
          label="Quote approved · payment gated"
          orders={sections.approved}
          selectedId={selected.id}
          onSelect={setSelectedId}
        />
      </div>

      <aside className={styles.inspector}>
        <header>
          <div>
            <p>Order {selected.reference}</p>
            <h2>{selected.contactName}</h2>
          </div>
          <span>{CUSTOMER_VISIBLE_ORDER_STATES[selected.state].label}</span>
        </header>
        <OrderLifecycle order={selected} />
        <div className={styles.privateData}>
          <strong>{selected.retailer}</strong>
          <span>{selected.contactEmail}</span>
          <span>{selected.contactPhone}</span>
          <span>
            {selected.deliveryAddress}, {selected.deliveryCity},{" "}
            {selected.deliveryState}
          </span>
          {selected.deliveryInstructions ? (
            <span>{selected.deliveryInstructions}</span>
          ) : null}
          <small>
            {selected.whatsappConsent
              ? "WhatsApp consent recorded"
              : "Do not initiate WhatsApp contact"}
          </small>
        </div>
        <div className={styles.lines}>
          {selected.lines.map((line) => (
            <div key={line.slug}>
              <span>
                {line.brand} · {line.name}
                <small>
                  {line.size} × {line.quantity}
                </small>
              </span>
              <span className={styles.lineActions}>
                <b>{naira.format(line.observedUnitPriceNgn * line.quantity)}</b>
                {line.observedListingUrl ? (
                  <a
                    href={line.observedListingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open retailer <ExternalLink size={14} aria-hidden="true" />
                  </a>
                ) : null}
              </span>
            </div>
          ))}
        </div>

        <OrderVerificationPanel
          order={selected}
          canManage={canManage}
          pending={pending}
          onReverify={() =>
            run(() => reverifyOrderAction({ orderId: selected.id }))
          }
        />

        <TeamAlertDelivery
          alert={selectedOperatorAlert}
          canManage={canManage}
          pending={pending}
          onRetry={() =>
            run(() => retryOrderOperatorAlertAction({ orderId: selected.id }))
          }
        />

        <NotificationDelivery
          delivery={selectedDelivery}
          enabled={selected.emailNotificationsConsent}
          canManage={canManage}
          pending={pending}
          onRetry={() =>
            selectedDelivery &&
            run(() =>
              retryOrderNotificationAction({
                notificationId: selectedDelivery.id,
                orderId: selected.id,
              }),
            )
          }
        />

        {selected.state === "requested" ||
        selected.state === "needs_response" ? (
          <div className={styles.decision}>
            <p>
              <Clock3 size={17} /> Next governed step
            </p>
            <h3>Begin a fresh verification.</h3>
            <p>
              Check exact products and every cost component. Do not substitute.
            </p>
            <button
              disabled={!canManage || pending}
              onClick={() =>
                run(() =>
                  transitionOrderAction({
                    orderId: selected.id,
                    revision: selected.revision,
                    transition: "quoting",
                  }),
                )
              }
            >
              Start quoting
            </button>
          </div>
        ) : null}

        {selected.state === "quoting" ? (
          <QuoteForm
            key={selected.id}
            order={selected}
            disabled={!canManage || pending}
            onSubmit={(input) => run(() => submitOrderQuoteAction(input))}
          />
        ) : null}

        {selected.state === "awaiting_approval" ? (
          <div className={styles.decision}>
            <p>
              <CheckCircle2 size={17} /> Customer decision
            </p>
            <h3>Quote version {selected.quote?.version} is waiting.</h3>
            <p>
              It expires{" "}
              {selected.quote
                ? date.format(new Date(selected.quote.expiresAt))
                : "soon"}
              . A changed cost requires a new quote.
            </p>
          </div>
        ) : null}

        {selected.state === "payment_pending" ? (
          <div className={styles.paymentGate}>
            <CheckCircle2 size={18} />
            <p>
              <strong>Approval recorded.</strong> Paid and procurement remain
              unavailable until the separate payment-evidence release is
              accepted.
            </p>
          </div>
        ) : null}

        {canManage &&
        [
          "requested",
          "quoting",
          "awaiting_approval",
          "needs_response",
          "payment_pending",
        ].includes(selected.state) ? (
          <button
            className={styles.cancel}
            disabled={pending}
            onClick={() =>
              run(() =>
                transitionOrderAction({
                  orderId: selected.id,
                  revision: selected.revision,
                  transition: "cancelled",
                  reason: "Cancelled by Operations.",
                }),
              )
            }
          >
            <XCircle size={16} /> Cancel order request
          </button>
        ) : null}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {feedback ? (
          <p className={styles.feedback} role="status">
            {feedback}
          </p>
        ) : null}
      </aside>
    </div>
  );
}

const JOURNEY_ICONS: Record<OrderOperationsJourneyId, LucideIcon> = {
  request: Inbox,
  verify: ShieldCheck,
  approval: UserRoundCheck,
  payment: CreditCard,
  purchase: Store,
  delivery: Truck,
  complete: PackageCheck,
};

function OrderLifecycle({ order }: { order: AssistedOrderPrivateView }) {
  const { steps, exception, deepestReachedIndex } =
    resolveOrderOperationsJourney(order.state, order.events);
  const current = exception ?? CUSTOMER_VISIBLE_ORDER_STATES[order.state];
  const ExceptionIcon = exception?.id === "cancelled" ? XCircle : RefreshCcw;
  const currentStepRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 720px)").matches) return;
    currentStepRef.current?.scrollIntoView({
      block: "nearest",
      inline: "center",
    });
  }, [order.id, order.state]);

  return (
    <section className={styles.lifecycle} aria-label="Order progress">
      <header>
        <div>
          <p>Order progress</p>
          <strong>{current.label}</strong>
        </div>
        <span>{current.detail}</span>
      </header>
      <ol>
        {steps.map((step, index) => {
          const Icon = JOURNEY_ICONS[step.id];
          const shouldCenter =
            step.status === "current" ||
            step.status === "attention" ||
            Boolean(exception && index === deepestReachedIndex);
          return (
            <li
              ref={shouldCenter ? currentStepRef : undefined}
              key={step.id}
              data-status={step.status}
              aria-current={
                step.status === "current" || step.status === "attention"
                  ? "step"
                  : undefined
              }
            >
              <span className={styles.lifecycleIcon} aria-hidden="true">
                <Icon size={18} />
                {step.status === "complete" ? (
                  <span className={styles.lifecycleBadge}>
                    <Check size={10} strokeWidth={3} />
                  </span>
                ) : null}
                {step.status === "attention" ? (
                  <span className={styles.lifecycleBadge}>
                    <CircleAlert size={11} strokeWidth={2.5} />
                  </span>
                ) : null}
              </span>
              <span>
                <strong>{step.label}</strong>
                <small>
                  {step.status === "complete"
                    ? "Done"
                    : step.status === "reached"
                      ? "Reached"
                      : step.status === "attention"
                        ? "Needs attention"
                        : step.status === "current"
                          ? "Now"
                          : "Later"}
                </small>
              </span>
            </li>
          );
        })}
      </ol>
      {exception ? (
        <div
          className={styles.lifecycleException}
          data-status={exception.status}
        >
          <ExceptionIcon size={17} aria-hidden="true" />
          <span>
            <strong>{exception.label}</strong>
            <small>{exception.detail}</small>
          </span>
        </div>
      ) : null}
    </section>
  );
}

function TeamAlertDelivery({
  alert,
  canManage,
  pending,
  onRetry,
}: {
  alert?: AssistedOrderOperatorAlertSummary;
  canManage: boolean;
  pending: boolean;
  onRetry: () => void;
}) {
  const failed = alert?.failedCount ?? 0;
  const waiting = alert?.pendingCount ?? 0;
  const sent = alert?.sentCount ?? 0;
  const recipients = alert?.recipientCount ?? 0;
  const status =
    failed > 0
      ? "failed"
      : waiting > 0
        ? "pending"
        : sent > 0
          ? "sent"
          : "missing";
  const label =
    status === "sent"
      ? `Team notified · ${sent}/${recipients}`
      : status === "failed"
        ? `Team alert needs attention · ${failed} failed`
        : status === "pending"
          ? `Team alert pending · ${waiting}`
          : "No active order-alert recipients";
  return (
    <section
      className={styles.teamAlert}
      data-status={status}
      aria-label="Operations team alert delivery"
    >
      <span aria-hidden="true">
        <BellRing size={19} />
      </span>
      <div>
        <p>Ops handoff</p>
        <strong>{label}</strong>
        <small>
          {alert?.lastAttemptAt
            ? `Last attempt ${date.format(new Date(alert.lastAttemptAt))}`
            : "Sent independently of customer email preferences."}
        </small>
      </div>
      {(failed > 0 || waiting > 0) && canManage ? (
        <button type="button" disabled={pending} onClick={onRetry}>
          <RefreshCcw size={15} aria-hidden="true" /> Try now
        </button>
      ) : null}
    </section>
  );
}

function NotificationDelivery({
  delivery,
  enabled,
  canManage,
  pending,
  onRetry,
}: {
  delivery?: AssistedOrderNotificationDeliverySummary;
  enabled: boolean;
  canManage: boolean;
  pending: boolean;
  onRetry: () => void;
}) {
  const status = delivery?.emailStatus ?? (enabled ? "pending" : "suppressed");
  const label =
    status === "sent"
      ? "Email delivered"
      : status === "failed"
        ? "Email needs attention"
        : status === "suppressed"
          ? "Email updates are off"
          : "Email delivery pending";
  return (
    <section
      className={styles.notificationDelivery}
      data-status={status}
      aria-label="Customer notification delivery"
    >
      <span aria-hidden="true">
        {status === "sent" ? <MailCheck size={19} /> : <BellRing size={19} />}
      </span>
      <div>
        <p>Customer update</p>
        <strong>{label}</strong>
        <small>
          {delivery?.title ??
            "No customer-visible order event has been created yet."}
          {delivery?.emailLastAttemptAt
            ? ` · Last attempt ${date.format(new Date(delivery.emailLastAttemptAt))}`
            : ""}
        </small>
      </div>
      {(status === "failed" || status === "pending") &&
      delivery &&
      canManage ? (
        <button type="button" disabled={pending} onClick={onRetry}>
          <RefreshCcw size={15} aria-hidden="true" />{" "}
          {status === "failed" ? "Retry" : "Try now"}
        </button>
      ) : null}
    </section>
  );
}

function QueueSection({
  label,
  orders,
  selectedId,
  onSelect,
}: {
  label: string;
  orders: AssistedOrderPrivateView[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (!orders.length) return null;
  return (
    <section>
      <h2>
        {label}
        <span>{orders.length}</span>
      </h2>
      <div>
        {orders.map((order) => (
          <button
            key={order.id}
            type="button"
            data-active={order.id === selectedId ? "true" : "false"}
            onClick={() => onSelect(order.id)}
          >
            <OrderQueueIdentity order={order} />
            <span>
              <b>{order.lines.length} lines</b>
              <small>{date.format(new Date(order.updatedAt))}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function OrderQueueIdentity({ order }: { order: AssistedOrderPrivateView }) {
  const { steps, exception, deepestReachedIndex } =
    resolveOrderOperationsJourney(order.state, order.events);
  const active =
    steps.find(
      (step) => step.status === "current" || step.status === "attention",
    ) ??
    steps[deepestReachedIndex] ??
    steps.at(-1);
  const Icon =
    exception?.id === "cancelled"
      ? XCircle
      : exception
        ? RefreshCcw
        : JOURNEY_ICONS[active?.id ?? "request"];
  return (
    <span className={styles.queueIdentity}>
      <i aria-hidden="true">
        <Icon size={17} />
      </i>
      <span>
        <strong>{order.reference}</strong>
        <small>
          {CUSTOMER_VISIBLE_ORDER_STATES[order.state].label} · {order.retailer}
        </small>
      </span>
    </span>
  );
}

function OrderVerificationPanel({
  order,
  canManage,
  pending,
  onReverify,
}: {
  order: AssistedOrderPrivateView;
  canManage: boolean;
  pending: boolean;
  onReverify: () => void;
}) {
  const verifications = order.lineVerifications;
  if (!verifications.length) {
    return (
      <section className={styles.verification} data-status="pending">
        <span aria-hidden="true">
          <Zap size={18} />
        </span>
        <div>
          <p>Automated verification</p>
          <strong>Running in background…</strong>
          <small>
            Price, stock, and delivery data will appear here when ready.
          </small>
        </div>
        {canManage ? (
          <button type="button" disabled={pending} onClick={onReverify}>
            <RefreshCcw size={15} aria-hidden="true" /> Re-verify now
          </button>
        ) : null}
      </section>
    );
  }

  const verified = verifications.filter((v) => v.verifiedUnitPriceNgn != null);
  const failed = verifications.filter((v) => v.verificationError);
  const hasDelivery = verifications.some((v) => v.verifiedDeliveryNgn != null);
  const status =
    failed.length > verified.length
      ? "failed"
      : hasDelivery
        ? "complete"
        : "partial";

  // Aggregate the breakdown if all lines have subtotal data.
  const aggregatedSubtotal = verifications.reduce(
    (sum, v) => sum + (v.verifiedProductSubtotalNgn ?? 0),
    0,
  );
  const aggregatedDelivery =
    verifications.find((v) => v.verifiedDeliveryNgn != null)
      ?.verifiedDeliveryNgn ?? null;
  const aggregatedTax =
    verifications.find((v) => v.verifiedTaxNgn != null)?.verifiedTaxNgn ?? null;
  const aggregatedRetailerFee =
    verifications.find((v) => v.verifiedRetailerFeeNgn != null)
      ?.verifiedRetailerFeeNgn ?? null;
  const aggregatedTotal =
    verifications.find((v) => v.verifiedTotalNgn != null)?.verifiedTotalNgn ??
    null;
  const bestMethod = verifications[0]?.verificationMethod ?? "unknown";
  const bestConfidence = Math.max(
    ...verifications.map((v) => v.verificationConfidence),
  );

  return (
    <section className={styles.verification} data-status={status}>
      <span aria-hidden="true">
        <ShieldCheck size={18} />
      </span>
      <div>
        <p>Automated verification</p>
        <strong>
          {verified.length}/{verifications.length} lines verified
          {hasDelivery ? " with delivery" : ""}
        </strong>
        <small>
          Method: {bestMethod} · Confidence: {bestConfidence}%
        </small>
        {aggregatedDelivery != null ? (
          <dl className={styles.verificationBreakdown}>
            <div>
              <dt>Products</dt>
              <dd>{naira.format(aggregatedSubtotal)}</dd>
            </div>
            {aggregatedRetailerFee != null ? (
              <div>
                <dt>Retailer fee</dt>
                <dd>{naira.format(aggregatedRetailerFee)}</dd>
              </div>
            ) : null}
            {aggregatedTax != null ? (
              <div>
                <dt>Tax</dt>
                <dd>{naira.format(aggregatedTax)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Delivery</dt>
              <dd>{naira.format(aggregatedDelivery)}</dd>
            </div>
            {aggregatedTotal != null ? (
              <div>
                <dt>Estimated total</dt>
                <dd>{naira.format(aggregatedTotal)}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {failed.length > 0 ? (
          <small className={styles.verificationError}>
            {failed[0]?.verificationError}
          </small>
        ) : null}
      </div>
      {canManage ? (
        <button type="button" disabled={pending} onClick={onReverify}>
          <RefreshCcw size={15} aria-hidden="true" /> Re-verify
        </button>
      ) : null}
    </section>
  );
}

function QuoteForm({
  order,
  disabled,
  onSubmit,
}: {
  order: AssistedOrderPrivateView;
  disabled: boolean;
  onSubmit: (input: unknown) => void;
}) {
  const observed = order.lines.reduce(
    (sum, line) => sum + line.observedUnitPriceNgn * line.quantity,
    0,
  );
  const verifications = order.lineVerifications;
  const verifiedSubtotal =
    verifications.reduce(
      (sum, v) => sum + (v.verifiedProductSubtotalNgn ?? 0),
      0,
    ) || null;
  const verifiedDelivery =
    verifications.find((v) => v.verifiedDeliveryNgn != null)
      ?.verifiedDeliveryNgn ?? null;
  const verifiedTax =
    verifications.find((v) => v.verifiedTaxNgn != null)?.verifiedTaxNgn ?? null;
  const verifiedRetailerFee =
    verifications.find((v) => v.verifiedRetailerFeeNgn != null)
      ?.verifiedRetailerFeeNgn ?? null;
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState({
    productSubtotalNgn:
      verifiedSubtotal != null ? String(verifiedSubtotal) : "",
    retailerFeeNgn:
      verifiedRetailerFee != null ? String(verifiedRetailerFee) : "",
    taxNgn: verifiedTax != null ? String(verifiedTax) : "",
    jelocareFeeNgn: "",
    deliveryNgn: verifiedDelivery != null ? String(verifiedDelivery) : "",
    evidenceReference: verifications[0]?.verificationMethod
      ? `auto-verified:${verifications[0].verificationMethod}@${new Date(verifications[0].verifiedAt).toISOString().slice(0, 16)}`
      : "",
    notes: "",
    expiresAt: "",
  });
  const questions = [
    {
      key: "productSubtotalNgn",
      shortLabel: "Products",
      icon: PackageSearch,
      label: "What is the verified product total?",
      hint:
        verifiedSubtotal != null
          ? `Auto-verified: ${naira.format(verifiedSubtotal)}`
          : `Observed when requested: ${naira.format(observed)}`,
      placeholder: `e.g. ${observed.toLocaleString("en-NG")}`,
    },
    {
      key: "retailerFeeNgn",
      shortLabel: "Retailer fee",
      icon: Store,
      label: "Did the retailer add a service fee?",
      hint:
        verifiedRetailerFee != null
          ? `Auto-verified: ${naira.format(verifiedRetailerFee)}`
          : "Enter 0 only when the retailer confirms there is none.",
      placeholder: "Enter amount or 0",
    },
    {
      key: "taxNgn",
      shortLabel: "Tax",
      icon: ReceiptText,
      label: "Is tax shown separately?",
      hint:
        verifiedTax != null
          ? `Auto-verified: ${naira.format(verifiedTax)}`
          : "Enter the exact listed tax, or 0 when the retailer shows none.",
      placeholder: "Enter tax or 0",
    },
    {
      key: "jelocareFeeNgn",
      shortLabel: "JeloCare fee",
      icon: HandCoins,
      label: "What is JeloCare’s service fee?",
      hint: "This must match the approved service-fee policy.",
      placeholder: "Enter approved fee",
    },
    {
      key: "deliveryNgn",
      shortLabel: "Delivery",
      icon: Truck,
      label: "What is delivery to this address?",
      hint:
        verifiedDelivery != null
          ? `Auto-verified: ${naira.format(verifiedDelivery)} to ${order.deliveryCity}, ${order.deliveryState}`
          : `${order.deliveryCity}, ${order.deliveryState}`,
      placeholder: "Enter delivery fee",
    },
  ] as const;
  const total =
    Number(draft.productSubtotalNgn || 0) +
    Number(draft.retailerFeeNgn || 0) +
    Number(draft.taxNgn || 0) +
    Number(draft.jelocareFeeNgn || 0) +
    Number(draft.deliveryNgn || 0);
  const reviewStep = questions.length + 2;
  const canContinue =
    step < questions.length
      ? draft[questions[step].key] !== "" &&
        Number.isInteger(Number(draft[questions[step].key])) &&
        Number(draft[questions[step].key]) >= 0
      : step === questions.length
        ? draft.evidenceReference.trim().length >= 8
        : step === questions.length + 1
          ? Boolean(draft.expiresAt) &&
            Number.isFinite(new Date(draft.expiresAt).valueOf())
          : true;
  const stepIdentity =
    step < questions.length
      ? { label: questions[step].shortLabel, icon: questions[step].icon }
      : step === questions.length
        ? { label: "Evidence", icon: FileCheck2 }
        : step === questions.length + 1
          ? { label: "Validity", icon: CalendarClock }
          : { label: "Review", icon: ClipboardCheck };
  const StepIcon = stepIdentity.icon;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < reviewStep) {
      if (canContinue) setStep((current) => current + 1);
      return;
    }
    onSubmit({
      orderId: order.id,
      revision: order.revision,
      ...draft,
      productSubtotalNgn: Number(draft.productSubtotalNgn),
      retailerFeeNgn: Number(draft.retailerFeeNgn),
      taxNgn: Number(draft.taxNgn),
      jelocareFeeNgn: Number(draft.jelocareFeeNgn),
      deliveryNgn: Number(draft.deliveryNgn),
      expiresAt: new Date(draft.expiresAt).toISOString(),
    });
  }

  return (
    <form className={styles.quoteForm} onSubmit={submit}>
      <header className={styles.quoteHeader}>
        <div>
          <span className={styles.quoteStepIdentity}>
            <StepIcon size={18} aria-hidden="true" />
            <span>
              <small>
                Step {step + 1} of {reviewStep + 1}
              </small>
              <strong>{stepIdentity.label}</strong>
            </span>
          </span>
          <strong>{naira.format(total)}</strong>
        </div>
        <progress value={step + 1} max={reviewStep + 1}>
          Step {step + 1} of {reviewStep + 1}
        </progress>
      </header>

      {step < questions.length
        ? (() => {
            const question = questions[step];
            return (
              <label className={styles.quoteQuestion}>
                <span className={styles.quotePrompt}>
                  <question.icon size={24} aria-hidden="true" />
                  {question.label}
                </span>
                <small>{question.hint}</small>
                <input
                  autoFocus
                  inputMode="numeric"
                  type="number"
                  min="0"
                  placeholder={question.placeholder}
                  value={draft[question.key]}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [question.key]: event.target.value,
                    }))
                  }
                  required
                />
              </label>
            );
          })()
        : null}

      {step === questions.length ? (
        <label className={styles.quoteQuestion}>
          <span className={styles.quotePrompt}>
            <FileCheck2 size={24} aria-hidden="true" />
            Where did you verify these numbers?
          </span>
          <small>
            Use the retailer quote, checkout reference, or staff evidence—not a
            private credential.
          </small>
          <input
            autoFocus
            value={draft.evidenceReference}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                evidenceReference: event.target.value,
              }))
            }
            minLength={8}
            placeholder="e.g. Checkout #BH-48392"
            required
          />
        </label>
      ) : null}

      {step === questions.length + 1 ? (
        <div className={styles.quoteEvidence}>
          <label>
            <span className={styles.quotePrompt}>
              <CalendarClock size={22} aria-hidden="true" />
              When should this quote expire?
            </span>
            <input
              autoFocus
              type="datetime-local"
              value={draft.expiresAt}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  expiresAt: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            <span>What should the customer know?</span>
            <textarea
              value={draft.notes}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              maxLength={1000}
              placeholder="Optional, concise customer note"
            />
          </label>
        </div>
      ) : null}

      {step === reviewStep ? (
        <div className={styles.quoteReview}>
          <p>
            <ClipboardCheck size={17} aria-hidden="true" /> Review before
            sending
          </p>
          <dl>
            <div>
              <dt>Products</dt>
              <dd>{naira.format(Number(draft.productSubtotalNgn))}</dd>
            </div>
            <div>
              <dt>Retailer fee</dt>
              <dd>{naira.format(Number(draft.retailerFeeNgn))}</dd>
            </div>
            <div>
              <dt>Tax</dt>
              <dd>{naira.format(Number(draft.taxNgn))}</dd>
            </div>
            <div>
              <dt>JeloCare fee</dt>
              <dd>{naira.format(Number(draft.jelocareFeeNgn))}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>{naira.format(Number(draft.deliveryNgn))}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{naira.format(total)}</dd>
            </div>
          </dl>
          <small>Evidence: {draft.evidenceReference}</small>
        </div>
      ) : null}

      <footer className={styles.quoteNav}>
        {step > 0 ? (
          <button
            className={styles.quoteBack}
            type="button"
            onClick={() => setStep((current) => current - 1)}
          >
            <ArrowLeft size={16} aria-hidden="true" /> Back
          </button>
        ) : (
          <span />
        )}
        <button disabled={disabled || !canContinue} type="submit">
          {step === reviewStep ? (
            "Issue exact quote"
          ) : (
            <>
              Continue <ArrowRight size={16} aria-hidden="true" />
            </>
          )}
        </button>
      </footer>
    </form>
  );
}
