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
import {
  dailyEditorialPillars,
  claimSafeMarketPillar,
  type CampaignPillar,
} from "@/lib/campaigns/daily-campaign-editorial";

export type DailyCampaignOfferEvidence = {
  retailer: string;
  listingUrl: string;
  priceNgn: number;
  stock: "in-stock" | "low-stock" | "out-of-stock" | "unknown";
  observedAt: string;
  checkedAt: string | null;
};

type CampaignPacketPlan = readonly [
  {
    role: "proof";
    renderKind: "product-story" | "review-pillar";
    renderPath: string;
    pillar: CampaignPillar;
  },
  {
    role: "use";
    renderKind: "review-pillar";
    renderPath: string;
    pillar: CampaignPillar;
  },
  {
    role: "remember";
    renderKind: "review-pillar";
    renderPath: string;
    pillar: CampaignPillar;
  },
];

type DailyCampaignSelectionDetails = {
  source: "live-share-ranked-pool";
  signalKind: "drop" | "gap" | "fresh" | null;
  evidenceRank: number | null;
  recentProductCooldownDays: number;
  catalogueProductCount: number;
  freshPriceCandidateCount: number;
  rejectedCandidates: Array<{ slug: string; blocker: string }>;
};

type DailyCampaignDraftBase = {
  campaignId: string;
  status: "draft";
  createdAt: string;
  dataCheckedAt: string;
  objective: string;
  selection: DailyCampaignSelectionDetails;
  offerEvidence: DailyCampaignOfferEvidence[];
  evidenceBoundary: string;
  careBoundary: string;
  copy: CampaignCopy;
  channels: ["whatsapp-status", "instagram-stories", "snapchat"];
  actionUrl: string;
  publication: [];
};

export type DailyMarketCampaignDraft = DailyCampaignDraftBase & {
  schemaVersion: 1;
  campaignKind: "market-plus-editorial";
  dailyDeskEligible: true;
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
    packet: CampaignPacketPlan;
  };
};

export type DailyEditorialFallbackDraft = DailyCampaignDraftBase & {
  schemaVersion: 2;
  campaignKind: "editorial-fallback";
  dailyDeskEligible: false;
  product: null;
  sourceAsset: null;
  publicationEvidence: null;
  creativePlan: {
    mode: "dark";
    width: 1080;
    height: 1920;
    generationRoute: "deterministic-next-og-story";
    storyKind: "editorial";
    trendWindow: null;
    renderPath: string;
    packet: CampaignPacketPlan;
  };
};

export type DailyCampaignDraft =
  DailyMarketCampaignDraft | DailyEditorialFallbackDraft;

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

function storyPath(
  slug: string,
  story: CampaignStoryChoice,
  variant?: "use" | "remember",
) {
  const query = new URLSearchParams({ kind: story.kind });
  if (story.window) query.set("window", story.window);
  if (variant) query.set("variant", variant);
  return `/share/${encodeURIComponent(slug)}/story?${query.toString()}`;
}

function editorialRenderPath(dateKey: string, role: CampaignPillar["role"]) {
  return `/campaigns/daily/${dateKey}/${role}`;
}

function campaignPacketPlan(
  slug: string,
  proofStory: CampaignStoryChoice,
  now: Date,
  marketPillar: CampaignPillar,
) {
  const dateKey = lagosDateKey(now);
  const [useful, relatable] = dailyEditorialPillars(now);
  return [
    {
      role: "proof",
      renderKind: "product-story",
      renderPath: storyPath(slug, proofStory),
      pillar: marketPillar,
    },
    {
      role: "use",
      renderKind: "review-pillar",
      renderPath: editorialRenderPath(dateKey, "use"),
      pillar: useful,
    },
    {
      role: "remember",
      renderKind: "review-pillar",
      renderPath: editorialRenderPath(dateKey, "remember"),
      pillar: relatable,
    },
  ] as const;
}

export function buildEditorialFallbackCampaign(input: {
  now: Date;
  checkedAt: string;
  catalogueProductCount: number;
  priceEligibleProductCount: number;
  freshPriceCandidateCount: number;
  rejectedCandidates: Array<{ slug: string; blocker: string }>;
}): DailyEditorialFallbackDraft {
  const dateKey = lagosDateKey(input.now);
  const market = claimSafeMarketPillar(input);
  const [useful, relatable] = dailyEditorialPillars(input.now);
  const packet: CampaignPacketPlan = [
    {
      role: "proof",
      renderKind: "review-pillar",
      renderPath: editorialRenderPath(dateKey, "proof"),
      pillar: market,
    },
    {
      role: "use",
      renderKind: "review-pillar",
      renderPath: editorialRenderPath(dateKey, "use"),
      pillar: useful,
    },
    {
      role: "remember",
      renderKind: "review-pillar",
      renderPath: editorialRenderPath(dateKey, "remember"),
      pillar: relatable,
    },
  ];
  return {
    schemaVersion: 2,
    campaignKind: "editorial-fallback",
    dailyDeskEligible: false,
    campaignId: `${dateKey}-editorial-review-packet`,
    status: "draft",
    createdAt: input.checkedAt,
    dataCheckedAt: input.checkedAt,
    objective: "daily market integrity, useful guidance and relatable reach",
    selection: {
      source: "live-share-ranked-pool",
      signalKind: null,
      evidenceRank: null,
      recentProductCooldownDays: cooldownDays,
      catalogueProductCount: input.catalogueProductCount,
      freshPriceCandidateCount: input.freshPriceCandidateCount,
      rejectedCandidates: input.rejectedCandidates,
    },
    product: null,
    sourceAsset: null,
    publicationEvidence: null,
    offerEvidence: [],
    evidenceBoundary:
      "Full public catalogue checked. No product price is shown without fresh, exact, evidence-bound Nigerian listing evidence.",
    careBoundary:
      "Service guidance and brand-safe observation only. No diagnosis or suitability claim.",
    copy: {
      headline: market.headline,
      productLine: "FULL-CATALOGUE MARKET CHECK",
      priceLine: "No current price claim today.",
      action: market.action,
      disclaimer: "Evidence before urgency.",
      caption: market.caption,
      embeddedUrl: null,
    },
    creativePlan: {
      mode: "dark",
      width: 1080,
      height: 1920,
      generationRoute: "deterministic-next-og-story",
      storyKind: "editorial",
      trendWindow: null,
      renderPath: packet[0].renderPath,
      packet,
    },
    channels: ["whatsapp-status", "instagram-stories", "snapchat"],
    actionUrl: market.actionUrl,
    publication: [],
  };
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
    return {
      status: "selected",
      draft: buildEditorialFallbackCampaign({
        now: nowDate,
        checkedAt,
        catalogueProductCount: signals.catalogueProductCount,
        priceEligibleProductCount: signals.priceEligibleProductCount,
        freshPriceCandidateCount: signals.rankedPool.length,
        rejectedCandidates,
      }),
    };
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
  const marketPillar: CampaignPillar = {
    role: "proof",
    kind: "market",
    label: "Market",
    eyebrow: "Today’s market check",
    headline: copy.headline,
    body: `${copy.productLine}. ${copy.priceLine}.`,
    action: copy.action,
    actionUrl,
    caption: copy.caption,
    footerNote: "Exact product. Fresh Nigerian listings. Prices can change.",
    evidenceNote: `${offerEvidence.length} fresh, exact Nigerian ${offerEvidence.length === 1 ? "listing" : "listings"}. Prices change.`,
  };

  return {
    status: "selected",
    draft: {
      schemaVersion: 1,
      campaignKind: "market-plus-editorial",
      dailyDeskEligible: true,
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
        catalogueProductCount: signals.catalogueProductCount,
        freshPriceCandidateCount: signals.rankedPool.length,
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
        packet: campaignPacketPlan(
          selected.product.slug,
          story,
          nowDate,
          marketPillar,
        ),
      },
      channels: ["whatsapp-status", "instagram-stories", "snapchat"],
      actionUrl,
      publication: [],
    },
  };
}
