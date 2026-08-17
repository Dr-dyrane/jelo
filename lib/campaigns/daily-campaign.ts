import "server-only";

import { canonicalBrandName } from "@/data/brand-canonical-names";
import { findCatalogueProduct } from "@/lib/catalogue/repository";
import {
  buildCampaignTrendStory,
  formatCampaignProductSize,
} from "@/lib/share/campaign-story";
import { getProductTrendData } from "@/lib/share/product-trends";
import { getWorthSharingReadModel } from "@/lib/share/worth-sharing";
import {
  buildCampaignCopy,
  campaignStoryChoice,
  lagosDateKey,
  type CampaignCopy,
  type CampaignStoryChoice,
} from "@/lib/campaigns/daily-campaign-policy";
import {
  publishedCampaignProductEvidence,
  type CampaignProductIdentifier,
} from "@/lib/campaigns/product-evidence";
import { isShareableNgOffer } from "@/modules/commerce/shareable-offer";
import type { ShareSignal } from "@/modules/commerce/share-insights";

export type DailyCampaignOfferEvidence = {
  retailer: string;
  listingUrl: string;
  priceNgn: number;
  stock: "in-stock" | "low-stock" | "out-of-stock" | "unknown";
  observedAt: string;
  checkedAt: string | null;
};

export type DailyCampaignDraft = {
  schemaVersion: 1;
  campaignId: string;
  status: "draft";
  createdAt: string;
  dataCheckedAt: string;
  objective: string;
  selection: {
    source: "live-share-ranked-pool";
    signalKind: "drop" | "gap" | "fresh";
    evidenceRank: number;
    recentProductCooldownDays: number;
    rejectedCandidates: Array<{ slug: string; blocker: string }>;
  };
  product: {
    slug: string;
    brand: string;
    name: string;
    size: string;
    packageVersion: string;
    identifier: CampaignProductIdentifier;
    publicationScope: "neutral-reference" | "recommendation-eligible";
  };
  sourceAsset: {
    url: string;
    sha256: string;
    mimeType: string;
    width: number;
    height: number;
  };
  publicationEvidence: {
    dossierFingerprint: string;
    releaseFingerprint: string;
  };
  offerEvidence: DailyCampaignOfferEvidence[];
  evidenceBoundary: string;
  careBoundary: string;
  copy: CampaignCopy;
  creativePlan: {
    mode: "dark";
    width: 1080;
    height: 1920;
    generationRoute: "deterministic-next-og-story";
    storyKind: "price" | "trend";
    trendWindow: "7d" | "1m" | null;
    renderPath: string;
  };
  channels: ["whatsapp-status", "instagram-stories", "snapchat"];
  actionUrl: string;
  publication: [];
};

export type DailyCampaignSelection =
  | { status: "selected"; draft: DailyCampaignDraft }
  | {
      status: "no-candidate";
      checkedAt: string;
      rejectedCandidates: Array<{ slug: string; blocker: string }>;
    };

const cooldownDays = 14;

function timestamp(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function stockStatus(
  value: string | null | undefined,
): DailyCampaignOfferEvidence["stock"] {
  if (
    value === "in-stock" ||
    value === "low-stock" ||
    value === "out-of-stock"
  ) {
    return value;
  }
  return "unknown";
}

function objective(signal: ShareSignal, story: CampaignStoryChoice) {
  if (story.kind === "trend") return "current same-retailer price movement";
  if (signal.kind === "gap" || signal.storeCount >= 2)
    return "current multi-store price comparison";
  return "current Nigerian price reference";
}

function storyPath(slug: string, story: CampaignStoryChoice) {
  const query = new URLSearchParams({ kind: story.kind });
  if (story.window) query.set("window", story.window);
  return `/share/${encodeURIComponent(slug)}/story?${query.toString()}`;
}

export function campaignProductIdentityMatchesEvidence(
  product: { brand: string; name: string; size: string; image: string },
  evidence: NonNullable<ReturnType<typeof publishedCampaignProductEvidence>>,
) {
  return (
    canonicalBrandName(product.brand) === canonicalBrandName(evidence.brand) &&
    product.name === evidence.name &&
    product.size === evidence.size &&
    product.image === evidence.finalImage.url
  );
}

export async function selectDailyCampaign(input: {
  now?: number | Date;
  recentProductSlugs?: ReadonlySet<string>;
}): Promise<DailyCampaignSelection> {
  const now = input.now ?? Date.now();
  const nowDate = typeof now === "number" ? new Date(now) : now;
  const nowMs = nowDate.valueOf();
  if (!Number.isFinite(nowMs)) throw new Error("campaign_invalid_clock");

  const recentProductSlugs = input.recentProductSlugs ?? new Set<string>();
  const signals = await getWorthSharingReadModel({ now: nowDate });
  const rejectedCandidates: Array<{ slug: string; blocker: string }> = [];

  let selected:
    | {
        signal: ShareSignal;
        evidence: NonNullable<
          ReturnType<typeof publishedCampaignProductEvidence>
        >;
        product: NonNullable<Awaited<ReturnType<typeof findCatalogueProduct>>>;
        rank: number;
      }
    | undefined;

  for (const [rank, signal] of signals.rankedPool.entries()) {
    if (recentProductSlugs.has(signal.slug)) {
      rejectedCandidates.push({
        slug: signal.slug,
        blocker: `sent-within-${cooldownDays}-day-cooldown`,
      });
      continue;
    }
    const evidence = publishedCampaignProductEvidence(signal.slug);
    if (!evidence) {
      rejectedCandidates.push({
        slug: signal.slug,
        blocker: "published-dossier-or-release-unavailable",
      });
      continue;
    }
    // Resolve the candidate through the same per-product repository boundary
    // used by the deterministic story route. The catalogue list and product
    // caches can refresh at different moments, so trusting the list snapshot
    // here can select a product that the renderer correctly rejects.
    const product = await findCatalogueProduct(signal.slug);
    if (!product) {
      rejectedCandidates.push({
        slug: signal.slug,
        blocker: "live-product-unavailable",
      });
      continue;
    }
    if (!campaignProductIdentityMatchesEvidence(product, evidence)) {
      rejectedCandidates.push({
        slug: signal.slug,
        blocker: "live-product-dossier-identity-drift",
      });
      continue;
    }
    if (!product.offers.some((offer) => isShareableNgOffer(offer, nowDate))) {
      rejectedCandidates.push({
        slug: signal.slug,
        blocker: "no-fresh-shareable-ng-offer",
      });
      continue;
    }
    selected = { signal, evidence, product, rank: rank + 1 };
    break;
  }

  const checkedAt = nowDate.toISOString();
  if (!selected) {
    return { status: "no-candidate", checkedAt, rejectedCandidates };
  }

  const displaySize = formatCampaignProductSize(
    selected.product.slug,
    selected.product.size,
  );
  let story = campaignStoryChoice(selected.signal);
  let trendCopy: {
    retailer: string;
    direction: "down" | "up" | "flat";
    percent: number;
    windowLabel: "7 days" | "30 days";
  } | null = null;

  if (story.kind === "trend") {
    const trendData = await getProductTrendData(selected.signal.slug);
    if (trendData && story.window) {
      const referenceNow = trendData.summary.observedAt
        ? Date.parse(trendData.summary.observedAt)
        : nowMs;
      const trend = buildCampaignTrendStory(
        trendData,
        Number.isFinite(referenceNow) ? referenceNow : nowMs,
        story.window,
      );
      if (trend.mode === "history" && trend.direction === "down") {
        trendCopy = {
          retailer: trend.retailer,
          direction: trend.direction,
          percent: trend.percent,
          windowLabel: story.window === "1m" ? "30 days" : "7 days",
        };
      } else {
        story = { kind: "price", window: null };
      }
    } else {
      story = { kind: "price", window: null };
    }
  }

  const actionUrl = `https://www.jelocare.com/share/${selected.product.slug}`;
  const copy = buildCampaignCopy(selected.signal, {
    size: displaySize,
    shareUrl: actionUrl,
    trend: trendCopy,
  });
  const offerEvidence = selected.product.offers
    .filter((offer) => isShareableNgOffer(offer, nowDate))
    .sort(
      (left, right) =>
        (left.priceNgn as number) - (right.priceNgn as number) ||
        left.retailer.localeCompare(right.retailer),
    )
    .map((offer): DailyCampaignOfferEvidence => ({
      retailer: offer.retailer,
      listingUrl: offer.url,
      priceNgn: offer.priceNgn as number,
      stock: stockStatus(offer.priceObservation?.stock),
      observedAt:
        offer.checkedAt ??
        offer.priceObservation?.observedAt ??
        offer.listingEvidence?.observedAt ??
        checkedAt,
      checkedAt: offer.checkedAt ?? null,
    }));
  const observedAt = offerEvidence
    .map((offer) => offer.observedAt)
    .sort((left, right) => timestamp(right) - timestamp(left))[0];
  const dateKey = lagosDateKey(nowDate);
  const purpose = story.kind === "trend" ? "price-movement" : "price-context";

  return {
    status: "selected",
    draft: {
      schemaVersion: 1,
      campaignId: `${dateKey}-${selected.product.slug}-${purpose}`,
      status: "draft",
      createdAt: checkedAt,
      dataCheckedAt: checkedAt,
      objective: objective(selected.signal, story),
      selection: {
        source: "live-share-ranked-pool",
        signalKind: selected.signal.kind,
        evidenceRank: selected.rank,
        recentProductCooldownDays: cooldownDays,
        rejectedCandidates,
      },
      product: {
        slug: selected.product.slug,
        brand: selected.product.brand,
        name: selected.product.name,
        size: displaySize,
        packageVersion: selected.evidence.packageVersion,
        identifier: selected.evidence.identifier,
        publicationScope: selected.evidence.publicationScope,
      },
      sourceAsset: selected.evidence.finalImage,
      publicationEvidence: {
        dossierFingerprint: selected.evidence.dossierFingerprint,
        releaseFingerprint: selected.evidence.releaseFingerprint,
      },
      offerEvidence,
      evidenceBoundary:
        `Price/share-ready only: ${offerEvidence.length} fresh, exact, evidence-bound Nigerian ` +
        `${offerEvidence.length === 1 ? "listing" : "listings"}; newest observation ${observedAt}. ` +
        "No sale, saving, authenticity, retailer-quality, or suitability claim.",
      careBoundary: "Price context only. " + selected.evidence.careBoundary,
      copy,
      creativePlan: {
        mode: "dark",
        width: 1080,
        height: 1920,
        generationRoute: "deterministic-next-og-story",
        storyKind: story.kind,
        trendWindow: story.window,
        renderPath: storyPath(selected.product.slug, story),
      },
      channels: ["whatsapp-status", "instagram-stories", "snapchat"],
      actionUrl,
      publication: [],
    },
  };
}
