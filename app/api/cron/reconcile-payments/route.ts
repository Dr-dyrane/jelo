import { reconcileStaleStripePayments } from "@/lib/commerce/payment-service";
import { isAuthorizedCronRequest } from "@/modules/retail-intelligence/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  if (
    !isAuthorizedCronRequest(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await reconcileStaleStripePayments();

  console.info(
    JSON.stringify({
      event: "payment_reconciliation_cron_completed",
      ...summary,
    }),
  );

  return Response.json(summary, {
    status: summary.retryableErrors > 0 ? 503 : 200,
  });
}
