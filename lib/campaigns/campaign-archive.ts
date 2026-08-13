import "server-only";

import { createHmac } from "node:crypto";
import { Redis } from "@upstash/redis";
import {
  BlobPreconditionFailedError,
  head,
  put,
  type HeadBlobResult,
} from "@vercel/blob";
import type { DailyCampaignDraft } from "@/lib/campaigns/daily-campaign";
import type { RenderedCampaignStory } from "@/lib/campaigns/campaign-render";

export type CampaignRunMode = "preview" | "test" | "production";

export type ArchivedCampaign = {
  mode: CampaignRunMode;
  runPath: string;
  image: {
    path: string;
    url: string;
    downloadUrl: string;
    sha256: string;
    width: 1080;
    height: 1920;
  };
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
let redis: Redis | undefined;

function productionCampaignDate(archive: ArchivedCampaign) {
  const date = archive.runPath.match(
    /^campaigns\/daily\/(\d{4}-\d{2}-\d{2})\//,
  )?.[1];
  if (!date) throw new Error("campaign_production_date_invalid");
  return date;
}

export function campaignDeliveryIntentKey(archive: ArchivedCampaign) {
  if (archive.mode !== "production") {
    return `${archive.campaignRecordKey}:delivery-intent`;
  }
  return `${ledgerPrefix}:production:${productionCampaignDate(archive)}:delivery-intent`;
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
  rendered: RenderedCampaignStory,
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
    if (!(error instanceof BlobPreconditionFailedError)) throw error;
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
  rendered: RenderedCampaignStory;
}): Promise<ArchivedCampaign> {
  const iteration = safeIteration(input.iteration);
  const date = input.draft.campaignId.slice(0, 10);
  const runPath = `${runPrefix(input.mode)}/${date}/${input.draft.campaignId}/v${iteration}`;
  const imageName = `${input.draft.product.slug}-${input.draft.creativePlan.storyKind}-${input.rendered.sha256.slice(0, 16)}.png`;
  const imagePath = `${runPath}/${imageName}`;
  const image = await putPublicImage(imagePath, input.rendered);
  const recordPrefix = `${ledgerPrefix}:${input.mode}:${input.draft.campaignId}:v${iteration}`;
  const campaignRecordKey = `${recordPrefix}:campaign`;
  const checksumKey = `${recordPrefix}:checksum`;
  const campaignRecord = {
    ...input.draft,
    creative: [
      {
        mode: input.draft.creativePlan.mode,
        path: imagePath,
        url: image.url,
        downloadUrl: image.downloadUrl,
        width: input.rendered.width,
        height: input.rendered.height,
        sha256: input.rendered.sha256,
        generationRoute: input.draft.creativePlan.generationRoute,
        renderUrl: input.rendered.renderUrl,
        sourceAssetVerified: input.rendered.sourceAssetVerified,
      },
    ],
  };

  await Promise.all([
    putLedgerImmutable(campaignRecordKey, jsonBytes(campaignRecord)),
    putLedgerImmutable(
      checksumKey,
      Buffer.from(`${input.rendered.sha256}  ${imageName}\n`, "utf8"),
    ),
  ]);

  return {
    mode: input.mode,
    runPath,
    image: {
      path: imagePath,
      url: image.url,
      downloadUrl: image.downloadUrl,
      sha256: input.rendered.sha256,
      width: input.rendered.width,
      height: input.rendered.height,
    },
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
  const key = campaignDeliveryIntentKey(input.archive);
  if (
    input.archive.mode === "production" &&
    (await acceptedProductionRecordForDate(
      productionCampaignDate(input.archive),
    ))
  ) {
    return { reserved: false, key } as const;
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
  const suffix =
    input.state === "accepted" ? "delivery-accepted" : "delivery-failed";
  const key = `${input.archive.campaignRecordKey}:${suffix}`;
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
  if (input.state === "accepted" && input.archive.mode === "production") {
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
