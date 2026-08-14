"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireConsoleOperator } from "@/lib/moderation/console-access";
import { assertCan } from "@/lib/moderation/capabilities";
import {
  submitAssistedOrderQuote,
  transitionAssistedOrderForOperator,
} from "@/lib/commerce/assisted-procurement-repository";
import { submitAssistedQuoteSchema } from "@/lib/commerce/assisted-procurement-schema";
import {
  deliverPendingAssistedOrderNotifications,
  retryAssistedOrderNotificationDelivery,
} from "@/lib/commerce/order-notification-repository";
import {
  deliverAssistedOrderOperatorAlerts,
  retryAssistedOrderOperatorAlerts,
} from "@/lib/commerce/order-operator-alert-repository";
import { verifyAssistedOrder } from "@/lib/commerce/order-verification-service";

export type OrderActionResult =
  | {
      ok: true;
      delivery: "sent" | "pending" | "failed" | "none";
    }
  | { ok: false; error: string };

const transitionSchema = z.object({
  orderId: z.uuid(),
  revision: z.number().int().positive(),
  transition: z.enum(["quoting", "cancelled"]),
  reason: z.string().trim().max(1000).optional().default(""),
});

const retryNotificationSchema = z.object({
  notificationId: z.uuid(),
  orderId: z.uuid(),
});

async function deliverOrderUpdate(
  orderId: string,
): Promise<OrderActionResult & { ok: true }> {
  try {
    const delivery = await deliverPendingAssistedOrderNotifications({
      orderId,
      limit: 5,
    });
    if (delivery.sent > 0) return { ok: true, delivery: "sent" };
    if (delivery.failed > 0) return { ok: true, delivery: "failed" };
    if (delivery.pending > 0 || delivery.unavailable)
      return { ok: true, delivery: "pending" };
    return { ok: true, delivery: "none" };
  } catch {
    // The append-only order event remains canonical even when its optional
    // delivery transport is temporarily unavailable. Ops can retry it.
    return { ok: true, delivery: "pending" };
  }
}

function refresh() {
  revalidatePath("/ops/orders");
  revalidatePath("/ops", "layout");
}

export async function transitionOrderAction(
  input: unknown,
): Promise<OrderActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, "orders.manage");
    const parsed = transitionSchema.parse(input);
    const order = await transitionAssistedOrderForOperator({
      orderId: parsed.orderId,
      revision: parsed.revision,
      operatorSubject: operator.authSubject,
      toState: parsed.transition,
      reason: parsed.reason || null,
    });
    if (!order)
      return { ok: false, error: "This order changed. Refresh before acting." };
    const result = await deliverOrderUpdate(order.id);
    refresh();
    return result;
  } catch {
    return { ok: false, error: "That order transition could not be saved." };
  }
}

export async function submitOrderQuoteAction(
  input: unknown,
): Promise<OrderActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, "orders.manage");
    const parsed = submitAssistedQuoteSchema.parse(input);
    const order = await submitAssistedOrderQuote({
      orderId: parsed.orderId,
      revision: parsed.revision,
      operatorSubject: operator.authSubject,
      components: {
        productSubtotalNgn: parsed.productSubtotalNgn,
        retailerFeeNgn: parsed.retailerFeeNgn,
        taxNgn: parsed.taxNgn,
        jelocareFeeNgn: parsed.jelocareFeeNgn,
        deliveryNgn: parsed.deliveryNgn,
      },
      evidenceReference: parsed.evidenceReference,
      notes: parsed.notes || null,
      expiresAt: parsed.expiresAt,
      serviceFeePolicyId: parsed.serviceFeePolicyId ?? null,
      serviceFeePolicyResolvedNgn: parsed.serviceFeePolicyResolvedNgn ?? null,
    });
    if (!order)
      return {
        ok: false,
        error: "This order changed. Refresh before quoting.",
      };
    const result = await deliverOrderUpdate(order.id);
    refresh();
    return result;
  } catch {
    return {
      ok: false,
      error: "Complete every quote component and use a future expiry.",
    };
  }
}

export async function retryOrderNotificationAction(
  input: unknown,
): Promise<OrderActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, "orders.manage");
    const parsed = retryNotificationSchema.parse(input);
    const admitted = await retryAssistedOrderNotificationDelivery({
      notificationId: parsed.notificationId,
      orderId: parsed.orderId,
    });
    if (!admitted)
      return { ok: false, error: "This delivery is no longer retryable." };
    const result = await deliverOrderUpdate(parsed.orderId);
    refresh();
    return result;
  } catch {
    return {
      ok: false,
      error: "The notification retry could not be completed.",
    };
  }
}

export async function retryOrderOperatorAlertAction(
  input: unknown,
): Promise<OrderActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, "orders.manage");
    const parsed = z.object({ orderId: z.uuid() }).parse(input);
    const admitted = await retryAssistedOrderOperatorAlerts(parsed.orderId);
    if (!admitted)
      return { ok: false, error: "No failed team alert is ready to retry." };
    const delivery = await deliverAssistedOrderOperatorAlerts({
      orderId: parsed.orderId,
    });
    refresh();
    if (delivery.sent > 0) return { ok: true, delivery: "sent" };
    if (delivery.failed > 0 || delivery.unavailable)
      return { ok: true, delivery: "failed" };
    return { ok: true, delivery: "pending" };
  } catch {
    return { ok: false, error: "The team alert retry could not be completed." };
  }
}

export async function reverifyOrderAction(
  input: unknown,
): Promise<OrderActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, "orders.manage");
    const parsed = z.object({ orderId: z.uuid() }).parse(input);
    await verifyAssistedOrder(parsed.orderId);
    refresh();
    return { ok: true, delivery: "none" };
  } catch {
    return {
      ok: false,
      error:
        "Automated verification could not be completed. Check server logs.",
    };
  }
}
