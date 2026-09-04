import "server-only";

import { createHash } from "node:crypto";

import {
  acceptDailyDeskCampaign,
  acceptedDailyDeskCampaignRecordKeyForDate,
  archiveCampaign,
} from "@/lib/campaigns/campaign-archive";
import {
  selectDailyCampaign,
  type DailyCampaignDraft,
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
      replaced: boolean;
    }
  | { status: "already-accepted"; date: string; campaignRecordKey: string }
  | {
      status: "accepted-evidence-invalid";
      date: string;
      campaignRecordKey: string;
      evidenceStatus: Exclude<DailyDeskReadModel["status"], "ready">;
    }
  | {
      status: "no-replacement-candidate";
      date: string;
      campaignRecordKey: string;
      evidenceStatus: Exclude<DailyDeskReadModel["status"], "ready">;
      checkedAt: string;
      rejectedCandidateCount: number;
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
): Extract<DailyDeskReconciliationResult, { status: "no-candidate" }> {
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

function nextDailyDeskArchiveIteration(campaignRecordKey: string | null) {
  if (!campaignRecordKey) return 1;
  const match = campaignRecordKey.match(/:v(\d+):campaign$/);
  const current = match ? Number(match[1]) : Number.NaN;
  if (!Number.isSafeInteger(current) || current < 1 || current >= 99) {
    throw new Error("daily_desk_revision_invalid");
  }
  return current + 1;
}

export function dailyDeskRevisionDraft(
  draft: DailyCampaignDraft,
  iteration: number,
): DailyCampaignDraft {
  const date = draft.campaignId.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || draft.campaignId[10] !== "-") {
    throw new Error("daily_desk_campaign_id_invalid");
  }
  const digest = createHash("sha256")
    .update(JSON.stringify({ iteration, draft }), "utf8")
    .digest("hex")
    .slice(0, 12);
  const marker = `-r${iteration}-${digest}`;
  const stem = draft.campaignId
    .slice(11, 11 + 180 - marker.length)
    .replace(/-+$/, "");
  if (!stem) throw new Error("daily_desk_campaign_id_invalid");
  return { ...draft, campaignId: `${date}-${stem}${marker}` };
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
 * Keeps one current evidence-qualified market record per Lagos date while
 * retaining every superseded archive as an immutable revision.
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
  let invalidAccepted:
    | Extract<
        DailyDeskReconciliationResult,
        { status: "accepted-evidence-invalid" }
      >
    | undefined;
  if (acceptedRecordKey) {
    const validation = await validateAcceptedDesk(
      date,
      acceptedRecordKey,
      now,
      dependencies,
    );
    if ("current" in validation) {
      return {
        status: "already-accepted",
        date,
        campaignRecordKey: acceptedRecordKey,
      };
    }
    invalidAccepted = validation;
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
    if (acceptedRecordKey && invalidAccepted) {
      const noCandidate = noCandidateResult(date, selection, now.toISOString());
      return {
        status: "no-replacement-candidate",
        date,
        campaignRecordKey: acceptedRecordKey,
        evidenceStatus: invalidAccepted.evidenceStatus,
        checkedAt: noCandidate.checkedAt,
        rejectedCandidateCount: noCandidate.rejectedCandidateCount,
      };
    }
    return noCandidateResult(date, selection, now.toISOString());
  }

  const iteration = nextDailyDeskArchiveIteration(acceptedRecordKey);
  const revisionDraft = dailyDeskRevisionDraft(selection.draft, iteration);
  const rendered = await dependencies.render({
    draft: revisionDraft,
    requestOrigin: input.requestOrigin,
  });
  const archive = await dependencies.archive({
    mode: "production",
    archiveScope: "daily-desk",
    iteration,
    draft: revisionDraft,
    rendered,
  });
  const accepted = await dependencies.accept({
    archive,
    acceptedAt: now.toISOString(),
    expectedCurrentRecordKey: acceptedRecordKey,
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
    campaignId: revisionDraft.campaignId,
    campaignRecordKey: accepted.campaignRecordKey,
    dataCheckedAt: revisionDraft.dataCheckedAt,
    replaced: acceptedRecordKey !== null,
  };
}

export function dailyDeskReconciliationEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return env.DAILY_DESK_RECONCILIATION_ENABLED === "true";
}
