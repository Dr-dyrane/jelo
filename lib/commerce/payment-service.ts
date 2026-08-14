import "server-only";

import {
  createPayment,
  readPaymentByReference,
  verifyPaymentAndMarkOrderPaid,
  updatePaymentStatus,
  type AssistedOrderPayment,
  type PaymentProvider,
} from "./payment-repository";
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  isPaystackConfigured,
} from "./payment-provider";
import { readAssistedOrderById } from "./assisted-procurement-repository";

export type PaymentInitResult = {
  payment: AssistedOrderPayment;
  authorizationUrl: string;
};

/**
 * Initialize a Paystack payment for an order in payment_pending state.
 * Creates a payment record and returns the Paystack authorization URL.
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
  if (order.quote.totalNgn == null || order.quote.totalNgn <= 0) {
    throw new Error("Quote total is incomplete.");
  }

  const init = await initializePaystackTransaction({
    amountNgn: order.quote.totalNgn,
    orderReference: order.reference,
    customerEmail: order.contactEmail,
    customerName: order.contactName,
    callbackUrl: input.callbackUrl,
  });

  const payment = await createPayment({
    orderId: order.id,
    quoteVersion: order.quote.version,
    amountNgn: order.quote.totalNgn,
    provider: "paystack",
    providerReference: init.reference,
  });

  return {
    payment,
    authorizationUrl: init.authorizationUrl,
  };
}

/**
 * Handle a Paystack webhook event.
 * Verifies the transaction via the Paystack API and marks the order as paid
 * if the amount matches the approved quote total.
 */
export async function handlePaystackWebhookEvent(input: {
  reference: string;
}): Promise<{ handled: boolean; reason: string }> {
  const payment = await readPaymentByReference(input.reference);
  if (!payment) {
    return { handled: false, reason: "Payment not found for reference." };
  }
  if (payment.status === "verified") {
    return { handled: true, reason: "Already verified." };
  }

  const verification = await verifyPaystackTransaction(input.reference);

  if (verification.status === "success") {
    const amountNgn = Math.round(verification.amountKobo / 100);
    const verified = await verifyPaymentAndMarkOrderPaid({
      paymentId: payment.id,
      evidenceReference: `paystack:${verification.reference}:${verification.paidAt ?? ""}`,
      verifiedBySubject: null,
      expectedAmountNgn: amountNgn,
    });
    if (!verified) {
      return {
        handled: false,
        reason: "Amount mismatch or order not in payment_pending state.",
      };
    }
    return { handled: true, reason: "Payment verified and order marked paid." };
  }

  if (verification.status === "failed" || verification.status === "abandoned") {
    await updatePaymentStatus({
      paymentId: payment.id,
      status: verification.status,
      evidenceReference: `paystack:${verification.reference}:${verification.status}`,
    });
    return {
      handled: true,
      reason: `Payment marked as ${verification.status}.`,
    };
  }

  return {
    handled: false,
    reason: `Payment status is ${verification.status}.`,
  };
}

/**
 * Operator manually verifies a bank transfer payment.
 * Requires the operator to provide evidence (bank statement reference, transfer ID, etc.)
 * and the amount must match the approved quote total.
 */
export async function manuallyVerifyPayment(input: {
  orderId: string;
  operatorSubject: string;
  evidenceReference: string;
  providerReference: string | null;
}): Promise<
  { ok: true; payment: AssistedOrderPayment } | { ok: false; error: string }
> {
  const order = await readAssistedOrderById(input.orderId);
  if (!order) return { ok: false, error: "Order not found." };
  if (order.state !== "payment_pending") {
    return { ok: false, error: "Order is not awaiting payment." };
  }
  if (!order.quote || order.quote.status !== "approved") {
    return { ok: false, error: "No approved quote." };
  }
  if (order.quote.totalNgn == null || order.quote.totalNgn <= 0) {
    return { ok: false, error: "Quote total is incomplete." };
  }

  if (input.evidenceReference.trim().length < 8) {
    return {
      ok: false,
      error: "Evidence reference must be at least 8 characters.",
    };
  }

  const payment = await createPayment({
    orderId: order.id,
    quoteVersion: order.quote.version,
    amountNgn: order.quote.totalNgn,
    provider: "manual_bank_transfer" as PaymentProvider,
    providerReference: input.providerReference,
  });

  const verified = await verifyPaymentAndMarkOrderPaid({
    paymentId: payment.id,
    evidenceReference: `manual:${input.evidenceReference}`,
    verifiedBySubject: input.operatorSubject,
    expectedAmountNgn: order.quote.totalNgn,
  });

  if (!verified) {
    return {
      ok: false,
      error: "Could not verify payment. The amount may not match the quote.",
    };
  }

  return { ok: true, payment: verified };
}
