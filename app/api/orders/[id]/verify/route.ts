import { NextRequest, NextResponse } from "next/server";
import { sameSiteRequest } from "@/lib/community-intake/request-security";
import { requireOperator } from "@/lib/moderation/access";
import { getPostgresClient } from "@/lib/db/postgres";
import { verifyAssistedOrder } from "@/lib/commerce/order-verification-service";

export const runtime = "nodejs";

/**
 * Operator-triggered re-verification of an assisted order's lines.
 * Runs the full extraction chain (Woo cart API, HTTP, Playwright, AI Gateway)
 * for each line and stores fresh price, stock, and delivery data.
 *
 * This endpoint is operator-only: the caller must be an authenticated operator.
 * The customer cannot trigger verification.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameSiteRequest(request))
    return NextResponse.json(
      { error: "Request not allowed." },
      { status: 403 },
    );

  // Verify operator access using the same gate as the ops console.
  let operator;
  try {
    operator = await requireOperator(getPostgresClient());
  } catch {
    return NextResponse.json(
      { error: "Operator access required." },
      { status: 403 },
    );
  }

  const { id: orderId } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      orderId,
    )
  )
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });

  try {
    const summary = await verifyAssistedOrder(orderId);
    console.log(
      `Operator ${operator.id} triggered re-verification for order ${orderId}: ${summary.verifiedCount}/${summary.lineCount} verified.`,
    );
    return NextResponse.json(
      {
        orderId,
        lineCount: summary.lineCount,
        verifiedCount: summary.verifiedCount,
        failedCount: summary.failedCount,
        results: summary.results.map((r) => ({
          productSlug: r.productSlug,
          productName: r.productName,
          method: r.result.verificationMethod,
          confidence: r.result.verificationConfidence,
          unitPriceNgn: r.result.verifiedUnitPriceNgn,
          inventoryStatus: r.result.verifiedInventoryStatus,
          deliveryNgn: r.result.verifiedDeliveryNgn,
          totalNgn: r.result.verifiedTotalNgn,
          error: r.result.verificationError,
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "Operator-triggered order verification failed.",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "Verification failed. Check server logs." },
      { status: 500 },
    );
  }
}
