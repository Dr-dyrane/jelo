import "server-only";

import type { Sql } from "postgres";
import { lagosDateKey } from "@/lib/campaigns/daily-campaign-policy";
import { getDailyDeskReadModel } from "@/lib/campaigns/daily-desk";
import { buildMarketTruthReadModel } from "@/lib/market-truth/read-model";
import {
  readInventoryMarketTruthFacts,
  readPhysicalMarketTruthFacts,
  readRetailerDiscoveryMarketTruthFacts,
  staticRetailerMarketTruthFacts,
} from "@/lib/market-truth/repository";
import { readScheduledOwnerReceipts } from "@/lib/market-truth/scheduled-owner-receipts";
import type {
  DailyDeskMarketTruthFacts,
  MarketTruthReadModel,
} from "@/lib/market-truth/types";

async function settledResult<T>(
  promise: Promise<T>,
  event: string,
): Promise<T | null> {
  try {
    return await promise;
  } catch {
    console.error(JSON.stringify({ event, reason: "source_unavailable" }));
    return null;
  }
}

export async function loadMarketTruthReadModel(
  sql: Sql,
  options: { now?: Date } = {},
): Promise<MarketTruthReadModel> {
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.valueOf())) {
    throw new Error("market_truth_clock_invalid");
  }
  const generatedAt = now.toISOString();
  const date = lagosDateKey(now);
  const [
    inventory,
    retailerDiscovery,
    physicalMarkets,
    receipts,
    deskProjection,
  ] = await Promise.all([
    settledResult(
      readInventoryMarketTruthFacts(sql),
      "market_truth_inventory_read_failed",
    ),
    settledResult(
      readRetailerDiscoveryMarketTruthFacts(sql),
      "market_truth_retailer_discovery_read_failed",
    ),
    settledResult(
      readPhysicalMarketTruthFacts(sql),
      "market_truth_physical_market_read_failed",
    ),
    settledResult(
      readScheduledOwnerReceipts(),
      "market_truth_receipt_read_failed",
    ),
    settledResult(
      getDailyDeskReadModel({ now }),
      "market_truth_daily_desk_read_failed",
    ),
  ]);
  const dailyDesk: DailyDeskMarketTruthFacts | null = !deskProjection
    ? null
    : {
        date,
        status: deskProjection.status,
        acceptedDate:
          deskProjection.status === "ready" ? deskProjection.date : null,
        recency:
          deskProjection.status === "ready" ? deskProjection.recency : null,
        observedAt: generatedAt,
      };

  return buildMarketTruthReadModel({
    generatedAt,
    inventory,
    retailerDiscovery,
    staticRetailers: staticRetailerMarketTruthFacts(),
    physicalMarkets,
    dailyDesk,
    scheduledOwnerReceipts: receipts,
  });
}
