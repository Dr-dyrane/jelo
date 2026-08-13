'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { assertCan } from '@/lib/moderation/capabilities';
import {
  submitAssistedOrderQuote,
  transitionAssistedOrderForOperator,
} from '@/lib/commerce/assisted-procurement-repository';
import { submitAssistedQuoteSchema } from '@/lib/commerce/assisted-procurement-schema';

export type OrderActionResult = { ok: true } | { ok: false; error: string };

const transitionSchema = z.object({
  orderId: z.uuid(),
  revision: z.number().int().positive(),
  transition: z.enum(['quoting', 'cancelled']),
  reason: z.string().trim().max(1000).optional().default(''),
});

function refresh() {
  revalidatePath('/ops/orders');
  revalidatePath('/ops', 'layout');
}

export async function transitionOrderAction(input: unknown): Promise<OrderActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'orders.manage');
    const parsed = transitionSchema.parse(input);
    const order = await transitionAssistedOrderForOperator({
      orderId: parsed.orderId,
      revision: parsed.revision,
      operatorSubject: operator.authSubject,
      toState: parsed.transition,
      reason: parsed.reason || null,
    });
    if (!order) return { ok: false, error: 'This order changed. Refresh before acting.' };
    refresh();
    return { ok: true };
  } catch {
    return { ok: false, error: 'That order transition could not be saved.' };
  }
}

export async function submitOrderQuoteAction(input: unknown): Promise<OrderActionResult> {
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, 'orders.manage');
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
    });
    if (!order) return { ok: false, error: 'This order changed. Refresh before quoting.' };
    refresh();
    return { ok: true };
  } catch {
    return { ok: false, error: 'Complete every quote component and use a future expiry.' };
  }
}
