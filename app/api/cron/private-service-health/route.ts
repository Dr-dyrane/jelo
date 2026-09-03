import { evaluateCustomerPrivateTelemetryFastBurn } from "@/lib/customer/private-telemetry-alert";
import { readCustomerPrivateTelemetryCompletedQuarterReport } from "@/lib/customer/private-telemetry";
import { isAuthorizedCronRequest } from "@/modules/retail-intelligence/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PRIVATE_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
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
      { status: 401, headers: PRIVATE_RESPONSE_HEADERS },
    );
  }

  try {
    const report = await readCustomerPrivateTelemetryCompletedQuarterReport({
      environment: "production",
    });
    const evaluation = evaluateCustomerPrivateTelemetryFastBurn(report);
    const log = evaluation.status === "healthy" ? console.info : console.warn;
    log(
      JSON.stringify({
        event: "customer_private_telemetry_fast_burn_checked",
        ...evaluation,
      }),
    );
    return Response.json(evaluation, {
      status: evaluation.status === "rollback-required" ? 503 : 200,
      headers: PRIVATE_RESPONSE_HEADERS,
    });
  } catch {
    console.error(
      JSON.stringify({
        event: "customer_private_telemetry_fast_burn_failed",
        reason: "report_or_configuration_unavailable",
        writesPerformed: 0,
      }),
    );
    return Response.json(
      { error: "customer_private_telemetry_fast_burn_unavailable" },
      { status: 500, headers: PRIVATE_RESPONSE_HEADERS },
    );
  }
}
