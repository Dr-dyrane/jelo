import { NextRequest, NextResponse } from "next/server";
import { verifyPaystackWebhookSignature } from "@/lib/commerce/payment-provider";
import { handlePaystackWebhookEvent } from "@/lib/commerce/payment-service";

export const runtime = "nodejs";

type PaystackWebhookEvent = {
  event: string;
  data: {
    reference: string;
    status: string;
    amount: number;
    currency: string;
    paid_at: string | null;
    gateway_response: string;
  };
};

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";

  if (!verifyPaystackWebhookSignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  try {
    const event = JSON.parse(payload) as PaystackWebhookEvent;

    // Only handle charge success events.
    if (event.event !== "charge.success") {
      return NextResponse.json({ received: true });
    }

    if (!event.data?.reference) {
      return NextResponse.json({ error: "No reference." }, { status: 400 });
    }

    const result = await handlePaystackWebhookEvent({
      reference: event.data.reference,
    });

    // Always return 200 to Paystack so it doesn't retry.
    return NextResponse.json({
      received: true,
      handled: result.handled,
      reason: result.reason,
    });
  } catch {
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }
}
