import 'server-only';

import {
  calculatePriceTrends,
  type PriceObservation,
  type PriceTrendOfferSnapshot,
  type ProductPriceTrends,
} from '@/modules/commerce/price-trends';
import { staticPriceHistory } from '@/data/price-history';

import type { ProductPriceTrendRequest } from './price-trends';

/**
 * Computes price trends from static price history data when no database is
 * available. For each product, looks up previous price observations from
 * `data/price-history.ts` and pairs them with the current offer snapshot to
 * create the two-point series that `calculatePriceTrends` needs.
 *
 * The static history is sparse — it only contains entries for offers where
 * the price actually changed between verification batches. Products without
 * static history get empty trends (no movement), which is honest.
 */
function computeStaticProductTrends(
  slug: string,
  snapshot: readonly PriceTrendOfferSnapshot[],
): ProductPriceTrends {
  const historyEntries = staticPriceHistory.filter(
    entry => entry.productSlug === slug,
  );
  if (!historyEntries.length) return {};

  const observations: PriceObservation[] = [];

  for (const entry of historyEntries) {
    // Find the matching snapshot entry by retailer
    const snap = snapshot.find(
      s => s.market === 'NG'
        && s.retailer.trim().toLocaleLowerCase('en-NG') === entry.retailer.trim().toLocaleLowerCase('en-NG'),
    );
    if (!snap) continue;

    const offerId = `static-${slug}-${entry.retailer}`;

    // Anchor observation (old price)
    observations.push({
      historyId: `static-${slug}-${entry.retailer}-anchor`,
      offerId,
      retailer: entry.retailer,
      priceMinor: entry.oldPriceNgn,
      observedAt: entry.oldObservedAt,
      recordedAt: entry.oldObservedAt,
    });

    // Current observation (new price from snapshot)
    observations.push({
      historyId: `static-${slug}-${entry.retailer}-current`,
      offerId,
      retailer: entry.retailer,
      priceMinor: snap.priceMinor,
      observedAt: snap.observedAt,
      recordedAt: snap.observedAt,
    });
  }

  if (!observations.length) return {};

  return { NG: calculatePriceTrends(observations) };
}

/**
 * Fallback trend calculator that uses static price history when the database
 * is not configured or returns no data. Returns a map of slug → trends for
 * all products in the requests that have static history entries.
 */
export function computeStaticPriceTrends(
  requests: readonly ProductPriceTrendRequest[],
): ReadonlyMap<string, ProductPriceTrends> {
  const results = new Map<string, ProductPriceTrends>();

  for (const request of requests) {
    const slug = request.slug.trim();
    if (!slug || request.snapshot.length === 0) continue;
    const trends = computeStaticProductTrends(slug, request.snapshot);
    if (Object.keys(trends).length > 0) {
      results.set(slug, trends);
    }
  }

  return results;
}
