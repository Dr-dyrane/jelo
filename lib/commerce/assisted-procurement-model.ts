export const ASSISTED_ORDER_STATES = [
  "requested",
  "quoting",
  "awaiting_approval",
  "needs_response",
  "payment_pending",
  "paid",
  "procurement",
  "retailer_confirmed",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "refund_pending",
  "refunded",
] as const;

export type AssistedOrderState = (typeof ASSISTED_ORDER_STATES)[number];

export const CUSTOMER_VISIBLE_ORDER_STATES: Record<
  AssistedOrderState,
  {
    label: string;
    detail: string;
  }
> = {
  requested: {
    label: "Request received",
    detail: "We're verifying exact products and costs.",
  },
  quoting: {
    label: "Checking your basket",
    detail: "Confirming each item and cost component.",
  },
  awaiting_approval: {
    label: "Quote ready",
    detail: "Review and approve to proceed.",
  },
  needs_response: {
    label: "Needs your attention",
    detail: "The quote changed or expired.",
  },
  payment_pending: {
    label: "Approved",
    detail: "Pay to begin procurement.",
  },
  paid: {
    label: "Payment confirmed",
    detail: "Procurement starting.",
  },
  procurement: {
    label: "Being purchased",
    detail: "Ordering from the retailer.",
  },
  retailer_confirmed: {
    label: "Retailer confirmed",
    detail: "Order accepted.",
  },
  out_for_delivery: {
    label: "Out for delivery",
    detail: "On its way.",
  },
  delivered: { label: "Delivered", detail: "Complete." },
  cancelled: {
    label: "Cancelled",
    detail: "No further action.",
  },
  refund_pending: {
    label: "Refund pending",
    detail: "Being reconciled.",
  },
  refunded: { label: "Refunded", detail: "Refund complete. Order closed." },
};

const TRANSITIONS: Record<AssistedOrderState, readonly AssistedOrderState[]> = {
  requested: ["quoting", "cancelled"],
  quoting: ["awaiting_approval", "needs_response", "cancelled"],
  awaiting_approval: ["payment_pending", "needs_response", "cancelled"],
  needs_response: ["quoting", "cancelled"],
  payment_pending: ["paid", "needs_response", "cancelled"],
  paid: ["procurement", "refund_pending"],
  procurement: ["retailer_confirmed", "needs_response", "refund_pending"],
  retailer_confirmed: ["out_for_delivery", "refund_pending"],
  out_for_delivery: ["delivered", "refund_pending"],
  delivered: ["refund_pending"],
  cancelled: ["refund_pending"],
  refund_pending: ["refunded"],
  refunded: [],
};

export function canTransitionAssistedOrder(
  from: AssistedOrderState,
  to: AssistedOrderState,
) {
  return TRANSITIONS[from].includes(to);
}

export type AssistedOrderQuoteComponents = {
  productSubtotalNgn: number | null;
  retailerFeeNgn: number | null;
  taxNgn: number | null;
  jelocareFeeNgn: number | null;
  deliveryNgn: number | null;
};

export function quoteTotal(
  components: AssistedOrderQuoteComponents,
): number | null {
  const values = Object.values(components);
  if (
    values.some(
      (value) => value == null || !Number.isFinite(value) || value < 0,
    )
  )
    return null;
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

export function quoteIsComplete(input: {
  components: AssistedOrderQuoteComponents;
  evidenceReference: string | null;
  expiresAt: string | Date;
}) {
  const expiresAt = new Date(input.expiresAt);
  return (
    quoteTotal(input.components) != null &&
    Boolean(input.evidenceReference?.trim()) &&
    Number.isFinite(expiresAt.valueOf()) &&
    expiresAt.valueOf() > Date.now()
  );
}

export type AssistedOrderLineView = {
  slug: string;
  brand: string;
  name: string;
  size: string;
  image: string;
  quantity: number;
  observedUnitPriceNgn: number;
  observedListingUrl: string;
};

export type AssistedOrderLineVerification = {
  verifiedUnitPriceNgn: number | null;
  verifiedInventoryStatus: string | null;
  verifiedProductSubtotalNgn: number | null;
  verifiedDeliveryNgn: number | null;
  verifiedTaxNgn: number | null;
  verifiedRetailerFeeNgn: number | null;
  verifiedTotalNgn: number | null;
  verificationMethod: string;
  verificationConfidence: number;
  verificationDeliveryNote: string | null;
  verificationError: string | null;
  verifiedAt: string;
};

export type AssistedOrderQuoteView = {
  id: string;
  version: number;
  status:
    "awaiting_approval" | "approved" | "declined" | "expired" | "superseded";
  components: AssistedOrderQuoteComponents;
  totalNgn: number | null;
  evidenceReference: string;
  notes: string | null;
  issuedAt: string;
  expiresAt: string;
  approvedAt: string | null;
  serviceFeePolicyId: string | null;
  serviceFeePolicyResolvedNgn: number | null;
};

export type AssistedOrderEventView = {
  id: string;
  action: string;
  fromState: AssistedOrderState | null;
  toState: AssistedOrderState;
  reason: string | null;
  createdAt: string;
};

export type AssistedOrderFulfillmentView = {
  retailerOrderReference: string | null;
  carrier: string | null;
  trackingReference: string | null;
  trackingUrl: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
};

export type AssistedOrderReturnView = {
  status: "requested" | "approved" | "declined";
  reason: string;
  requestedAt: string;
  decisionReason: string | null;
  decidedAt: string | null;
};

export type AssistedOrderRefundView = {
  status: "pending" | "refunded";
  amountNgn: number;
  initiatedAt: string;
  completedAt: string | null;
};

export type AssistedOrderView = {
  id: string;
  reference: string;
  retailer: string;
  state: AssistedOrderState;
  revision: number;
  ownerSubject: string | null;
  contactName: string;
  contactEmail: string;
  deliveryCity: string;
  deliveryState: string;
  whatsappConsent: boolean;
  emailNotificationsConsent: boolean;
  lines: AssistedOrderLineView[];
  lineVerifications: AssistedOrderLineVerification[];
  quote: AssistedOrderQuoteView | null;
  fulfillment: AssistedOrderFulfillmentView;
  returnRequest: AssistedOrderReturnView | null;
  refund: AssistedOrderRefundView | null;
  events: AssistedOrderEventView[];
  createdAt: string;
  updatedAt: string;
};

export type AssistedOrderCustomerView = Omit<
  AssistedOrderView,
  "ownerSubject" | "contactName" | "contactEmail"
>;

export function toAssistedOrderCustomerView(
  order: AssistedOrderView,
): AssistedOrderCustomerView {
  return {
    id: order.id,
    reference: order.reference,
    retailer: order.retailer,
    state: order.state,
    revision: order.revision,
    deliveryCity: order.deliveryCity,
    deliveryState: order.deliveryState,
    whatsappConsent: order.whatsappConsent,
    emailNotificationsConsent: order.emailNotificationsConsent,
    lines: order.lines,
    lineVerifications: order.lineVerifications,
    quote: order.quote,
    fulfillment: order.fulfillment,
    returnRequest: order.returnRequest,
    refund: order.refund,
    events: order.events,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

const CUSTOMER_EVENT_LABELS: Record<string, string> = {
  order_requested: "Request received",
  quoting_started: "Verification started",
  quote_issued: "Quote ready",
  quote_approved: "Quote approved",
  quote_declined: "Change requested",
  quote_expired: "Quote expired",
  payment_verified: "Payment confirmed",
  payment_failed: "Payment needs another try",
  payment_abandoned: "Payment was not completed",
  procurement_started: "Purchase started",
  retailer_confirmed: "Retailer confirmed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  return_requested: "Return requested",
  return_declined: "Return request reviewed",
  refund_pending: "Refund pending",
  refunded: "Refunded",
  order_cancelled: "Cancelled",
};

export function customerOrderEventLabel(event: AssistedOrderEventView) {
  return (
    CUSTOMER_EVENT_LABELS[event.action] ??
    CUSTOMER_VISIBLE_ORDER_STATES[event.toState].label
  );
}

export function customerQuotePresentation(state: AssistedOrderState) {
  if (state === "awaiting_approval") {
    return { totalLabel: "Quote total", showExpiry: true } as const;
  }
  if (state === "payment_pending") {
    return { totalLabel: "Total to pay", showExpiry: true } as const;
  }
  if (
    [
      "paid",
      "procurement",
      "retailer_confirmed",
      "out_for_delivery",
      "delivered",
    ].includes(state)
  ) {
    return { totalLabel: "Paid total", showExpiry: false } as const;
  }
  if (state === "refund_pending" || state === "refunded") {
    return { totalLabel: "Original paid total", showExpiry: false } as const;
  }
  return { totalLabel: "Total to pay", showExpiry: true } as const;
}

export function hasOpenReturnRequest(order: AssistedOrderView) {
  return order.returnRequest?.status === "requested";
}
