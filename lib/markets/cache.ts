import "server-only";

import { revalidateTag } from "next/cache";
import { isMarketFinderSlug } from "@/lib/markets/domain";

export const MARKET_FINDER_CACHE_TAG = "market-finder";

export function marketFinderMarketCacheTag(marketSlug: string): string {
  if (!isMarketFinderSlug(marketSlug)) {
    throw new Error("A valid market slug is required for cache tagging.");
  }
  return `${MARKET_FINDER_CACHE_TAG}:market:${marketSlug}`;
}

export function marketFinderProductCacheTag(productSlug: string): string {
  if (!isMarketFinderSlug(productSlug)) {
    throw new Error("A valid product slug is required for cache tagging.");
  }
  return `${MARKET_FINDER_CACHE_TAG}:product:${productSlug}`;
}

export function marketFinderLocationCacheTag(locationId: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      locationId,
    )
  ) {
    throw new Error(
      "A valid retailer location id is required for cache tagging.",
    );
  }
  return `${MARKET_FINDER_CACHE_TAG}:location:${locationId.toLowerCase()}`;
}

export function marketFinderReadCacheTags(input: {
  marketSlug: string;
  productSlug: string;
}): string[] {
  return [
    MARKET_FINDER_CACHE_TAG,
    marketFinderMarketCacheTag(input.marketSlug),
    marketFinderProductCacheTag(input.productSlug),
  ];
}

export function marketFinderDirectoryCacheTags(marketSlug: string): string[] {
  return [MARKET_FINDER_CACHE_TAG, marketFinderMarketCacheTag(marketSlug)];
}

/**
 * Physical evidence corrections must not use stale-while-revalidate. Expire
 * only the scopes named by the audited mutation. Callers must provide the
 * owning market; `{ global: true }` is the explicit exceptional path.
 */
export function invalidateMarketFinderCache(
  input:
    | {
        marketSlug: string;
        productSlug?: string;
        locationId?: string;
      }
    | { global: true },
): void {
  if ("global" in input) {
    revalidateTag(MARKET_FINDER_CACHE_TAG, { expire: 0 });
    return;
  }

  const tags = [
    marketFinderMarketCacheTag(input.marketSlug),
    input.productSlug
      ? marketFinderProductCacheTag(input.productSlug)
      : undefined,
    input.locationId
      ? marketFinderLocationCacheTag(input.locationId)
      : undefined,
  ].filter((tag): tag is string => Boolean(tag));

  for (const tag of new Set(tags)) {
    revalidateTag(tag, { expire: 0 });
  }
}
