import { isRetailerOfferExcluded } from "@/data/retail-offers";
import type { Offer, Product } from "@/data/products";
import {
  materializePersistedOfferEvidence,
  type PersistedOfferEvidence,
} from "@/modules/commerce/offer-evidence";
import { isOfferFresh } from "@/modules/commerce/offer-freshness";

export type PersistedCatalogueOffer = Offer & PersistedOfferEvidence;

export function materializeCurrentPersistedOffers(
  product: Pick<Product, "name" | "size"> & Partial<Pick<Product, "slug">>,
  persistedOffers: readonly PersistedCatalogueOffer[],
  now: number | Date = Date.now(),
) {
  return persistedOffers
    .filter(
      (persistedOffer) =>
        !product.slug ||
        !isRetailerOfferExcluded(product.slug, persistedOffer.retailer),
    )
    .map((persistedOffer) => {
      const {
        verificationMethod,
        lastVerifiedAt,
        inventoryStatus,
        observedTitle,
        observedSize,
        canonicalUrl,
        ...offer
      } = persistedOffer;

      return materializePersistedOfferEvidence(product, offer, {
        verificationMethod,
        lastVerifiedAt,
        inventoryStatus,
        observedTitle,
        observedSize,
        canonicalUrl,
      });
    })
    .filter((offer) => isOfferFresh(offer, now));
}
