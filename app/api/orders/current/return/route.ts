import { NextRequest, NextResponse } from "next/server";
import { getAuthSubject } from "@/lib/auth/subject";
import {
  readBoundedJson,
  sameSiteRequest,
} from "@/lib/community-intake/request-security";
import { customerReturnRequestSchema } from "@/lib/commerce/assisted-procurement-schema";
import {
  readAssistedOrderBySession,
  readAssistedOrderForOwner,
  requestAssistedOrderReturn,
} from "@/lib/commerce/assisted-procurement-repository";
import {
  allowAssistedOrderAction,
  orderSessionHashFromRequest,
} from "@/lib/commerce/assisted-procurement-security";
import { deliverPendingAssistedOrderNotifications } from "@/lib/commerce/order-notification-repository";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameSiteRequest(request)) {
    return NextResponse.json(
      { error: "Request not allowed." },
      { status: 403 },
    );
  }
  if (!(await allowAssistedOrderAction(request, "return"))) {
    return NextResponse.json(
      { error: "Please try again shortly." },
      { status: 429 },
    );
  }

  try {
    const input = customerReturnRequestSchema.parse(
      await readBoundedJson(request),
    );
    const identity = await getAuthSubject();
    const sessionHash = orderSessionHashFromRequest(request) ?? undefined;
    const ownerOrder =
      identity && input.orderId
        ? await readAssistedOrderForOwner(input.orderId, identity.subject)
        : null;
    const guestOrder = sessionHash
      ? await readAssistedOrderBySession(sessionHash)
      : null;
    const current =
      ownerOrder ??
      (input.orderId && guestOrder?.id !== input.orderId ? null : guestOrder);
    if (!current) {
      return NextResponse.json(
        { error: "Order session not found." },
        { status: 404 },
      );
    }
    const order = await requestAssistedOrderReturn({
      orderId: current.id,
      revision: input.orderRevision,
      sessionHash: ownerOrder ? undefined : sessionHash,
      ownerSubject: ownerOrder ? identity?.subject : undefined,
      reason: input.reason,
    });
    if (!order) {
      return NextResponse.json(
        { error: "This order changed. Refresh before requesting a return." },
        { status: 409 },
      );
    }
    try {
      await deliverPendingAssistedOrderNotifications({
        orderId: order.id,
        limit: 5,
      });
    } catch {
      // The append-only return request remains canonical if email is offline.
    }
    const response = NextResponse.json({
      state: order.state,
      revision: order.revision,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return NextResponse.json(
      { error: "Explain the return request and try again." },
      { status: 400 },
    );
  }
}
