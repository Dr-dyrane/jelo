import { NextRequest, NextResponse } from "next/server";
import { getAuthSubject } from "@/lib/auth/subject";
import { sameSiteRequest } from "@/lib/community-intake/request-security";
import {
  allowAssistedOrderAction,
  orderSessionHashFromRequest,
} from "@/lib/commerce/assisted-procurement-security";
import {
  readAssistedOrderBySession,
  readAssistedOrderForOwner,
} from "@/lib/commerce/assisted-procurement-repository";
import { initiatePaystackPayment } from "@/lib/commerce/payment-service";
import { isPaystackConfigured } from "@/lib/commerce/payment-provider";

export const runtime = "nodejs";

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
  if (!(await allowAssistedOrderAction(request, "decide"))) {
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

  const identity = await getAuthSubject();
  const sessionHash = orderSessionHashFromRequest(request);

  // Find the order by session or owner identity.
  let orderId: string | null = null;
  if (identity?.subject) {
    // For signed-in users, we need to find their current order.
    // The session-based lookup is the primary path; owner-based is secondary.
    const sessionOrder = sessionHash
      ? await readAssistedOrderBySession(sessionHash)
      : null;
    if (sessionOrder) {
      orderId = sessionOrder.id;
    } else {
      // Try to read by owner — but we need the order ID. The /api/orders/current
      // endpoint already handles this. For payment initiation, the client
      // passes the orderId.
      const body = await request.json().catch(() => ({}));
      if (body.orderId && typeof body.orderId === "string") {
        const ownerOrder = await readAssistedOrderForOwner(
          body.orderId,
          identity.subject,
        );
        if (ownerOrder) orderId = ownerOrder.id;
      }
    }
  } else if (sessionHash) {
    const sessionOrder = await readAssistedOrderBySession(sessionHash);
    if (sessionOrder) orderId = sessionOrder.id;
  }

  if (!orderId) {
    return NextResponse.json(
      { error: "Order session not found." },
      { status: 404 },
    );
  }

  try {
    const callbackUrl = `${publicOrigin(request)}/order`;
    const result = await initiatePaystackPayment({
      orderId,
      callbackUrl,
    });
    const response = NextResponse.json({
      authorizationUrl: result.authorizationUrl,
      reference: result.payment.providerReference,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Payment initiation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
