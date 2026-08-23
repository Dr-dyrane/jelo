import { lagosDateKey } from "@/lib/campaigns/daily-campaign-policy";

export type CampaignPillar = {
  role: "proof" | "use" | "remember";
  kind: "market" | "useful" | "relatable";
  label: "Market" | "Useful" | "Relatable";
  eyebrow: string;
  headline: string;
  body: string;
  action: string;
  actionUrl: string;
  caption: string;
  footerNote: string;
  evidenceNote: string;
};

const usefulRotation = [
  {
    eyebrow: "One retailer",
    headline: "Build one exact basket.",
    body: "Choose products, compare retailers that list every item, then request one clear quote.",
    action: "Build a basket",
    actionUrl: "https://www.jelocare.com/bundle",
    caption:
      "One basket. One retailer. One clear quote. Build yours with JeloCare: https://www.jelocare.com/bundle",
    footerNote:
      "Pick the products. JeloCare shows which retailer can fulfil the whole basket.",
  },
  {
    eyebrow: "Guest-first",
    headline: "Shop before signing in.",
    body: "Your basket starts as a guest and stays with you when you choose to sign in.",
    action: "Explore products",
    actionUrl: "https://www.jelocare.com/products",
    caption:
      "Start shopping without an account. Your JeloCare basket stays with you: https://www.jelocare.com/products",
    footerNote:
      "Browse and build first. Sign in only when you want an account.",
  },
  {
    eyebrow: "Clear before payment",
    headline: "See the full quote first.",
    body: "Products, service and delivery are verified before you approve and pay.",
    action: "How ordering works",
    actionUrl: "https://www.jelocare.com/lagos",
    caption:
      "Know what you are approving before you pay. See how JeloCare ordering works: https://www.jelocare.com/lagos",
    footerNote:
      "Nothing proceeds until the complete verified quote is approved.",
  },
  {
    eyebrow: "Care context",
    headline: "Start with the concern.",
    body: "Browse clear guides, linked ingredients and reviewed product context without a diagnosis claim.",
    action: "Browse concerns",
    actionUrl: "https://www.jelocare.com/concerns",
    caption:
      "Start with what you are trying to understand. Browse JeloCare concern guides: https://www.jelocare.com/concerns",
    footerNote: "Clear context stays separate from diagnosis.",
  },
  {
    eyebrow: "Your JeloCare",
    headline: "Keep care in one place.",
    body: "Save products, build a routine and return to the prices and choices that matter to you.",
    action: "Open My JeloCare",
    actionUrl: "https://www.jelocare.com/me",
    caption:
      "Your shelf, routine and orders—kept together in My JeloCare: https://www.jelocare.com/me",
    footerNote: "Your choices stay organised around you.",
  },
] as const;

const relatableRotation = [
  {
    headline: "Your skincare tab count has entered the chat.",
    body: "Compare the exact product once. Keep the useful tab.",
    caption:
      "When every shop has a different price and your tabs become a research project. JeloCare keeps the comparison clear: https://www.jelocare.com/share",
    footerNote: "Fewer tabs. Clearer choices.",
  },
  {
    headline: "Same bottle. Different price. Naturally, we checked.",
    body: "Exact listings first. Dramatic conclusions never.",
    caption:
      "Same bottle, different prices—the Nigerian skincare shopping experience. Compare current listings on JeloCare: https://www.jelocare.com/share",
    footerNote: "The exact product deserves an exact comparison.",
  },
  {
    headline: "The routine is simple. The shopping tabs were not.",
    body: "One place for products, prices and clear care context.",
    caption:
      "The routine: three steps. The shopping research: thirty-seven tabs. Let JeloCare help: https://www.jelocare.com",
    footerNote: "Keep the useful tab.",
  },
  {
    headline: "Added to basket. Still comparing. Very responsible of you.",
    body: "JeloCare keeps the store, items and quote visible while you decide.",
    caption:
      "A basket is not a blood oath. Compare clearly before you approve your JeloCare quote: https://www.jelocare.com/basket",
    footerNote: "Decide with the whole basket visible.",
  },
  {
    headline: "‘How much is delivery?’ is not a plot twist.",
    body: "The verified quote shows the complete amount before payment.",
    caption:
      "Delivery should not arrive as a surprise ending. JeloCare verifies the full quote before payment: https://www.jelocare.com/lagos",
    footerNote: "See the complete amount before payment.",
  },
] as const;

function rotationIndex(now: Date, length: number) {
  const date = lagosDateKey(now);
  const [year, month, day] = date.split("-").map(Number);
  const dayNumber = Math.floor(
    (Date.UTC(year!, month! - 1, day!) - Date.UTC(year!, 0, 0)) / 86_400_000,
  );
  return dayNumber % length;
}

export function dailyEditorialPillars(
  now: Date,
): readonly [CampaignPillar, CampaignPillar] {
  const useful = usefulRotation[rotationIndex(now, usefulRotation.length)]!;
  const relatable =
    relatableRotation[rotationIndex(now, relatableRotation.length)]!;
  return [
    {
      role: "use",
      kind: "useful",
      label: "Useful",
      ...useful,
      evidenceNote: "JeloCare service guidance. No product or price claim.",
    },
    {
      role: "remember",
      kind: "relatable",
      label: "Relatable",
      eyebrow: "Small skincare truth",
      ...relatable,
      action: "Open JeloCare",
      actionUrl: "https://www.jelocare.com",
      evidenceNote:
        "Brand-safe observation. No health, product or price claim.",
    },
  ];
}

export function claimSafeMarketPillar(input: {
  catalogueProductCount: number;
  priceEligibleProductCount: number;
  freshPriceCandidateCount: number;
}): CampaignPillar {
  if (input.freshPriceCandidateCount > 0) {
    return {
      role: "proof",
      kind: "market",
      label: "Market",
      eyebrow: "Today’s market check",
      headline: "No price story today.",
      body: `JeloCare found ${input.freshPriceCandidateCount} fresh price ${input.freshPriceCandidateCount === 1 ? "candidate" : "candidates"} across ${input.catalogueProductCount} public products. None passed every campaign publication and rotation check today.`,
      action: "Browse the market",
      actionUrl: "https://www.jelocare.com/share",
      caption:
        "No campaign-ready price story today. Browse JeloCare’s current market view: https://www.jelocare.com/share",
      footerNote:
        "Freshness is necessary. Exact publication evidence comes next.",
      evidenceNote: `${input.freshPriceCandidateCount} fresh price ${input.freshPriceCandidateCount === 1 ? "candidate entered" : "candidates entered"} the campaign gate; none completed every publication and rotation check.`,
    };
  }

  return {
    role: "proof",
    kind: "market",
    label: "Market",
    eyebrow: "Today’s market check",
    headline: "No fresh price. No price claim.",
    body: `JeloCare checked ${input.catalogueProductCount} public products. None passed every current campaign-evidence check today.`,
    action: "Browse the market",
    actionUrl: "https://www.jelocare.com/share",
    caption:
      "No fresh evidence means no price claim today. Browse JeloCare’s current market view: https://www.jelocare.com/share",
    footerNote: "Fresh evidence returns before the next price claim.",
    evidenceNote: `${input.priceEligibleProductCount} products had trend-eligible listings before campaign evidence and cooldown checks.`,
  };
}
