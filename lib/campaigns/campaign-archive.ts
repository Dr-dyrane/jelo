import "server-only";

import { createHmac } from "node:crypto";
import { Redis } from "@upstash/redis";
import {
  BlobError,
  BlobPreconditionFailedError,
  head,
  put,
  type HeadBlobResult,
} from "@vercel/blob";
import type { DailyCampaignDraft } from "@/lib/campaigns/daily-campaign";
import type {
  CampaignPacketRole,
  RenderedCampaignPacket,
} from "@/lib/campaigns/campaign-render";

export type CampaignRunMode = "preview" | "test" | "production";

export type ArchivedCampaignImage<Role extends CampaignPacketRole> = {
  role: Role;
  path: string;
  url: string;
  downloadUrl: string;
  sha256: string;
  width: 1080;
  height: 1920;
};

export type ArchivedCampaignPacket = readonly [
  ArchivedCampaignImage<"proof">,
  ArchivedCampaignImage<"use">,
  ArchivedCampaignImage<"remember">,
];

export type ArchivedCampaign = {
  mode: CampaignRunMode;
  dailyDeskEligible?: boolean;
  runPath: string;
  image: ArchivedCampaignImage<"proof">;
  packetImages: ArchivedCampaignPacket;
  campaignRecordKey: string;
  checksumKey: string;
};

export type CampaignDeliveryRecipientRecord = {
  kind: "test" | "operator";
  recipientKey: string;
};

const productionPrefix = "campaigns/daily";
const ledgerPrefix = "jelocare:campaigns:v1";
const acceptedProductionIndex = `${ledgerPrefix}:production:accepted`;
const dailyDeskAggregatePrefix = `${ledgerPrefix}:daily-desk:aggregate`;
const dailyDeskRatePrefix = `${ledgerPrefix}:daily-desk:rate`;
const dailyDeskAggregateRetentionSeconds = 90 * 24 * 60 * 60;
const dailyDeskRateLimitPerMinute = 500;
const campaignPacketRoles = ["proof", "use", "remember"] as const;
let redis: Redis | undefined;

export type DailyDeskAggregateEvent = "view" | "compare_click";

function productionCampaignDate(archive: ArchivedCampaign) {
  const date = archive.runPath.match(
    /^campaigns\/daily\/(\d{4}-\d{2}-\d{2})\//,
  )?.[1];
  if (!date) throw new Error("campaign_production_date_invalid");
  return date;
}

function safeRecipientKey(recipient: CampaignDeliveryRecipientRecord) {
  if (!/^[0-9a-f]{64}$/.test(recipient.recipientKey)) {
    throw new Error("campaign_recipient_key_invalid");
  }
  return recipient.recipientKey;
}

export function campaignDeliveryIntentKey(
  archive: ArchivedCampaign,
  recipient: CampaignDeliveryRecipientRecord,
) {
  const recipientKey = safeRecipientKey(recipient);
  if (archive.mode !== "production") {
    return `${archive.campaignRecordKey}:delivery-intent:${recipientKey}`;
  }
  return `${ledgerPrefix}:production:${productionCampaignDate(archive)}:delivery-intent:${recipientKey}`;
}

export function campaignDeliveryOutcomeKey(
  archive: ArchivedCampaign,
  state: "accepted" | "failed",
  recipient: CampaignDeliveryRecipientRecord,
) {
  const suffix = state === "accepted" ? "delivery-accepted" : "delivery-failed";
  return `${archive.campaignRecordKey}:${suffix}:${safeRecipientKey(recipient)}`;
}

async function acceptedProductionRecordForDate(date: string) {
  const start = Date.parse(`${date}T00:00:00+01:00`);
  if (!Number.isFinite(start))
    throw new Error("campaign_production_date_invalid");
  const records = await campaignLedger().zrange<string[]>(
    acceptedProductionIndex,
    start,
    start + 86_400_000 - 1,
    { byScore: true, offset: 0, count: 1 },
  );
  return records[0] ?? null;
}

async function claimProductionCampaignForDate(archive: ArchivedCampaign) {
  const date = productionCampaignDate(archive);
  const key = `${ledgerPrefix}:production:${date}:campaign`;
  const campaignRecordKey = archive.campaignRecordKey;
  const stored = await campaignLedger().set(key, campaignRecordKey, {
    nx: true,
  });
  if (stored === "OK") return true;
  return (await campaignLedger().get<string>(key)) === campaignRecordKey;
}

export async function acceptedProductionCampaignJsonForDate(date: string) {
  const campaignRecordKey = await acceptedProductionRecordForDate(date);
  if (!campaignRecordKey) return null;
  return campaignLedger().get<string>(campaignRecordKey);
}

function safeDailyDeskSegment(value: string, pattern: RegExp, error: string) {
  if (!pattern.test(value)) throw new Error(error);
  return value;
}

export function dailyDeskAggregateMetricKey(input: {
  date: string;
  campaignId: string;
  event: DailyDeskAggregateEvent;
}) {
  const date = safeDailyDeskSegment(
    input.date,
    /^\d{4}-\d{2}-\d{2}$/,
    "daily_desk_metric_date_invalid",
  );
  const campaignId = safeDailyDeskSegment(
    input.campaignId,
    /^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,180}$/,
    "daily_desk_metric_campaign_invalid",
  );
  if (input.event !== "view" && input.event !== "compare_click") {
    throw new Error("daily_desk_metric_event_invalid");
  }
  return `${dailyDeskAggregatePrefix}:${date}:${campaignId}:${input.event}`;
}

export async function recordDailyDeskAggregateEvent(input: {
  date: string;
  campaignId: string;
  event: DailyDeskAggregateEvent;
  recordedAt?: Date;
}) {
  try {
    const metricKey = dailyDeskAggregateMetricKey(input);
    const recordedAt = input.recordedAt ?? new Date();
    const timestamp = recordedAt.valueOf();
    if (!Number.isFinite(timestamp)) return false;

    // This is deliberately global, not visitor-based: no IP, user agent,
    // cookie, session, referrer, or fingerprint is read or stored.
    const minute = Math.floor(timestamp / 60_000);
    const rateKey = `${dailyDeskRatePrefix}:${minute}`;
    const rate = await campaignLedger().incr(rateKey);
    if (rate === 1) await campaignLedger().expire(rateKey, 120);
    if (rate > dailyDeskRateLimitPerMinute) return false;

    const total = await campaignLedger().incr(metricKey);
    if (total === 1) {
      await campaignLedger().expire(
        metricKey,
        dailyDeskAggregateRetentionSeconds,
      );
    }
    return true;
  } catch {
    // Measurement is best-effort. Redis failure cannot affect the public page
    // or the shopper's navigation to the price comparison.
    return false;
  }
}

function runPrefix(mode: CampaignRunMode) {
  if (mode === "production") return productionPrefix;
  return mode === "test" ? "campaigns/tests" : "campaigns/previews";
}

function safeIteration(value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 99) {
    throw new Error("campaign_iteration_invalid");
  }
  return value;
}

function jsonBytes(value: unknown) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function campaignLedger() {
  if (redis) return redis;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token || !url.startsWith("https://")) {
    throw new Error("campaign_ledger_not_configured");
  }
  redis = new Redis({ url, token, automaticDeserialization: false });
  return redis;
}

async function putPublicImage(
  pathname: string,
  rendered: RenderedCampaignPacket[number],
): Promise<HeadBlobResult> {
  try {
    const stored = await put(pathname, rendered.bytes, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: rendered.contentType,
      cacheControlMaxAge: 31_536_000,
    });
    return {
      ...stored,
      size: rendered.bytes.length,
      uploadedAt: new Date(),
      cacheControl: "public",
    };
  } catch (error) {
    const isAlreadyExists =
      error instanceof BlobPreconditionFailedError ||
      (error instanceof BlobError && /already exists/i.test(error.message));
    if (!isAlreadyExists) throw error;
    const existing = await head(pathname);
    if (existing.size !== rendered.bytes.length) {
      throw new Error("campaign_archive_existing_image_mismatch");
    }
    return existing;
  }
}

async function putLedgerImmutable(key: string, bytes: Buffer) {
  const value = bytes.toString("utf8");
  const stored = await campaignLedger().set(key, value, { nx: true });
  if (stored === "OK") return;
  const existing = await campaignLedger().get<string>(key);
  if (existing !== value) {
    throw new Error("campaign_archive_immutable_record_mismatch");
  }
}

export async function archiveCampaign(input: {
  mode: CampaignRunMode;
  iteration: number;
  draft: DailyCampaignDraft;
  rendered: RenderedCampaignPacket;
}): Promise<ArchivedCampaign> {
  const iteration = safeIteration(input.iteration);
  const date = input.draft.campaignId.slice(0, 10);
  const runPath = `${runPrefix(input.mode)}/${date}/${input.draft.campaignId}/v${iteration}`;
  for (const [index, role] of campaignPacketRoles.entries()) {
    if (input.rendered[index]?.role !== role) {
      throw new Error("campaign_packet_role_order_invalid");
    }
  }

  async function storePacketImage<Index extends 0 | 1 | 2>(index: Index) {
    const rendered = input.rendered[index];
    const role = campaignPacketRoles[index];
    const subject = input.draft.product?.slug ?? "jelocare-daily";
    const imageName = `${subject}-${input.draft.creativePlan.storyKind}-${role}-${rendered.sha256.slice(0, 16)}.png`;
    const imagePath = `${runPath}/${imageName}`;
    const image = await putPublicImage(imagePath, rendered);
    return {
      role,
      imageName,
      rendered,
      archived: {
        role,
        path: imagePath,
        url: image.url,
        downloadUrl: image.downloadUrl,
        sha256: rendered.sha256,
        width: rendered.width,
        height: rendered.height,
      },
    };
  }

  const [proof, use, remember] = await Promise.all([
    storePacketImage(0),
    storePacketImage(1),
    storePacketImage(2),
  ]);
  const packetImages: ArchivedCampaignPacket = [
    proof.archived,
    use.archived,
    remember.archived,
  ];
  const recordPrefix = `${ledgerPrefix}:${input.mode}:${input.draft.campaignId}:v${iteration}`;
  const campaignRecordKey = `${recordPrefix}:campaign`;
  const checksumKey = `${recordPrefix}:checksum`;
  const campaignRecord = {
    ...input.draft,
    creative: [
      {
        mode: input.draft.creativePlan.mode,
        path: proof.archived.path,
        url: proof.archived.url,
        downloadUrl: proof.archived.downloadUrl,
        width: proof.rendered.width,
        height: proof.rendered.height,
        sha256: proof.rendered.sha256,
        generationRoute: input.draft.creativePlan.generationRoute,
        renderUrl: proof.rendered.renderUrl,
        sourceAssetVerified: proof.rendered.sourceAssetVerified,
      },
    ],
    packet: [proof, use, remember].map(({ archived, rendered }) => ({
      role: archived.role,
      path: archived.path,
      url: archived.url,
      downloadUrl: archived.downloadUrl,
      width: archived.width,
      height: archived.height,
      sha256: archived.sha256,
      generationRoute: input.draft.creativePlan.generationRoute,
      renderUrl: rendered.renderUrl,
      sourceAssetVerified: rendered.sourceAssetVerified,
    })),
  };

  await Promise.all([
    putLedgerImmutable(campaignRecordKey, jsonBytes(campaignRecord)),
    putLedgerImmutable(
      checksumKey,
      Buffer.from(
        [proof, use, remember]
          .map(({ archived, imageName }) => `${archived.sha256}  ${imageName}`)
          .join("\n") + "\n",
        "utf8",
      ),
    ),
  ]);

  return {
    mode: input.mode,
    dailyDeskEligible: input.draft.dailyDeskEligible,
    runPath,
    image: packetImages[0],
    packetImages,
    campaignRecordKey,
    checksumKey,
  };
}

export async function recentProductionCampaignSlugs(input: {
  now: Date;
  cooldownDays: number;
}) {
  const cutoff = input.now.valueOf() - input.cooldownDays * 86_400_000;
  const records = await campaignLedger().zrange<string[]>(
    acceptedProductionIndex,
    "+inf",
    cutoff,
    { byScore: true, rev: true, offset: 0, count: 60 },
  );
  const slugs = new Set<string>();

  for (const campaignRecordKey of records) {
    try {
      const source = await campaignLedger().get<string>(campaignRecordKey);
      if (!source) continue;
      const parsed = JSON.parse(source) as {
        product?: { slug?: unknown };
      };
      if (typeof parsed.product?.slug === "string") {
        slugs.add(parsed.product.slug);
      }
    } catch {
      // A corrupt historical record is ignored for rotation, never for sending
      // idempotency. The per-run delivery intent remains the send authority.
    }
  }
  return slugs;
}

export async function reserveCampaignDelivery(input: {
  archive: ArchivedCampaign;
  recipient: CampaignDeliveryRecipientRecord;
  createdAt: string;
}) {
  const key = campaignDeliveryIntentKey(input.archive, input.recipient);
  if (input.archive.mode === "production") {
    const acceptedCampaign = await acceptedProductionRecordForDate(
      productionCampaignDate(input.archive),
    );
    if (
      (acceptedCampaign &&
        acceptedCampaign !== input.archive.campaignRecordKey) ||
      !(await claimProductionCampaignForDate(input.archive))
    ) {
      return { reserved: false, key } as const;
    }
  }
  const body = jsonBytes({
    schemaVersion: 1,
    state: "sending",
    campaignRecordKey: input.archive.campaignRecordKey,
    recipient: input.recipient,
    createdAt: input.createdAt,
  }).toString("utf8");
  const stored = await campaignLedger().set(key, body, { nx: true });
  return { reserved: stored === "OK", key } as const;
}

export async function recordCampaignDeliveryOutcome(input: {
  archive: ArchivedCampaign;
  state: "accepted" | "failed";
  recordedAt: string;
  recipient: CampaignDeliveryRecipientRecord;
  errorCode?: string;
}) {
  const safeError = input.errorCode
    ?.replace(/[^a-z0-9_-]+/gi, "-")
    .slice(0, 80);
  const key = campaignDeliveryOutcomeKey(
    input.archive,
    input.state,
    input.recipient,
  );
  await putLedgerImmutable(
    key,
    jsonBytes({
      schemaVersion: 1,
      state: input.state,
      transport: "configured-jelocare-email-provider",
      recipient: input.recipient,
      recordedAt: input.recordedAt,
      ...(input.state === "failed"
        ? { errorCode: safeError || "email-send-failed" }
        : {}),
    }),
  );
  if (
    input.state === "accepted" &&
    input.archive.mode === "production" &&
    input.archive.dailyDeskEligible !== false
  ) {
    const score = Date.parse(input.recordedAt);
    if (!Number.isFinite(score))
      throw new Error("campaign_delivery_time_invalid");
    await campaignLedger().zadd(acceptedProductionIndex, {
      score,
      member: input.archive.campaignRecordKey,
    });
  }
  return key;
}

export function campaignRecipientKey(
  email: string,
  env: Record<string, string | undefined> = process.env,
) {
  const secret = env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("campaign_recipient_key_secret_missing");
  }
  return createHmac("sha256", secret)
    .update(email.trim().toLowerCase(), "utf8")
    .digest("hex");
}
