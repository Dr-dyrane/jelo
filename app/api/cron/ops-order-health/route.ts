import { readOpsOrderQueueAgeFacts } from "@/app/(ops)/ops/overview-read-model";
import { getPostgresClient } from "@/lib/db/postgres";
import { evaluateOpsOrderQueueAgeHealth } from "@/lib/commerce/order-queue-age-policy";
import { isAuthorizedCronRequest } from "@/modules/retail-intelligence/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
};

export async function GET(request: Request) {
  if (
    !isAuthorizedCronRequest(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  try {
    const snapshot = await readOpsOrderQueueAgeFacts(getPostgresClient());
    const report = evaluateOpsOrderQueueAgeHealth(
      snapshot.facts,
      snapshot.asOf,
    );
    const log = report.status === "healthy" ? console.info : console.warn;
    log(
      JSON.stringify({
        event: "ops_order_queue_age_health_checked",
        schemaVersion: report.schemaVersion,
        sourceLabel: report.sourceLabel,
        accountableOwner: report.accountableOwner,
        status: report.status,
        actionableCount: report.actionableCount,
        missingClockCount: report.missingClockCount,
        buckets: report.buckets.map((bucket) => ({
          kind: bucket.kind,
          actionableCount: bucket.actionableCount,
          missingClockCount: bucket.missingClockCount,
          oldestAgeMinutes: bucket.oldestAgeMinutes,
          status: bucket.status,
        })),
        writesPerformed: report.writesPerformed,
      }),
    );

    return Response.json(report, {
      status: report.status === "healthy" ? 200 : 503,
      headers: PRIVATE_NO_STORE_HEADERS,
    });
  } catch {
    console.error(
      JSON.stringify({
        event: "ops_order_queue_age_health_failed",
        reason: "query_or_policy_error",
        writesPerformed: 0,
      }),
    );
    return Response.json(
      { error: "ops_order_queue_age_health_unavailable" },
      { status: 500, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
}
