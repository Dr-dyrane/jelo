import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSubject } from "@/lib/auth/subject";
import {
  readBoundedJson,
  sameSiteRequest,
} from "@/lib/community-intake/request-security";
import {
  allowAssistedOrderAction,
  orderSessionHashFromRequest,
} from "@/lib/commerce/assisted-procurement-security";
import { resolvePaymentOrderAccess } from "@/lib/commerce/payment-order-access";
import {
  initiatePaystackPayment,
  PaymentInitializationPendingError,
} from "@/lib/commerce/payment-service";
import {
  isPaystackConfigured,
  PaystackProviderError,
} from "@/lib/commerce/payment-provider";

export const runtime = "nodejs";

const paymentRequestSchema = z.object({ orderId: z.uuid().optional() });

function publicOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  return configured && /^https?:\/\//.test(configured)
    ? configured
    : request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!sameSiteRequest(request)) {
    return NextResponse.json(
      { error: "Request not allowed." },
      { status: 403 },
    );
  }
  if (!(await allowAssistedOrderAction(request, "payment"))) {
    return NextResponse.json(
      { error: "Please try again shortly." },
      { status: 429 },
    );
  }
  if (!isPaystackConfigured()) {
    return NextResponse.json(
      {
        error:
          "Online payment is not available yet. Please contact JeloCare for bank transfer details.",
      },
      { status: 503 },
    );
  }

  let input: z.infer<typeof paymentRequestSchema>;
  try {
    input = paymentRequestSchema.parse(await readBoundedJson(request));
  } catch {
    return NextResponse.json(
      { error: "Check the payment request." },
      { status: 400 },
    );
  }

  const identity = await getAuthSubject();
  const access = await resolvePaymentOrderAccess({
    ownerSubject: identity?.subject ?? null,
    requestedOrderId: input.orderId ?? null,
    sessionHash: orderSessionHashFromRequest(request),
  });
  if (!access) {
    return NextResponse.json(
      { error: "Order session not found." },
      { status: 404 },
    );
  }

  try {
    const callback = new URL(
      access.surface === "member" ? "/me/orders" : "/order",
      publicOrigin(request),
    );
    callback.searchParams.set("payment", "return");
    const result = await initiatePaystackPayment({
      orderId: access.order.id,
      callbackUrl: callback.toString(),
    });
    const response = NextResponse.json({
      authorizationUrl: result.authorizationUrl,
      reference: result.payment.providerReference,
      alreadyPaid: result.alreadyPaid,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof PaymentInitializationPendingError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof PaystackProviderError) {
      return NextResponse.json(
        {
          error:
            "Paystack could not start this payment. Please try again shortly.",
        },
        { status: 502 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Payment initiation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
