import "server-only";

import {
  createAndVerifyManualPayment,
  expireApprovedQuoteAfterPaymentClosed,
  listStalePendingStripePayments,
  readPaymentByReference,
  recordPaymentReviewRequired,
  recordStripePaymentInitialization,
  reserveStripePaymentAttempt,
  updatePaymentStatus,
  verifyPaymentAndMarkOrderPaid,
  PaymentSettlementOutsideQuoteWindowError,
  PaymentQuoteExpiredWithActiveAttemptError,
  type AssistedOrderPayment,
} from "./payment-repository";
import {
  createStripeReference,
  createStripeCheckoutSession,
  isStripeConfigured,
  StripeProviderError,
  retrieveStripeCheckoutSession,
  type StripeSessionVerifyResult,
} from "./stripe-provider";
import { ngnToKobo, normalizeNgnAmount } from "./payment-money";
import { readAssistedOrderById } from "./assisted-procurement-repository";
import { deliverPendingAssistedOrderNotifications } from "./order-notification-repository";

const INCOMPLETE_RESERVATION_GRACE_MS = 2 * 60 * 1000;
const READY_ATTEMPT_RECHECK_MS = 60 * 1000;
const STALE_RECONCILIATION_AGE_MS = 24 * 60 * 60 * 1000;
const STALE_RECONCILIATION_BATCH_SIZE = 5;

export type PaymentInitResult = {
  payment: AssistedOrderPayment;
  authorizationUrl: string;
  alreadyPaid: boolean;
};

export class PaymentInitializationPendingError extends Error {
  constructor() {
    super("Payment setup is still being reconciled. Please try again shortly.");
    this.name = "PaymentInitializationPendingError";
  }
}

export function successfulEvidenceProblem(
  expectedReference: string,
  verification: StripeSessionVerifyResult,
) {
  if (verification.reference !== expectedReference) {
    return {
      code: "reference-mismatch",
      reason: "Stripe returned a different session reference.",
    };
  }
  if (verification.currency !== "ngn") {
    return {
      code: "currency-mismatch",
      reason: "Stripe returned a non-NGN session.",
    };
  }
  if (
    verification.status !== "complete" ||
    verification.paymentStatus !== "paid"
  ) {
    return {
      code: "session-not-paid",
      reason: "Stripe did not return a completed paid Checkout Session.",
    };
  }
  if (
    !verification.paymentIntentId ||
    !verification.paymentIntentId.startsWith("pi_") ||
    verification.paymentIntentStatus !== "succeeded"
  ) {
    return {
      code: "payment-intent-not-succeeded",
      reason: "Stripe returned no succeeded PaymentIntent evidence.",
    };
  }
  if (
    !verification.chargeId ||
    !verification.chargeId.startsWith("ch_") ||
    verification.chargeStatus !== "succeeded" ||
    verification.chargePaid !== true ||
    verification.chargeCaptured !== true
  ) {
    return {
      code: "charge-not-captured",
      reason: "Stripe returned no succeeded, paid, captured Charge evidence.",
    };
  }
  if (
    !verification.chargeCreatedAt ||
    !Number.isFinite(Date.parse(verification.chargeCreatedAt))
  ) {
    return {
      code: "missing-charge-time",
      reason: "Stripe returned no valid Charge creation time.",
    };
  }
  if (
    verification.chargeCurrency !== verification.currency ||
    verification.chargeAmountKobo !== verification.amountTotalKobo ||
    verification.chargeAmountCapturedKobo !== verification.amountTotalKobo
  ) {
    return {
      code: "charge-money-mismatch",
      reason: "Stripe Charge money does not match the Checkout Session.",
    };
  }
  if (
    !verification.paidAt ||
    !Number.isFinite(Date.parse(verification.paidAt))
  ) {
    return {
      code: "missing-settlement-time",
      reason: "Stripe returned no valid settlement time.",
    };
  }
  if (
    Date.parse(verification.paidAt) < Date.parse(verification.chargeCreatedAt)
  ) {
    return {
      code: "success-event-before-charge",
      reason: "Stripe success Event predates its Charge evidence.",
    };
  }
  return null;
}

export type StripeReconciliationSignal =
  "observe" | "success" | "failure" | "cron";

export type StripeEvidenceDecision =
  | { action: "verify" }
  | { action: "close"; status: "failed" | "abandoned"; reason: string }
  | { action: "pending"; reason: string }
  | { action: "review"; code: string; reason: string };

/** One canonical decision table shared by signed webhooks and stale polling. */
export function stripeEvidenceDecision(input: {
  expectedReference: string;
  expectedAmountKobo: number;
  verification: StripeSessionVerifyResult;
  signal: StripeReconciliationSignal;
}): StripeEvidenceDecision {
  if (input.verification.reference !== input.expectedReference) {
    return {
      action: "review",
      code: "reference-mismatch",
      reason: "Stripe returned a different session reference.",
    };
  }

  if (input.verification.paymentStatus === "paid") {
    const problem = successfulEvidenceProblem(
      input.expectedReference,
      input.verification,
    );
    if (problem) return { action: "review", ...problem };
    if (input.expectedAmountKobo !== input.verification.amountTotalKobo) {
      return {
        action: "review",
        code: "amount-mismatch",
        reason: "Stripe reported a successful payment for a different amount.",
      };
    }
    return { action: "verify" };
  }

  if (input.verification.paymentStatus === "no_payment_required") {
    return {
      action: "review",
      code: "no-payment-required",
      reason:
        "Stripe reported that the priced Checkout Session needs no payment.",
    };
  }

  if (input.verification.status === "expired") {
    return {
      action: "close",
      status: "abandoned",
      reason: "Stripe reports that the Checkout Session expired.",
    };
  }

  const providerFailure =
    input.verification.paymentIntentStatus === "canceled" ||
    (input.verification.status === "complete" &&
      input.verification.paymentIntentStatus === "requires_payment_method");
  const delayedFailureConfirmed =
    input.signal === "failure" &&
    input.verification.status === "complete" &&
    input.verification.paymentStatus === "unpaid" &&
    input.verification.paymentIntentStatus !== "processing" &&
    input.verification.paymentIntentStatus !== "succeeded";
  if (providerFailure || delayedFailureConfirmed) {
    return {
      action: "close",
      status: "failed",
      reason: "Stripe reports that the payment failed.",
    };
  }

  return {
    action: "pending",
    reason:
      input.verification.paymentIntentStatus === "processing"
        ? "Stripe payment is still processing."
        : `Stripe Checkout Session is ${input.verification.status}.`,
  };
}

export function stripeWebhookSignal(
  eventType: string,
): Exclude<StripeReconciliationSignal, "cron"> | null {
  if (eventType === "checkout.session.completed") return "observe";
  if (eventType === "checkout.session.async_payment_succeeded") {
    return "success";
  }
  if (eventType === "checkout.session.async_payment_failed") return "failure";
  return null;
}

function nonRetryableStripeRetrievalProblem(error: unknown) {
  if (!(error instanceof StripeProviderError)) return null;
  if (error.httpStatus === 404) {
    return {
      code: "stored-session-not-found",
      reason: "Stripe could not find the stored Checkout Session.",
    };
  }
  if (error.httpStatus === null) {
    return {
      code: "malformed-provider-evidence",
      reason: "Stripe returned malformed Checkout Session evidence.",
    };
  }
  return null;
}

function providerEvidence(verification: StripeSessionVerifyResult) {
  return {
    verificationStatus: verification.status,
    paymentStatus: verification.paymentStatus,
    observedReference: verification.reference,
    observedAmountKobo: verification.amountTotalKobo,
    observedCurrency: verification.currency,
    observedPaidAt: verification.paidAt,
    sessionId: verification.sessionId,
    paymentIntentId: verification.paymentIntentId,
    paymentIntentStatus: verification.paymentIntentStatus,
    chargeId: verification.chargeId,
    chargeStatus: verification.chargeStatus,
    chargePaid: verification.chargePaid,
    chargeCaptured: verification.chargeCaptured,
    chargeAmountKobo: verification.chargeAmountKobo,
    chargeAmountCapturedKobo: verification.chargeAmountCapturedKobo,
    chargeCurrency: verification.chargeCurrency,
    chargeCreatedAt: verification.chargeCreatedAt,
  };
}

async function recordProviderReview(input: {
  payment: AssistedOrderPayment;
  code: string;
  reason: string;
  metadata: Record<string, unknown>;
}) {
  const reference = input.payment.providerReference ?? input.payment.id;
  const recorded = await recordPaymentReviewRequired({
    paymentId: input.payment.id,
    evidenceReference: `stripe-review:${reference}:${input.code}`,
    reason: input.reason,
    metadata: {
      paymentStatus: input.payment.status,
      expectedReference: input.payment.providerReference,
      expectedAmountKobo: ngnToKobo(input.payment.amountNgn),
      ...input.metadata,
    },
  });
  if (!recorded) {
    throw new Error("Payment review evidence could not be recorded.");
  }
}

async function deliverPaymentUpdate(orderId: string) {
  try {
    await deliverPendingAssistedOrderNotifications({ orderId, limit: 5 });
  } catch {
    // Payment state and its append-only event remain canonical. The existing
    // Ops notification retry surface can retry optional email delivery.
  }
}

async function reconcileSuccessfulStripePayment(input: {
  payment: AssistedOrderPayment;
  verification: StripeSessionVerifyResult;
  successEventId?: string;
}) {
  const reference = input.payment.providerReference;
  if (!reference) return null;
  const problem = successfulEvidenceProblem(reference, input.verification);
  if (problem) return null;
  if (
    ngnToKobo(input.payment.amountNgn) !== input.verification.amountTotalKobo
  ) {
    return null;
  }

  const verified = await verifyPaymentAndMarkOrderPaid({
    paymentId: input.payment.id,
    evidenceReference: `stripe:${reference}:${input.successEventId ?? "reviewed-event"}:${input.verification.paidAt}`,
    evidenceMetadata: {
      reference,
      successEventId: input.successEventId ?? null,
      ...providerEvidence(input.verification),
    },
    verifiedBySubject: null,
    receivedAmountKobo: input.verification.amountTotalKobo,
    paidAt: input.verification.paidAt!,
  });
  if (verified) await deliverPaymentUpdate(verified.orderId);
  return verified;
}

async function initializeReservedAttempt(input: {
  payment: AssistedOrderPayment;
  amountNgn: number;
  orderReference: string;
  customerEmail: string;
  customerName: string | null;
  callbackUrl: string;
}): Promise<PaymentInitResult> {
  const reference = input.payment.providerReference;
  if (!reference)
    throw new Error("The payment attempt has no provider reference.");

  const successUrl = `${input.callbackUrl}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = input.callbackUrl.replace(
    "payment=return",
    "payment=cancelled",
  );

  const initialized = await createStripeCheckoutSession({
    amountNgn: input.amountNgn,
    reference,
    orderReference: input.orderReference,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    successUrl,
    cancelUrl,
  });
  const persisted = await recordStripePaymentInitialization({
    paymentId: input.payment.id,
    providerReference: reference,
    checkoutUrl: initialized.url,
    providerSessionId: initialized.sessionId,
    initializedAt: new Date().toISOString(),
  });
  if (!persisted) {
    // The reserved reference remains queryable by webhook/reconciliation. Do
    // not return an unpersisted URL and do not create another live attempt.
    throw new PaymentInitializationPendingError();
  }
  return {
    payment: persisted,
    authorizationUrl: initialized.url,
    alreadyPaid: false,
  };
}

async function reconcileExpiredActiveAttempt(input: {
  error: PaymentQuoteExpiredWithActiveAttemptError;
  callbackUrl: string;
}): Promise<PaymentInitResult> {
  const payment = input.error.payment;
  const reference = payment.providerReference;
  if (!reference) throw new PaymentInitializationPendingError();

  const sessionId = payment.providerInitialization?.providerSessionId;
  if (!sessionId) throw new PaymentInitializationPendingError();

  let verification: StripeSessionVerifyResult;
  try {
    verification = await retrieveStripeCheckoutSession(sessionId);
  } catch (error) {
    if (!(error instanceof StripeProviderError) || error.httpStatus !== 404) {
      throw error;
    }
    const retired = await updatePaymentStatus({
      paymentId: payment.id,
      status: "abandoned",
      evidenceReference: `stripe:${reference}:not-found-after-expiry`,
      reason: "Stripe had no session for the expired quote attempt.",
    });
    if (!retired) throw new PaymentInitializationPendingError();
    const expired = await expireApprovedQuoteAfterPaymentClosed({
      orderId: payment.orderId,
      quoteVersion: payment.quoteVersion,
      paymentId: payment.id,
    });
    if (!expired) throw new PaymentInitializationPendingError();
    await deliverPaymentUpdate(payment.orderId);
    throw new Error("The approved quote expired. Request a fresh quote.");
  }

  const decision = stripeEvidenceDecision({
    expectedReference: reference,
    expectedAmountKobo: ngnToKobo(payment.amountNgn),
    verification,
    signal: "cron",
  });
  if (decision.action === "review") {
    await recordProviderReview({
      payment,
      code: decision.code,
      reason: decision.reason,
      metadata: providerEvidence(verification),
    });
    throw new PaymentInitializationPendingError();
  }

  if (decision.action === "verify") {
    try {
      const verified = await reconcileSuccessfulStripePayment({
        payment,
        verification,
      });
      if (verified) {
        return {
          payment: verified,
          authorizationUrl: input.callbackUrl,
          alreadyPaid: true,
        };
      }
    } catch (error) {
      if (!(error instanceof PaymentSettlementOutsideQuoteWindowError))
        throw error;
      await recordProviderReview({
        payment,
        code: "settlement-outside-quote-window",
        reason: error.message,
        metadata: {
          ...providerEvidence(verification),
          quoteIssuedAt: error.issuedAt,
          quoteExpiresAt: error.expiresAt,
        },
      });
    }
    throw new PaymentInitializationPendingError();
  }

  if (decision.action === "close") {
    const retired = await updatePaymentStatus({
      paymentId: payment.id,
      status: decision.status,
      evidenceReference: `stripe:${reference}:${decision.status}:after-expiry`,
      reason: decision.reason,
    });
    if (!retired) throw new PaymentInitializationPendingError();
    const expired = await expireApprovedQuoteAfterPaymentClosed({
      orderId: payment.orderId,
      quoteVersion: payment.quoteVersion,
      paymentId: payment.id,
    });
    if (!expired) throw new PaymentInitializationPendingError();
    await deliverPaymentUpdate(payment.orderId);
    throw new Error("The approved quote expired. Request a fresh quote.");
  }

  await recordProviderReview({
    payment,
    code: "quote-expired-active",
    reason: input.error.message,
    metadata: {
      ...providerEvidence(verification),
      quoteExpiresAt: input.error.expiresAt,
    },
  });
  throw new PaymentInitializationPendingError();
}

async function reserveAndInitialize(input: {
  orderId: string;
  quoteVersion: number;
  amountNgn: number;
  orderReference: string;
  customerEmail: string;
  customerName: string | null;
  callbackUrl: string;
}): Promise<PaymentInitResult> {
  const reservedAt = new Date().toISOString();
  let reservation: Awaited<ReturnType<typeof reserveStripePaymentAttempt>>;
  try {
    reservation = await reserveStripePaymentAttempt({
      orderId: input.orderId,
      quoteVersion: input.quoteVersion,
      amountNgn: input.amountNgn,
      providerReference: createStripeReference(
        input.orderReference,
        input.quoteVersion,
      ),
      reservedAt,
    });
  } catch (error) {
    if (!(error instanceof PaymentQuoteExpiredWithActiveAttemptError))
      throw error;
    return reconcileExpiredActiveAttempt({
      error,
      callbackUrl: input.callbackUrl,
    });
  }

  if (reservation.created) {
    return initializeReservedAttempt({
      payment: reservation.payment,
      ...input,
    });
  }

  const initialization = reservation.payment.providerInitialization;
  if (
    initialization?.phase === "ready" &&
    initialization.checkoutUrl &&
    initialization.initializedAt &&
    Date.now() - Date.parse(initialization.initializedAt) <
      READY_ATTEMPT_RECHECK_MS
  ) {
    return {
      payment: reservation.payment,
      authorizationUrl: initialization.checkoutUrl,
      alreadyPaid: false,
    };
  }

  const reservedTime = initialization?.reservedAt
    ? Date.parse(initialization.reservedAt)
    : Number.NaN;
  if (
    initialization?.phase !== "ready" &&
    (!Number.isFinite(reservedTime) ||
      Date.now() - reservedTime < INCOMPLETE_RESERVATION_GRACE_MS)
  ) {
    throw new PaymentInitializationPendingError();
  }

  const reference = reservation.payment.providerReference;
  if (!reference) throw new PaymentInitializationPendingError();

  const sessionId = initialization?.providerSessionId;
  if (!sessionId) throw new PaymentInitializationPendingError();

  let verification: StripeSessionVerifyResult;
  try {
    verification = await retrieveStripeCheckoutSession(sessionId);
  } catch (error) {
    if (error instanceof StripeProviderError && error.httpStatus === 404) {
      const abandoned = await updatePaymentStatus({
        paymentId: reservation.payment.id,
        status: "abandoned",
        evidenceReference: `stripe:${reference}:not-found`,
        reason: "Stripe had no session for the stale reserved reference.",
      });
      if (!abandoned) throw new PaymentInitializationPendingError();
      return reserveAndInitialize(input);
    }
    throw error;
  }

  const decision = stripeEvidenceDecision({
    expectedReference: reference,
    expectedAmountKobo: ngnToKobo(reservation.payment.amountNgn),
    verification,
    signal: "cron",
  });
  if (decision.action === "review") {
    await recordProviderReview({
      payment: reservation.payment,
      code: decision.code,
      reason: decision.reason,
      metadata: providerEvidence(verification),
    });
    throw new PaymentInitializationPendingError();
  }

  if (decision.action === "verify") {
    let verified: AssistedOrderPayment | null;
    try {
      verified = await reconcileSuccessfulStripePayment({
        payment: reservation.payment,
        verification,
      });
    } catch (error) {
      if (!(error instanceof PaymentSettlementOutsideQuoteWindowError))
        throw error;
      await recordProviderReview({
        payment: reservation.payment,
        code: "settlement-outside-quote-window",
        reason: error.message,
        metadata: {
          ...providerEvidence(verification),
          quoteIssuedAt: error.issuedAt,
          quoteExpiresAt: error.expiresAt,
        },
      });
      throw new PaymentInitializationPendingError();
    }
    if (!verified) throw new PaymentInitializationPendingError();
    return {
      payment: verified,
      authorizationUrl: input.callbackUrl,
      alreadyPaid: true,
    };
  }

  if (decision.action === "close") {
    const retired = await updatePaymentStatus({
      paymentId: reservation.payment.id,
      status: decision.status,
      evidenceReference: `stripe:${reference}:${decision.status}`,
      reason: decision.reason,
    });
    if (!retired) throw new PaymentInitializationPendingError();
    await deliverPaymentUpdate(reservation.payment.orderId);
    return reserveAndInitialize(input);
  }

  if (initialization?.phase === "ready" && initialization.checkoutUrl) {
    return {
      payment: reservation.payment,
      authorizationUrl: initialization.checkoutUrl,
      alreadyPaid: false,
    };
  }

  await recordProviderReview({
    payment: reservation.payment,
    code: "initialization-incomplete",
    reason:
      "The reserved Stripe session is live but no reusable checkout URL was persisted.",
    metadata: {
      ...providerEvidence(verification),
    },
  });

  throw new PaymentInitializationPendingError();
}

/**
 * Initialize exactly one DB-reserved Stripe attempt for the approved quote.
 * Repeat requests reuse the persisted checkout URL for that same attempt.
 */
export async function initiateStripePayment(input: {
  orderId: string;
  callbackUrl: string;
}): Promise<PaymentInitResult> {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured.");
  }

  const order = await readAssistedOrderById(input.orderId);
  if (!order) throw new Error("Order not found.");
  if (order.state !== "payment_pending") {
    throw new Error("Order is not awaiting payment.");
  }
  if (!order.quote || order.quote.status !== "approved") {
    throw new Error("No approved quote to pay for.");
  }
  const amountNgn = normalizeNgnAmount(order.quote.totalNgn);

  return reserveAndInitialize({
    orderId: order.id,
    quoteVersion: order.quote.version,
    amountNgn,
    orderReference: order.reference,
    customerEmail: order.contactEmail,
    customerName: order.contactName,
    callbackUrl: input.callbackUrl,
  });
}

export type StripeWebhookHandling = {
  handled: boolean;
  retryable: boolean;
  reason: string;
};

export type StaleStripeReconciliationSummary = {
  scanned: number;
  verified: number;
  failed: number;
  abandoned: number;
  pending: number;
  reviewRequired: number;
  retryableErrors: number;
};

type StaleStripeReconciliationDependencies = {
  listStale: typeof listStalePendingStripePayments;
  retrieve: typeof retrieveStripeCheckoutSession;
  verify: typeof verifyPaymentAndMarkOrderPaid;
  updateStatus: typeof updatePaymentStatus;
  recordReview: typeof recordPaymentReviewRequired;
  expireQuote: typeof expireApprovedQuoteAfterPaymentClosed;
  deliverUpdate: typeof deliverPaymentUpdate;
};

const staleStripeReconciliationDependencies: StaleStripeReconciliationDependencies =
  {
    listStale: listStalePendingStripePayments,
    retrieve: retrieveStripeCheckoutSession,
    verify: verifyPaymentAndMarkOrderPaid,
    updateStatus: updatePaymentStatus,
    recordReview: recordPaymentReviewRequired,
    expireQuote: expireApprovedQuoteAfterPaymentClosed,
    deliverUpdate: deliverPaymentUpdate,
  };

/** Verify provider evidence and idempotently reconcile one Stripe event. */
export async function handleStripeWebhookEvent(input: {
  reference: string;
  eventSessionId: string;
  eventId: string;
  successObservedAt: string | null;
  signal: Exclude<StripeReconciliationSignal, "cron">;
}): Promise<StripeWebhookHandling> {
  const payment = await readPaymentByReference(input.reference);
  if (!payment) {
    return {
      handled: false,
      retryable: true,
      reason: "Payment not found for reference.",
    };
  }
  if (payment.status === "verified") {
    await deliverPaymentUpdate(payment.orderId);
    return { handled: true, retryable: false, reason: "Already verified." };
  }

  const sessionId = payment.providerInitialization?.providerSessionId;
  if (!sessionId) {
    await recordProviderReview({
      payment,
      code: "webhook-without-stored-session",
      reason:
        "Stripe sent a Checkout event before the reserved attempt had a stored session.",
      metadata: { eventSessionId: input.eventSessionId, signal: input.signal },
    });
    return {
      handled: false,
      retryable: false,
      reason: "Payment has no Stripe session to verify.",
    };
  }
  if (sessionId !== input.eventSessionId) {
    await recordProviderReview({
      payment,
      code: "session-mismatch",
      reason:
        "Stripe sent a different Checkout Session for the stored reference.",
      metadata: {
        storedSessionId: sessionId,
        eventSessionId: input.eventSessionId,
        signal: input.signal,
      },
    });
    return {
      handled: false,
      retryable: false,
      reason: "Provider session does not match the reserved payment.",
    };
  }

  let retrieved: StripeSessionVerifyResult;
  try {
    retrieved = await retrieveStripeCheckoutSession(sessionId);
  } catch (error) {
    const problem = nonRetryableStripeRetrievalProblem(error);
    if (!problem) throw error;
    await recordProviderReview({
      payment,
      code: problem.code,
      reason: problem.reason,
      metadata: {
        stripeEventId: input.eventId,
        eventSessionId: input.eventSessionId,
        signal: input.signal,
      },
    });
    return {
      handled: false,
      retryable: false,
      reason: problem.reason,
    };
  }
  const verification: StripeSessionVerifyResult = {
    ...retrieved,
    paidAt: input.signal === "failure" ? null : input.successObservedAt,
  };
  const decision = stripeEvidenceDecision({
    expectedReference: input.reference,
    expectedAmountKobo: ngnToKobo(payment.amountNgn),
    verification,
    signal: input.signal,
  });
  const webhookEvidence = {
    stripeEventId: input.eventId,
    signal: input.signal,
    ...providerEvidence(verification),
  };

  if (decision.action === "review") {
    await recordProviderReview({
      payment,
      code: decision.code,
      reason: decision.reason,
      metadata: webhookEvidence,
    });
    return {
      handled: false,
      retryable: false,
      reason: decision.reason,
    };
  }

  if (decision.action === "verify") {
    if (payment.status !== "pending") {
      await recordProviderReview({
        payment,
        code: "late-success-after-local-close",
        reason:
          "Stripe reported a successful payment after the local attempt was already closed.",
        metadata: webhookEvidence,
      });
      return {
        handled: false,
        retryable: false,
        reason: "A late provider success requires operator reconciliation.",
      };
    }
    let verified: AssistedOrderPayment | null;
    try {
      verified = await reconcileSuccessfulStripePayment({
        payment,
        verification,
        successEventId: input.eventId,
      });
    } catch (error) {
      if (!(error instanceof PaymentSettlementOutsideQuoteWindowError))
        throw error;
      await recordProviderReview({
        payment,
        code: "settlement-outside-quote-window",
        reason: error.message,
        metadata: {
          ...webhookEvidence,
          quoteIssuedAt: error.issuedAt,
          quoteExpiresAt: error.expiresAt,
        },
      });
      return {
        handled: false,
        retryable: false,
        reason: error.message,
      };
    }
    if (!verified) {
      await recordProviderReview({
        payment,
        code: "commit-mismatch",
        reason:
          "Verified Stripe evidence could not be matched to the current approved order state.",
        metadata: {
          ...webhookEvidence,
        },
      });
      return {
        handled: false,
        retryable: true,
        reason: "Payment evidence could not yet be committed.",
      };
    }
    return {
      handled: true,
      retryable: false,
      reason: "Payment verified and order marked paid.",
    };
  }

  if (decision.action === "close") {
    const updated = await updatePaymentStatus({
      paymentId: payment.id,
      status: decision.status,
      evidenceReference: `stripe:${verification.sessionId}:${decision.status}`,
      reason: decision.reason,
    });
    if (!updated) {
      return {
        handled: false,
        retryable: true,
        reason: "Payment status could not yet be committed.",
      };
    }
    await expireApprovedQuoteAfterPaymentClosed({
      orderId: payment.orderId,
      quoteVersion: payment.quoteVersion,
      paymentId: payment.id,
    });
    await deliverPaymentUpdate(payment.orderId);
    return {
      handled: true,
      retryable: false,
      reason: `Payment marked as ${decision.status}.`,
    };
  }

  if (input.signal === "observe") {
    return {
      handled: true,
      retryable: false,
      reason: decision.reason,
    };
  }
  return {
    handled: false,
    retryable: true,
    reason: decision.reason,
  };
}

/**
 * Reconcile a bounded stale batch without ever timing out a provider call into
 * an abandonment. Only re-retrieved terminal evidence can close an attempt.
 */
export async function reconcileStaleStripePayments(
  input: { now?: Date; limit?: number } = {},
  dependencies: StaleStripeReconciliationDependencies = staleStripeReconciliationDependencies,
): Promise<StaleStripeReconciliationSummary> {
  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Stripe reconciliation time is invalid.");
  }
  const summary: StaleStripeReconciliationSummary = {
    scanned: 0,
    verified: 0,
    failed: 0,
    abandoned: 0,
    pending: 0,
    reviewRequired: 0,
    retryableErrors: 0,
  };
  const payments = await dependencies.listStale({
    staleBefore: new Date(
      now.getTime() - STALE_RECONCILIATION_AGE_MS,
    ).toISOString(),
    limit: input.limit ?? STALE_RECONCILIATION_BATCH_SIZE,
  });
  summary.scanned = payments.length;

  const recordReview = async (
    payment: AssistedOrderPayment,
    code: string,
    reason: string,
    metadata: Record<string, unknown>,
  ) => {
    const reference = payment.providerReference ?? payment.id;
    const recorded = await dependencies.recordReview({
      paymentId: payment.id,
      evidenceReference: `stripe-review:${reference}:${code}`,
      reason,
      metadata: {
        paymentStatus: payment.status,
        expectedReference: payment.providerReference,
        expectedAmountKobo: ngnToKobo(payment.amountNgn),
        ...metadata,
      },
    });
    if (!recorded) throw new Error("Payment review could not be recorded.");
    summary.reviewRequired += 1;
  };

  for (const payment of payments) {
    try {
      const reference = payment.providerReference;
      const initialization = payment.providerInitialization;
      const sessionId = initialization?.providerSessionId;
      if (!reference || initialization?.phase !== "ready" || !sessionId) {
        await recordReview(
          payment,
          "stale-reservation-without-session",
          "A stale Stripe reservation has no complete stored session evidence.",
          {
            phase: initialization?.phase ?? null,
            reservedAt: initialization?.reservedAt ?? null,
          },
        );
        continue;
      }

      let verification: StripeSessionVerifyResult;
      try {
        verification = await dependencies.retrieve(sessionId);
      } catch (error) {
        const problem = nonRetryableStripeRetrievalProblem(error);
        if (problem) {
          await recordReview(payment, problem.code, problem.reason, {
            sessionId,
          });
          continue;
        }
        summary.retryableErrors += 1;
        continue;
      }
      const decision = stripeEvidenceDecision({
        expectedReference: reference,
        expectedAmountKobo: ngnToKobo(payment.amountNgn),
        verification,
        signal: "cron",
      });

      if (decision.action === "pending") {
        summary.pending += 1;
        continue;
      }
      if (decision.action === "review") {
        await recordReview(
          payment,
          decision.code,
          decision.reason,
          providerEvidence(verification),
        );
        continue;
      }
      if (decision.action === "verify") {
        try {
          const verified = await dependencies.verify({
            paymentId: payment.id,
            evidenceReference: `stripe:${reference}:${verification.chargeId}:${verification.paidAt}`,
            evidenceMetadata: {
              reference,
              ...providerEvidence(verification),
            },
            verifiedBySubject: null,
            receivedAmountKobo: verification.amountTotalKobo,
            paidAt: verification.paidAt!,
          });
          if (!verified) {
            await recordReview(
              payment,
              "commit-mismatch",
              "Verified Stripe evidence could not be matched to the current approved order state.",
              providerEvidence(verification),
            );
            summary.retryableErrors += 1;
            continue;
          }
          summary.verified += 1;
          await dependencies.deliverUpdate(payment.orderId);
        } catch (error) {
          if (!(error instanceof PaymentSettlementOutsideQuoteWindowError)) {
            throw error;
          }
          await recordReview(
            payment,
            "settlement-outside-quote-window",
            error.message,
            {
              ...providerEvidence(verification),
              quoteIssuedAt: error.issuedAt,
              quoteExpiresAt: error.expiresAt,
            },
          );
        }
        continue;
      }

      const closed = await dependencies.updateStatus({
        paymentId: payment.id,
        status: decision.status,
        evidenceReference: `stripe:${sessionId}:${decision.status}`,
        reason: decision.reason,
      });
      if (!closed) {
        summary.retryableErrors += 1;
        continue;
      }
      summary[decision.status === "failed" ? "failed" : "abandoned"] += 1;
      await dependencies.expireQuote({
        orderId: payment.orderId,
        quoteVersion: payment.quoteVersion,
        paymentId: payment.id,
      });
      await dependencies.deliverUpdate(payment.orderId);
    } catch {
      summary.retryableErrors += 1;
    }
  }

  return summary;
}

/** Record independently observed manual-bank evidence against the locked quote. */
export async function manuallyVerifyPayment(input: {
  orderId: string;
  operatorSubject: string;
  evidenceReference: string;
  providerReference: string;
  receivedAmountNgn: number;
}): Promise<
  { ok: true; payment: AssistedOrderPayment } | { ok: false; error: string }
> {
  if (input.evidenceReference.trim().length < 8) {
    return {
      ok: false,
      error: "Evidence reference must be at least 8 characters.",
    };
  }
  if (input.providerReference.trim().length < 6) {
    return {
      ok: false,
      error: "Enter the bank transaction reference from the received payment.",
    };
  }

  let receivedAmountNgn: number;
  try {
    receivedAmountNgn = normalizeNgnAmount(input.receivedAmountNgn);
  } catch {
    return { ok: false, error: "Enter the exact amount received in NGN." };
  }

  const verification = await createAndVerifyManualPayment({
    orderId: input.orderId,
    operatorSubject: input.operatorSubject,
    evidenceReference: input.evidenceReference,
    providerReference: input.providerReference,
    receivedAmountNgn,
  });

  if (!verification.ok) {
    if (verification.reason === "active_stripe") {
      return {
        ok: false,
        error:
          "An online Stripe attempt is still active. Reconcile it before recording a bank transfer.",
      };
    }
    if (verification.reason === "reference_reused") {
      return {
        ok: false,
        error:
          "That bank transaction reference has already been used for another payment.",
      };
    }
    if (verification.reason === "not_payable") {
      return {
        ok: false,
        error:
          "This approval is no longer payable. Issue a fresh quote before recording payment.",
      };
    }
    return {
      ok: false,
      error: "The received amount does not match the current approved quote.",
    };
  }

  await deliverPaymentUpdate(verification.payment.orderId);
  return { ok: true, payment: verification.payment };
}
