import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { marketReportContributionHref } from "@/lib/markets/feedback";
import styles from "./market-finder.module.css";

type MarketFeedbackProps = {
  marketSlug: string;
  productSlug: string;
  shopName: string;
  shopSlug: string;
};

export function MarketFeedback({
  marketSlug,
  productSlug,
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
      <div>
        <p className={styles.kicker}>Contribute</p>
        <h2 id="market-feedback">Know something changed?</h2>
        <p>
          Tell us what you found at {shopName}. Your report can help JeloCare
          keep this research record useful.
        </p>
      </div>

      <div className={styles.reportEntry}>
        {reportHref ? (
          <Link className={styles.reportAction} href={reportHref}>
            Report an update <ArrowRight size={17} aria-hidden="true" />
          </Link>
        ) : (
          <p className={styles.reportUnavailable}>
            Reporting is unavailable until this record has exact context.
          </p>
        )}
        <p className={styles.reportBoundary}>
          No account needed. Continue to Contribute for review; this does not
          update stock or directions directly.
        </p>
      </div>
    </section>
  );
}
