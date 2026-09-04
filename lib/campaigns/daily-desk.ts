import "server-only";

import { z } from "zod";
import { acceptedDailyDeskCampaignJsonForDate } from "@/lib/campaigns/campaign-archive";
import { lagosDateKey } from "@/lib/campaigns/daily-campaign-policy";
import { findCatalogueProduct } from "@/lib/catalogue/repository";
import { formatCampaignProductSize } from "@/lib/share/campaign-story";
import { isShareableNgOffer } from "@/modules/commerce/shareable-offer";
import type { Product } from "@/data/products";

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
        retailer: z.string().trim().min(1).max(160),
        listingUrl: httpsUrl,
        priceNgn: z.number().positive().max(100_000_000),
        stock: z.enum(["in-stock", "low-stock", "out-of-stock", "unknown"]),
        observedAt: isoTimestamp,
        checkedAt: isoTimestamp.nullable(),
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
  recency: "current-day" | "previous-day";
  campaignId: string;
  product: AcceptedCampaign["product"];
  copy: AcceptedCampaign["copy"];
  actionUrl: string;
  image: AcceptedCampaign["creative"][number];
  evidence: {
    boundary: string;
    offerCount: number;
    dataCheckedAt: string;
    offers: AcceptedCampaign["offerEvidence"];
  };
};

export type DailyDeskReadModel =
  | DailyDeskReady
  | { status: "no-campaign"; date: string }
  | { status: "evidence-expired"; date: string }
  | { status: "unavailable"; date: string };

export function projectAcceptedCampaignForDailyDesk(
  source: string,
  date: string,
  recency: DailyDeskReady["recency"] = "current-day",
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
      recency,
      campaignId: campaign.campaignId,
      product: campaign.product,
      copy: campaign.copy,
      actionUrl: campaign.actionUrl,
      image: campaign.creative[0]!,
      evidence: {
        boundary: campaign.evidenceBoundary,
        offerCount: campaign.offerEvidence.length,
        dataCheckedAt: campaign.dataCheckedAt,
        offers: campaign.offerEvidence,
      },
    };
  } catch {
    return null;
  }
}

type DailyDeskDependencies = {
  readAcceptedCampaign: (date: string) => Promise<string | null>;
  readProduct: (slug: string) => Promise<Product | null>;
};

const defaultDependencies: DailyDeskDependencies = {
  readAcceptedCampaign: acceptedDailyDeskCampaignJsonForDate,
  readProduct: async (slug) => (await findCatalogueProduct(slug)) ?? null,
};

function normalizedRetailer(value: string) {
  return value.trim().toLocaleLowerCase("en-NG");
}

function normalizedHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function offerObservedAt(offer: Product["offers"][number]) {
  return (
    offer.checkedAt ??
    offer.priceObservation?.observedAt ??
    offer.listingEvidence?.observedAt ??
    null
  );
}

/**
 * Binds an immutable Desk record back to the exact offers that are actionable
 * now. The archive stays untouched; a terminal contradiction, expiry, price
 * change, or listing replacement only suppresses the public projection.
 */
export function dailyDeskEvidenceIsCurrent(
  desk: DailyDeskReady,
  product: Pick<Product, "slug" | "brand" | "name" | "size" | "offers"> | null,
  now: number | Date = Date.now(),
) {
  if (
    !product ||
    product.slug !== desk.product.slug ||
    product.brand !== desk.product.brand ||
    product.name !== desk.product.name ||
    formatCampaignProductSize(product.slug, product.size) !== desk.product.size
  ) {
    return false;
  }

  const currentOffers = product.offers.filter((offer) =>
    isShareableNgOffer(offer, now),
  );
  if (currentOffers.length !== desk.evidence.offers.length) return false;
  const seen = new Set<string>();

  return desk.evidence.offers.every((accepted) => {
    const acceptedUrl = normalizedHttpsUrl(accepted.listingUrl);
    const retailer = normalizedRetailer(accepted.retailer);
    if (!acceptedUrl || !retailer) return false;
    const key = `${retailer}\u0000${acceptedUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);

    const matches = currentOffers.filter(
      (offer) =>
        normalizedRetailer(offer.retailer) === retailer &&
        normalizedHttpsUrl(offer.url) === acceptedUrl,
    );
    if (matches.length !== 1) return false;
    const current = matches[0]!;
    const observedAt = offerObservedAt(current);
    const currentObservedAt = observedAt ? Date.parse(observedAt) : Number.NaN;
    const acceptedObservedAt = Date.parse(accepted.observedAt);
    return (
      current.priceNgn === accepted.priceNgn &&
      Number.isFinite(currentObservedAt) &&
      currentObservedAt >= acceptedObservedAt
    );
  });
}

function previousCalendarDate(date: string) {
  const middayUtc = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(middayUtc)) throw new Error("daily_desk_date_invalid");
  return new Date(middayUtc - 86_400_000).toISOString().slice(0, 10);
}

export async function getDailyDeskReadModel(
  input: { now?: Date | number } = {},
  dependencies: DailyDeskDependencies = defaultDependencies,
): Promise<DailyDeskReadModel> {
  const now = input.now ?? new Date();
  const date = lagosDateKey(now);
  try {
    const source = await dependencies.readAcceptedCampaign(date);
    if (source) {
      const projected = projectAcceptedCampaignForDailyDesk(source, date);
      if (!projected) return { status: "unavailable", date };
      const product = await dependencies.readProduct(projected.product.slug);
      return dailyDeskEvidenceIsCurrent(projected, product, now)
        ? projected
        : { status: "evidence-expired", date };
    }

    const previousDate = previousCalendarDate(date);
    const previousSource =
      await dependencies.readAcceptedCampaign(previousDate);
    if (!previousSource) return { status: "no-campaign", date };
    const projected = projectAcceptedCampaignForDailyDesk(
      previousSource,
      previousDate,
      "previous-day",
    );
    if (!projected) return { status: "unavailable", date };
    const product = await dependencies.readProduct(projected.product.slug);
    return dailyDeskEvidenceIsCurrent(projected, product, now)
      ? projected
      : { status: "evidence-expired", date };
  } catch {
    return { status: "unavailable", date };
  }
}
