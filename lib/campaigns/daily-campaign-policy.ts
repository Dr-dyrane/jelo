import type { ShareSignal } from "@/modules/commerce/share-insights";

export const CAMPAIGN_TIME_ZONE = "Africa/Lagos";
export const CAMPAIGN_COOLDOWN_DAYS = 14;

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export type CampaignStoryChoice = {
  kind: "price" | "trend";
  window: "7d" | "1m" | null;
};

export type CampaignCopy = {
  headline: string;
  productLine: string;
  priceLine: string;
  action: string;
  disclaimer: string;
  caption: string;
  embeddedUrl: null;
};

export function lagosDateKey(value: number | Date) {
  const date = typeof value === "number" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPAIGN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function campaignStoryChoice(signal: ShareSignal): CampaignStoryChoice {
  if (signal.kind === "drop") {
    return {
      kind: "trend",
      window: signal.drop.days === 30 ? "1m" : "7d",
    };
  }
  return { kind: "price", window: null };
}

export function buildCampaignCopy(
  signal: ShareSignal,
  input: {
    size: string;
    shareUrl: string;
    trend?: {
      retailer: string;
      direction: "down" | "up" | "flat";
      percent: number;
      windowLabel: "7 days" | "30 days";
    } | null;
  },
): CampaignCopy {
  const productLine = `${signal.brand.toLocaleUpperCase("en-NG")} · ${signal.name} · ${input.size}`;
  const action = "Compare current prices";
  const disclaimer = "Prices change.";

  if (signal.kind === "drop" && input.trend?.direction === "down") {
    const magnitude = Math.abs(input.trend.percent);
    const percent = `${magnitude >= 10 ? magnitude.toFixed(0) : magnitude.toFixed(1)}%`;
    return {
      headline: `Down ${percent}.`,
      productLine,
      priceLine: `${input.trend.retailer} · ${input.trend.windowLabel}`,
      action,
      disclaimer,
      caption: `${signal.brand} ${signal.name} moved down ${percent} at ${input.trend.retailer}. Compare current Nigerian prices: ${input.shareUrl} Prices change.`,
      embeddedUrl: null,
    };
  }

  if (
    signal.kind === "gap" ||
    (signal.kind === "drop" && signal.storeCount >= 2)
  ) {
    const low = signal.lowestNaira;
    const high = signal.highestNaira;
    const spread = signal.kind === "gap" ? signal.gap.spreadNaira : high - low;
    return {
      headline: `Same product. ${naira.format(spread)} apart.`,
      productLine,
      priceLine: `${naira.format(low)} — ${naira.format(high)}`,
      action,
      disclaimer,
      caption: `Same product, ${naira.format(spread)} apart across current Nigerian listings. Compare ${signal.brand} ${signal.name}: ${input.shareUrl} Prices change.`,
      embeddedUrl: null,
    };
  }

  const priceLine =
    signal.storeCount >= 2
      ? `${naira.format(signal.lowestNaira)} — ${naira.format(signal.highestNaira)}`
      : naira.format(signal.lowestNaira);
  return {
    headline:
      signal.storeCount >= 2 ? "Current price range." : "Current price.",
    productLine,
    priceLine,
    action,
    disclaimer,
    caption: `Current Nigerian price context for ${signal.brand} ${signal.name}: ${input.shareUrl} Prices change.`,
    embeddedUrl: null,
  };
}

export function chooseEligibleSignal<T extends { slug: string }>(
  ranked: readonly T[],
  input: {
    recentProductSlugs: ReadonlySet<string>;
    isEligible: (signal: T) => boolean;
  },
) {
  return (
    ranked.find(
      (signal) =>
        !input.recentProductSlugs.has(signal.slug) && input.isEligible(signal),
    ) ?? null
  );
}
