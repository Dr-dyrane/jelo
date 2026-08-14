import "server-only";

import { sendAlertEmail } from "@/lib/email/mailer";
import {
  archiveCampaign,
  recentProductionCampaignSlugs,
  recordCampaignDeliveryOutcome,
  reserveCampaignDelivery,
  type ArchivedCampaign,
  type CampaignRunMode,
} from "@/lib/campaigns/campaign-archive";
import { dailyCampaignEmail } from "@/lib/campaigns/campaign-email";
import {
  CAMPAIGN_COOLDOWN_DAYS,
  lagosDateKey,
} from "@/lib/campaigns/daily-campaign-policy";
import { renderDailyCampaignStory } from "@/lib/campaigns/campaign-render";
import {
  campaignDailyEnabled,
  resolveCampaignRecipient,
} from "@/lib/campaigns/campaign-recipient";
import {
  selectDailyCampaign,
  type DailyCampaignSelection,
} from "@/lib/campaigns/daily-campaign";

type RunnerDependencies = {
  now: () => Date;
  recentSlugs: typeof recentProductionCampaignSlugs;
  select: typeof selectDailyCampaign;
  render: typeof renderDailyCampaignStory;
  archive: typeof archiveCampaign;
  resolveRecipient: typeof resolveCampaignRecipient;
  reserveDelivery: typeof reserveCampaignDelivery;
  send: typeof sendAlertEmail;
  recordOutcome: typeof recordCampaignDeliveryOutcome;
};

const defaultDependencies: RunnerDependencies = {
  now: () => new Date(),
  recentSlugs: recentProductionCampaignSlugs,
  select: selectDailyCampaign,
  render: renderDailyCampaignStory,
  archive: archiveCampaign,
  resolveRecipient: resolveCampaignRecipient,
  reserveDelivery: reserveCampaignDelivery,
  send: sendAlertEmail,
  recordOutcome: recordCampaignDeliveryOutcome,
};

export type DailyCampaignRunResult =
  | {
      status: "no-candidate";
      checkedAt: string;
      rejectedCandidateCount: number;
    }
  | {
      status: "preview-ready";
      campaignId: string;
      caption: string;
      actionUrl: string;
      dataCheckedAt: string;
      evidenceBoundary: string;
      channels: readonly string[];
      image: ArchivedCampaign["image"];
      campaignRecordKey: string;
    }
  | {
      status: "duplicate-suppressed";
      campaignId: string;
      deliveryIntentKey: string;
    }
  | {
      status: "accepted";
      campaignId: string;
      recipientKind: "test" | "operator";
      image: ArchivedCampaign["image"];
      deliveryRecordKey: string;
    };

function boundedErrorCode(cause: unknown) {
  const source = cause instanceof Error ? cause.message : "campaign-run-failed";
  return (
    source
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "campaign-run-failed"
  );
}

export async function runDailyCampaign(
  input: {
    mode: CampaignRunMode;
    iteration: number;
    requestOrigin: string;
  },
  dependencies: RunnerDependencies = defaultDependencies,
): Promise<DailyCampaignRunResult> {
  const now = dependencies.now();
  if (!Number.isFinite(now.valueOf()))
    throw new Error("campaign_invalid_clock");
  const recentProductSlugs = await dependencies.recentSlugs({
    now,
    cooldownDays: CAMPAIGN_COOLDOWN_DAYS,
  });
  const selection: DailyCampaignSelection = await dependencies.select({
    now,
    recentProductSlugs,
  });
  if (selection.status === "no-candidate") {
    // Log when no campaign candidate is available so operators can detect
    // systemic issues (e.g., all offers expired, all products in cooldown).
    // Without this, no-candidate days are completely silent — no email is
    // sent and no error is thrown, making it hard to distinguish "nothing
    // to send" from "the pipeline is broken."
    console.warn(
      `Daily campaign: no candidate selected. ${selection.rejectedCandidates.length} products rejected.`,
      selection.rejectedCandidates.map((c) => ({
        slug: c.slug,
        blocker: c.blocker,
      })),
    );
    return {
      status: selection.status,
      checkedAt: selection.checkedAt,
      rejectedCandidateCount: selection.rejectedCandidates.length,
    };
  }

  const rendered = await dependencies.render({
    draft: selection.draft,
    requestOrigin: input.requestOrigin,
  });
  const archive = await dependencies.archive({
    mode: input.mode,
    iteration: input.iteration,
    draft: selection.draft,
    rendered,
  });

  if (input.mode === "preview") {
    return {
      status: "preview-ready",
      campaignId: selection.draft.campaignId,
      caption: selection.draft.copy.caption,
      actionUrl: selection.draft.actionUrl,
      dataCheckedAt: selection.draft.dataCheckedAt,
      evidenceBoundary: selection.draft.evidenceBoundary,
      channels: selection.draft.channels,
      image: archive.image,
      campaignRecordKey: archive.campaignRecordKey,
    };
  }

  const recipient = await dependencies.resolveRecipient(input.mode);
  const intent = await dependencies.reserveDelivery({
    archive,
    recipient: recipient.record,
    createdAt: now.toISOString(),
  });
  if (!intent.reserved) {
    return {
      status: "duplicate-suppressed",
      campaignId: selection.draft.campaignId,
      deliveryIntentKey: intent.key,
    };
  }

  try {
    await dependencies.send({
      to: recipient.email,
      ...dailyCampaignEmail({
        mode: input.mode,
        draft: selection.draft,
        archive,
        recipient,
      }),
    });
  } catch (cause) {
    await dependencies.recordOutcome({
      archive,
      state: "failed",
      recordedAt: dependencies.now().toISOString(),
      recipient: recipient.record,
      errorCode: boundedErrorCode(cause),
    });
    throw cause;
  }

  const deliveryRecordKey = await dependencies.recordOutcome({
    archive,
    state: "accepted",
    recordedAt: dependencies.now().toISOString(),
    recipient: recipient.record,
  });
  return {
    status: "accepted",
    campaignId: selection.draft.campaignId,
    recipientKind: recipient.kind,
    image: archive.image,
    deliveryRecordKey,
  };
}

export function dailyCampaignScheduleStatus(
  env: Record<string, string | undefined> = process.env,
) {
  return {
    enabled: campaignDailyEnabled(env),
    timeZone: "Africa/Lagos",
    localTime: "08:00",
    utcSchedule: "0 7 * * *",
    date: lagosDateKey(Date.now()),
  };
}
