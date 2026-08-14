"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireConsoleOperator } from "@/lib/moderation/console-access";
import { assertCan } from "@/lib/moderation/capabilities";
import {
  advanceAssistedOrderLifecycleForOperator,
  submitAssistedOrderQuote,
  transitionAssistedOrderForOperator,
  verifyAssistedOrderPaymentDevelopmentFixture,
} from "@/lib/commerce/assisted-procurement-repository";
import { assistedOrderFixtureEnabled } from "@/lib/commerce/assisted-procurement-security";
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
import { normalizeNgnAmount } from "@/lib/commerce/payment-money";

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
  revalidatePath("/order");
  revalidatePath("/me/orders");
}

export async function transitionOrderAction(
  input: unknown,
): Promise<OrderActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, "orders.manage");
    const parsed = transitionSchema.parse(input);
    if (parsed.transition === "cancelled" && parsed.reason.trim().length < 4) {
      return { ok: false, error: "Record why this order must be cancelled." };
    }
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

const manualPaymentSchema = z.object({
  orderId: z.uuid(),
  receivedAmountNgn: z
    .union([z.string().trim().min(1), z.number()])
    .transform((value) => normalizeNgnAmount(value)),
  evidenceReference: z.string().trim().min(8).max(1000),
  providerReference: z.string().trim().min(6).max(200),
});

export type ManualPaymentResult =
  | { ok: true; delivery: "sent" | "pending" | "failed" | "none" }
  | { ok: false; error: string };

export async function verifyManualPaymentAction(
  input: unknown,
): Promise<ManualPaymentResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, "orders.manage");
    const parsed = manualPaymentSchema.parse(input);
    if (assistedOrderFixtureEnabled()) {
      const order = verifyAssistedOrderPaymentDevelopmentFixture({
        orderId: parsed.orderId,
        operatorSubject: operator.authSubject,
        evidenceReference: parsed.evidenceReference,
        providerReference: parsed.providerReference,
        receivedAmountNgn: parsed.receivedAmountNgn,
      });
      if (!order) {
        return {
          ok: false,
          error: "The fixture evidence must match the exact approved total.",
        };
      }
      const delivery = await deliverOrderUpdate(order.id);
      refresh();
      return delivery;
    }
    const { manuallyVerifyPayment } =
      await import("@/lib/commerce/payment-service");
    const result = await manuallyVerifyPayment({
      orderId: parsed.orderId,
      operatorSubject: operator.authSubject,
      evidenceReference: parsed.evidenceReference,
      providerReference: parsed.providerReference,
      receivedAmountNgn: parsed.receivedAmountNgn,
    });
    if (!result.ok) return { ok: false, error: result.error };
    refresh();
    return { ok: true, delivery: "none" };
  } catch {
    return {
      ok: false,
      error:
        "Could not verify the manual payment. Check the evidence and amount.",
    };
  }
}

const lifecycleActionSchema = z
  .object({
    orderId: z.uuid(),
    revision: z.number().int().positive(),
    action: z.enum([
      "start_procurement",
      "confirm_retailer",
      "record_dispatch",
      "record_delivery",
      "approve_return",
      "decline_return",
      "complete_refund",
      "cancel_and_refund",
    ]),
    reason: z.string().trim().max(1000).optional().default(""),
    evidenceReference: z.string().trim().min(8).max(1000),
    retailerOrderReference: z.string().trim().min(4).max(200).optional(),
    carrier: z.string().trim().min(2).max(120).optional(),
    trackingReference: z.string().trim().min(3).max(200).optional(),
    trackingUrl: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((value) => value || undefined)
      .refine(
        (value) => !value || /^https:\/\//.test(value),
        "Tracking links must use HTTPS.",
      ),
    refundReference: z.string().trim().min(6).max(200).optional(),
  })
  .superRefine((value, context) => {
    const require = (field: keyof typeof value, message: string) => {
      if (!value[field]) {
        context.addIssue({
          code: "custom",
          path: [field],
          message,
        });
      }
    };
    if (value.action === "confirm_retailer") {
      require("retailerOrderReference", "Enter the retailer order reference.");
    }
    if (value.action === "record_dispatch") {
      require("carrier", "Enter the carrier or retailer delivery service.");
      require("trackingReference", "Enter the tracking reference.");
    }
    if (
      value.action === "approve_return" ||
      value.action === "decline_return" ||
      value.action === "cancel_and_refund"
    ) {
      require("reason", "Record the decision reason.");
    }
    if (value.action === "complete_refund") {
      require("refundReference", "Enter the completed refund reference.");
    }
  });

export async function advanceOrderLifecycleAction(
  input: unknown,
): Promise<OrderActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, "orders.manage");
    const parsed = lifecycleActionSchema.parse(input);
    const order = await advanceAssistedOrderLifecycleForOperator({
      orderId: parsed.orderId,
      revision: parsed.revision,
      operatorSubject: operator.authSubject,
      action: parsed.action,
      reason: parsed.reason || null,
      evidenceReference: parsed.evidenceReference,
      retailerOrderReference: parsed.retailerOrderReference,
      carrier: parsed.carrier,
      trackingReference: parsed.trackingReference,
      trackingUrl: parsed.trackingUrl ?? null,
      refundReference: parsed.refundReference,
    });
    if (!order) {
      return {
        ok: false,
        error: "This order changed or the required evidence is incomplete.",
      };
    }
    const delivery = await deliverOrderUpdate(order.id);
    refresh();
    return delivery;
  } catch {
    return {
      ok: false,
      error: "Complete the current evidence step and try again.",
    };
  }
}
