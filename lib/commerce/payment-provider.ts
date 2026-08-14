import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ngnToKobo, normalizeKoboAmount } from "./payment-money";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const PAYSTACK_REQUEST_TIMEOUT_MS = 10_000;

export function paystackSecretKey(): string | null {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !key.startsWith("sk_")) return null;
  return key;
}

export function paystackPublicKey(): string | null {
  const key = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
  if (!key || !key.startsWith("pk_")) return null;
  return key;
}

export function isPaystackConfigured(): boolean {
  return paystackSecretKey() != null && paystackPublicKey() != null;
}

export type PaystackInitResult = {
  reference: string;
  authorizationUrl: string;
  accessCode: string;
};

export class PaystackProviderError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number | null = null,
  ) {
    super(message);
    this.name = "PaystackProviderError";
  }
}

export function createPaystackReference(
  orderReference: string,
  quoteVersion: number,
) {
  const order = orderReference.replace(/^JC-/, "").replace(/[^A-Z0-9]/gi, "");
  return `JC-${order}-Q${quoteVersion}-${randomBytes(8).toString("hex").toUpperCase()}`;
}

export type PaystackVerifyResult = {
  status:
    | "success"
    | "failed"
    | "abandoned"
    | "pending"
    | "ongoing"
    | "processing"
    | "queued"
    | "reversed";
  amountKobo: number;
  currency: string;
  reference: string;
  gatewayResponse: string;
  paidAt: string | null;
  channel: string | null;
};

/**
 * Initialize a Paystack transaction for an order.
 * The reference is generated server-side to prevent collisions.
 * The callback URL is the order status page where the customer returns after payment.
 */
export async function initializePaystackTransaction(input: {
  amountNgn: number;
  reference: string;
  orderReference: string;
  customerEmail: string;
  customerName: string | null;
  callbackUrl: string;
}): Promise<PaystackInitResult> {
  const key = paystackSecretKey();
  if (!key) throw new Error("Paystack is not configured.");

  const amountKobo = ngnToKobo(input.amountNgn);

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.customerEmail,
      amount: amountKobo,
      currency: "NGN",
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: {
        custom_fields: [
          {
            display_name: "Order",
            variable_name: "order",
            value: input.orderReference,
          },
          ...(input.customerName
            ? [
                {
                  display_name: "Customer",
                  variable_name: "customer",
                  value: input.customerName,
                },
              ]
            : []),
        ],
      },
    }),
    signal: AbortSignal.timeout(PAYSTACK_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new PaystackProviderError(
      `Paystack initialize failed: ${response.status} ${body.slice(0, 200)}`,
      response.status,
    );
  }

  const data = (await response.json()) as {
    status: boolean;
    data: {
      reference: string;
      authorization_url: string;
      access_code: string;
    };
  };

  if (
    !data.status ||
    !data.data ||
    data.data.reference !== input.reference ||
    typeof data.data.access_code !== "string" ||
    !data.data.access_code ||
    typeof data.data.authorization_url !== "string"
  ) {
    throw new PaystackProviderError(
      "Paystack initialize returned invalid data.",
    );
  }
  let authorizationUrl: URL;
  try {
    authorizationUrl = new URL(data.data.authorization_url);
  } catch {
    throw new PaystackProviderError(
      "Paystack initialize returned an invalid authorization URL.",
    );
  }
  if (
    authorizationUrl.protocol !== "https:" ||
    authorizationUrl.hostname !== "checkout.paystack.com"
  ) {
    throw new PaystackProviderError(
      "Paystack initialize returned an invalid authorization URL.",
    );
  }

  return {
    reference: data.data.reference,
    authorizationUrl: authorizationUrl.toString(),
    accessCode: data.data.access_code,
  };
}

/**
 * Verify a Paystack transaction by reference.
 * This is the governed evidence source — the order becomes paid only when
 * this returns success with the correct amount.
 */
export async function verifyPaystackTransaction(
  reference: string,
): Promise<PaystackVerifyResult> {
  const key = paystackSecretKey();
  if (!key) throw new Error("Paystack is not configured.");

  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(PAYSTACK_REQUEST_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new PaystackProviderError(
      `Paystack verify failed: ${response.status} ${body.slice(0, 200)}`,
      response.status,
    );
  }

  const data = (await response.json()) as {
    status: boolean;
    data: {
      status: string;
      amount: number;
      currency: string;
      reference: string;
      gateway_response: string;
      paid_at: string | null;
      channel: string | null;
    };
  };

  if (!data.status || !data.data) {
    throw new PaystackProviderError("Paystack verify returned no data.");
  }

  if (
    typeof data.data.reference !== "string" ||
    data.data.reference.length < 1 ||
    data.data.reference.length > 200 ||
    typeof data.data.currency !== "string" ||
    data.data.currency.length < 1 ||
    data.data.currency.length > 10 ||
    typeof data.data.gateway_response !== "string" ||
    data.data.gateway_response.length > 500 ||
    (data.data.paid_at !== null &&
      (typeof data.data.paid_at !== "string" ||
        data.data.paid_at.length > 100)) ||
    (data.data.channel !== null &&
      (typeof data.data.channel !== "string" || data.data.channel.length > 80))
  ) {
    throw new PaystackProviderError(
      "Paystack verify returned malformed evidence.",
    );
  }

  const statuses = [
    "success",
    "failed",
    "abandoned",
    "pending",
    "ongoing",
    "processing",
    "queued",
    "reversed",
  ] as const;
  if (!statuses.includes(data.data.status as (typeof statuses)[number])) {
    throw new PaystackProviderError(
      "Paystack verify returned an invalid status.",
    );
  }

  return {
    status: data.data.status as PaystackVerifyResult["status"],
    amountKobo: normalizeKoboAmount(data.data.amount),
    currency: data.data.currency,
    reference: data.data.reference,
    gatewayResponse: data.data.gateway_response,
    paidAt: data.data.paid_at,
    channel: data.data.channel,
  };
}

/**
 * Verify a Paystack webhook signature.
 * Paystack signs webhooks with HMAC-SHA512 using the secret key.
 */
export function verifyPaystackWebhookSignature(
  payload: string,
  signature: string,
): boolean {
  const secret = paystackSecretKey();
  if (!secret) return false;
  try {
    if (!/^[a-f\d]{128}$/i.test(signature)) return false;
    const expected = createHmac("sha512", secret).update(payload).digest("hex");
    if (expected.length !== signature.length) return false;
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex"),
    );
  } catch {
    return false;
  }
}
