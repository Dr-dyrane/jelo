import Link from "next/link";
import { campaignReviewPath } from "@/lib/auth/sign-in-intent";
import { readCampaignReview } from "@/lib/campaigns/x-review/review-service";
import { ReviewDesk } from "./review-desk";
import { saveCampaignDecision } from "./actions";
import styles from "./review.module.css";

export const dynamic = "force-dynamic";

export default async function CampaignReviewPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const path = campaignReviewPath(reportId);
  const result = path
    ? await readCampaignReview(reportId)
    : { status: "not-found" as const };
  if (result.status === "ready")
    return (
      <ReviewDesk initial={result.view} saveAction={saveCampaignDecision} />
    );
  const signedOut =
    result.status === "signed-out" || result.status === "forbidden";
  return (
    <main className={styles.shell}>
      <p className={styles.eyebrow}>JeloCare · Campaigns</p>
      <h1>{signedOut ? "Your campaign desk." : "Review unavailable."}</h1>
      <p>
        {signedOut
          ? "Use the verified campaign email to open this private review. No general Ops access is needed."
          : result.status === "not-found"
            ? "This link has expired or is not available to this account. Use the newest review email."
            : result.status === "disabled"
              ? "The private review pilot is not active. Nothing will publish."
              : "We couldn’t verify access just now. Nothing has changed. Try again shortly."}
      </p>
      {signedOut && path ? (
        <Link
          className={styles.primary}
          href={`/sign-in?next=${encodeURIComponent(path)}`}
        >
          Sign in to review
        </Link>
      ) : (
        <a className={styles.secondary} href={path ?? "/"}>
          Try again
        </a>
      )}
    </main>
  );
}
