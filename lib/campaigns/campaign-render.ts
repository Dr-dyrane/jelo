import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import { GET as renderCampaignStoryRoute } from "@/app/(site)/share/[slug]/story/route";
import type { DailyCampaignDraft } from "@/lib/campaigns/daily-campaign";

const MAX_PACKSHOT_BYTES = 12 * 1024 * 1024;
const MAX_STORY_BYTES = 12 * 1024 * 1024;

export type RenderedCampaignStory = {
  bytes: Buffer;
  sha256: string;
  width: 1080;
  height: 1920;
  contentType: "image/png";
  sourceAssetVerified: true;
  renderUrl: string;
};

async function boundedResponseBytes(response: Response, maximum: number) {
  const length = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > maximum) {
    throw new Error("campaign_asset_too_large");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > maximum) {
    throw new Error("campaign_asset_invalid_size");
  }
  return bytes;
}

async function verifySourceAsset(
  draft: DailyCampaignDraft,
  fetcher: typeof fetch,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetcher(draft.sourceAsset.url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: draft.sourceAsset.mimeType },
    });
    if (!response.ok) throw new Error("campaign_source_asset_unavailable");
    const bytes = await boundedResponseBytes(response, MAX_PACKSHOT_BYTES);
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== draft.sourceAsset.sha256) {
      throw new Error("campaign_source_asset_digest_mismatch");
    }
    const metadata = await sharp(bytes, { animated: false }).metadata();
    if (
      metadata.format !== "png" ||
      metadata.width !== draft.sourceAsset.width ||
      metadata.height !== draft.sourceAsset.height
    ) {
      throw new Error("campaign_source_asset_geometry_mismatch");
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function renderDailyCampaignStory(input: {
  draft: DailyCampaignDraft;
  requestOrigin: string;
  fetcher?: typeof fetch;
}): Promise<RenderedCampaignStory> {
  const fetcher = input.fetcher ?? fetch;
  const origin = new URL(input.requestOrigin);
  if (origin.protocol !== "https:" && origin.hostname !== "localhost") {
    throw new Error("campaign_render_origin_invalid");
  }

  await verifySourceAsset(input.draft, fetcher);

  const renderUrl = new URL(
    input.draft.creativePlan.renderPath,
    origin,
  ).toString();
  const response = await renderCampaignStoryRoute(new Request(renderUrl), {
    params: Promise.resolve({ slug: input.draft.product.slug }),
  });
  if (!response.ok) {
    throw new Error(`campaign_story_render_${response.status}`);
  }
  if (response.headers.get("content-type")?.split(";")[0] !== "image/png") {
    throw new Error("campaign_story_render_wrong_type");
  }
  const bytes = await boundedResponseBytes(response, MAX_STORY_BYTES);
  const metadata = await sharp(bytes, { animated: false }).metadata();
  if (
    metadata.format !== "png" ||
    metadata.width !== input.draft.creativePlan.width ||
    metadata.height !== input.draft.creativePlan.height
  ) {
    throw new Error("campaign_story_render_wrong_geometry");
  }

  return {
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width: 1080,
    height: 1920,
    contentType: "image/png",
    sourceAssetVerified: true,
    renderUrl,
  };
}
