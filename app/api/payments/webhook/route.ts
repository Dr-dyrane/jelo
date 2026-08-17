import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyStripeWebhookSignature } from "@/lib/commerce/stripe-provider";
import { handleStripeWebhookEvent } from "@/lib/commerce/payment-service";

export const runtime = "nodejs";

const stripeWebhookSchema = z.object({
  type: z.string().max(120),
  data: z.object({
    object: z.object({
      metadata: z
        .object({ reference: z.string().trim().min(1).max(200) })
        .nullable()
        .optional(),
    }),
  }),
});

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  if (!verifyStripeWebhookSignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  try {
    const event = stripeWebhookSchema.parse(JSON.parse(payload));

    // Only handle checkout session completion events.
    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ received: true });
    }

    const reference = event.data.object.metadata?.reference;
    if (!reference) {
      return NextResponse.json({
        received: true,
        handled: false,
        reason: "No reference in session metadata.",
      });
    }

    const result = await handleStripeWebhookEvent({ reference });

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
