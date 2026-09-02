import {
  lockedMarketReportContextSchema,
  marketReportContextHintSchema,
  type LockedMarketReportContext,
  type MarketReportContextHint,
} from "./schema";
import type { ResolvedMarketReportTarget as CanonicalMarketReportTarget } from "@/lib/markets/domain";

export type ResolvedMarketReportTarget = Pick<
  CanonicalMarketReportTarget,
  | "marketId"
  | "marketSlug"
  | "productIdentityVersionId"
  | "productSlug"
  | "retailerLocationId"
  | "locationSlug"
>;

export class MarketReportContextUnavailableError extends Error {
  constructor() {
    super("market_report_context_unavailable");
    this.name = "MarketReportContextUnavailableError";
  }
}

export function lockResolvedMarketReportContext(
  hint: MarketReportContextHint,
  resolved: ResolvedMarketReportTarget | null,
): LockedMarketReportContext {
  const parsedHint = marketReportContextHintSchema.parse(hint);
  if (
    !resolved ||
    resolved.marketSlug !== parsedHint.marketSlug ||
    resolved.productSlug !== parsedHint.productSlug ||
    resolved.locationSlug !== parsedHint.shopSlug
  ) {
    throw new MarketReportContextUnavailableError();
  }

  return lockedMarketReportContextSchema.parse({
    marketId: resolved.marketId,
    marketSlug: resolved.marketSlug,
    productIdentityVersionId: resolved.productIdentityVersionId,
    productSlug: resolved.productSlug,
    retailerLocationId: resolved.retailerLocationId,
    shopSlug: resolved.locationSlug,
    outcome: null,
  });
}

export function marketReportContextLockMatches(
  locked: LockedMarketReportContext | undefined,
  candidate: LockedMarketReportContext | undefined,
) {
  if (!locked || !candidate) return false;
  return (
    locked.marketId === candidate.marketId &&
    locked.marketSlug === candidate.marketSlug &&
    locked.productIdentityVersionId === candidate.productIdentityVersionId &&
    locked.productSlug === candidate.productSlug &&
    locked.retailerLocationId === candidate.retailerLocationId &&
    locked.shopSlug === candidate.shopSlug
  );
}
