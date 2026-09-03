import {
  ArrowRight,
  LockKeyhole,
  MessageSquareMore,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { marketReportContributionHref } from "@/lib/markets/feedback";
import styles from "./market-finder.module.css";

type MarketFeedbackProps = {
  marketSlug: string;
  productSlug: string;
  reportingEnabled?: boolean;
  shopName: string;
  shopSlug: string;
};

export function MarketFeedback({
  marketSlug,
  productSlug,
  reportingEnabled = true,
  shopName,
  shopSlug,
}: MarketFeedbackProps) {
  const reportHref = marketReportContributionHref({
    marketSlug,
    productSlug,
    shopSlug,
  });

  return (
    <section className={styles.feedbackPanel} aria-labelledby="market-feedback">
      <span className={styles.feedbackIcon} aria-hidden="true">
        <MessageSquareMore size={24} />
      </span>
      <div>
        <p className="eyebrow">Keep it current</p>
        <h2 id="market-feedback">Something changed?</h2>
        <p>Send a private update about {shopName}.</p>
      </div>

      <div className={styles.reportEntry}>
        {reportingEnabled && reportHref ? (
          <Link className={styles.reportAction} href={reportHref}>
            Report a change <ArrowRight size={17} aria-hidden="true" />
          </Link>
        ) : (
          <p className={styles.reportUnavailable}>
            Reporting is not open for this record yet.
          </p>
        )}
        <div
          className={styles.reportBoundary}
          role="group"
          aria-label="Report privacy"
        >
          <span>
            <LockKeyhole size={14} aria-hidden="true" /> Private
          </span>
          <span>
            <ShieldCheck size={14} aria-hidden="true" /> Reviewed first
          </span>
        </div>
      </div>
    </section>
  );
}
