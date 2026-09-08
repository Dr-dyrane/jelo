"use client";

import { useRef, useState, useTransition } from "react";
import type { CampaignPreviewResult } from "@/lib/campaigns/x-review/preview-service";
import styles from "./[reportId]/review.module.css";

export function PreviewForm({
  runAction,
}: {
  runAction: (confirmed: boolean) => Promise<CampaignPreviewResult>;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<CampaignPreviewResult | null>(null);
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);

  function submit() {
    if (!confirmed || pending || inFlight.current || result?.status === "ready")
      return;
    inFlight.current = true;
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await runAction(true));
      } catch {
        setResult({
          status: "error",
          message:
            "We couldn’t confirm the result. An attempt may have been used. Don’t rerun immediately; no automatic retry will happen.",
        });
      } finally {
        setConfirmed(false);
        inFlight.current = false;
      }
    });
  }

  return (
    <main className={styles.shell}>
      <p className={styles.eyebrow}>JeloCare · Campaigns</p>
      <h1>A quick inbox check.</h1>
      <p>
        Prepare a private snapshot of up to five recent X mentions from the last
        48 hours.
      </p>
      <p className={styles.notice}>
        Preview only. No AI drafting, email, or public posts.
      </p>
      <section
        className={styles.card}
        aria-labelledby="preview-title"
        aria-busy={pending}
      >
        <h2 id="preview-title">Run one preview</h2>
        <p className={styles.meta}>
          Each run uses one paid attempt, even if no items are found or the run
          fails. The pilot allows six attempts total, at most one per 12-hour
          UTC window.
        </p>
        <p className={styles.meta}>
          Local allowance: $0.25 per attempt. This is an estimate, not a
          provider billing cap.
        </p>
        {result?.status === "ready" ? (
          <div>
            <p role="status">
              {result.itemCount === 0
                ? "Preview ready. No items need review in this snapshot."
                : `Preview ready. ${result.itemCount} ${result.itemCount === 1 ? "item needs" : "items need"} review.`}
            </p>
            <a className={styles.primary} href={result.reportPath}>
              Open private preview
            </a>
            <p className={styles.meta}>
              Keep the review link. The snapshot is retained for 24 hours;
              decisions close after one hour.
            </p>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                disabled={pending}
                required
              />
              <span>
                I understand this uses one paid preview attempt and sends
                nothing.
              </span>
            </label>
            <div className={styles.actions}>
              <button
                className={styles.primary}
                type="submit"
                disabled={!confirmed || pending}
              >
                {pending ? "Preparing preview…" : "Run preview"}
              </button>
            </div>
            <p className={styles.feedback} role="status" aria-live="polite">
              {pending
                ? "Checking X once. Please keep this page open."
                : (result?.message ?? "")}
            </p>
            {result?.signInRequired ? (
              <a
                className={styles.secondary}
                href="/sign-in?next=%2Fcampaign-review"
              >
                Sign in again
              </a>
            ) : null}
          </form>
        )}
      </section>
      <p className={styles.footer}>
        Nothing runs on page load or refresh. Care concerns and incomplete
        context stay held for human review.
      </p>
    </main>
  );
}
