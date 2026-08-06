import 'server-only';

import { z } from 'zod';
import { getPostgresClient, hasPostgresConfig } from '@/lib/db/postgres';

// Handoff interaction events for the trust bridge. Same privacy boundary as
// store_click: productSlug and retailer are catalogue identifiers, not user
// input. No free text, no personal data (docs/ANALYTICS.md).
export const handoffEventSchema = z.object({
  productSlug: z.string().min(1).max(160),
  retailer: z.string().min(1).max(160),
  market: z.enum(['NG', 'US']),
  interaction: z.enum(['viewed', 'continue', 'alternative', 'cancelled']),
}).strict();
export type HandoffEvent = z.infer<typeof handoffEventSchema>;

// Records a trust-bridge interaction for aggregate analysis. No-ops without
// Neon and never throws into the caller: a measurement write must not affect
// navigation. Intended to run after the response via next/server `after`.
export async function recordHandoffEvent(event: HandoffEvent): Promise<void> {
  if (!hasPostgresConfig()) return;
  const parsed = handoffEventSchema.safeParse(event);
  if (!parsed.success) return;
  const { productSlug, retailer, market, interaction } = parsed.data;
  try {
    const sql = getPostgresClient();
    await sql`
      insert into commerce_events (
        event_type, product_slug, retailer, market
      ) values (
        ${`handoff_${interaction}`}, ${productSlug}, ${retailer}, ${market}
      )
    `;
  } catch {
    // Measurement is best-effort; a failed insert never surfaces to the shopper.
  }
}
