"use client";

import { useState, useTransition } from "react";
import type {
  ReviewActionResult,
  ReviewView,
} from "@/lib/campaigns/x-review/review-service";
import type { EditorialTransitionInput } from "@/lib/campaigns/x-review/editorial";
import styles from "./review.module.css";

type SaveAction = (
  reportId: string,
  input: EditorialTransitionInput,
) => Promise<ReviewActionResult>;
type Operation = EditorialTransitionInput["operation"];
const statusLabels = {
  draft: "Needs a decision",
  approved: "Copy approved · not posted",
  rejected: "Skipped",
  "changes-requested": "Changes requested · not redrafted",
};

export function ReviewDesk({
  initial,
  saveAction,
}: {
  initial: ReviewView;
  saveAction: SaveAction;
}) {
  const [view, setView] = useState(initial);
  const [pending, startTransition] = useTransition();
  function decide(
    input: EditorialTransitionInput,
  ): Promise<ReviewActionResult> {
    return new Promise((resolve) =>
      startTransition(async () => {
        try {
          const result = await saveAction(view.report.id, {
            ...input,
            expectedVersion: view.version,
          });
          if (result.status === "saved") setView(result.view);
          resolve(result);
        } catch {
          resolve({
            status: "error",
            message:
              "We couldn’t confirm the save. Keep your copy and refresh to check before retrying.",
          });
        }
      }),
    );
  }
  return (
    <main className={styles.shell}>
      <header>
        <p className={styles.eyebrow}>JeloCare · Campaigns</p>
        <h1>A few conversations.</h1>
        <p>Review the context, shape the reply, then approve the exact copy.</p>
        <p className={styles.notice}>
          Private editorial review. Publishing is not connected.
        </p>
        <p className={styles.meta}>
          Snapshot: {view.report.checkedAt} · Version {view.version}
        </p>
        {view.expired && (
          <p role="status" className={styles.notice}>
            This snapshot has expired. A fresh report is needed before further
            decisions.
          </p>
        )}
        {view.report.moreAvailable && (
          <p className={styles.meta}>
            This is not the full inbox. Some conversations still need review on
            X.
          </p>
        )}
      </header>
      {!view.report.items.length && (
        <p>Nothing in this report needs a decision.</p>
      )}
      {view.report.items.map((source, index) => (
        <ReplyEditor
          key={source.source.id}
          source={source}
          item={view.items[index]}
          version={view.version}
          disabled={pending || view.expired}
          decide={decide}
        />
      ))}
      <footer className={styles.footer}>
        <a href={`/campaign-review/${view.report.id}`}>Refresh review</a>
        <p>
          Only the campaign operator can open this page. Email replies do not
          run commands.
        </p>
      </footer>
    </main>
  );
}

function ReplyEditor({
  source,
  item,
  version,
  disabled,
  decide,
}: {
  source: ReviewView["report"]["items"][number];
  item: ReviewView["items"][number];
  version: number;
  disabled: boolean;
  decide: (input: EditorialTransitionInput) => Promise<ReviewActionResult>;
}) {
  const [text, setText] = useState(item.text);
  const [feedback, setFeedback] = useState(item.feedback ?? "");
  const [checkedLive, setCheckedLive] = useState(false);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState<Operation | null>(null);
  const held =
    source.classification === "manual review" ||
    source.classification === "care/safety response";
  const editable =
    item.status === "draft" || item.status === "changes-requested";
  const dirty = text !== item.text;
  const count = [...text].length;
  async function submit(operation: Operation) {
    setWorking(operation);
    setMessage("");
    const result = await decide({
      sourceId: item.sourceId,
      expectedVersion: version,
      operation,
      text,
      feedback,
      checkedLive,
      copyHash: item.copyHash,
    });
    if (result.status === "saved") {
      const updated = result.view.items.find(
        (value) => value.sourceId === item.sourceId,
      )!;
      setText(updated.text);
      setFeedback(updated.feedback ?? "");
      setCheckedLive(false);
      setMessage(
        operation === "approve"
          ? "Exact copy approved. Nothing was posted."
          : operation === "request-changes"
            ? "Change request saved. A revised draft has not been generated yet."
            : "Decision saved. Nothing was posted.",
      );
    } else {
      setMessage(result.message);
    }
    setWorking(null);
  }
  return (
    <section
      className={styles.card}
      aria-labelledby={`source-${item.sourceId}`}
    >
      <div className={styles.row}>
        <h2 id={`source-${item.sourceId}`}>
          @{source.source.username ?? "unknown"}
        </h2>
        <span className={styles.meta}>{statusLabels[item.status]}</span>
      </div>
      <p className={styles.prose}>{source.source.text}</p>
      <a
        href={`https://x.com/i/status/${item.sourceId}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open live conversation ↗
      </a>
      <details className={styles.context}>
        <summary>Context and checks</summary>
        {source.source.parent && (
          <>
            <p className={styles.prose}>{source.source.parent.text}</p>
            <a
              href={`https://x.com/i/status/${source.source.parent.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Parent post ↗
            </a>
          </>
        )}
        <p>{source.reason}</p>
        <p className={styles.meta}>
          {source.source.createdAt} · {source.source.metrics.replies} replies ·{" "}
          {source.source.metrics.likes} likes · {source.source.metrics.reposts}{" "}
          reposts · {source.source.metrics.views ?? "Unavailable"} views
        </p>
      </details>
      {held ? (
        <p className={styles.notice}>
          Human follow-up required. This desk cannot approve care,
          private-information or unreviewed-media replies.
        </p>
      ) : (
        <>
          <label className={styles.label} htmlFor={`reply-${item.sourceId}`}>
            Final reply · text only, no media
          </label>
          <textarea
            id={`reply-${item.sourceId}`}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setCheckedLive(false);
            }}
            disabled={disabled || !editable}
            rows={4}
          />
          <p className={styles.meta}>
            {count}/240 characters · Keep this pilot claim-free and link-free.
          </p>
          {dirty && (
            <p className={styles.meta}>Save your changes before approval.</p>
          )}
          {editable && (
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={checkedLive}
                disabled={disabled || dirty || !item.text}
                onChange={(event) => setCheckedLive(event.target.checked)}
              />
              I checked the live thread, context and existing replies.
            </label>
          )}
        </>
      )}
      {item.feedback && (
        <p className={styles.prose}>Requested change: {item.feedback}</p>
      )}
      <div className={styles.actions}>
        {!held && editable && (
          <>
            <button
              className={styles.primary}
              disabled={
                disabled ||
                dirty ||
                !checkedLive ||
                !item.text ||
                item.status !== "draft"
              }
              onClick={() => void submit("approve")}
            >
              {working === "approve"
                ? "Saving approval…"
                : "Approve saved copy"}
            </button>
            <button
              className={styles.secondary}
              disabled={disabled || !text.trim() || count > 240}
              onClick={() => void submit("save")}
            >
              {working === "save" ? "Saving copy…" : "Save copy"}
            </button>
          </>
        )}
        {item.status !== "rejected" && (
          <button
            className={styles.secondary}
            disabled={disabled || dirty}
            onClick={() => void submit("reject")}
          >
            {working === "reject" ? "Saving…" : "Skip"}
          </button>
        )}
        {(item.status === "approved" || item.status === "rejected") && (
          <button
            className={styles.secondary}
            disabled={disabled}
            onClick={() => void submit("reopen")}
          >
            Reopen decision
          </button>
        )}
      </div>
      {!held && editable && (
        <details className={styles.context}>
          <summary>Request a different reply</summary>
          <label className={styles.label} htmlFor={`feedback-${item.sourceId}`}>
            What should change?
          </label>
          <textarea
            id={`feedback-${item.sourceId}`}
            rows={2}
            maxLength={600}
            value={feedback}
            disabled={disabled}
            onChange={(event) => setFeedback(event.target.value)}
          />
          <button
            className={styles.secondary}
            disabled={disabled || dirty || !feedback.trim()}
            onClick={() => void submit("request-changes")}
          >
            Save change request
          </button>
        </details>
      )}
      <p role="status" aria-live="polite" className={styles.feedback}>
        {working ? "Saving your decision…" : message}
      </p>
    </section>
  );
}
