import type { Offer, Product } from "@/data/products";
import { mergeRetailOffers } from "@/data/retail-offers";
import { isOfferFresh } from "@/modules/commerce/offer-freshness";
import { hasListingEvidence } from "@/modules/commerce/offer-evidence";
import { nigeriaRetailers } from "@/data/retailers";

export type BundleOffer = {
  retailer: string;
  trust: number;
  offers: BundleProductOffer[];
  combinedTotal: number;
  allInStock: boolean;
};

export type BundleProductOffer = {
  productSlug: string;
  productBrand: string;
  productName: string;
  productSize: string;
  retailer: string;
  url: string;
  priceNgn: number;
  available: boolean;
  fresh: boolean;
  stock: "in-stock" | "low-stock" | "out-of-stock";
};

export type BundleFinderResult = {
  bundles: BundleOffer[];
  productSlugs: string[];
  unmatchedProducts: string[];
};

function retailerTrust(retailer: string, fallback: number): number {
  return nigeriaRetailers.find((r) => r.name === retailer)?.trust ?? fallback;
}

function stockLabel(offer: Offer): "in-stock" | "low-stock" | "out-of-stock" {
  if (!offer.available) return "out-of-stock";
  if (offer.inventoryQuantity != null && offer.inventoryQuantity <= 5)
    return "low-stock";
  const stock = offer.priceObservation?.stock;
  if (stock === "out-of-stock") return "out-of-stock";
  if (stock === "low-stock") return "low-stock";
  return "in-stock";
}

/**
 * Find retailers with an exact Nigerian listing for ALL given products.
 *
 * Only considers exact-match offers with listing evidence and a visible NGN
 * price. Expired offers are removed by the shared offer merge. Retailers are
 * ranked by combined total (lowest first).
 */
export function findBundleStores(
  products: Pick<Product, "slug" | "name" | "brand" | "size" | "offers">[],
  now: number | Date = Date.now(),
): BundleFinderResult {
  if (products.length < 2) {
    return {
      bundles: [],
      productSlugs: products.map((p) => p.slug),
      unmatchedProducts: [],
    };
  }

  // Build a map: productSlug -> Map<retailer, Offer> (only fresh, exact, priced, NG)
  const productOfferMaps = products.map((product) => {
    const merged = mergeRetailOffers(product, product.offers ?? [], now);
    const retailerMap = new Map<string, Offer>();
    for (const offer of merged) {
      if (offer.match === "search") continue;
      if (!hasListingEvidence(offer)) continue;
      if (!offer.location.includes("NG")) continue;
      if (offer.priceNgn == null) continue;
      // Keep the best offer per retailer (first one wins, mergeRetailOffers already deduplicates)
      if (!retailerMap.has(offer.retailer)) {
        retailerMap.set(offer.retailer, offer);
      }
    }
    return { product, retailerMap };
  });

  // Find retailers that appear in ALL products' offer maps
  const firstMap = productOfferMaps[0].retailerMap;
  const commonRetailers: string[] = [];
  for (const retailer of firstMap.keys()) {
    if (productOfferMaps.every((m) => m.retailerMap.has(retailer))) {
      commonRetailers.push(retailer);
    }
  }

  // Track products that have no common retailer
  const unmatchedProducts: string[] = [];
  for (const { product, retailerMap } of productOfferMaps) {
    if (!commonRetailers.some((r) => retailerMap.has(r))) {
      unmatchedProducts.push(product.slug);
    }
  }

  // Build bundle offers for each common retailer
  const bundles: BundleOffer[] = commonRetailers.map((retailer) => {
    const offers: BundleProductOffer[] = productOfferMaps.map(
      ({ product, retailerMap }) => {
        const offer = retailerMap.get(retailer)!;
        const fresh = isOfferFresh(offer, now);
        return {
          productSlug: product.slug,
          productBrand: product.brand,
          productName: product.name,
          productSize: product.size,
          retailer: offer.retailer,
          url: offer.url,
          priceNgn: offer.priceNgn!,
          available: offer.available,
          fresh,
          stock: stockLabel(offer),
        };
      },
    );

    const combinedTotal = offers.reduce((sum, o) => sum + o.priceNgn, 0);
    const allInStock = offers.every(
      (o) => o.available && o.stock !== "out-of-stock",
    );

    const trust = offers[0] ? retailerTrust(retailer, 0) : 0;

    return {
      retailer,
      trust,
      offers,
      combinedTotal,
      allInStock,
    };
  });

  // Sort by combined total (cheapest first), then by trust
  bundles.sort(
    (a, b) => a.combinedTotal - b.combinedTotal || b.trust - a.trust,
  );

  return {
    bundles,
    productSlugs: products.map((p) => p.slug),
    unmatchedProducts,
  };
}

/**
 * Find products from the catalogue that share at least one retailer with the
 * given product, so we can suggest "buy together" bundles on product pages.
 *
 * Returns products sorted by the number of shared retailers (most first), then
 * by the cheapest combined total.
 */
export function findBuyTogetherSuggestions(
  targetProduct: Pick<Product, "slug" | "name" | "brand" | "size" | "offers">,
  allProducts: Pick<Product, "slug" | "name" | "brand" | "size" | "offers">[],
  now: number | Date = Date.now(),
  limit = 4,
): Array<{
  product: Pick<Product, "slug" | "name" | "brand" | "size" | "offers">;
  sharedRetailerCount: number;
  cheapestCombined: number;
}> {
  const targetOffers = mergeRetailOffers(
    targetProduct,
    targetProduct.offers ?? [],
    now,
  );
  const targetRetailers = new Set(
    targetOffers
      .filter(
        (o) =>
          o.match !== "search" &&
          hasListingEvidence(o) &&
          o.location.includes("NG") &&
          o.priceNgn != null,
      )
      .map((o) => o.retailer),
  );

  if (targetRetailers.size === 0) return [];

  const suggestions: Array<{
    product: Pick<Product, "slug" | "name" | "brand" | "size" | "offers">;
    sharedRetailerCount: number;
    cheapestCombined: number;
  }> = [];

  for (const product of allProducts) {
    if (product.slug === targetProduct.slug) continue;

    const result = findBundleStores([targetProduct, product], now);
    if (result.bundles.length === 0) continue;

    const cheapest = result.bundles[0];
    suggestions.push({
      product,
      sharedRetailerCount: result.bundles.length,
      cheapestCombined: cheapest.combinedTotal,
    });
  }

  suggestions.sort(
    (a, b) =>
      b.sharedRetailerCount - a.sharedRetailerCount ||
      a.cheapestCombined - b.cheapestCombined,
  );

  return suggestions.slice(0, limit);
}
