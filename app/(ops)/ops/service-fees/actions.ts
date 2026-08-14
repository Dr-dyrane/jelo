"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireConsoleOperator } from "@/lib/moderation/console-access";
import { assertCan } from "@/lib/moderation/capabilities";
import {
  createServiceFeePolicy,
  updateServiceFeePolicy,
  type ServiceFeeModel,
} from "@/lib/commerce/service-fee-policy";

export type ServiceFeePolicyResult =
  { ok: true } | { ok: false; error: string };

const feeModelEnum = z.enum(["flat", "percentage", "pct_with_cap"]);

const policySchema = z.object({
  name: z.string().trim().min(1).max(120),
  retailerSlug: z.string().trim().max(120).nullable().optional(),
  deliveryState: z.string().trim().max(60).nullable().optional(),
  feeModel: feeModelEnum,
  flatFeeNgn: z.number().int().min(0).nullable().optional(),
  percentageRate: z.number().min(0).max(100).nullable().optional(),
  minFeeNgn: z.number().int().min(0).nullable().optional(),
  maxFeeNgn: z.number().int().min(0).nullable().optional(),
  priority: z.number().int().min(0).max(1000).default(0),
  notes: z.string().trim().max(1000).nullable().optional(),
});

const createSchema = policySchema;
const updateSchema = policySchema.extend({
  id: z.uuid(),
  isActive: z.boolean().default(true),
});

function refresh() {
  revalidatePath("/ops/service-fees");
  revalidatePath("/ops/orders");
  revalidatePath("/ops", "layout");
}

export async function createServiceFeePolicyAction(
  input: unknown,
): Promise<ServiceFeePolicyResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, "orders.manage");
    const parsed = createSchema.parse(input);
    await createServiceFeePolicy({
      name: parsed.name,
      retailerSlug: parsed.retailerSlug ?? null,
      deliveryState: parsed.deliveryState ?? null,
      feeModel: parsed.feeModel as ServiceFeeModel,
      flatFeeNgn: parsed.flatFeeNgn ?? null,
      percentageRate: parsed.percentageRate ?? null,
      minFeeNgn: parsed.minFeeNgn ?? null,
      maxFeeNgn: parsed.maxFeeNgn ?? null,
      priority: parsed.priority,
      notes: parsed.notes ?? null,
    });
    refresh();
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Could not create the fee policy. Check the model and values.",
    };
  }
}

export async function updateServiceFeePolicyAction(
  input: unknown,
): Promise<ServiceFeePolicyResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, "orders.manage");
    const parsed = updateSchema.parse(input);
    const updated = await updateServiceFeePolicy({
      id: parsed.id,
      name: parsed.name,
      retailerSlug: parsed.retailerSlug ?? null,
      deliveryState: parsed.deliveryState ?? null,
      feeModel: parsed.feeModel as ServiceFeeModel,
      flatFeeNgn: parsed.flatFeeNgn ?? null,
      percentageRate: parsed.percentageRate ?? null,
      minFeeNgn: parsed.minFeeNgn ?? null,
      maxFeeNgn: parsed.maxFeeNgn ?? null,
      priority: parsed.priority,
      isActive: parsed.isActive,
      notes: parsed.notes ?? null,
    });
    if (!updated) return { ok: false, error: "Policy not found." };
    refresh();
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Could not update the fee policy. Check the model and values.",
    };
  }
}
