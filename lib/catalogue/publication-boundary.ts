import type { Product } from '@/data/products';
import { hasCompletePriceObservation, hasListingEvidence } from '@/modules/commerce/offer-evidence';
import { assertRetailerResponseScope } from '@/modules/retail-intelligence/response-scope';

function sameIdentity(left: Product, right: Product) {
  return left.brand === right.brand
    && left.name === right.name
    && left.size === right.size;
}

function scopedPersistedOffers(persistedProduct: Product, approvedProduct: Product) {
  if (!sameIdentity(persistedProduct, approvedProduct)) return [];

  return persistedProduct.offers.filter(offer => {
    if (!hasListingEvidence(offer) || !hasCompletePriceObservation(offer)) return false;
    try {
      assertRetailerResponseScope({
        requestedUrl: offer.url,
        responseUrl: offer.url,
        expectedTitle: `${approvedProduct.brand} ${approvedProduct.name}`,
        expectedSize: approvedProduct.size,
        observedTitle: offer.priceObservation?.variant,
        observedSize: offer.priceObservation?.size,
        marketCode: offer.location.includes('NG') ? 'NG' : offer.location.includes('US') ? 'US' : 'INTL',
      });
      return true;
    } catch {
      return false;
    }
  });
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
  const approvedBySlug = new Map(approvedProducts.map(product => [product.slug, product]));
  const seen = new Set<string>();

  return persistedProducts.flatMap(persistedProduct => {
    if (seen.has(persistedProduct.slug)) return [];
    const approvedProduct = approvedBySlug.get(persistedProduct.slug);
    if (!approvedProduct) return [];
    seen.add(persistedProduct.slug);
    const persistedOffers = scopedPersistedOffers(persistedProduct, approvedProduct);

    return [{
      ...approvedProduct,
      offers: persistedOffers.length ? persistedOffers : approvedProduct.offers,
    }];
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
  const seen = new Set(reconciledProducts.map(product => product.slug));
  const additions = dossierReleasedProducts.filter(product => (
    (!slug || product.slug === slug) && !seen.has(product.slug)
  ));
  return [...reconciledProducts, ...additions];
}
