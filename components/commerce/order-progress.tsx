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

function progressTone(state: AssistedOrderState) {
  if (state === "cancelled") return "danger";
  if (state === "needs_response" || state === "refund_pending") {
    return "warning";
  }
  if (state === "delivered" || state === "refunded") return "success";
  return "action";
}

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

export function orderProgressActiveIndex(
  state: AssistedOrderState,
  events: readonly Pick<AssistedOrderEventView, "fromState" | "toState">[] = [],
) {
  return EXCEPTION_STATES.has(state) || state === "needs_response"
    ? reachedStep(state, events)
    : (STATE_STEP[state] ?? 0);
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
  const tone = progressTone(state);
  const activeIndex = orderProgressActiveIndex(state, events);
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
      data-tone={tone}
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
              : `Current · Step ${activeIndex + 1} of ${STEPS.length}`}
          </small>
          <strong>{presentation.label}</strong>
          {!compact ? (
            <p className={styles.next}>
              <span>
                {state === "cancelled" ||
                state === "delivered" ||
                state === "refunded"
                  ? "Outcome"
                  : state === "needs_response"
                    ? "Now"
                    : "Next"}
              </span>
              {presentation.detail}
            </p>
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
              aria-label={`${step.label}: ${
                status === "complete"
                  ? "complete"
                  : status === "current" || status === "attention"
                    ? "current"
                    : status === "reached"
                      ? "reached"
                      : "later"
              }`}
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
