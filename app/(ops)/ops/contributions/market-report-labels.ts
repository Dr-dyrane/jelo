export type MarketFinderReportLabelContext = {
  productBrand: string;
  productVariant: string;
  productSize: string;
};

export type MarketFinderReportLabelOutcome =
  "found_bought" | "shop_exists_no_stock" | "location_wrong" | "shop_closed";

export function marketFinderOutcomeLabel(
  outcome: MarketFinderReportLabelOutcome,
) {
  if (outcome === "found_bought") return "Found and bought";
  if (outcome === "shop_exists_no_stock") return "Shop exists, no stock";
  if (outcome === "location_wrong") return "Location is wrong";
  return "Shop is closed";
}

export function exactMarketProductLabel(
  report: MarketFinderReportLabelContext,
) {
  return [report.productBrand, report.productVariant, report.productSize]
    .filter(Boolean)
    .join(" · ");
}
