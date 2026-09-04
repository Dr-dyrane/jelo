import { revalidatePath } from "next/cache";
import {
  dailyDeskReconciliationEnabled,
  reconcileDailyDesk,
} from "@/lib/campaigns/daily-desk-reconciliation";
import { isAuthorizedCronRequest } from "@/modules/retail-intelligence/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 120;

function errorResponse(code: string, status: number) {
  return Response.json(
    { error: "Daily Desk reconciliation failed.", code },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function safeFailureCode(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "";
  const code = message.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 80);
  return code || "daily-desk-reconciliation-failed";
}

export async function GET(request: Request) {
  if (
    !isAuthorizedCronRequest(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return errorResponse("unauthorized", 401);
  }

  if (!dailyDeskReconciliationEnabled()) {
    return Response.json(
      { status: "disabled", timeZone: "Africa/Lagos" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = new URL(request.url);
  try {
    const result = await reconcileDailyDesk({
      requestOrigin: process.env.VERCEL_ENV
        ? "https://www.jelocare.com"
        : url.origin,
    });
    console.info(
      JSON.stringify({
        event: "daily_desk_reconciliation_completed",
        status: result.status,
        date: result.date,
        campaignId: "campaignId" in result ? result.campaignId : null,
      }),
    );
    if (result.status === "accepted" || result.status === "already-accepted") {
      revalidatePath("/lagos");
    }
    return Response.json(result, {
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  } catch (cause) {
    const code = safeFailureCode(cause);
    console.error(
      JSON.stringify({ event: "daily_desk_reconciliation_failed", code }),
    );
    return errorResponse(code, 500);
  }
}
