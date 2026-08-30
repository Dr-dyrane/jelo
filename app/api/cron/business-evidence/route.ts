import { getPostgresClient } from "@/lib/db/postgres";
import { readBusinessEvidenceRegister } from "@/lib/business-evidence/register";
import { isAuthorizedCronRequest } from "@/modules/retail-intelligence/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  if (
    !isAuthorizedCronRequest(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const report = await readBusinessEvidenceRegister(
      getPostgresClient(),
      new Date(),
    );
    const unavailableCostInputs = Object.values(report.costCompleteness).filter(
      (status) => status === "unavailable",
    ).length;
    console.info(
      JSON.stringify({
        event: "business_evidence_register_checked",
        schemaVersion: report.schemaVersion,
        window: report.window,
        stages: report.stages,
        evidenceCompleteness: report.evidenceCompleteness,
        unavailableCostInputs,
        writesPerformed: report.writesPerformed,
      }),
    );
    return Response.json(report, {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    console.error(
      JSON.stringify({
        event: "business_evidence_register_failed",
        reason: "query_or_configuration_error",
        writesPerformed: 0,
      }),
    );
    return Response.json(
      { error: "business_evidence_unavailable" },
      {
        status: 500,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
