export const MARKET_REPORT_OUTCOMES = [
  {
    id: "found_bought",
    label: "Found and bought the exact product",
  },
  {
    id: "shop_exists_no_stock",
    label: "Shop exists, but no stock",
  },
  {
    id: "location_wrong",
    label: "Shop or location was wrong",
  },
  {
    id: "shop_closed",
    label: "Shop has closed",
  },
] as const;

export type MarketReportOutcomeId =
  (typeof MARKET_REPORT_OUTCOMES)[number]["id"];

export type MarketReportContext = {
  marketSlug: string;
  productSlug: string;
  shopSlug: string;
};

const contextSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function exactContextSlug(value: string) {
  return value.length <= 120 && contextSlugPattern.test(value) ? value : null;
}

export function marketReportContributionHref(
  context: MarketReportContext,
): string | null {
  const market = exactContextSlug(context.marketSlug);
  const product = exactContextSlug(context.productSlug);
  const shop = exactContextSlug(context.shopSlug);
  if (!market || !product || !shop) return null;

  const params = new URLSearchParams({
    mode: "market-report",
    market,
    product,
    shop,
  });
  return `/contribute?${params.toString()}#contribution-form`;
}
