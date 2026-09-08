import "server-only";
import {
  campaignReviewPath,
  type CampaignReviewContinuation,
} from "@/lib/auth/sign-in-intent";
import { campaignReviewAccess } from "./access";
import { prepareXReview } from "./runner";

export const previewServiceDependencies = {
  access: campaignReviewAccess,
  prepare: prepareXReview,
};

export type CampaignPreviewResult =
  | {
      status: "ready";
      reportPath: CampaignReviewContinuation;
      itemCount: number;
    }
  | { status: "error"; message: string; signInRequired?: boolean };

const failedPreview: CampaignPreviewResult = {
  status: "error",
  message:
    "We couldn’t confirm a saved preview. An attempt may have been consumed. Do not retry automatically; check the pilot status first.",
};

export async function startCampaignPreview(
  confirmed: unknown,
  env: Record<string, string | undefined> = process.env,
  now = new Date(),
  deps = previewServiceDependencies,
): Promise<CampaignPreviewResult> {
  // Every action rechecks the real verified inbox identity, not page/link access.
  let access;
  try {
    access = await deps.access(env, now);
  } catch {
    access = { status: "unavailable" as const };
  }
  if (access.status === "signed-out")
    return {
      status: "error",
      message: "Sign in with the campaign email before running a preview.",
      signInRequired: true,
    };
  if (access.status === "disabled")
    return {
      status: "error",
      message: "The preview pilot is disabled. No X request was made.",
    };
  if (access.status === "forbidden")
    return {
      status: "error",
      message:
        "Use the verified campaign email to run a preview. No X request was made.",
    };
  if (access.status !== "ready")
    return {
      status: "error",
      message:
        "We couldn’t verify campaign access. No X request was made. Refresh before trying again.",
    };
  if (confirmed !== true)
    return {
      status: "error",
      message:
        "Confirm the paid preview before running it. No X request was made.",
    };

  try {
    // This entry point is read-only and text-only even if other pilot switches
    // are enabled. The existing runner owns the shared atomic budget ledger.
    const result = await deps.prepare(
      {
        ...env,
        JELOCARE_X_AI_ENABLED: "false",
        JELOCARE_X_EMAIL_ENABLED: "false",
      },
      now,
    );
    if (result.status === "disabled")
      return {
        status: "error",
        message: "The preview pilot is disabled. No X request was made.",
      };
    if (result.status === "allowance-or-window-exhausted")
      return {
        status: "error",
        message:
          "No preview was run: this 12-hour window or the six-attempt pilot allowance has been used.",
      };
    const reportPath = campaignReviewPath(result.reportId);
    if (
      !reportPath ||
      !Number.isSafeInteger(result.itemCount) ||
      result.itemCount < 0 ||
      result.itemCount > 5
    )
      return { ...failedPreview };
    // Email, hash, actor and credentials never cross the client boundary.
    return { status: "ready", reportPath, itemCount: result.itemCount };
  } catch {
    // A source or storage failure may already have consumed the reservation.
    return { ...failedPreview };
  }
}
