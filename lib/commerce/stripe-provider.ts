import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ngnToKobo, normalizeKoboAmount } from "./payment-money";

const STRIPE_BASE_URL = "https://api.stripe.com";
const STRIPE_REQUEST_TIMEOUT_MS = 10_000;
const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

export function stripeSecretKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !key.startsWith("sk_")) return null;
  return key;
}

export function stripeWebhookSecret(): string | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !secret.startsWith("whsec_")) return null;
  return secret;
}

export function isStripeConfigured(): boolean {
  return stripeSecretKey() != null;
}

export type StripeCheckoutSessionResult = {
  sessionId: string;
  url: string;
  paymentIntentId: string | null;
};

export class StripeProviderError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number | null = null,
  ) {
    super(message);
    this.name = "StripeProviderError";
  }
}

export function createStripeReference(
  orderReference: string,
  quoteVersion: number,
) {
  const order = orderReference.replace(/^JC-/, "").replace(/[^A-Z0-9]/gi, "");
  return `JC-${order}-Q${quoteVersion}-${randomBytes(8).toString("hex").toUpperCase()}`;
}

export type StripeSessionVerifyResult = {
  status:
    "paid" | "unpaid" | "no_payment_required" | "expired" | "open" | "complete";
  paymentStatus: "paid" | "unpaid" | "no_payment_required";
  amountTotalKobo: number;
  currency: string;
  sessionId: string;
  paymentIntentId: string | null;
  reference: string | null;
  paidAt: string | null;
};

/**
 * Create a Stripe Checkout Session for a one-time NGN payment.
 * The reference is stored in session metadata for webhook reconciliation.
 * Stripe generates the session ID; we store it after creation.
 */
export async function createStripeCheckoutSession(input: {
  amountNgn: number;
  reference: string;
  orderReference: string;
  customerEmail: string;
  customerName: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<StripeCheckoutSessionResult> {
  const key = stripeSecretKey();
  if (!key) throw new Error("Stripe is not configured.");

  const amountKobo = ngnToKobo(input.amountNgn);
  const displayName = `JeloCare Order ${input.orderReference}`;

  const params = new URLSearchParams();
  params.append("mode", "payment");
  params.append("currency", "ngn");
  params.append("line_items[0][price_data][currency]", "ngn");
  params.append("line_items[0][price_data][product_data][name]", displayName);
  params.append("line_items[0][price_data][unit_amount]", String(amountKobo));
  params.append("line_items[0][quantity]", "1");
  params.append("success_url", input.successUrl);
  params.append("cancel_url", input.cancelUrl);
  params.append("metadata[reference]", input.reference);
  params.append("metadata[order_reference]", input.orderReference);
  if (input.customerEmail) {
    params.append("customer_email", input.customerEmail);
  }

  const response = await fetch(`${STRIPE_BASE_URL}/v1/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    signal: AbortSignal.timeout(STRIPE_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new StripeProviderError(
      `Stripe checkout session creation failed: ${response.status} ${body.slice(0, 200)}`,
      response.status,
    );
  }

  const data = (await response.json()) as {
    id: string;
    url: string;
    payment_intent: string | null;
    status: string;
  };

  if (
    typeof data.id !== "string" ||
    !data.id.startsWith("cs_") ||
    typeof data.url !== "string" ||
    !data.url
  ) {
    throw new StripeProviderError(
      "Stripe checkout session creation returned invalid data.",
    );
  }

  let sessionUrl: URL;
  try {
    sessionUrl = new URL(data.url);
  } catch {
    throw new StripeProviderError(
      "Stripe checkout session returned an invalid URL.",
    );
  }

  if (
    sessionUrl.protocol !== "https:" ||
    (sessionUrl.hostname !== "checkout.stripe.com" &&
      !sessionUrl.hostname.endsWith(".stripe.com"))
  ) {
    throw new StripeProviderError(
      "Stripe checkout session returned an invalid checkout URL.",
    );
  }

  return {
    sessionId: data.id,
    url: sessionUrl.toString(),
    paymentIntentId:
      typeof data.payment_intent === "string" ? data.payment_intent : null,
  };
}

/**
 * Retrieve a Stripe Checkout Session to verify its payment status.
 * This is the governed evidence source — the order becomes paid only when
 * this returns payment_status=paid with the correct amount.
 */
export async function retrieveStripeCheckoutSession(
  sessionId: string,
): Promise<StripeSessionVerifyResult> {
  const key = stripeSecretKey();
  if (!key) throw new Error("Stripe is not configured.");

  const response = await fetch(
    `${STRIPE_BASE_URL}/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      signal: AbortSignal.timeout(STRIPE_REQUEST_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new StripeProviderError(
      `Stripe session retrieval failed: ${response.status} ${body.slice(0, 200)}`,
      response.status,
    );
  }

  const data = (await response.json()) as {
    id: string;
    status: string;
    payment_status: string;
    amount_total: number;
    currency: string;
    payment_intent: string | null;
    metadata: { reference?: string } | null;
    created: number;
  };

  if (
    typeof data.id !== "string" ||
    data.id.length < 1 ||
    data.id.length > 200 ||
    typeof data.currency !== "string" ||
    data.currency.length < 1 ||
    data.currency.length > 10
  ) {
    throw new StripeProviderError(
      "Stripe session retrieval returned malformed evidence.",
    );
  }

  const validStatuses = [
    "paid",
    "unpaid",
    "no_payment_required",
    "expired",
    "open",
    "complete",
  ];
  if (!validStatuses.includes(data.status)) {
    throw new StripeProviderError(
      "Stripe session retrieval returned an invalid status.",
    );
  }

  const validPaymentStatuses = ["paid", "unpaid", "no_payment_required"];
  if (!validPaymentStatuses.includes(data.payment_status)) {
    throw new StripeProviderError(
      "Stripe session retrieval returned an invalid payment status.",
    );
  }

  return {
    status: data.status as StripeSessionVerifyResult["status"],
    paymentStatus:
      data.payment_status as StripeSessionVerifyResult["paymentStatus"],
    amountTotalKobo: normalizeKoboAmount(data.amount_total),
    currency: data.currency,
    sessionId: data.id,
    paymentIntentId:
      typeof data.payment_intent === "string" ? data.payment_intent : null,
    reference: data.metadata?.reference ?? null,
    paidAt:
      data.payment_status === "paid"
        ? new Date(data.created * 1000).toISOString()
        : null,
  };
}

/**
 * Verify a Stripe webhook signature.
 * Stripe signs webhooks with HMAC-SHA256 using a separate webhook signing secret.
 * The header format is: t=timestamp,v1=signature
 */
export function verifyStripeWebhookSignature(
  payload: string,
  signature: string,
): boolean {
  const secret = stripeWebhookSecret();
  if (!secret) return false;

  try {
    const parts = signature.split(",");
    const timestampPart = parts.find((p) => p.startsWith("t="));
    const v1Parts = parts.filter((p) => p.startsWith("v1="));
    if (!timestampPart || v1Parts.length === 0) return false;

    const timestamp = timestampPart.slice(2);
    const timestampNum = Number(timestamp);
    if (!Number.isFinite(timestampNum)) return false;

    // Replay protection: reject timestamps older than tolerance
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      Math.abs(nowSeconds - timestampNum) > STRIPE_WEBHOOK_TOLERANCE_SECONDS
    ) {
      return false;
    }

    const signedPayload = `${timestamp}.${payload}`;
    const expected = createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

    for (const v1Part of v1Parts) {
      const received = v1Part.slice(3);
      if (received.length === expected.length) {
        const receivedBuf = Buffer.from(received, "hex");
        const expectedBuf = Buffer.from(expected, "hex");
        if (receivedBuf.length === expectedBuf.length) {
          return timingSafeEqual(receivedBuf, expectedBuf);
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}
