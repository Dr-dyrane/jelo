import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyPaystackWebhookSignature } from "@/lib/commerce/payment-provider";
import { handlePaystackWebhookEvent } from "@/lib/commerce/payment-service";

export const runtime = "nodejs";

const paystackWebhookSchema = z.object({
  event: z.string().max(120),
  data: z.object({ reference: z.string().trim().min(1).max(200) }),
});

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";

  if (!verifyPaystackWebhookSignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  try {
    const event = paystackWebhookSchema.parse(JSON.parse(payload));

    // Only handle charge success events.
    if (event.event !== "charge.success") {
      return NextResponse.json({ received: true });
    }

    const result = await handlePaystackWebhookEvent({
      reference: event.data.reference,
    });

    if (!result.handled) {
      if (!result.retryable) {
        return NextResponse.json({
          received: true,
          handled: false,
          reason: result.reason,
        });
      }
      return NextResponse.json(
        { received: false, handled: false, reason: result.reason },
        { status: 503 },
      );
    }
    return NextResponse.json({ received: true, handled: true });
  } catch {
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }
}
