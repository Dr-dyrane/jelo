import {
  contributionReviewItem,
  type ContributionReviewItem,
} from "@/lib/moderation/contribution-presentation";
import type {
  MarketFinderReportContext,
  PendingContribution,
} from "@/lib/moderation/queues";
import {
  exactMarketProductLabel,
  marketFinderOutcomeLabel,
} from "./market-report-labels";

export type ContributionWorkItem = ContributionReviewItem & {
  parentModerationStatus: PendingContribution["moderationStatus"];
  marketReport: MarketFinderReportContext | null;
};

export function contributionWorkItem(
  row: PendingContribution,
): ContributionWorkItem {
  const base = contributionReviewItem(row);
  if (!row.marketReport) {
    return {
      ...base,
      parentModerationStatus: row.moderationStatus,
      marketReport: null,
    };
  }

  return {
    ...base,
    kindLabel: "Market Finder report",
    title: exactMarketProductLabel(row.marketReport),
    summary: `${row.marketReport.retailerLocationName} · ${marketFinderOutcomeLabel(row.marketReport.outcome)}`,
    pendingLinkedReportCount:
      base.pendingLinkedReportCount +
      (row.marketReport.moderationStatus === "pending" ? 1 : 0),
    parentModerationStatus: row.moderationStatus,
    marketReport: row.marketReport,
  };
}
