import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

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

export type PaystackVerifyResult = {
  status: "success" | "failed" | "abandoned" | "pending";
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
  orderReference: string;
  customerEmail: string;
  customerName: string | null;
  callbackUrl: string;
}): Promise<PaystackInitResult> {
  const key = paystackSecretKey();
  if (!key) throw new Error("Paystack is not configured.");

  const reference = `JC-${input.orderReference.replace(/^JC-/, "")}-${Date.now()}`;
  const amountKobo = Math.round(input.amountNgn * 100);

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
      reference,
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
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Paystack initialize failed: ${response.status} ${body.slice(0, 200)}`,
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

  if (!data.status || !data.data) {
    throw new Error("Paystack initialize returned no data.");
  }

  return {
    reference: data.data.reference,
    authorizationUrl: data.data.authorization_url,
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
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Paystack verify failed: ${response.status} ${body.slice(0, 200)}`,
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
    throw new Error("Paystack verify returned no data.");
  }

  return {
    status: data.data.status as PaystackVerifyResult["status"],
    amountKobo: data.data.amount,
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
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
  if (!secret) return false;
  try {
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
