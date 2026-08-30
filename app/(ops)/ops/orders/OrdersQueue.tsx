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
  X,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
} from "react";
import { useUrlInboxSelection } from "@/components/ops/inbox/use-url-inbox-selection";
import {
  OPS_OVERLAY_INERT_TARGETS,
  useOpsOverlay,
} from "@/components/ops/shell/use-ops-overlay";
import type { AssistedOrderPrivateView } from "@/lib/commerce/assisted-procurement-repository";
import { CUSTOMER_VISIBLE_ORDER_STATES } from "@/lib/commerce/assisted-procurement-model";
import type { AssistedOrderNotificationDeliverySummary } from "@/lib/commerce/order-notification-model";
import type { AssistedOrderOperatorAlertSummary } from "@/lib/commerce/order-operator-alert-repository";
import { formatOrderDateTime } from "@/lib/commerce/order-date";
import {
  boundedPaymentEvidenceText,
  providerSettlementDate,
} from "@/lib/commerce/payment-review";
import type { ResolvedServiceFee } from "@/lib/commerce/service-fee-policy";
import {
  resolveOrderOperationsJourney,
  type OrderOperationsJourneyId,
} from "@/lib/commerce/order-operations-journey";
import {
  advanceOrderLifecycleAction,
  retryOrderNotificationAction,
  retryOrderOperatorAlertAction,
  reverifyOrderAction,
  submitOrderQuoteAction,
  transitionOrderAction,
  verifyManualPaymentAction,
} from "./actions";
import { resolveOrderQueueSelection } from "./order-selection";
import styles from "./orders.module.css";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function subscribeToDetailPane(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

function getDetailPaneSnapshot() {
  return document.getElementById("ops-detail-pane");
}

function getServerDetailPaneSnapshot() {
  return null;
}

function subscribeToDesktopViewport(onStoreChange: () => void) {
  const query = window.matchMedia("(min-width: 1180px)");
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function getDesktopViewportSnapshot() {
  return window.matchMedia("(min-width: 1180px)").matches;
}

function getServerDesktopViewportSnapshot() {
  return true;
}

export function OrdersQueue({
  orders,
  notificationDeliveries,
  operatorAlerts,
  canManage,
  serviceFees,
}: {
  orders: AssistedOrderPrivateView[];
  notificationDeliveries: AssistedOrderNotificationDeliverySummary[];
  operatorAlerts: AssistedOrderOperatorAlertSummary[];
  canManage: boolean;
  serviceFees: Map<string, ResolvedServiceFee | null>;
}) {
  const router = useRouter();
  const {
    selectedId,
    pendingSelectionId,
    onSelect: selectOrderId,
    onDeselect: deselectOrderId,
  } = useUrlInboxSelection();
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [overlayOrderId, setOverlayOrderId] = useState<string | null>(null);
  const [actionModeKey, setActionModeKey] = useState<string | null>(null);
  const [openedActionKey, setOpenedActionKey] = useState<string | null>(null);
  const [recoveryModeKey, setRecoveryModeKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const detailPortalTarget = useSyncExternalStore(
    subscribeToDetailPane,
    getDetailPaneSnapshot,
    getServerDetailPaneSnapshot,
  );
  const isDesktop = useSyncExternalStore(
    subscribeToDesktopViewport,
    getDesktopViewportSnapshot,
    getServerDesktopViewportSnapshot,
  );
  const overlayDialogRef = useRef<HTMLElement | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const inspectorRef = useRef<HTMLElement | null>(null);
  const actionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const recoveryTriggerRef = useRef<HTMLButtonElement | null>(null);
  const actionRecoveryRef = useRef<HTMLButtonElement | null>(null);
  const secondaryDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const actionHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const actionReturnTargetRef = useRef<"primary" | "recovery">("primary");
  const { selected, selectionMissing } = resolveOrderQueueSelection(
    orders,
    selectedId,
  );
  const selectedDelivery = notificationDeliveries.find(
    (delivery) => delivery.orderId === selected?.id,
  );
  const selectedOperatorAlert = operatorAlerts.find(
    (alert) => alert.orderId === selected?.id,
  );
  const selectedActionKey = selected
    ? `${selected.id}:${selected.state}:${selected.revision}`
    : null;
  const selectedAction = selected ? resolveCurrentOrderAction(selected) : null;
  const actionMode =
    selectedActionKey != null && actionModeKey === selectedActionKey;
  const actionWasOpened =
    selectedActionKey != null && openedActionKey === selectedActionKey;
  const recoveryMode =
    selectedActionKey != null && recoveryModeKey === selectedActionKey;
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

  const closeInspector = useCallback(() => {
    setOverlayOrderId(null);
    setActionModeKey(null);
    setOpenedActionKey(null);
    setRecoveryModeKey(null);
  }, []);
  const openOrder = useCallback(
    (order: AssistedOrderPrivateView, trigger: HTMLButtonElement) => {
      lastTriggerRef.current = trigger;
      setActionModeKey(null);
      setOpenedActionKey(null);
      setRecoveryModeKey(null);
      selectOrderId(order);
      if (!isDesktop) setOverlayOrderId(order.id);
    },
    [isDesktop, selectOrderId],
  );
  const openCurrentAction = useCallback(() => {
    if (!selectedActionKey) return;
    actionReturnTargetRef.current = "primary";
    setRecoveryModeKey(null);
    setOpenedActionKey(selectedActionKey);
    setActionModeKey(selectedActionKey);
    requestAnimationFrame(() => {
      const inspector = inspectorRef.current;
      const scrollOwner =
        inspector?.closest<HTMLElement>("[data-ops-order-overlay-scroll]") ??
        inspector;
      scrollOwner?.scrollTo({ top: 0, left: 0 });
      actionHeadingRef.current?.focus();
    });
  }, [selectedActionKey]);
  const openRecoveryAction = useCallback(
    (trigger: HTMLButtonElement) => {
      if (!selectedActionKey) return;
      recoveryTriggerRef.current = trigger;
      actionReturnTargetRef.current = "recovery";
      setRecoveryModeKey(selectedActionKey);
      setOpenedActionKey(selectedActionKey);
      setActionModeKey(selectedActionKey);
      requestAnimationFrame(() => {
        const inspector = inspectorRef.current;
        const scrollOwner =
          inspector?.closest<HTMLElement>("[data-ops-order-overlay-scroll]") ??
          inspector;
        scrollOwner?.scrollTo({ top: 0, left: 0 });
        actionHeadingRef.current?.focus();
      });
    },
    [selectedActionKey],
  );
  const returnToOrder = useCallback(() => {
    const returnTarget = actionReturnTargetRef.current;
    setActionModeKey(null);
    setRecoveryModeKey(null);
    requestAnimationFrame(() => {
      if (returnTarget === "recovery") {
        if (secondaryDetailsRef.current)
          secondaryDetailsRef.current.open = true;
        recoveryTriggerRef.current?.focus();
        return;
      }
      const inspector = inspectorRef.current;
      const scrollOwner =
        inspector?.closest<HTMLElement>("[data-ops-order-overlay-scroll]") ??
        inspector;
      scrollOwner?.scrollTo({ top: 0, left: 0 });
      actionTriggerRef.current?.focus();
    });
  }, []);
  const returnFromRecovery = useCallback(() => {
    setRecoveryModeKey(null);
    requestAnimationFrame(() => {
      actionRecoveryRef.current?.focus();
    });
  }, []);
  const overlayMounted =
    !isDesktop && overlayOrderId === selected?.id && detailPortalTarget != null;

  useOpsOverlay({
    open: overlayMounted,
    onClose: closeInspector,
    dialogRef: overlayDialogRef,
    returnFocusRef: lastTriggerRef,
    inertTargetSelectors: OPS_OVERLAY_INERT_TARGETS,
    initialFocusSelector: "[data-ops-inspector-close]",
    returnFocusFallbackSelector: "[data-ops-main]",
  });

  useEffect(() => {
    if (!selectionMissing) return;

    deselectOrderId();
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>("[data-ops-main]")
        ?.focus({ preventScroll: true });
    });
  }, [deselectOrderId, selectionMissing]);

  useEffect(() => {
    if (!selected || lastTriggerRef.current?.isConnected) return;
    lastTriggerRef.current =
      document.querySelector<HTMLElement>(
        `[data-order-id="${CSS.escape(selected.id)}"]`,
      ) ?? document.querySelector<HTMLElement>("[data-ops-main]");
  }, [orders, selected]);

  useEffect(() => {
    const desktopViewport = window.matchMedia("(min-width: 1180px)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) closeInspector();
    };

    desktopViewport.addEventListener("change", closeAtDesktop);
    return () => desktopViewport.removeEventListener("change", closeAtDesktop);
  }, [closeInspector]);

  if (orders.length === 0)
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

  const inspector = selected ? (
    <aside
      ref={inspectorRef}
      className={styles.inspector}
      data-ops-order-inspector
      data-view={actionMode ? "action" : "summary"}
    >
      {!actionMode ? (
        <>
          <header>
            <div>
              <p>Selected order</p>
              <h2>{selected.reference}</h2>
            </div>
            <span>{CUSTOMER_VISIBLE_ORDER_STATES[selected.state].label}</span>
          </header>

          <OrderEssentials order={selected} />

          {selected.state === "payment_pending" ? (
            <PaymentOverview order={selected} />
          ) : null}

          <OrderOverviewWarnings
            order={selected}
            delivery={selectedDelivery}
            alert={selectedOperatorAlert}
          />

          <OrderStageSummary order={selected} />

          {selectedAction && canManage ? (
            <section className={styles.currentAction}>
              <div>
                <p>Current action</p>
                <strong>{selectedAction.title}</strong>
                <small>{selectedAction.detail}</small>
              </div>
              <button
                ref={actionTriggerRef}
                type="button"
                onClick={openCurrentAction}
              >
                {selectedAction.buttonLabel}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </section>
          ) : null}

          <details
            ref={secondaryDetailsRef}
            className={styles.secondaryDetails}
            data-ops-order-secondary-details
          >
            <summary>
              <span>
                <strong>More order details</strong>
                <small>Customer, full progress, checks, and delivery</small>
              </span>
              <span aria-hidden="true">Show</span>
            </summary>
            <div>
              <section
                className={styles.secondaryGroup}
                aria-labelledby={`order-customer-${selected.id}`}
              >
                <header>
                  <h3 id={`order-customer-${selected.id}`}>
                    Customer and delivery
                  </h3>
                  <strong>{selected.contactName}</strong>
                </header>
                <div className={styles.privateData}>
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
              </section>

              <section
                className={styles.secondaryGroup}
                aria-labelledby={`order-products-${selected.id}`}
              >
                <header>
                  <h3 id={`order-products-${selected.id}`}>Product lines</h3>
                  <strong>
                    {selected.lines.length}{" "}
                    {selected.lines.length === 1 ? "line" : "lines"}
                  </strong>
                </header>
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
                        <b>
                          {naira.format(
                            line.observedUnitPriceNgn * line.quantity,
                          )}
                        </b>
                        {line.observedListingUrl ? (
                          <a
                            href={line.observedListingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open retailer{" "}
                            <ExternalLink size={14} aria-hidden="true" />
                          </a>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <OrderLifecycle order={selected} />

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
                  run(() =>
                    retryOrderOperatorAlertAction({ orderId: selected.id }),
                  )
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
              {selected.state === "awaiting_approval" && canManage ? (
                <button
                  type="button"
                  className={styles.signalRecovery}
                  onClick={(event) => openRecoveryAction(event.currentTarget)}
                >
                  Order cannot continue
                </button>
              ) : null}
            </div>
          </details>
        </>
      ) : null}

      {actionWasOpened && canManage ? (
        <section className={styles.actionView} hidden={!actionMode}>
          <header>
            <button
              type="button"
              className={styles.backToOrder}
              onClick={returnToOrder}
            >
              <ArrowLeft size={16} aria-hidden="true" /> Back to order
            </button>
            <div>
              <p>Order {selected.reference}</p>
              <h2 ref={actionHeadingRef} tabIndex={-1}>
                {selectedAction?.title ?? "Cancel this order request"}
              </h2>
              <span>
                {selectedAction?.detail ??
                  "Record the exact reason this request cannot continue."}
              </span>
            </div>
          </header>

          <OrderActionWarning order={selected} />

          <div hidden={recoveryMode}>
            {selected.state === "requested" ||
            selected.state === "needs_response" ? (
              <div className={styles.decision}>
                <p>
                  <Clock3 size={17} /> Next governed step
                </p>
                <h3>Claim this request and begin verification.</h3>
                <p>
                  Check exact products and every cost component. Do not
                  substitute.
                </p>
                <button
                  disabled={pending}
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
                  Claim &amp; verify
                </button>
              </div>
            ) : null}

            {selected.state === "quoting" ? (
              <QuoteForm
                key={selectedActionKey}
                order={selected}
                disabled={pending}
                serviceFee={serviceFees.get(selected.id) ?? null}
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
                    ? formatOrderDateTime(selected.quote.expiresAt)
                    : "soon"}
                  . A changed cost requires a new quote.
                </p>
              </div>
            ) : null}

            {selected.state === "payment_pending" ? (
              <PaymentVerification
                order={selected}
                canManage={canManage}
                disabled={pending}
                onSubmit={(input) =>
                  run(() => verifyManualPaymentAction(input))
                }
              />
            ) : null}

            {[
              "paid",
              "procurement",
              "retailer_confirmed",
              "out_for_delivery",
              "refund_pending",
            ].includes(selected.state) ||
            (selected.state === "delivered" &&
              selected.returnRequest?.status === "requested") ? (
              <LifecycleDecisionForm
                key={selectedActionKey}
                order={selected}
                disabled={pending}
                onSubmit={(input) =>
                  run(() => advanceOrderLifecycleAction(input))
                }
              />
            ) : null}

            {isPrePaymentCancellationState(selected.state) ? (
              <button
                ref={actionRecoveryRef}
                className={styles.actionRecovery}
                type="button"
                disabled={pending}
                onClick={() =>
                  selectedActionKey && setRecoveryModeKey(selectedActionKey)
                }
              >
                Order cannot continue
              </button>
            ) : null}
          </div>

          {recoveryMode ? (
            <CancellationRecovery
              key={`cancel:${selectedActionKey}`}
              order={selected}
              disabled={pending}
              onBack={returnFromRecovery}
              onSubmit={(reason) =>
                run(() =>
                  transitionOrderAction({
                    orderId: selected.id,
                    revision: selected.revision,
                    transition: "cancelled",
                    reason,
                  }),
                )
              }
            />
          ) : null}
        </section>
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
  ) : (
    <div className={styles.empty} data-ops-order-inspector-empty>
      <PackageSearch size={24} aria-hidden="true" />
      <h2>Select an order</h2>
      <p>Choose a queue row to open its private order details.</p>
    </div>
  );

  return (
    <>
      <div className={styles.workspace} data-ops-reserve-detail>
        <div className={styles.queue} aria-label="Assisted orders">
          <QueueSection
            label="Needs a verified step"
            orders={sections.waiting}
            selectedId={selected?.id ?? ""}
            pendingSelectionId={pendingSelectionId}
            onSelect={openOrder}
          />
          <QueueSection
            label="In progress"
            orders={sections.active}
            selectedId={selected?.id ?? ""}
            pendingSelectionId={pendingSelectionId}
            onSelect={openOrder}
          />
          <QueueSection
            label="Quote approved · payment gated"
            orders={sections.approved}
            selectedId={selected?.id ?? ""}
            pendingSelectionId={pendingSelectionId}
            onSelect={openOrder}
          />
        </div>
      </div>

      {isDesktop && detailPortalTarget
        ? createPortal(inspector, detailPortalTarget)
        : null}
      {overlayMounted && detailPortalTarget && inspector
        ? createPortal(
            <div className={styles.overlayStage}>
              <button
                type="button"
                className={styles.overlayScrim}
                onClick={closeInspector}
                tabIndex={-1}
                aria-hidden="true"
              />
              <section
                ref={overlayDialogRef}
                className={styles.overlaySheet}
                role="dialog"
                aria-modal="true"
                aria-labelledby="order-inspector-title"
                tabIndex={-1}
              >
                <header className={styles.overlayHeader}>
                  <div>
                    <span>Order details</span>
                    <strong id="order-inspector-title">
                      {selected?.reference ?? "Selected order"}
                    </strong>
                  </div>
                  <button
                    type="button"
                    data-ops-inspector-close
                    className={styles.overlayClose}
                    onClick={closeInspector}
                    aria-label="Close order details"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </header>
                <div
                  className={styles.overlayBody}
                  data-ops-order-overlay-scroll
                >
                  {inspector}
                </div>
              </section>
            </div>,
            detailPortalTarget,
          )
        : null}
    </>
  );
}

function resolveCurrentOrderAction(order: AssistedOrderPrivateView) {
  if (order.state === "requested" || order.state === "needs_response")
    return {
      title: "Claim and verify this request",
      detail: "Confirm the exact products and costs before preparing a quote.",
      buttonLabel: "Review and claim",
    };
  if (order.state === "quoting")
    return {
      title: "Prepare the exact quote",
      detail: "Record each verified cost and the evidence behind it.",
      buttonLabel: "Prepare quote",
    };
  if (order.state === "payment_pending")
    return {
      title: "Verify the approved payment",
      detail: "Reconcile bank evidence before the order can progress.",
      buttonLabel: "Verify payment",
    };
  if (order.state === "paid")
    return {
      title: "Begin the exact retailer purchase",
      detail: "Record governed purchase evidence before progressing.",
      buttonLabel: "Start procurement",
    };
  if (order.state === "procurement")
    return {
      title: "Confirm the retailer order",
      detail: "Record the retailer reference and confirmation evidence.",
      buttonLabel: "Confirm retailer",
    };
  if (order.state === "retailer_confirmed")
    return {
      title: "Record the delivery handoff",
      detail: "Enter the carrier and tracking facts exactly as supplied.",
      buttonLabel: "Record dispatch",
    };
  if (order.state === "out_for_delivery")
    return {
      title: "Confirm delivery evidence",
      detail: "Use governed retailer, courier, or customer evidence.",
      buttonLabel: "Record delivery",
    };
  if (order.state === "refund_pending")
    return {
      title: "Confirm the completed refund",
      detail: "Keep the verified payment unchanged and record refund evidence.",
      buttonLabel: "Complete refund",
    };
  if (
    order.state === "delivered" &&
    order.returnRequest?.status === "requested"
  )
    return {
      title: "Review the return request",
      detail: "Read the customer reason before recording a decision.",
      buttonLabel: "Review return",
    };
  return null;
}

function OrderEssentials({ order }: { order: AssistedOrderPrivateView }) {
  const primaryLine = order.lines[0];
  const remainingLines = Math.max(order.lines.length - 1, 0);
  const observedValue = order.lines.reduce(
    (total, line) =>
      total + line.observedUnitPriceNgn * Math.max(line.quantity, 0),
    0,
  );

  return (
    <section className={styles.orderEssentials} aria-label="Order essentials">
      <div>
        <p>{order.lines.length === 1 ? "Product" : "Products"}</p>
        <strong>
          {primaryLine
            ? `${primaryLine.brand} · ${primaryLine.name}`
            : "Product details unavailable"}
        </strong>
        {primaryLine ? (
          <small>
            {primaryLine.size} × {primaryLine.quantity}
            {remainingLines > 0
              ? ` · ${remainingLines} more ${remainingLines === 1 ? "line" : "lines"}`
              : ""}
          </small>
        ) : null}
      </div>
      <dl>
        <div>
          <dt>Retailer</dt>
          <dd>{order.retailer}</dd>
        </div>
        <div>
          <dt>Observed value</dt>
          <dd>{naira.format(observedValue)}</dd>
        </div>
      </dl>
    </section>
  );
}

function OrderStageSummary({ order }: { order: AssistedOrderPrivateView }) {
  const { steps, exception, deepestReachedIndex } =
    resolveOrderOperationsJourney(order.state, order.events);
  const current = exception ?? CUSTOMER_VISIBLE_ORDER_STATES[order.state];

  return (
    <section className={styles.stageSummary} aria-label="Present order stage">
      <div>
        <p>Present stage</p>
        <strong>{current.label}</strong>
        <small>{current.detail}</small>
      </div>
      <span>
        Step {Math.min(deepestReachedIndex + 1, steps.length)} of {steps.length}
      </span>
    </section>
  );
}

function isPrePaymentCancellationState(
  state: AssistedOrderPrivateView["state"],
) {
  return [
    "requested",
    "quoting",
    "awaiting_approval",
    "needs_response",
    "payment_pending",
  ].includes(state);
}

function PaymentOverview({ order }: { order: AssistedOrderPrivateView }) {
  const paymentReview = order.paymentReviews?.at(-1);
  return (
    <section className={styles.paymentOverview}>
      <div>
        <p>Approved total</p>
        <strong>{naira.format(order.quote?.totalNgn ?? 0)}</strong>
      </div>
      {paymentReview ? (
        <div className={styles.paymentOverviewWarning} role="alert">
          <CircleAlert size={17} aria-hidden="true" />
          <span>
            <strong>Provider evidence needs review</strong>
            <small>
              {paymentReview.reason ??
                "Reconcile the payment evidence before proceeding."}
            </small>
          </span>
        </div>
      ) : (
        <small>Waiting for governed payment evidence.</small>
      )}
    </section>
  );
}

function OrderOverviewWarnings({
  order,
  delivery,
  alert,
}: {
  order: AssistedOrderPrivateView;
  delivery?: AssistedOrderNotificationDeliverySummary;
  alert?: AssistedOrderOperatorAlertSummary;
}) {
  const verificationFailure = order.lineVerifications.find(
    (verification) => verification.verificationError,
  );
  const customerDeliveryStatus =
    delivery?.emailStatus ??
    (order.emailNotificationsConsent ? "pending" : "suppressed");
  const warnings = [
    verificationFailure ? "Product verification needs attention" : null,
    (alert?.failedCount ?? 0) > 0
      ? "Team alert delivery failed"
      : (alert?.pendingCount ?? 0) > 0
        ? "Team alert delivery is pending"
        : null,
    customerDeliveryStatus === "failed"
      ? "Customer email delivery failed"
      : customerDeliveryStatus === "pending"
        ? "Customer email delivery is pending"
        : null,
  ].filter((warning): warning is string => warning != null);

  if (!warnings.length) return null;
  return (
    <section className={styles.overviewWarnings} aria-label="Order attention">
      <CircleAlert size={17} aria-hidden="true" />
      <span>
        <strong>Needs attention</strong>
        <small>{warnings.join(" · ")}</small>
      </span>
    </section>
  );
}

function OrderActionWarning({ order }: { order: AssistedOrderPrivateView }) {
  if (order.state !== "quoting") return null;
  const failed = order.lineVerifications.find(
    (verification) => verification.verificationError,
  );
  if (!failed) return null;
  return (
    <p className={styles.actionWarning} role="alert">
      <CircleAlert size={17} aria-hidden="true" />
      <span>
        <strong>Verification needs attention</strong>
        <small>{failed.verificationError}</small>
      </span>
    </p>
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
    const currentStep = currentStepRef.current;
    const lifecycleList = currentStep?.parentElement;
    const lifecycleDetails =
      currentStep?.closest<HTMLDetailsElement>("details");
    const centerCurrentStep = () => {
      if (lifecycleDetails && !lifecycleDetails.open) return;
      if (!currentStep || !lifecycleList) return;
      lifecycleList.scrollTo({
        left:
          currentStep.offsetLeft -
          (lifecycleList.clientWidth - currentStep.clientWidth) / 2,
      });
    };

    centerCurrentStep();
    lifecycleDetails?.addEventListener("toggle", centerCurrentStep);
    return () =>
      lifecycleDetails?.removeEventListener("toggle", centerCurrentStep);
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
            ? `Last attempt ${formatOrderDateTime(alert.lastAttemptAt)}`
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
            ? ` · Last attempt ${formatOrderDateTime(delivery.emailLastAttemptAt)}`
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
  pendingSelectionId,
  onSelect,
}: {
  label: string;
  orders: AssistedOrderPrivateView[];
  selectedId: string;
  pendingSelectionId: string | null;
  onSelect: (
    order: AssistedOrderPrivateView,
    trigger: HTMLButtonElement,
  ) => void;
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
            data-order-id={order.id}
            data-active={order.id === selectedId ? "true" : "false"}
            aria-pressed={order.id === selectedId}
            aria-busy={pendingSelectionId === order.id ? "true" : undefined}
            onClick={(event) => onSelect(order, event.currentTarget)}
          >
            <OrderQueueIdentity order={order} />
            <span>
              <b>
                {order.lines.length}{" "}
                {order.lines.length === 1 ? "line" : "lines"}
              </b>
              <small>{formatOrderDateTime(order.updatedAt)}</small>
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
  serviceFee,
}: {
  order: AssistedOrderPrivateView;
  disabled: boolean;
  onSubmit: (input: unknown) => void;
  serviceFee: ResolvedServiceFee | null;
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
  const [feeOverride, setFeeOverride] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState({
    productSubtotalNgn:
      verifiedSubtotal != null ? String(verifiedSubtotal) : "",
    retailerFeeNgn:
      verifiedRetailerFee != null ? String(verifiedRetailerFee) : "",
    taxNgn: verifiedTax != null ? String(verifiedTax) : "",
    jelocareFeeNgn: serviceFee ? String(serviceFee.feeNgn) : "",
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
      hint: serviceFee
        ? `Policy "${serviceFee.policyName}": ${serviceFee.calculation}`
        : "No active policy matched this order. Enter the approved fee manually.",
      placeholder: serviceFee
        ? `Policy resolved: ${serviceFee.feeNgn.toLocaleString("en-NG")}`
        : "Enter approved fee",
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
        Number.isFinite(Number(draft[questions[step].key])) &&
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
      serviceFeePolicyId: serviceFee?.policyId ?? null,
      serviceFeePolicyResolvedNgn: serviceFee?.feeNgn ?? null,
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
            const isFeeStep = question.key === "jelocareFeeNgn";
            return (
              <label className={styles.quoteQuestion}>
                <span className={styles.quotePrompt}>
                  <question.icon size={24} aria-hidden="true" />
                  {question.label}
                </span>
                <small>{question.hint}</small>
                <input
                  autoFocus
                  inputMode="decimal"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={question.placeholder}
                  value={draft[question.key]}
                  onChange={(event) => {
                    if (isFeeStep && serviceFee) setFeeOverride(true);
                    setDraft((current) => ({
                      ...current,
                      [question.key]: event.target.value,
                    }));
                  }}
                  required
                />
                {isFeeStep && serviceFee ? (
                  <small className={styles.feePolicyNote}>
                    <button
                      type="button"
                      className={styles.feeResetButton}
                      onClick={() => {
                        setFeeOverride(false);
                        setDraft((current) => ({
                          ...current,
                          jelocareFeeNgn: String(serviceFee.feeNgn),
                        }));
                      }}
                    >
                      Reset to policy ({naira.format(serviceFee.feeNgn)})
                    </button>
                    {feeOverride ? " — overridden from policy" : ""}
                  </small>
                ) : null}
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

type LifecycleActionName =
  | "start_procurement"
  | "confirm_retailer"
  | "record_dispatch"
  | "record_delivery"
  | "approve_return"
  | "decline_return"
  | "complete_refund"
  | "cancel_and_refund";

function CancellationRecovery({
  order,
  disabled,
  onBack,
  onSubmit,
}: {
  order: AssistedOrderPrivateView;
  disabled: boolean;
  onBack: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <form
      className={styles.quoteForm}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(reason);
      }}
    >
      <div className={styles.quoteQuestion}>
        <label>
          <span className={styles.quotePrompt}>
            <XCircle size={21} aria-hidden="true" /> Why must this request stop?
          </span>
          <small>
            This records a terminal cancellation for {order.reference}. An
            active Stripe attempt must be reconciled first.
          </small>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Record the specific customer, retailer, evidence, or safety reason"
            minLength={4}
            maxLength={1000}
            required
          />
        </label>
      </div>
      <div className={styles.quoteNav}>
        <button className={styles.quoteBack} type="button" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> Keep order open
        </button>
        <button disabled={disabled || reason.trim().length < 4} type="submit">
          Record cancellation
        </button>
      </div>
    </form>
  );
}

function LifecycleDecisionForm({
  order,
  disabled,
  onSubmit,
}: {
  order: AssistedOrderPrivateView;
  disabled: boolean;
  onSubmit: (input: Record<string, unknown>) => void;
}) {
  const [reason, setReason] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [retailerOrderReference, setRetailerOrderReference] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingReference, setTrackingReference] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [refundReference, setRefundReference] = useState("");
  const [mode, setMode] = useState<"progress" | "cancel">("progress");
  const [returnDecision, setReturnDecision] = useState<
    "approve_return" | "decline_return" | null
  >(null);

  const definition: {
    action: LifecycleActionName;
    icon: LucideIcon;
    eyebrow: string;
    title: string;
    detail: string;
    button: string;
  } =
    mode === "cancel"
      ? {
          action: "cancel_and_refund",
          icon: RefreshCcw,
          eyebrow: "Recovery path",
          title: "Stop procurement and begin a full refund.",
          detail:
            "Record why the paid order cannot continue and the evidence supporting the stop.",
          button: "Cancel and begin refund",
        }
      : order.state === "paid"
        ? {
            action: "start_procurement",
            icon: HandCoins,
            eyebrow: "Purchase",
            title: "Begin the exact retailer purchase.",
            detail:
              "Use the exact retailer links above. Record the governed cart or purchase evidence before progressing.",
            button: "Start procurement",
          }
        : order.state === "procurement"
          ? {
              action: "confirm_retailer",
              icon: Store,
              eyebrow: "Retailer decision",
              title: "Has the retailer accepted the exact order?",
              detail:
                "Record the retailer order reference and the confirmation evidence. Changed products or costs cannot be accepted here.",
              button: "Record retailer confirmation",
            }
          : order.state === "retailer_confirmed"
            ? {
                action: "record_dispatch",
                icon: Truck,
                eyebrow: "Dispatch",
                title: "Record the traceable delivery handoff.",
                detail:
                  "Enter the carrier and tracking facts exactly as the retailer or courier supplied them.",
                button: "Record dispatch",
              }
            : order.state === "out_for_delivery"
              ? {
                  action: "record_delivery",
                  icon: PackageCheck,
                  eyebrow: "Delivery",
                  title: "What evidence confirms delivery?",
                  detail:
                    "Record governed retailer, courier, or customer delivery evidence. A status guess is not sufficient.",
                  button: "Record delivery",
                }
              : order.state === "refund_pending"
                ? {
                    action: "complete_refund",
                    icon: RefreshCcw,
                    eyebrow: "Refund evidence",
                    title: `Confirm the ${naira.format(order.refund?.amountNgn ?? 0)} refund.`,
                    detail:
                      "The original verified payment remains unchanged. Record the completed refund reference and evidence.",
                    button: "Record refund complete",
                  }
                : {
                    action: returnDecision ?? "approve_return",
                    icon: ClipboardCheck,
                    eyebrow: "Return decision",
                    title: "Review the customer return request.",
                    detail:
                      order.returnRequest?.reason ??
                      "Read the recorded customer reason before deciding.",
                    button:
                      returnDecision === "decline_return"
                        ? "Record return decision"
                        : "Approve and begin refund",
                  };
  const Icon = definition.icon;
  const isReturnDecision =
    order.state === "delivered" && order.returnRequest?.status === "requested";
  const canCancel = [
    "paid",
    "procurement",
    "retailer_confirmed",
    "out_for_delivery",
  ].includes(order.state);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isReturnDecision && !returnDecision) return;
    onSubmit({
      orderId: order.id,
      revision: order.revision,
      action: definition.action,
      reason,
      evidenceReference,
      retailerOrderReference: retailerOrderReference || undefined,
      carrier: carrier || undefined,
      trackingReference: trackingReference || undefined,
      trackingUrl: trackingUrl || undefined,
      refundReference: refundReference || undefined,
    });
  }

  return (
    <form className={styles.quoteForm} onSubmit={submit}>
      <div className={styles.quoteHeader}>
        <span className={styles.quoteStepIdentity}>
          <Icon size={18} aria-hidden="true" />
          <span>
            <small>{definition.eyebrow}</small>
            <strong>One current decision</strong>
          </span>
        </span>
      </div>
      <div className={styles.quoteQuestion}>
        <label>
          <span className={styles.quotePrompt}>{definition.title}</span>
          <small>{definition.detail}</small>
        </label>

        {isReturnDecision && !returnDecision ? (
          <div className={styles.lifecycleChoices}>
            <button
              type="button"
              onClick={() => setReturnDecision("approve_return")}
            >
              <Check size={16} aria-hidden="true" /> Approve return
            </button>
            <button
              type="button"
              onClick={() => setReturnDecision("decline_return")}
            >
              <XCircle size={16} aria-hidden="true" /> Decline request
            </button>
          </div>
        ) : (
          <>
            {definition.action === "confirm_retailer" ? (
              <label>
                <span>Retailer order reference</span>
                <input
                  value={retailerOrderReference}
                  onChange={(event) =>
                    setRetailerOrderReference(event.target.value)
                  }
                  placeholder="Example: RET-482193"
                  autoComplete="off"
                />
              </label>
            ) : null}
            {definition.action === "record_dispatch" ? (
              <>
                <label>
                  <span>Carrier or delivery service</span>
                  <input
                    value={carrier}
                    onChange={(event) => setCarrier(event.target.value)}
                    placeholder="Example: GIG Logistics"
                    autoComplete="organization"
                  />
                </label>
                <label>
                  <span>Tracking reference</span>
                  <input
                    value={trackingReference}
                    onChange={(event) =>
                      setTrackingReference(event.target.value)
                    }
                    placeholder="Enter the exact tracking code"
                    autoComplete="off"
                  />
                </label>
                <label>
                  <span>Tracking link · optional</span>
                  <input
                    type="url"
                    value={trackingUrl}
                    onChange={(event) => setTrackingUrl(event.target.value)}
                    placeholder="https://carrier.example/track/..."
                    inputMode="url"
                  />
                </label>
              </>
            ) : null}
            {definition.action === "complete_refund" ? (
              <label>
                <span>Completed refund reference</span>
                <input
                  value={refundReference}
                  onChange={(event) => setRefundReference(event.target.value)}
                  placeholder="Enter the Stripe or bank refund reference"
                  autoComplete="off"
                />
              </label>
            ) : null}
            {["approve_return", "decline_return", "cancel_and_refund"].includes(
              definition.action,
            ) ? (
              <label>
                <span>Decision reason</span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Record the specific policy and order facts behind this decision"
                />
              </label>
            ) : null}
            <label>
              <span>Evidence reference</span>
              <input
                value={evidenceReference}
                onChange={(event) => setEvidenceReference(event.target.value)}
                placeholder="Retailer URL, receipt, courier proof, or governed staff reference"
                autoComplete="off"
              />
            </label>
          </>
        )}
      </div>
      {isReturnDecision && returnDecision ? (
        <button type="button" onClick={() => setReturnDecision(null)}>
          <ArrowLeft size={16} aria-hidden="true" /> Change decision
        </button>
      ) : null}
      {!isReturnDecision || returnDecision ? (
        <button disabled={disabled} type="submit">
          {definition.button} <ArrowRight size={16} aria-hidden="true" />
        </button>
      ) : null}
      {canCancel ? (
        <button
          className={styles.lifecycleRecovery}
          type="button"
          onClick={() => setMode(mode === "cancel" ? "progress" : "cancel")}
        >
          {mode === "cancel"
            ? "Return to current step"
            : "Order cannot continue"}
        </button>
      ) : null}
    </form>
  );
}

function PaymentVerification({
  order,
  canManage,
  disabled,
  onSubmit,
}: {
  order: AssistedOrderPrivateView;
  canManage: boolean;
  disabled: boolean;
  onSubmit: (input: unknown) => void;
}) {
  const [evidence, setEvidence] = useState("");
  const [providerRef, setProviderRef] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const total = order.quote?.totalNgn;
  const paymentReview = order.paymentReviews?.at(-1);
  const reviewMetadata = paymentReview?.metadata ?? {};
  const expectedReference =
    boundedPaymentEvidenceText(reviewMetadata.expectedReference) ??
    boundedPaymentEvidenceText(paymentReview?.evidenceReference);
  const observedReference = boundedPaymentEvidenceText(
    reviewMetadata.observedReference,
  );
  const reviewStatus =
    typeof reviewMetadata.verificationStatus === "string"
      ? reviewMetadata.verificationStatus
      : typeof reviewMetadata.paymentStatus === "string"
        ? reviewMetadata.paymentStatus
        : null;
  const rawReviewPaidAt = boundedPaymentEvidenceText(
    reviewMetadata.observedPaidAt,
    100,
  );
  const reviewPaidAt = providerSettlementDate(rawReviewPaidAt);
  const observedCurrency = boundedPaymentEvidenceText(
    reviewMetadata.observedCurrency,
    10,
  );
  const expectedKobo =
    typeof reviewMetadata.expectedAmountKobo === "number"
      ? reviewMetadata.expectedAmountKobo
      : null;
  const observedKobo =
    typeof reviewMetadata.observedAmountKobo === "number"
      ? reviewMetadata.observedAmountKobo
      : null;
  const receivedAmountValid =
    /^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(receivedAmount) &&
    Number(receivedAmount) > 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      orderId: order.id,
      receivedAmountNgn: receivedAmount,
      evidenceReference: evidence,
      providerReference: providerRef,
    });
  }

  return (
    <div className={styles.paymentGate}>
      <CheckCircle2 size={18} />
      <p>
        <strong>Quote approved.</strong> Total: {naira.format(total ?? 0)}. The
        customer can pay online via the Stripe checkout on their order page, or
        by direct bank transfer.
      </p>
      {canManage ? (
        <form className={styles.manualPaymentForm} onSubmit={submit}>
          {paymentReview ? (
            <div className={styles.paymentReview} role="alert">
              <CircleAlert size={17} aria-hidden="true" />
              <span>
                <strong>Provider evidence needs review</strong>
                <small>
                  {paymentReview.reason ??
                    "Reconcile this payment in Stripe before proceeding."}
                </small>
                {expectedReference ? (
                  <small>Expected reference · {expectedReference}</small>
                ) : null}
                {observedReference &&
                observedReference !== expectedReference ? (
                  <small>Observed reference · {observedReference}</small>
                ) : null}
                {observedCurrency ? (
                  <small>
                    Currency · expected NGN · observed {observedCurrency}
                  </small>
                ) : null}
                {reviewStatus ? <small>Status · {reviewStatus}</small> : null}
                {expectedKobo != null || observedKobo != null ? (
                  <small>
                    Expected · {naira.format((expectedKobo ?? 0) / 100)} ·
                    Observed · {naira.format((observedKobo ?? 0) / 100)}
                  </small>
                ) : null}
                {reviewPaidAt ? (
                  <small>
                    Provider paid at · {formatOrderDateTime(reviewPaidAt)}
                  </small>
                ) : rawReviewPaidAt ? (
                  <small>Invalid provider settlement timestamp</small>
                ) : null}
              </span>
            </div>
          ) : null}
          <p>
            <strong>Manual bank transfer verification</strong>
          </p>
          <small>
            Read the received amount from the bank record. JeloCare compares it
            with the approved {naira.format(total ?? 0)} total before
            proceeding.
          </small>
          <label>
            <span>Amount received (NGN)</span>
            <input
              inputMode="decimal"
              value={receivedAmount}
              onChange={(event) => setReceivedAmount(event.target.value)}
              placeholder="e.g. 27500.00"
              required
            />
          </label>
          <label>
            <span>Evidence reference</span>
            <input
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="e.g. GTBank transfer 20260814-ABC123"
              required
              minLength={8}
              maxLength={1000}
            />
          </label>
          <label>
            <span>Bank transaction reference</span>
            <input
              value={providerRef}
              required
              minLength={6}
              onChange={(e) => setProviderRef(e.target.value)}
              placeholder="e.g. TST-20260814-001"
              maxLength={200}
            />
          </label>
          <button
            type="submit"
            disabled={
              disabled || !receivedAmountValid || evidence.trim().length < 8
            }
          >
            Mark payment verified
          </button>
        </form>
      ) : null}
    </div>
  );
}
