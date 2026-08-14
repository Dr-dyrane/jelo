import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getAuthSubject } from "@/lib/auth/subject";
import {
  hasTransactionalEmailConfig,
  sendAssistedOrderRecovery,
} from "@/lib/email/mailer";
import {
  readBoundedJson,
  sameSiteRequest,
} from "@/lib/community-intake/request-security";
import { createAssistedOrderSchema } from "@/lib/commerce/assisted-procurement-schema";
import {
  requestAssistedOrder,
  AssistedOrderInputError,
} from "@/lib/commerce/assisted-procurement-service";
import { deliverAssistedOrderOperatorAlerts } from "@/lib/commerce/order-operator-alert-repository";
import { verifyAssistedOrder } from "@/lib/commerce/order-verification-service";
import {
  allowAssistedOrderAction,
  assistedOrderCookieMaxAge,
  assistedOrderCookieName,
} from "@/lib/commerce/assisted-procurement-security";

export const runtime = "nodejs";

function publicOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  return configured && /^https?:\/\//.test(configured)
    ? configured
    : request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!sameSiteRequest(request))
    return NextResponse.json(
      { error: "Request not allowed." },
      { status: 403 },
    );
  if (!(await allowAssistedOrderAction(request, "create"))) {
    return NextResponse.json(
      { error: "Please wait before trying again." },
      { status: 429 },
    );
  }
  try {
    const input = createAssistedOrderSchema.parse(
      await readBoundedJson(request),
    );
    const identity = await getAuthSubject();
    const created = await requestAssistedOrder(
      input,
      identity?.subject ?? null,
    );
    await deliverAssistedOrderOperatorAlerts({
      orderId: created.order.id,
    }).catch((error) => {
      console.error(
        "Assisted order operator alert failed.",
        error instanceof Error ? error.message : "unknown",
      );
    });

    // Run automated verification in the background after the response is sent.
    // This fetches fresh price, stock, delivery, and full cost-breakdown data
    // for each line so operators see pre-filled verification data.
    after(async () => {
      try {
        const summary = await verifyAssistedOrder(created.order.id);
        console.log(
          `Order verification ${created.order.reference}: ${summary.verifiedCount}/${summary.lineCount} lines verified, ${summary.failedCount} need manual.`,
        );
        // When every line fails automated verification, re-alert operators
        // so the order doesn't sit silently in "requested" waiting for manual
        // intervention. The initial alert tells them a new order arrived;
        // this re-delivery signals that automated price/stock checks could
        // not confirm any line and manual quoting is required.
        if (summary.lineCount > 0 && summary.verifiedCount === 0) {
          console.warn(
            `Order ${created.order.reference}: all ${summary.lineCount} lines failed automated verification. Manual quoting required.`,
          );
          await deliverAssistedOrderOperatorAlerts({
            orderId: created.order.id,
          }).catch((error) => {
            console.error(
              "Operator re-alert for verification failure could not be delivered.",
              error instanceof Error ? error.message : "unknown",
            );
          });
        }
      } catch (error) {
        console.error(
          "Order verification failed.",
          error instanceof Error ? error.message : "unknown",
        );
      }
    });
    const recoveryUrl = new URL("/api/orders/recover", publicOrigin(request));
    recoveryUrl.searchParams.set("token", created.recoverySecret);

    let emailDelivery: "sent" | "unavailable" | "failed" = "unavailable";
    if (hasTransactionalEmailConfig()) {
      try {
        await sendAssistedOrderRecovery({
          to: input.contactEmail,
          name: input.contactName,
          reference: created.order.reference,
          statusLink: recoveryUrl.toString(),
        });
        emailDelivery = "sent";
      } catch (error) {
        console.error(
          "Assisted order recovery delivery failed.",
          error instanceof Error ? error.message : "unknown",
        );
        emailDelivery = "failed";
      }
    }

    const response = NextResponse.json(
      {
        reference: created.order.reference,
        state: created.order.state,
        statusUrl: "/order",
        emailDelivery,
      },
      { status: 201 },
    );
    response.headers.set("Cache-Control", "private, no-store");
    response.cookies.set({
      name: assistedOrderCookieName,
      value: created.sessionSecret,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: assistedOrderCookieMaxAge,
    });
    return response;
  } catch (error) {
    const message =
      error instanceof AssistedOrderInputError
        ? error.code === "stock"
          ? "One item is no longer listed in stock. Review your basket."
          : "That exact one-retailer basket is no longer available. Review your basket."
        : error instanceof Error && error.message === "payload_too_large"
          ? "That request is too large."
          : "Check the order details and try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
