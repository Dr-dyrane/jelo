import {
  Check,
  CircleAlert,
  CreditCard,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  CUSTOMER_VISIBLE_ORDER_STATES,
  type AssistedOrderEventView,
  type AssistedOrderState,
} from "@/lib/commerce/assisted-procurement-model";
import styles from "./order-progress.module.css";

const STEPS = [
  { id: "request", label: "Request", icon: ReceiptText },
  { id: "quote", label: "Quote", icon: ShieldCheck },
  { id: "approval", label: "Approve", icon: Check },
  { id: "payment", label: "Payment", icon: CreditCard },
  { id: "delivery", label: "Delivery", icon: Truck },
] as const;

const STATE_STEP: Partial<Record<AssistedOrderState, number>> = {
  requested: 0,
  quoting: 1,
  needs_response: 1,
  awaiting_approval: 2,
  payment_pending: 3,
  paid: 3,
  procurement: 4,
  retailer_confirmed: 4,
  out_for_delivery: 4,
  delivered: 4,
};

const EXCEPTION_STATES = new Set<AssistedOrderState>([
  "cancelled",
  "refund_pending",
  "refunded",
]);

function reachedStep(
  state: AssistedOrderState,
  events: readonly Pick<AssistedOrderEventView, "fromState" | "toState">[],
) {
  return [
    state,
    ...events.flatMap((event) => [event.fromState, event.toState]),
  ].reduce(
    (deepest, candidate) =>
      Math.max(deepest, candidate ? (STATE_STEP[candidate] ?? -1) : -1),
    0,
  );
}

export function OrderProgress({
  state,
  events = [],
  compact = false,
}: {
  state: AssistedOrderState;
  events?: readonly Pick<AssistedOrderEventView, "fromState" | "toState">[];
  compact?: boolean;
}) {
  const presentation = CUSTOMER_VISIBLE_ORDER_STATES[state];
  const exception = EXCEPTION_STATES.has(state);
  const activeIndex = exception
    ? reachedStep(state, events)
    : (STATE_STEP[state] ?? 0);
  const CurrentIcon: LucideIcon =
    state === "cancelled"
      ? X
      : state === "refund_pending"
        ? CircleAlert
        : state === "refunded" || state === "delivered"
          ? PackageCheck
          : (STEPS[activeIndex]?.icon ?? ReceiptText);

  return (
    <section
      className={styles.progress}
      data-compact={compact ? "true" : "false"}
      data-exception={exception ? "true" : "false"}
      aria-label="Order progress"
    >
      <div className={styles.current}>
        <span className={styles.currentIcon} aria-hidden="true">
          <CurrentIcon size={compact ? 18 : 21} />
        </span>
        <span>
          <small>
            {exception
              ? "Order update"
              : `Step ${activeIndex + 1} of ${STEPS.length}`}
          </small>
          <strong>{presentation.label}</strong>
          {!compact && (state === "needs_response" || exception) ? (
            <p>{presentation.detail}</p>
          ) : null}
        </span>
      </div>

      <ol>
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const status =
            index < activeIndex
              ? "complete"
              : index === activeIndex
                ? exception
                  ? "reached"
                  : state === "needs_response"
                    ? "attention"
                    : "current"
                : "later";
          return (
            <li
              key={step.id}
              data-status={status}
              aria-current={
                status === "current" || status === "attention"
                  ? "step"
                  : undefined
              }
            >
              <span aria-hidden="true">
                {status === "complete" ? (
                  <Check size={13} strokeWidth={2.8} />
                ) : (
                  <Icon size={15} />
                )}
              </span>
              <small>{step.label}</small>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
