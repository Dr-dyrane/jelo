import "server-only";

import type { TransactionSql } from "postgres";
import { resolveMarketReportTargetContext } from "@/lib/markets/repository";
import {
  lockResolvedMarketReportContext,
  MarketReportContextUnavailableError,
} from "./market-report-context";
import type {
  LockedMarketReportContext,
  MarketReportContextHint,
} from "./schema";

export async function resolveMarketReportDraftContext(
  transaction: TransactionSql,
  hint: MarketReportContextHint,
): Promise<LockedMarketReportContext> {
  const resolution = await resolveMarketReportTargetContext(
    {
      marketSlug: hint.marketSlug,
      locationSlug: hint.shopSlug,
      productSlug: hint.productSlug,
    },
    { client: transaction },
  );
  if (resolution.status !== "resolved")
    throw new MarketReportContextUnavailableError();

  return lockResolvedMarketReportContext(hint, {
    marketId: resolution.context.marketId,
    marketSlug: resolution.context.marketSlug,
    productIdentityVersionId: resolution.context.productIdentityVersionId,
    productSlug: resolution.context.productSlug,
    retailerLocationId: resolution.context.retailerLocationId,
    locationSlug: resolution.context.locationSlug,
  });
}
