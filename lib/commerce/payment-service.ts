import "server-only";

import {
  createAndVerifyManualPayment,
  expireApprovedQuoteAfterPaymentClosed,
  readPaymentByReference,
  recordPaymentReviewRequired,
  recordPaystackPaymentInitialization,
  reservePaystackPaymentAttempt,
  updatePaymentStatus,
  verifyPaymentAndMarkOrderPaid,
  PaymentSettlementOutsideQuoteWindowError,
  PaymentQuoteExpiredWithActiveAttemptError,
  type AssistedOrderPayment,
} from "./payment-repository";
import {
  createPaystackReference,
  initializePaystackTransaction,
  isPaystackConfigured,
  PaystackProviderError,
  verifyPaystackTransaction,
  type PaystackVerifyResult,
} from "./payment-provider";
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
  verification: PaystackVerifyResult,
) {
  if (verification.reference !== expectedReference) {
    return {
      code: "reference-mismatch",
      reason: "Paystack returned a different transaction reference.",
    };
  }
  if (verification.currency !== "NGN") {
    return {
      code: "currency-mismatch",
      reason: "Paystack returned a non-NGN transaction.",
    };
  }
  if (
    !verification.paidAt ||
    !Number.isFinite(Date.parse(verification.paidAt))
  ) {
    return {
      code: "missing-settlement-time",
      reason: "Paystack returned no valid settlement time.",
    };
  }
  return null;
}

function providerEvidence(verification: PaystackVerifyResult) {
  return {
    verificationStatus: verification.status,
    observedReference: verification.reference,
    observedAmountKobo: verification.amountKobo,
    observedCurrency: verification.currency,
    observedPaidAt: verification.paidAt,
    channel: verification.channel,
    gatewayResponse: verification.gatewayResponse,
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
    evidenceReference: `paystack-review:${reference}:${input.code}`,
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

async function reconcileSuccessfulPaystackPayment(input: {
  payment: AssistedOrderPayment;
  verification: PaystackVerifyResult;
}) {
  const reference = input.payment.providerReference;
  if (!reference) return null;
  const problem = successfulEvidenceProblem(reference, input.verification);
  if (problem) return null;
  if (ngnToKobo(input.payment.amountNgn) !== input.verification.amountKobo) {
    return null;
  }

  const verified = await verifyPaymentAndMarkOrderPaid({
    paymentId: input.payment.id,
    evidenceReference: `paystack:${reference}:${input.verification.paidAt}`,
    evidenceMetadata: {
      reference,
      amountKobo: input.verification.amountKobo,
      currency: input.verification.currency,
      paidAt: input.verification.paidAt,
      channel: input.verification.channel,
      gatewayResponse: input.verification.gatewayResponse,
    },
    verifiedBySubject: null,
    receivedAmountKobo: input.verification.amountKobo,
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

  const initialized = await initializePaystackTransaction({
    amountNgn: input.amountNgn,
    reference,
    orderReference: input.orderReference,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    callbackUrl: input.callbackUrl,
  });
  const persisted = await recordPaystackPaymentInitialization({
    paymentId: input.payment.id,
    providerReference: reference,
    authorizationUrl: initialized.authorizationUrl,
    accessCode: initialized.accessCode,
    initializedAt: new Date().toISOString(),
  });
  if (!persisted) {
    // The reserved reference remains queryable by webhook/reconciliation. Do
    // not return an unpersisted URL and do not create another live attempt.
    throw new PaymentInitializationPendingError();
  }
  return {
    payment: persisted,
    authorizationUrl: initialized.authorizationUrl,
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

  let verification: PaystackVerifyResult;
  try {
    verification = await verifyPaystackTransaction(reference);
  } catch (error) {
    if (!(error instanceof PaystackProviderError) || error.httpStatus !== 404) {
      throw error;
    }
    const retired = await updatePaymentStatus({
      paymentId: payment.id,
      status: "abandoned",
      evidenceReference: `paystack:${reference}:not-found-after-expiry`,
      reason: "Paystack had no transaction for the expired quote attempt.",
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

  if (verification.status === "success") {
    try {
      const verified = await reconcileSuccessfulPaystackPayment({
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
    verification.status === "failed" ||
    verification.status === "abandoned" ||
    verification.status === "reversed"
  ) {
    const status =
      verification.status === "reversed" ? "failed" : verification.status;
    const retired = await updatePaymentStatus({
      paymentId: payment.id,
      status,
      evidenceReference: `paystack:${reference}:${verification.status}:after-expiry`,
      reason: `Paystack reports ${verification.status} after quote expiry.`,
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
  let reservation: Awaited<ReturnType<typeof reservePaystackPaymentAttempt>>;
  try {
    reservation = await reservePaystackPaymentAttempt({
      orderId: input.orderId,
      quoteVersion: input.quoteVersion,
      amountNgn: input.amountNgn,
      providerReference: createPaystackReference(
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

  const initialization = reservation.payment.paystackInitialization;
  if (
    initialization?.phase === "ready" &&
    initialization.authorizationUrl &&
    initialization.initializedAt &&
    Date.now() - Date.parse(initialization.initializedAt) <
      READY_ATTEMPT_RECHECK_MS
  ) {
    return {
      payment: reservation.payment,
      authorizationUrl: initialization.authorizationUrl,
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

  let verification: PaystackVerifyResult;
  try {
    verification = await verifyPaystackTransaction(reference);
  } catch (error) {
    if (error instanceof PaystackProviderError && error.httpStatus === 404) {
      const abandoned = await updatePaymentStatus({
        paymentId: reservation.payment.id,
        status: "abandoned",
        evidenceReference: `paystack:${reference}:not-found`,
        reason: "Paystack had no transaction for the stale reserved reference.",
      });
      if (!abandoned) throw new PaymentInitializationPendingError();
      return reserveAndInitialize(input);
    }
    throw error;
  }

  if (verification.status === "success") {
    let verified: AssistedOrderPayment | null;
    try {
      verified = await reconcileSuccessfulPaystackPayment({
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
    verification.status === "failed" ||
    verification.status === "abandoned" ||
    verification.status === "reversed"
  ) {
    const retiredStatus =
      verification.status === "reversed" ? "failed" : verification.status;
    const retired = await updatePaymentStatus({
      paymentId: reservation.payment.id,
      status: retiredStatus,
      evidenceReference: `paystack:${reference}:${verification.status}`,
      reason:
        verification.status === "reversed"
          ? "Paystack reports that the transaction was reversed."
          : undefined,
    });
    if (!retired) throw new PaymentInitializationPendingError();
    await deliverPaymentUpdate(reservation.payment.orderId);
    return reserveAndInitialize(input);
  }

  if (initialization?.phase === "ready" && initialization.authorizationUrl) {
    return {
      payment: reservation.payment,
      authorizationUrl: initialization.authorizationUrl,
      alreadyPaid: false,
    };
  }

  await recordProviderReview({
    payment: reservation.payment,
    code: "initialization-incomplete",
    reason:
      "The reserved Paystack transaction is live but no reusable checkout URL was persisted.",
    metadata: {
      ...providerEvidence(verification),
    },
  });

  throw new PaymentInitializationPendingError();
}

/**
 * Initialize exactly one DB-reserved Paystack attempt for the approved quote.
 * Repeat requests reuse the persisted authorization URL for that same attempt.
 */
export async function initiatePaystackPayment(input: {
  orderId: string;
  callbackUrl: string;
}): Promise<PaymentInitResult> {
  if (!isPaystackConfigured()) {
    throw new Error("Paystack is not configured.");
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

export type PaystackWebhookHandling = {
  handled: boolean;
  retryable: boolean;
  reason: string;
};

/** Verify provider evidence and idempotently reconcile one Paystack event. */
export async function handlePaystackWebhookEvent(input: {
  reference: string;
}): Promise<PaystackWebhookHandling> {
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

  const verification = await verifyPaystackTransaction(input.reference);
  if (verification.reference !== input.reference) {
    await recordProviderReview({
      payment,
      code: "reference-mismatch",
      reason: "Paystack returned a different transaction reference.",
      metadata: providerEvidence(verification),
    });
    return {
      handled: false,
      retryable: false,
      reason: "Provider reference mismatch.",
    };
  }

  if (verification.status === "success") {
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
    if (ngnToKobo(payment.amountNgn) !== verification.amountKobo) {
      await recordProviderReview({
        payment,
        code: "amount-mismatch",
        reason: "Paystack reported a successful charge for a different amount.",
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
          "Paystack reported a successful charge after the local attempt was already closed.",
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
      verified = await reconcileSuccessfulPaystackPayment({
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
          "Verified Paystack evidence could not be matched to the current approved order state.",
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
    verification.status === "failed" ||
    verification.status === "abandoned" ||
    verification.status === "reversed"
  ) {
    const retiredStatus =
      verification.status === "reversed" ? "failed" : verification.status;
    const updated = await updatePaymentStatus({
      paymentId: payment.id,
      status: retiredStatus,
      evidenceReference: `paystack:${verification.reference}:${verification.status}`,
      reason:
        verification.status === "reversed"
          ? "Paystack reports that the transaction was reversed."
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
    if (verification.reason === "active_paystack") {
      return {
        ok: false,
        error:
          "An online Paystack attempt is still active. Reconcile it before recording a bank transfer.",
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
