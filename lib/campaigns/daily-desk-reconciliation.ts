import "server-only";

import {
  acceptDailyDeskCampaign,
  acceptedDailyDeskCampaignRecordKeyForDate,
  archiveCampaign,
} from "@/lib/campaigns/campaign-archive";
import {
  selectDailyCampaign,
  type DailyCampaignSelection,
} from "@/lib/campaigns/daily-campaign";
import { lagosDateKey } from "@/lib/campaigns/daily-campaign-policy";
import { renderDailyCampaignStory } from "@/lib/campaigns/campaign-render";
import {
  getDailyDeskReadModel,
  type DailyDeskReadModel,
} from "@/lib/campaigns/daily-desk";

export type DailyDeskReconciliationDependencies = {
  now: () => Date;
  readAcceptedRecordKey: typeof acceptedDailyDeskCampaignRecordKeyForDate;
  readCurrentDesk: (input: { now?: Date }) => Promise<DailyDeskReadModel>;
  select: typeof selectDailyCampaign;
  render: typeof renderDailyCampaignStory;
  archive: typeof archiveCampaign;
  accept: typeof acceptDailyDeskCampaign;
};

const defaultDependencies: DailyDeskReconciliationDependencies = {
  now: () => new Date(),
  readAcceptedRecordKey: acceptedDailyDeskCampaignRecordKeyForDate,
  readCurrentDesk: (input) => getDailyDeskReadModel(input),
  select: selectDailyCampaign,
  render: renderDailyCampaignStory,
  archive: archiveCampaign,
  accept: acceptDailyDeskCampaign,
};

export type DailyDeskReconciliationResult =
  | {
      status: "accepted";
      date: string;
      campaignId: string;
      campaignRecordKey: string;
      dataCheckedAt: string;
    }
  | { status: "already-accepted"; date: string; campaignRecordKey: string }
  | {
      status: "accepted-evidence-invalid";
      date: string;
      campaignRecordKey: string;
      evidenceStatus: Exclude<DailyDeskReadModel["status"], "ready">;
    }
  | {
      status: "no-candidate";
      date: string;
      checkedAt: string;
      rejectedCandidateCount: number;
    };

function noCandidateResult(
  date: string,
  selection: DailyCampaignSelection,
  checkedAt: string,
): DailyDeskReconciliationResult {
  if (selection.status === "no-candidate") {
    return {
      status: "no-candidate",
      date,
      checkedAt: selection.checkedAt,
      rejectedCandidateCount: selection.rejectedCandidates.length,
    };
  }
  return {
    status: "no-candidate",
    date,
    checkedAt,
    rejectedCandidateCount: selection.draft.selection.rejectedCandidates.length,
  };
}

async function validateAcceptedDesk(
  date: string,
  campaignRecordKey: string,
  now: Date,
  dependencies: DailyDeskReconciliationDependencies,
): Promise<
  | { current: true }
  | Extract<
      DailyDeskReconciliationResult,
      { status: "accepted-evidence-invalid" }
    >
> {
  const desk = await dependencies.readCurrentDesk({ now });
  if (
    desk.status === "ready" &&
    desk.date === date &&
    desk.recency === "current-day"
  ) {
    return { current: true };
  }
  return {
    status: "accepted-evidence-invalid",
    date,
    campaignRecordKey,
    evidenceStatus: desk.status === "ready" ? "unavailable" : desk.status,
  };
}

/**
 * Accepts at most one evidence-qualified market record per Lagos date.
 *
 * This intentionally uses the same evidence selector as campaign production,
 * but no social/email delivery cooldown. The Daily Desk is a current market
 * projection, while the operator packet remains a separately rotated,
 * one-delivery-per-day workflow.
 */
export async function reconcileDailyDesk(
  input: { requestOrigin: string },
  dependencies: DailyDeskReconciliationDependencies = defaultDependencies,
): Promise<DailyDeskReconciliationResult> {
  const now = dependencies.now();
  if (!Number.isFinite(now.valueOf())) {
    throw new Error("daily_desk_invalid_clock");
  }
  const date = lagosDateKey(now);
  const acceptedRecordKey = await dependencies.readAcceptedRecordKey(date);
  if (acceptedRecordKey) {
    const validation = await validateAcceptedDesk(
      date,
      acceptedRecordKey,
      now,
      dependencies,
    );
    if (!("current" in validation)) return validation;
    return {
      status: "already-accepted",
      date,
      campaignRecordKey: acceptedRecordKey,
    };
  }

  const selection = await dependencies.select({
    now,
    recentProductSlugs: new Set(),
    recentBrands: new Set(),
  });
  if (
    selection.status === "no-candidate" ||
    selection.draft.dailyDeskEligible !== true
  ) {
    return noCandidateResult(date, selection, now.toISOString());
  }

  const rendered = await dependencies.render({
    draft: selection.draft,
    requestOrigin: input.requestOrigin,
  });
  const archive = await dependencies.archive({
    mode: "production",
    archiveScope: "daily-desk",
    iteration: 1,
    draft: selection.draft,
    rendered,
  });
  const accepted = await dependencies.accept({
    archive,
    acceptedAt: now.toISOString(),
  });
  if (!accepted.accepted) {
    const validation = await validateAcceptedDesk(
      date,
      accepted.campaignRecordKey,
      now,
      dependencies,
    );
    if (!("current" in validation)) return validation;
    return {
      status: "already-accepted",
      date,
      campaignRecordKey: accepted.campaignRecordKey,
    };
  }
  const validation = await validateAcceptedDesk(
    date,
    accepted.campaignRecordKey,
    now,
    dependencies,
  );
  if (!("current" in validation)) return validation;
  return {
    status: "accepted",
    date,
    campaignId: selection.draft.campaignId,
    campaignRecordKey: accepted.campaignRecordKey,
    dataCheckedAt: selection.draft.dataCheckedAt,
  };
}

export function dailyDeskReconciliationEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return env.DAILY_DESK_RECONCILIATION_ENABLED === "true";
}
