import "server-only";

import { z } from "zod";
import { getPostgresClient, hasPostgresConfig } from "@/lib/db/postgres";

// Strict shape for a store-click event: enums and bounded ints only, so no free
// text or personal data can enter by construction (docs/ANALYTICS.md privacy
// boundary). productSlug and retailer are catalogue identifiers, not user input.
export const storeClickEventSchema = z
  .object({
    productSlug: z.string().min(1).max(160),
    retailer: z.string().min(1).max(160),
    market: z.enum(["NG", "US"]),
    priceNgn: z.number().min(0).max(100_000_000).nullable(),
    priceRank: z.enum(["lowest", "median", "higher", "only", "marketplace"]),
    position: z.number().int().min(1).max(200),
    freshnessDays: z.number().int().min(0).max(3_650).nullable(),
  })
  .strict();
export type StoreClickEvent = z.infer<typeof storeClickEventSchema>;

// Records a store click for aggregate analysis. No-ops without Neon and never
// throws into the caller: a measurement write must not affect the outbound
// redirect. Intended to run after the response via next/server `after`.
export async function recordStoreClick(event: StoreClickEvent): Promise<void> {
  if (!hasPostgresConfig()) return;
  const parsed = storeClickEventSchema.safeParse(event);
  if (!parsed.success) return;
  const {
    productSlug,
    retailer,
    market,
    priceNgn,
    priceRank,
    position,
    freshnessDays,
  } = parsed.data;
  try {
    const sql = getPostgresClient();
    await sql`
      insert into commerce_events (
        event_type, product_slug, retailer, market, price_ngn, price_rank, position, freshness_days
      ) values (
        'store_click', ${productSlug}, ${retailer}, ${market}, ${priceNgn}, ${priceRank}, ${position}, ${freshnessDays}
      )
    `;
  } catch {
    // Measurement is best-effort; a failed insert never surfaces to the shopper.
  }
}
