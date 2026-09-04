import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  dailyDeskReconciliationEnabled,
  reconcileDailyDesk,
} from "@/lib/campaigns/daily-desk-reconciliation";
import { isAuthorizedCronRequest } from "@/modules/retail-intelligence/cron-auth";
import {
  recordScheduledOwnerCompleted,
  recordScheduledOwnerFailed,
  recordScheduledOwnerStarted,
} from "@/lib/market-truth/scheduled-owner-receipts";
import type { ScheduledOwnerOutcomeCode } from "@/lib/market-truth/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function errorResponse(code: string, status: number) {
  return Response.json(
    { error: "Daily Desk reconciliation failed.", code },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function safeFailureCode(cause: unknown) {
  const fingerprint =
    cause instanceof Error
      ? `${cause.name}:${cause.message}`
      : `UnknownError:${String(cause)}`;
  const digest = createHash("sha256")
    .update(fingerprint, "utf8")
    .digest("hex")
    .slice(0, 12);
  return `daily-desk-reconciliation-failed-${digest}`;
}

async function recordDeskStarted(startedAt: string) {
  try {
    await recordScheduledOwnerStarted({
      owner: "daily-desk-reconcile",
      startedAt,
    });
    return true;
  } catch {
    console.error(
      JSON.stringify({
        event: "market_truth_receipt_write_failed",
        owner: "daily-desk-reconcile",
        phase: "started",
      }),
    );
    return false;
  }
}

async function recordDeskCompleted(input: {
  startedAt: string;
  receiptStarted: boolean;
  outcomeCode: ScheduledOwnerOutcomeCode;
  counts: Record<string, number>;
}) {
  if (!input.receiptStarted) return false;
  try {
    await recordScheduledOwnerCompleted({
      owner: "daily-desk-reconcile",
      startedAt: input.startedAt,
      completedAt: new Date().toISOString(),
      outcomeCode: input.outcomeCode,
      counts: input.counts,
    });
    return true;
  } catch {
    console.error(
      JSON.stringify({
        event: "market_truth_receipt_write_failed",
        owner: "daily-desk-reconcile",
        phase: "completed",
      }),
    );
    return false;
  }
}

async function recordDeskFailed(startedAt: string, receiptStarted: boolean) {
  if (!receiptStarted) return false;
  try {
    await recordScheduledOwnerFailed({
      owner: "daily-desk-reconcile",
      startedAt,
      failedAt: new Date().toISOString(),
      outcomeCode: "reconciliation-failed",
    });
    return true;
  } catch {
    console.error(
      JSON.stringify({
        event: "market_truth_receipt_write_failed",
        owner: "daily-desk-reconcile",
        phase: "failed",
      }),
    );
    return false;
  }
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

  const startedAt = new Date().toISOString();
  const receiptStarted = await recordDeskStarted(startedAt);
  if (!receiptStarted) {
    return errorResponse("market-truth-receipt-start-failed", 503);
  }
  if (!dailyDeskReconciliationEnabled()) {
    const receiptRecorded = await recordDeskCompleted({
      startedAt,
      receiptStarted,
      outcomeCode: "disabled",
      counts: { accepted: 0 },
    });
    return Response.json(
      {
        status: "disabled",
        timeZone: "Africa/Lagos",
        receipt: { recorded: receiptRecorded, outcomeCode: "disabled" },
      },
      {
        status: receiptRecorded ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      },
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
    if (
      result.status === "accepted" ||
      result.status === "already-accepted" ||
      result.status === "accepted-evidence-invalid"
    ) {
      revalidatePath("/lagos");
    }
    const outcomeCode: ScheduledOwnerOutcomeCode =
      result.status === "accepted"
        ? "accepted"
        : result.status === "already-accepted"
          ? "already-current"
          : result.status === "accepted-evidence-invalid"
            ? "completed-with-exceptions"
            : "no-current-candidate";
    const receiptRecorded = await recordDeskCompleted({
      startedAt,
      receiptStarted,
      outcomeCode,
      counts:
        result.status === "no-candidate"
          ? {
              accepted: 0,
              rejectedCandidates: result.rejectedCandidateCount,
            }
          : result.status === "accepted-evidence-invalid"
            ? { accepted: 0, invalidAcceptedRecord: 1 }
            : { accepted: 1 },
    });
    return Response.json(
      {
        ...result,
        receipt: { recorded: receiptRecorded, outcomeCode },
      },
      {
        status: receiptRecorded ? 200 : 503,
        headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
      },
    );
  } catch (cause) {
    await recordDeskFailed(startedAt, receiptStarted);
    const code = safeFailureCode(cause);
    console.error(
      JSON.stringify({ event: "daily_desk_reconciliation_failed", code }),
    );
    return errorResponse(code, 500);
  }
}
