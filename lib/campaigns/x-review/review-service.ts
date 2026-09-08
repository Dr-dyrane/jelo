import "server-only";
import { campaignReviewPath } from "@/lib/auth/sign-in-intent";
import { campaignReviewAccess } from "./access";
import { xReviewStore } from "./store";
import { xEditorialStore } from "./review-store";
import { reportHash, type XReviewReport } from "./report";
import {
  editorialCopyHash,
  initialEditorialReview,
  transitionEditorialReview,
  EditorialReviewError,
  type EditorialReview,
  type EditorialTransitionInput,
} from "./editorial";

export const reviewServiceDependencies = {
  access: campaignReviewAccess,
  reports: xReviewStore,
  reviews: xEditorialStore,
};

export type ReviewView = {
  report: Pick<XReviewReport, "id" | "checkedAt" | "items" | "moreAvailable">;
  version: number;
  expired: boolean;
  items: (Omit<EditorialReview["items"][number], "actor"> & {
    copyHash: string;
  })[];
};
export type ReviewResult =
  | { status: "ready"; view: ReviewView }
  | {
      status:
        "disabled" | "signed-out" | "forbidden" | "unavailable" | "not-found";
    };
export type ReviewActionResult =
  { status: "saved"; view: ReviewView } | { status: "error"; message: string };

function present(
  report: XReviewReport,
  review: EditorialReview,
  now: Date,
): ReviewView {
  const age = now.valueOf() - Date.parse(report.checkedAt);
  return {
    report: {
      id: report.id,
      checkedAt: report.checkedAt,
      items: report.items,
      moreAvailable: report.moreAvailable,
    },
    version: review.version,
    expired: !Number.isFinite(age) || age < 0 || age > 3_600_000,
    items: report.items.map((source) => {
      const item = review.items.find(
        (entry) => entry.sourceId === source.source.id,
      );
      if (!item) throw new Error("x-review-editorial-source-missing");
      return {
        sourceId: item.sourceId,
        text: item.text,
        status: item.status,
        feedback: item.feedback,
        approvedHash: item.approvedHash,
        updatedAt: item.updatedAt,
        copyHash: editorialCopyHash(report, item),
      };
    }),
  };
}

async function loadAuthorized(
  reportId: string,
  now: Date,
  deps: typeof reviewServiceDependencies,
) {
  const access = await deps.access(process.env, now);
  if (access.status !== "ready") return access;
  if (!campaignReviewPath(reportId)) return { status: "not-found" as const };
  const report = await deps.reports.load(reportId);
  if (!report || report.recipientKey !== access.actor.recipientKey)
    return { status: "not-found" as const };
  const review =
    (await deps.reviews.load(reportId)) ?? initialEditorialReview(report);
  if (review.reportId !== report.id || review.reportHash !== reportHash(report))
    return { status: "unavailable" as const };
  return { status: "ready" as const, report, review, actor: access.actor };
}

export async function readCampaignReview(
  reportId: string,
  now = new Date(),
  deps = reviewServiceDependencies,
): Promise<ReviewResult> {
  try {
    const result = await loadAuthorized(reportId, now, deps);
    return result.status === "ready"
      ? { status: "ready", view: present(result.report, result.review, now) }
      : result;
  } catch {
    return { status: "unavailable" };
  }
}

export async function changeCampaignReview(
  reportId: string,
  input: EditorialTransitionInput,
  now = new Date(),
  deps = reviewServiceDependencies,
): Promise<ReviewActionResult> {
  try {
    // Reauthorize every POST; a once-valid page/link is never mutation authority.
    const loaded = await loadAuthorized(reportId, now, deps);
    if (loaded.status !== "ready")
      return {
        status: "error",
        message:
          "This review is unavailable. Refresh and sign in with the campaign email.",
      };
    const next = transitionEditorialReview(
      loaded.report,
      loaded.review,
      input,
      loaded.actor.subject,
      now,
    );
    if (
      !(await deps.reviews.compareAndSet(
        loaded.report,
        loaded.review.version,
        next,
      ))
    ) {
      return {
        status: "error",
        message:
          "This review changed or expired. Refresh before deciding; your unsaved copy is still below.",
      };
    }
    return { status: "saved", view: present(loaded.report, next, now) };
  } catch (error) {
    if (error instanceof EditorialReviewError) {
      const messages: Partial<Record<typeof error.code, string>> = {
        "x-review-editorial-stale":
          "This snapshot expired. Use a fresh report before deciding.",
        "x-review-editorial-version-conflict":
          "A newer decision exists. Keep your unsaved copy and refresh this review.",
        "x-review-editorial-held":
          "This conversation needs human follow-up outside this text-only desk. The safety hold cannot be overridden here.",
        "x-review-editorial-copy-invalid":
          "Use a reply up to 240 characters, without links, handles, prices, medical advice or unverified claims.",
        "x-review-editorial-copy-mismatch":
          "The copy changed. Save it, then review and approve that exact version.",
        "x-review-editorial-live-check-required":
          "Check the live conversation and existing replies, then tick the confirmation.",
        "x-review-editorial-feedback-required":
          "Say what should change before saving the request.",
      };
      return {
        status: "error",
        message:
          messages[error.code] ??
          "That decision could not be saved. Keep your copy and refresh to check the current state.",
      };
    }
    return {
      status: "error",
      message:
        "We couldn’t confirm the save. Keep your copy and refresh to check its status before trying again.",
    };
  }
}
