import "server-only";

import { z } from "zod";
import { acceptedProductionCampaignJsonForDate } from "@/lib/campaigns/campaign-archive";
import { lagosDateKey } from "@/lib/campaigns/daily-campaign-policy";

const httpsUrl = z.string().url().startsWith("https://");
const isoTimestamp = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)));

const acceptedCampaignSchema = z.object({
  schemaVersion: z.literal(1),
  campaignId: z.string().regex(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,180}$/),
  dataCheckedAt: isoTimestamp,
  product: z.object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(160),
    brand: z.string().trim().min(1).max(160),
    name: z.string().trim().min(1).max(200),
    size: z.string().trim().min(1).max(80),
  }),
  offerEvidence: z
    .array(
      z.object({
        priceNgn: z.number().positive().max(100_000_000),
      }),
    )
    .min(1)
    .max(20),
  evidenceBoundary: z.string().startsWith("Price/share-ready only:").max(1_000),
  copy: z.object({
    headline: z.string().trim().min(1).max(160),
    productLine: z.string().trim().min(1).max(320),
    priceLine: z.string().trim().min(1).max(160),
    action: z.literal("Compare current prices"),
    disclaimer: z.literal("Prices change."),
  }),
  actionUrl: httpsUrl,
  creative: z
    .array(
      z.object({
        mode: z.literal("dark"),
        url: httpsUrl,
        width: z.literal(1080),
        height: z.literal(1920),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        generationRoute: z.literal("deterministic-next-og-story"),
        sourceAssetVerified: z.literal(true),
      }),
    )
    .min(1)
    .max(2),
});

type AcceptedCampaign = z.infer<typeof acceptedCampaignSchema>;

export type DailyDeskReady = {
  status: "ready";
  date: string;
  campaignId: string;
  product: AcceptedCampaign["product"];
  copy: AcceptedCampaign["copy"];
  actionUrl: string;
  image: AcceptedCampaign["creative"][number];
  evidence: {
    boundary: string;
    offerCount: number;
    dataCheckedAt: string;
  };
};

export type DailyDeskReadModel =
  | DailyDeskReady
  | { status: "no-campaign"; date: string }
  | { status: "unavailable"; date: string };

export function projectAcceptedCampaignForDailyDesk(
  source: string,
  date: string,
): DailyDeskReady | null {
  try {
    const parsed = acceptedCampaignSchema.safeParse(JSON.parse(source));
    if (!parsed.success) return null;
    const campaign = parsed.data;
    const expectedActionUrl = `https://www.jelocare.com/share/${campaign.product.slug}`;
    if (!campaign.campaignId.startsWith(`${date}-`)) return null;
    if (campaign.actionUrl !== expectedActionUrl) return null;

    return {
      status: "ready",
      date,
      campaignId: campaign.campaignId,
      product: campaign.product,
      copy: campaign.copy,
      actionUrl: campaign.actionUrl,
      image: campaign.creative[0]!,
      evidence: {
        boundary: campaign.evidenceBoundary,
        offerCount: campaign.offerEvidence.length,
        dataCheckedAt: campaign.dataCheckedAt,
      },
    };
  } catch {
    return null;
  }
}

type DailyDeskDependencies = {
  readAcceptedCampaign: (date: string) => Promise<string | null>;
};

const defaultDependencies: DailyDeskDependencies = {
  readAcceptedCampaign: acceptedProductionCampaignJsonForDate,
};

export async function getDailyDeskReadModel(
  input: { now?: Date | number } = {},
  dependencies: DailyDeskDependencies = defaultDependencies,
): Promise<DailyDeskReadModel> {
  const now = input.now ?? new Date();
  const date = lagosDateKey(now);
  try {
    const source = await dependencies.readAcceptedCampaign(date);
    if (!source) return { status: "no-campaign", date };
    return (
      projectAcceptedCampaignForDailyDesk(source, date) ?? {
        status: "unavailable",
        date,
      }
    );
  } catch {
    return { status: "unavailable", date };
  }
}
