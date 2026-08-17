import "server-only";

import {
  createAndVerifyManualPayment,
  expireApprovedQuoteAfterPaymentClosed,
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
    !verification.paidAt ||
    !Number.isFinite(Date.parse(verification.paidAt))
  ) {
    return {
      code: "missing-settlement-time",
      reason: "Stripe returned no valid settlement time.",
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
    evidenceReference: `stripe:${reference}:${input.verification.paidAt}`,
    evidenceMetadata: {
      reference,
      sessionId: input.verification.sessionId,
      paymentIntentId: input.verification.paymentIntentId,
      amountKobo: input.verification.amountTotalKobo,
      currency: input.verification.currency,
      paidAt: input.verification.paidAt,
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

  if (verification.paymentStatus === "paid") {
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

  if (
    verification.status === "expired" ||
    verification.paymentStatus === "unpaid"
  ) {
    const retired = await updatePaymentStatus({
      paymentId: payment.id,
      status: "abandoned",
      evidenceReference: `stripe:${reference}:${verification.status}:after-expiry`,
      reason: `Stripe session is ${verification.status} after quote expiry.`,
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

  if (verification.paymentStatus === "paid") {
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

  if (
    verification.status === "expired" ||
    verification.paymentStatus === "unpaid"
  ) {
    const retired = await updatePaymentStatus({
      paymentId: reservation.payment.id,
      status: "abandoned",
      evidenceReference: `stripe:${reference}:${verification.status}`,
      reason:
        verification.status === "expired"
          ? "Stripe reports that the checkout session expired."
          : undefined,
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

/** Verify provider evidence and idempotently reconcile one Stripe event. */
export async function handleStripeWebhookEvent(input: {
  reference: string;
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
    return {
      handled: false,
      retryable: false,
      reason: "Payment has no Stripe session to verify.",
    };
  }

  const verification = await retrieveStripeCheckoutSession(sessionId);
  if (verification.reference !== input.reference) {
    await recordProviderReview({
      payment,
      code: "reference-mismatch",
      reason: "Stripe returned a different session reference.",
      metadata: providerEvidence(verification),
    });
    return {
      handled: false,
      retryable: false,
      reason: "Provider reference mismatch.",
    };
  }

  if (verification.paymentStatus === "paid") {
    const problem = successfulEvidenceProblem(input.reference, verification);
    if (problem) {
      await recordProviderReview({
        payment,
        code: problem.code,
        reason: problem.reason,
        metadata: {
          ...providerEvidence(verification),
        },
      });
      return { handled: false, retryable: false, reason: problem.reason };
    }
    if (ngnToKobo(payment.amountNgn) !== verification.amountTotalKobo) {
      await recordProviderReview({
        payment,
        code: "amount-mismatch",
        reason: "Stripe reported a successful payment for a different amount.",
        metadata: {
          ...providerEvidence(verification),
        },
      });
      return {
        handled: false,
        retryable: false,
        reason: "Provider amount does not match the reserved payment.",
      };
    }
    if (payment.status !== "pending") {
      await recordProviderReview({
        payment,
        code: "late-success-after-local-close",
        reason:
          "Stripe reported a successful payment after the local attempt was already closed.",
        metadata: providerEvidence(verification),
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
      });
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
          ...providerEvidence(verification),
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

  if (
    verification.status === "expired" ||
    verification.paymentStatus === "unpaid"
  ) {
    const updated = await updatePaymentStatus({
      paymentId: payment.id,
      status: "abandoned",
      evidenceReference: `stripe:${verification.sessionId}:${verification.status}`,
      reason:
        verification.status === "expired"
          ? "Stripe reports that the checkout session expired."
          : undefined,
    });
    if (!updated) {
      return {
        handled: false,
        retryable: true,
        reason: "Payment status could not yet be committed.",
      };
    }
    await deliverPaymentUpdate(payment.orderId);
    return {
      handled: true,
      retryable: false,
      reason: `Payment marked as ${verification.status}.`,
    };
  }

  return {
    handled: false,
    retryable: true,
    reason: `Payment status is ${verification.status}.`,
  };
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
