import "server-only";

import { getPostgresClient } from "@/lib/db/postgres";
import {
  verifyOrderLine,
  type OrderLineVerificationResult,
} from "./order-verification-extraction";

export type OrderVerificationSummary = {
  orderId: string;
  lineCount: number;
  verifiedCount: number;
  failedCount: number;
  results: Array<{
    lineId: string;
    productSlug: string;
    productName: string;
    result: OrderLineVerificationResult;
  }>;
};

type OrderLineForVerification = {
  id: string;
  product_slug: string;
  product_name: string;
  product_size: string;
  quantity: number;
  observed_listing_url: string;
};

type OrderForVerification = {
  id: string;
  delivery_city: string;
  delivery_state: string;
};

/**
 * Runs automated verification for every line in an assisted order.
 * For each line, the extraction chain tries (in order):
 *   1. Woo Cart API (full cost breakdown for Woo stores)
 *   2. Woo Store API (price/stock only for Woo stores)
 *   3. HTTP fetch + structured extraction + AI cart extraction
 *   4. Playwright browser fetch + AI extraction (for blocked sites)
 *   5. Manual fallback (marks the line as needing manual verification)
 *
 * Results are stored in assisted_order_line_verifications. The latest
 * verification per line (is_latest = true) is what the operator sees.
 */
export async function verifyAssistedOrder(
  orderId: string,
): Promise<OrderVerificationSummary> {
  const sql = getPostgresClient();

  // Fetch the order and its lines.
  const [orderRows] = await sql<OrderForVerification[]>`
    select id, delivery_city, delivery_state
    from assisted_orders
    where id = ${orderId}::uuid and retain_until > now()
  `;
  if (!orderRows) {
    return {
      orderId,
      lineCount: 0,
      verifiedCount: 0,
      failedCount: 0,
      results: [],
    };
  }

  const lines = await sql<OrderLineForVerification[]>`
    select id, product_slug, product_name, product_size, quantity, observed_listing_url
    from assisted_order_lines
    where order_id = ${orderId}::uuid
    order by created_at, id
  `;

  if (lines.length === 0) {
    return {
      orderId,
      lineCount: 0,
      verifiedCount: 0,
      failedCount: 0,
      results: [],
    };
  }

  // Run verification for each line sequentially to avoid rate-limiting
  // the retailer APIs. Each line takes up to ~12s, so a 4-line order
  // takes up to ~48s. This runs in the background after the customer's
  // order response is sent, so it does not block the customer.
  const results: OrderVerificationSummary["results"] = [];

  for (const line of lines) {
    const result = await verifyOrderLine({
      listingUrl: line.observed_listing_url,
      productName: line.product_name,
      productSize: line.product_size,
      quantity: line.quantity,
      deliveryCity: orderRows.delivery_city,
      deliveryState: orderRows.delivery_state,
    });

    results.push({
      lineId: line.id,
      productSlug: line.product_slug,
      productName: line.product_name,
      result,
    });

    // Persist the verification result.
    await persistVerification({
      sql,
      orderLineId: line.id,
      orderId,
      result,
    });
  }

  const verifiedCount = results.filter(
    (r) => r.result.verifiedUnitPriceNgn != null,
  ).length;
  const failedCount = results.length - verifiedCount;

  return {
    orderId,
    lineCount: lines.length,
    verifiedCount,
    failedCount,
    results,
  };
}

async function persistVerification(input: {
  sql: ReturnType<typeof getPostgresClient>;
  orderLineId: string;
  orderId: string;
  result: OrderLineVerificationResult;
}) {
  const { sql, orderLineId, orderId, result } = input;

  // Mark previous verifications for this line as not latest.
  await sql`
    update assisted_order_line_verifications
    set is_latest = false
    where order_line_id = ${orderLineId}::uuid and is_latest = true
  `;

  // Determine the next attempt number.
  const [attemptRow] = await sql<{ max_attempt: number }[]>`
    select coalesce(max(attempt), 0) as max_attempt
    from assisted_order_line_verifications
    where order_line_id = ${orderLineId}::uuid
  `;
  const attempt = (attemptRow?.max_attempt ?? 0) + 1;

  // Insert the new verification.
  await sql`
    insert into assisted_order_line_verifications (
      order_line_id, order_id, attempt, is_latest,
      verified_unit_price_ngn, verified_inventory_status, verified_currency_code,
      verified_product_subtotal_ngn, verified_delivery_ngn, verified_tax_ngn,
      verified_retailer_fee_ngn, verified_total_ngn,
      verification_method, verification_confidence, verification_evidence,
      verification_delivery_note, verification_error
    ) values (
      ${orderLineId}::uuid, ${orderId}::uuid, ${attempt}, true,
      ${result.verifiedUnitPriceNgn}, ${result.verifiedInventoryStatus}, 'NGN',
      ${result.verifiedProductSubtotalNgn}, ${result.verifiedDeliveryNgn},
      ${result.verifiedTaxNgn}, ${result.verifiedRetailerFeeNgn},
      ${result.verifiedTotalNgn},
      ${result.verificationMethod}, ${result.verificationConfidence},
      ${sql.json(result.verificationEvidence)},
      ${result.verificationDeliveryNote}, ${result.verificationError}
    )
  `;
}

/**
 * Reads the latest verification data for all lines in an order.
 * Returns a map of line ID -> verification result.
 */
export async function readOrderLineVerifications(orderId: string): Promise<
  Array<{
    orderLineId: string;
    productSlug: string;
    verifiedUnitPriceNgn: number | null;
    verifiedInventoryStatus: string | null;
    verifiedProductSubtotalNgn: number | null;
    verifiedDeliveryNgn: number | null;
    verifiedTaxNgn: number | null;
    verifiedRetailerFeeNgn: number | null;
    verifiedTotalNgn: number | null;
    verificationMethod: string;
    verificationConfidence: number;
    verificationDeliveryNote: string | null;
    verificationError: string | null;
    verifiedAt: string;
  }>
> {
  const sql = getPostgresClient();
  return sql`
    select
      v.order_line_id,
      l.product_slug,
      v.verified_unit_price_ngn,
      v.verified_inventory_status,
      v.verified_product_subtotal_ngn,
      v.verified_delivery_ngn,
      v.verified_tax_ngn,
      v.verified_retailer_fee_ngn,
      v.verified_total_ngn,
      v.verification_method,
      v.verification_confidence,
      v.verification_delivery_note,
      v.verification_error,
      v.verified_at::text as verified_at
    from assisted_order_line_verifications v
    join assisted_order_lines l on l.id = v.order_line_id
    where v.order_id = ${orderId}::uuid and v.is_latest = true
    order by l.created_at, l.id
  `;
}
