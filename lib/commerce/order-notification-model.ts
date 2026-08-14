export const ASSISTED_ORDER_NOTIFICATION_ACTIONS = {
  quote_issued: {
    kind: "quote_ready",
    title: "Your quote is ready.",
    message: "Review the complete verified quote before it expires.",
  },
  quote_expired: {
    kind: "action_needed",
    title: "Your quote needs another look.",
    message:
      "The previous quote expired. JeloCare will verify a fresh version before anything proceeds.",
  },
  order_cancelled: {
    kind: "cancelled",
    title: "This request was cancelled.",
    message: "No further procurement will proceed for this order request.",
  },
  payment_verified: {
    kind: "payment_confirmed",
    title: "Payment confirmed.",
    message: "The exact approved total was verified for your order.",
  },
  payment_failed: {
    kind: "payment_issue",
    title: "Payment needs another try.",
    message: "No payment was confirmed. Your order is still awaiting payment.",
  },
  payment_abandoned: {
    kind: "payment_issue",
    title: "Payment was not completed.",
    message: "No payment was confirmed. Your order is still awaiting payment.",
  },
  retailer_confirmed: {
    kind: "retailer_confirmed",
    title: "The retailer confirmed your order.",
    message: "The exact approved order has been accepted by the retailer.",
  },
  out_for_delivery: {
    kind: "out_for_delivery",
    title: "Your order is out for delivery.",
    message:
      "Dispatch evidence has been recorded for the exact approved order.",
  },
  delivered: {
    kind: "delivered",
    title: "Delivery was recorded.",
    message: "JeloCare recorded delivery for this order.",
  },
  refund_pending: {
    kind: "refund_update",
    title: "A refund is being reconciled.",
    message: "The refund remains pending until governed evidence confirms it.",
  },
  refunded: {
    kind: "refund_update",
    title: "Your refund was recorded.",
    message: "Governed refund evidence has been recorded for this order.",
  },
} as const;

export type AssistedOrderNotificationAction =
  keyof typeof ASSISTED_ORDER_NOTIFICATION_ACTIONS;
export type AssistedOrderNotificationKind =
  (typeof ASSISTED_ORDER_NOTIFICATION_ACTIONS)[AssistedOrderNotificationAction]["kind"];
export type AssistedOrderNotificationEmailStatus =
  "pending" | "sending" | "sent" | "failed" | "suppressed";

export type AssistedOrderNotificationView = {
  id: string;
  orderId: string;
  orderReference: string;
  retailer: string;
  kind: AssistedOrderNotificationKind;
  title: string;
  message: string;
  href: "/me/orders";
  readAt: string | null;
  emailStatus: AssistedOrderNotificationEmailStatus;
  createdAt: string;
};

export type AssistedOrderNotificationPreferenceView = {
  orderId: string;
  orderReference: string;
  retailer: string;
  emailEnabled: boolean;
};

export type AssistedOrderNotificationCenter = {
  notifications: AssistedOrderNotificationView[];
  preferences: AssistedOrderNotificationPreferenceView[];
  unreadCount: number;
};

export type AssistedOrderNotificationDeliverySummary = {
  id: string;
  orderId: string;
  title: string;
  emailStatus: AssistedOrderNotificationEmailStatus;
  emailAttempts: number;
  emailLastAttemptAt: string | null;
  emailSentAt: string | null;
};

export function notificationCopyForAction(action: string) {
  return Object.hasOwn(ASSISTED_ORDER_NOTIFICATION_ACTIONS, action)
    ? ASSISTED_ORDER_NOTIFICATION_ACTIONS[
        action as AssistedOrderNotificationAction
      ]
    : null;
}
