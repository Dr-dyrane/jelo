import { buildClinicalReviewPlan } from "@/lib/clinical/clinical-review-plan";
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
    return Response.json(
      { error: "unauthorized" },
      {
        status: 401,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  try {
    const plan = buildClinicalReviewPlan();
    console.info(
      JSON.stringify({
        event: "clinical_review_health_checked",
        schemaVersion: plan.schemaVersion,
        status: plan.status,
        manifestDigest: plan.manifestDigest,
        counts: plan.counts,
        writesPerformed: plan.writesPerformed,
      }),
    );
    return Response.json(plan, {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    console.error(
      JSON.stringify({
        event: "clinical_review_health_failed",
        reason: "plan_generation_failed",
        writesPerformed: 0,
      }),
    );
    return Response.json(
      { error: "clinical_review_health_unavailable" },
      {
        status: 500,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
