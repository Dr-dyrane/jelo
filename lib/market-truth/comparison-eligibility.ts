import { verifiedRetailOffers } from "@/data/retail-offers";
import { normalizeComparisonOfferUrl } from "@/modules/commerce/offer-comparison-identity";

type ComparisonOffer = {
  retailer: string;
  url: string;
  priceComparison?: "include" | "exclude";
};

export type ComparisonExcludedOfferIdentity = {
  product_slug: string;
  retailer: string;
  url: string;
  normalized_url: string;
};

export function comparisonExcludedOfferIdentities(
  offers: Record<string, readonly ComparisonOffer[]> = verifiedRetailOffers,
): ComparisonExcludedOfferIdentity[] {
  const identities = new Map<string, ComparisonExcludedOfferIdentity>();
  for (const [productSlug, productOffers] of Object.entries(offers)) {
    for (const offer of productOffers) {
      if (offer.priceComparison !== "exclude") continue;
      const identity = {
        product_slug: productSlug,
        retailer: offer.retailer,
        url: offer.url,
        normalized_url: normalizeComparisonOfferUrl(offer.url) ?? offer.url,
      };
      identities.set(
        `${identity.product_slug}\u0000${identity.retailer}\u0000${identity.normalized_url}`,
        identity,
      );
    }
  }
  return [...identities.values()];
}
