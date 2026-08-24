import { revalidatePath, revalidateTag } from "next/cache";
import { runDailyCampaign } from "@/lib/campaigns/daily-campaign-runner";
import { campaignDailyEnabled } from "@/lib/campaigns/campaign-recipient";
import { isAuthorizedCronRequest } from "@/modules/retail-intelligence/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 120;

function iteration(value: string | null) {
  if (value === null) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 99
    ? parsed
    : null;
}

function publicError(code: string, status: number) {
  return Response.json(
    { error: "Campaign run failed.", code },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request) {
  if (
    !isAuthorizedCronRequest(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return publicError("unauthorized", 401);
  }

  const url = new URL(request.url);
  const requestedMode = url.searchParams.get("mode");
  if (
    requestedMode !== null &&
    requestedMode !== "preview" &&
    requestedMode !== "test"
  ) {
    return publicError("invalid-mode", 400);
  }
  const runMode = requestedMode ?? "production";
  const runIteration =
    runMode === "production" ? 1 : iteration(url.searchParams.get("iteration"));
  if (runIteration === null) return publicError("invalid-iteration", 400);

  if (runMode === "production" && !campaignDailyEnabled()) {
    return Response.json(
      { status: "disabled", timeZone: "Africa/Lagos", localTime: "08:00" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await runDailyCampaign({
      mode: runMode,
      iteration: runIteration,
      requestOrigin: process.env.VERCEL_ENV
        ? "https://www.jelocare.com"
        : url.origin,
    });
    console.info(
      JSON.stringify({
        event: "daily_campaign_cron_completed",
        mode: runMode,
        status: result.status,
        campaignId: "campaignId" in result ? result.campaignId : null,
      }),
    );
    if (
      runMode === "production" &&
      (result.status === "accepted" || result.status === "duplicate-suppressed")
    ) {
      revalidatePath("/lagos");
      revalidateTag("catalogue", { expire: 0 });
    }
    return Response.json(result, {
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  } catch (cause) {
    const code =
      cause instanceof Error
        ? cause.message
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "-")
            .slice(0, 80)
        : "campaign-run-failed";
    console.error(
      JSON.stringify({
        event: "daily_campaign_cron_failed",
        mode: runMode,
        code,
      }),
    );
    return publicError(code || "campaign-run-failed", 500);
  }
}
