import "server-only";

import { sendAlertEmail } from "@/lib/email/mailer";
import {
  archiveCampaign,
  recentProductionCampaignBrands,
  recentProductionCampaignSlugs,
  recordCampaignDeliveryOutcome,
  reserveCampaignDelivery,
  type ArchivedCampaign,
  type CampaignRunMode,
} from "@/lib/campaigns/campaign-archive";
import { sendCampaignNoCandidateAlertIfNeeded } from "@/lib/campaigns/campaign-alerting";
import { dailyCampaignEmail } from "@/lib/campaigns/campaign-email";
import {
  CAMPAIGN_BRAND_COOLDOWN_DAYS,
  CAMPAIGN_COOLDOWN_DAYS,
  lagosDateKey,
} from "@/lib/campaigns/daily-campaign-policy";
import { renderDailyCampaignStory } from "@/lib/campaigns/campaign-render";
import {
  campaignDailyEnabled,
  resolveCampaignRecipients,
  type CampaignRecipient,
} from "@/lib/campaigns/campaign-recipient";
import {
  selectDailyCampaign,
  type DailyCampaignSelection,
} from "@/lib/campaigns/daily-campaign";

type RunnerDependencies = {
  now: () => Date;
  recentSlugs: typeof recentProductionCampaignSlugs;
  recentBrands: typeof recentProductionCampaignBrands;
  select: typeof selectDailyCampaign;
  render: typeof renderDailyCampaignStory;
  archive: typeof archiveCampaign;
  resolveRecipients: typeof resolveCampaignRecipients;
  reserveDelivery: typeof reserveCampaignDelivery;
  send: typeof sendAlertEmail;
  recordOutcome: typeof recordCampaignDeliveryOutcome;
  alertNoCandidate: typeof sendCampaignNoCandidateAlertIfNeeded;
};

const defaultDependencies: RunnerDependencies = {
  now: () => new Date(),
  recentSlugs: recentProductionCampaignSlugs,
  recentBrands: recentProductionCampaignBrands,
  select: selectDailyCampaign,
  render: renderDailyCampaignStory,
  archive: archiveCampaign,
  resolveRecipients: resolveCampaignRecipients,
  reserveDelivery: reserveCampaignDelivery,
  send: sendAlertEmail,
  recordOutcome: recordCampaignDeliveryOutcome,
  alertNoCandidate: sendCampaignNoCandidateAlertIfNeeded,
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
      packetImages: ArchivedCampaign["packetImages"];
      campaignRecordKey: string;
    }
  | {
      status: "duplicate-suppressed";
      campaignId: string;
      delivery: CampaignDeliverySummary;
    }
  | {
      status: "accepted";
      campaignId: string;
      image: ArchivedCampaign["image"];
      packetImages: ArchivedCampaign["packetImages"];
      delivery: CampaignDeliverySummary;
    };

type CampaignDeliverySummary = {
  recipientCount: number;
  recipientKinds: readonly CampaignRecipient["kind"][];
  acceptedCount: number;
  duplicateSuppressedCount: number;
  failedCount: number;
};

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
  const [recentProductSlugs, recentBrands] = await Promise.all([
    dependencies.recentSlugs({
      now,
      cooldownDays: CAMPAIGN_COOLDOWN_DAYS,
    }),
    dependencies.recentBrands({
      now,
      cooldownDays: CAMPAIGN_BRAND_COOLDOWN_DAYS,
    }),
  ]);
  const selection: DailyCampaignSelection = await dependencies.select({
    now,
    recentProductSlugs,
    recentBrands,
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
    // Send an operator alert so a no-candidate day is visible without
    // inspecting logs. The alert includes a blocker breakdown so operators
    // can distinguish expected cooldowns from systemic issues.
    await dependencies.alertNoCandidate(
      selection.checkedAt,
      selection.rejectedCandidates,
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
      packetImages: archive.packetImages,
      campaignRecordKey: archive.campaignRecordKey,
    };
  }

  const recipients = await dependencies.resolveRecipients(input.mode);
  const expectedRecipientCount = input.mode === "test" ? 1 : 3;
  const expectedRecipientKind = input.mode === "test" ? "test" : "operator";
  if (
    recipients.length !== expectedRecipientCount ||
    recipients.some((recipient) => recipient.kind !== expectedRecipientKind)
  ) {
    throw new Error("campaign_recipient_batch_invalid");
  }
  const recipientKinds = [
    ...new Set(recipients.map((recipient) => recipient.kind)),
  ].sort() as CampaignRecipient["kind"][];
  let acceptedCount = 0;
  let duplicateSuppressedCount = 0;
  let failedCount = 0;

  for (const recipient of recipients) {
    let intent: Awaited<ReturnType<typeof reserveCampaignDelivery>>;
    try {
      intent = await dependencies.reserveDelivery({
        archive,
        recipient: recipient.record,
        createdAt: now.toISOString(),
      });
    } catch {
      failedCount += 1;
      continue;
    }
    if (!intent.reserved) {
      duplicateSuppressedCount += 1;
      continue;
    }

    let sendFailed = false;
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
    } catch {
      sendFailed = true;
    }

    if (sendFailed) {
      failedCount += 1;
      try {
        await dependencies.recordOutcome({
          archive,
          state: "failed",
          recordedAt: dependencies.now().toISOString(),
          recipient: recipient.record,
          errorCode: "campaign_email_send_failed",
        });
      } catch {
        // The immutable delivery intent remains the retry authority even when
        // recording the provider failure is unavailable.
      }
      continue;
    }

    try {
      await dependencies.recordOutcome({
        archive,
        state: "accepted",
        recordedAt: dependencies.now().toISOString(),
        recipient: recipient.record,
      });
      acceptedCount += 1;
    } catch {
      // Provider acceptance without a durable outcome is indeterminate. Keep
      // the intent reserved and do not risk a duplicate resend.
      failedCount += 1;
    }
  }

  const delivery: CampaignDeliverySummary = {
    recipientCount: recipients.length,
    recipientKinds,
    acceptedCount,
    duplicateSuppressedCount,
    failedCount,
  };
  if (failedCount > 0) {
    throw new Error(
      `campaign_delivery_batch_failed_${failedCount}_of_${recipients.length}`,
    );
  }
  if (acceptedCount === 0) {
    return {
      status: "duplicate-suppressed",
      campaignId: selection.draft.campaignId,
      delivery,
    };
  }

  return {
    status: "accepted",
    campaignId: selection.draft.campaignId,
    image: archive.image,
    packetImages: archive.packetImages,
    delivery,
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
