import type { MarketFinderPackshotBinding } from "@/lib/markets/market-finder-packshot-binding";

/**
 * Market Finder can narrow an already-published catalogue image, but it cannot
 * publish or repair one. A product stays image-unavailable until a reviewed
 * supplemental binding is added here and passes the runtime validator.
 *
 * COSRX Aloe Soothing Sun Cream 50 ml and BEAUTIFUL YOU / MIRACLE Natural Hair
 * Anti-Dandruff & Anti-Itch Shampoo 400 ml intentionally have no accepted
 * binding.
 */
export const marketFinderPackshotBindings: readonly MarketFinderPackshotBinding[] =
  [];
