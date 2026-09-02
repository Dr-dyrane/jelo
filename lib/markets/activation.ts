import "server-only";

export const MARKET_FINDER_REPORT_INTAKE_FLAG =
  "MARKET_FINDER_REPORT_INTAKE_ENABLED";
export const MARKET_FINDER_PUBLIC_READ_FLAG =
  "MARKET_FINDER_PUBLIC_READ_ENABLED";
export const MARKET_FINDER_PUBLIC_MARKET_FLAG =
  "MARKET_FINDER_PUBLIC_MARKET_SLUG";

const TRADE_FAIR_PILOT_MARKET_SLUG = "trade-fair";

export type MarketFinderActivationEnvironment = {
  [key: string]: string | undefined;
  MARKET_FINDER_REPORT_INTAKE_ENABLED?: string;
  MARKET_FINDER_PUBLIC_READ_ENABLED?: string;
  MARKET_FINDER_PUBLIC_MARKET_SLUG?: string;
};

/**
 * The first production release is deliberately limited to one reviewed market.
 * A configured value cannot silently expand this into a general allowlist.
 */
export function marketFinderPublicMarketSlug(
  environment: MarketFinderActivationEnvironment = process.env,
): typeof TRADE_FAIR_PILOT_MARKET_SLUG | null {
  return environment.MARKET_FINDER_PUBLIC_MARKET_SLUG ===
    TRADE_FAIR_PILOT_MARKET_SLUG
    ? TRADE_FAIR_PILOT_MARKET_SLUG
    : null;
}

export function isMarketFinderPublicReadEnabled(
  environment: MarketFinderActivationEnvironment = process.env,
): boolean {
  return (
    environment.MARKET_FINDER_PUBLIC_READ_ENABLED === "true" &&
    marketFinderPublicMarketSlug(environment) !== null
  );
}

export function isMarketFinderPublicMarketAllowed(
  marketSlug: string,
  environment: MarketFinderActivationEnvironment = process.env,
): boolean {
  return (
    isMarketFinderPublicReadEnabled(environment) &&
    marketSlug === marketFinderPublicMarketSlug(environment)
  );
}

export function isMarketFinderReportIntakeEnabled(
  environment: MarketFinderActivationEnvironment = process.env,
): boolean {
  return (
    environment.MARKET_FINDER_REPORT_INTAKE_ENABLED === "true" &&
    isMarketFinderPublicReadEnabled(environment)
  );
}

export class MarketFinderReportIntakeUnavailableError extends Error {
  constructor() {
    super("market_finder_report_intake_unavailable");
    this.name = "MarketFinderReportIntakeUnavailableError";
  }
}

export function requireMarketFinderReportIntakeEnabled(
  contributionKind: string,
  environment: MarketFinderActivationEnvironment = process.env,
) {
  if (
    contributionKind === "market_report" &&
    !isMarketFinderReportIntakeEnabled(environment)
  ) {
    throw new MarketFinderReportIntakeUnavailableError();
  }
}
