import type { Product } from "@/data/products";
import {
  hasCompletePriceObservation,
  hasListingEvidence,
} from "@/modules/commerce/offer-evidence";
import { assertRetailerResponseScope } from "@/modules/retail-intelligence/response-scope";

function sameIdentity(left: Product, right: Product) {
  return (
    left.brand === right.brand &&
    left.name === right.name &&
    left.size === right.size
  );
}

function scopedPersistedOffers(
  persistedProduct: Product,
  approvedProduct: Product,
) {
  if (!sameIdentity(persistedProduct, approvedProduct)) return [];

  return persistedProduct.offers.filter((offer) => {
    if (!hasListingEvidence(offer) || !hasCompletePriceObservation(offer))
      return false;
    try {
      assertRetailerResponseScope({
        requestedUrl: offer.url,
        responseUrl: offer.url,
        expectedTitle: `${approvedProduct.brand} ${approvedProduct.name}`,
        expectedSize: approvedProduct.size,
        observedTitle: offer.priceObservation?.variant,
        observedSize: offer.priceObservation?.size,
        marketCode: offer.location.includes("NG")
          ? "NG"
          : offer.location.includes("US")
            ? "US"
            : "INTL",
      });
      return true;
    } catch {
      return false;
    }
  });
}

function checkedInExactOffers(approvedProduct: Product) {
  return approvedProduct.offers.filter(
    (offer) => hasListingEvidence(offer) && hasCompletePriceObservation(offer),
  );
}

function offerScopeKey(offer: Product["offers"][number]) {
  const markets = offer.location
    .map((market) => market.trim().toLocaleUpperCase("en-NG"))
    .filter(Boolean)
    .sort()
    .join(",");
  return `${offer.retailer.trim().toLocaleLowerCase("en-NG")}|${markets}`;
}

function offerObservedAt(offer: Product["offers"][number]) {
  const value = offer.listingEvidence?.observedAt ?? offer.checkedAt;
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

/**
 * Keep the checked-in exact-offer projection available until the protected
 * database reconciliation runs. A persisted observation replaces the
 * checked-in observation for the same retailer and market only when it is
 * strictly newer, matching the seed reconciliation rule.
 */
function reconcileScopedOffers(
  approvedOffers: Product["offers"],
  persistedOffers: Product["offers"],
) {
  const merged = new Map(
    approvedOffers.map((offer) => [offerScopeKey(offer), offer]),
  );

  for (const persistedOffer of persistedOffers) {
    const key = offerScopeKey(persistedOffer);
    const approvedOffer = merged.get(key);
    if (
      !approvedOffer ||
      offerObservedAt(persistedOffer) > offerObservedAt(approvedOffer)
    ) {
      merged.set(key, persistedOffer);
    }
  }

  return [...merged.values()];
}

/**
 * Database publication is necessary, but not sufficient. The checked-in
 * catalogue is the exact-SKU and image approval boundary; persisted rows may
 * contribute fresh offers only after their slug intersects that boundary.
 */
export function reconcilePublishedCatalogue(
  persistedProducts: readonly Product[],
  approvedProducts: readonly Product[],
) {
  const approvedBySlug = new Map(
    approvedProducts.map((product) => [product.slug, product]),
  );
  const seen = new Set<string>();

  return persistedProducts.flatMap((persistedProduct) => {
    if (seen.has(persistedProduct.slug)) return [];
    const approvedProduct = approvedBySlug.get(persistedProduct.slug);
    if (!approvedProduct) return [];
    seen.add(persistedProduct.slug);
    const persistedOffers = scopedPersistedOffers(
      persistedProduct,
      approvedProduct,
    );
    const approvedScopedOffers = checkedInExactOffers(approvedProduct);

    return [
      {
        ...approvedProduct,
        offers: persistedOffers.length
          ? reconcileScopedOffers(approvedScopedOffers, persistedOffers)
          : approvedProduct.offers,
      },
    ];
  });
}

/**
 * An explicit checked-in release is already bound to a verified dossier and is
 * therefore allowed to appear before its optional database projection exists.
 * Legacy/static products keep the older database-intersection behavior.
 */
export function mergeDossierReleasedCatalogue(
  reconciledProducts: readonly Product[],
  dossierReleasedProducts: readonly Product[],
  slug?: string,
) {
  const seen = new Set(reconciledProducts.map((product) => product.slug));
  const additions = dossierReleasedProducts.filter(
    (product) => (!slug || product.slug === slug) && !seen.has(product.slug),
  );
  return [...reconciledProducts, ...additions];
}
