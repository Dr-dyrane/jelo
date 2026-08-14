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
    detail:
      "JeloCare will verify the exact products, retailer terms, and delivery cost.",
  },
  quoting: {
    label: "Checking your basket",
    detail:
      "A staff member is confirming each exact item and every cost component.",
  },
  awaiting_approval: {
    label: "Quote ready",
    detail:
      "Review the complete quote. Nothing proceeds until you approve this exact version.",
  },
  needs_response: {
    label: "Your response is needed",
    detail:
      "The quote changed, expired, or needs a decision before work can continue.",
  },
  payment_pending: {
    label: "Quote approved",
    detail:
      "Your approval is recorded. Pay securely via card, bank transfer, or USSD to begin procurement.",
  },
  paid: {
    label: "Payment confirmed",
    detail: "Governed payment evidence has been recorded.",
  },
  procurement: {
    label: "Being purchased",
    detail: "The retailer order is being placed for the exact approved items.",
  },
  retailer_confirmed: {
    label: "Retailer confirmed",
    detail: "The retailer has accepted the exact order.",
  },
  out_for_delivery: {
    label: "Out for delivery",
    detail: "Dispatch evidence has been recorded.",
  },
  delivered: { label: "Delivered", detail: "Delivery has been recorded." },
  cancelled: {
    label: "Cancelled",
    detail: "No further procurement will proceed.",
  },
  refund_pending: {
    label: "Refund pending",
    detail: "A governed refund is being reconciled.",
  },
  refunded: { label: "Refunded", detail: "Refund evidence has been recorded." },
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
  delivered: [],
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
    events: order.events,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
