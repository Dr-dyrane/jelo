import {
  ArrowUpRight,
  CircleAlert,
  FileQuestion,
  ShieldCheck,
} from "lucide-react";
import type { ProductCareDecision } from "@/lib/catalogue/product-panel-model";
import styles from "./product-decision-summary.module.css";

type Props = {
  decision: ProductCareDecision;
};

const stateIcon = {
  supportive_eligible: ShieldCheck,
  pharmacist_review: CircleAlert,
  insufficient_data: FileQuestion,
} as const;

/**
 * The public product page's compact, always-present care-evidence truth.
 * Its copy is projected only from the canonical product-care review state.
 */
export function ProductDecisionSummary({ decision }: Props) {
  const StateIcon = stateIcon[decision.state];
  const reviewedDate = decision.reviewedAt
    ? formatReviewDate(decision.reviewedAt)
    : null;
  const showsApprovedUses =
    decision.state === "supportive_eligible" &&
    decision.approvedUses.length > 0;

  return (
    <section
      className={styles.section}
      aria-labelledby="product-care-evidence-title"
      data-care-state={decision.state}
    >
      <div className={styles.frame}>
        <div className={styles.summary}>
          <p className={styles.eyebrow}>
            <StateIcon size={15} strokeWidth={1.8} aria-hidden="true" />
            Care evidence
          </p>
          <h2 id="product-care-evidence-title" className={styles.heading}>
            {decision.statusLabel}
          </h2>
          <p className={styles.description}>{decision.summary}</p>
          {showsApprovedUses ? (
            <p className={styles.approvedUses}>
              <span>Reviewed for</span>
              {decision.approvedUses.join(" · ")}
            </p>
          ) : null}
        </div>

        <div className={styles.evidence} aria-label="Care review evidence">
          <p className={styles.evidenceLabel}>Evidence record</p>
          {decision.reviewedAt && reviewedDate ? (
            <p className={styles.reviewedOn}>
              Reviewed{" "}
              <time dateTime={decision.reviewedAt}>{reviewedDate}</time>
            </p>
          ) : (
            <p className={styles.evidenceMissing}>
              No completed care-review date is recorded yet.
            </p>
          )}

          {decision.evidenceSourceUrls.length > 0 ? (
            <ul className={styles.sourceList} aria-label="Care review sources">
              {decision.evidenceSourceUrls.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.sourceLink}
                  >
                    {sourceHostname(url)}
                    <ArrowUpRight size={12} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.evidenceMissing}>
              No public care-review source is recorded yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function sourceHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatReviewDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
