import Link from "next/link";
import { campaignReviewAccess } from "@/lib/campaigns/x-review/access";
import { runCampaignPreview } from "./actions";
import { PreviewForm } from "./preview-form";
import styles from "./[reportId]/review.module.css";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export default async function CampaignPreviewPage() {
  const access = await campaignReviewAccess();
  if (access.status === "ready") {
    return <PreviewForm runAction={runCampaignPreview} />;
  }
  const signIn =
    access.status === "signed-out" || access.status === "forbidden";
  return (
    <main className={styles.shell}>
      <p className={styles.eyebrow}>JeloCare · Campaigns</p>
      <h1>Your campaign desk.</h1>
      <p>
        {signIn
          ? "Sign in with the verified campaign email to prepare a private X preview. No general Ops access is needed."
          : access.status === "disabled"
            ? "The private preview pilot is not active. Nothing will run or publish."
            : "We couldn’t verify access just now. Nothing has run. Try again shortly."}
      </p>
      {signIn ? (
        <Link
          className={styles.primary}
          href="/sign-in?next=%2Fcampaign-review"
        >
          Sign in to campaigns
        </Link>
      ) : (
        <form action="/campaign-review" method="get">
          <button className={styles.secondary} type="submit">
            Check again
          </button>
        </form>
      )}
      <p className={styles.footer}>
        Opening or refreshing this page never runs a preview.
      </p>
    </main>
  );
}
