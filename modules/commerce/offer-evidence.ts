import type { Market } from '@/data/prices';
import type { Offer, Product } from '@/data/products';
import type { EvidenceReference, RetailerEvidence } from '@/data/retail-evidence';
import { retailerEvidenceFor } from '@/data/retailers';
import { isOfferFresh } from './offer-freshness';

export type PersistedOfferEvidence = {
  verificationMethod?: 'manual' | 'retailer_page' | 'api' | 'import' | null;
  lastVerifiedAt?: string | null;
  inventoryStatus?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown' | null;
  observedTitle?: string | null;
  observedSize?: string | null;
  canonicalUrl?: string | null;
};

function timestamp(value?: string | null) {
  if (!value) return undefined;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function validReference(value: EvidenceReference | undefined) {
  if (!value || !timestamp(value.observedAt)) return false;
  try {
    return new URL(value.sourceUrl).protocol === 'https:';
  } catch {
    return false;
  }
}

function stockFor(offer: Offer) {
  if (!offer.available) return 'out-of-stock' as const;
  if (offer.inventoryQuantity != null && offer.inventoryQuantity <= 5) return 'low-stock' as const;
  return 'in-stock' as const;
}

export function materializeOfferEvidence(
  _product: Pick<Product, 'name' | 'size'>,
  offer: Offer,
): Offer {
  return {
    ...offer,
    retailerEvidence: offer.retailerEvidence ?? retailerEvidenceFor(offer.retailer),
  };
}

export function materializePersistedOfferEvidence(
  _product: Pick<Product, 'name' | 'size'>,
  offer: Offer,
  persisted: PersistedOfferEvidence,
): Offer {
  const observedAt = timestamp(persisted.lastVerifiedAt);
  const basis = persisted.verificationMethod === 'retailer_page'
    ? 'retailer-page' as const
    : persisted.verificationMethod === 'api'
      ? 'retailer-api' as const
      : undefined;
  const sourceUrl = persisted.canonicalUrl || offer.url;
  const listingEvidence = basis && offer.match !== 'search' && observedAt ? {
    observedAt,
    sourceUrl,
    basis,
  } : undefined;
  const hasPrice = (typeof offer.priceNgn === 'number' && offer.priceNgn > 0)
    || (typeof offer.priceUsd === 'number' && offer.priceUsd > 0);
  const stock = persisted.inventoryStatus?.replaceAll('_', '-') as NonNullable<Offer['priceObservation']>['stock'] | undefined;
  const observedTitle = persisted.observedTitle?.trim();
  const observedSize = persisted.observedSize?.trim();

  return {
    ...offer,
    listingEvidence,
    priceObservation: listingEvidence && hasPrice && observedTitle && observedSize ? {
      observedAt: listingEvidence.observedAt,
      variant: observedTitle,
      size: observedSize,
      stock: stock ?? stockFor(offer),
      landedCost: 'unknown',
    } : undefined,
    retailerEvidence: retailerEvidenceFor(offer.retailer),
  };
}

export function hasListingEvidence(offer: Offer) {
  return Boolean(
    offer.listingEvidence
    && ['retailer-page', 'retailer-api'].includes(offer.listingEvidence.basis)
    && validReference(offer.listingEvidence),
  );
}

export function hasSellerIdentityEvidence(offer: Offer) {
  return Boolean(
    offer.sellerIdentityEvidence
    && offer.sellerIdentityEvidence.sellerName.trim()
    && ['retailer-page', 'self-published-contact', 'independent-register'].includes(offer.sellerIdentityEvidence.basis)
    && validReference(offer.sellerIdentityEvidence),
  );
}

export function hasRegulatorMatch(evidence: RetailerEvidence | undefined) {
  const match = evidence?.regulatorMatch;
  return Boolean(
    match
    && match.authority.trim()
    && match.registrationNumber.trim()
    && match.basis === 'independent-register'
    && validReference(match),
  );
}

export function hasBrandAuthorizationEvidence(offer: Offer, expectedBrand?: string) {
  const evidence = offer.brandAuthorizationEvidence;
  return Boolean(
    evidence
    && evidence.brand.trim()
    && (!expectedBrand || evidence.brand.localeCompare(expectedBrand, undefined, { sensitivity: 'base' }) === 0)
    && evidence.basis === 'brand-source'
    && validReference(evidence),
  );
}

export function hasCompletePriceObservation(offer: Offer) {
  const observation = offer.priceObservation;
  if (!observation || !timestamp(observation.observedAt)) return false;
  return Boolean(
    observation.variant.trim()
    && observation.size.trim()
    && ['in-stock', 'low-stock', 'out-of-stock', 'unknown'].includes(observation.stock)
    && ['included', 'excluded', 'unknown'].includes(observation.landedCost),
  );
}

export function observedMarketPrice(
  offer: Offer,
  market: Market,
  now: number | Date = Date.now(),
) {
  if (!offer.available || !hasListingEvidence(offer) || !hasCompletePriceObservation(offer) || !isOfferFresh(offer, now)) return null;
  const price = market === 'NG' ? offer.priceNgn : offer.priceUsd;
  return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : null;
}

export function comparableMarketPrice(
  offer: Offer,
  market: Market,
  now: number | Date = Date.now(),
) {
  if (offer.priceComparison === 'exclude') return null;
  return observedMarketPrice(offer, market, now);
}

export function landedCostCaveat(offer: Offer) {
  if (offer.priceObservation?.landedCost === 'included') return 'Delivery included';
  if (offer.priceObservation?.landedCost === 'excluded') return 'Delivery extra';
  return 'Delivery may change total';
}

/** Observed numeric delivery fee for the market, only when a listing stated one. */
export function observedDeliveryFee(offer: Offer, market: Market) {
  const fee = market === 'NG' ? offer.deliveryNgn : offer.deliveryUsd;
  return typeof fee === 'number' && Number.isFinite(fee) && fee > 0 ? fee : null;
}

/**
 * Comparable price a shopper would actually pay including delivery, when the total
 * is knowable: an "included" observation is already the total, and an "excluded"
 * observation plus a stated numeric fee sums to it. When delivery is unknown or has
 * no numeric amount, this returns the bare comparable price — never a guessed total.
 */
export function landedMarketPrice(
  offer: Offer,
  market: Market,
  now: number | Date = Date.now(),
) {
  const price = comparableMarketPrice(offer, market, now);
  if (price == null) return null;
  if (offer.priceObservation?.landedCost === 'excluded') {
    const fee = observedDeliveryFee(offer, market);
    if (fee != null) return price + fee;
  }
  return price;
}

export function observedStockLabel(offer: Offer, fresh: boolean) {
  if (!fresh) return 'Check stock';
  const observed = offer.priceObservation?.stock;
  if (!offer.available || observed === 'out-of-stock') return 'Out of stock';
  if (observed === 'unknown') return 'Check stock';
  if (observed === 'low-stock') {
    return offer.inventoryQuantity && offer.inventoryQuantity > 0
      ? `${offer.inventoryQuantity} left`
      : 'Low stock';
  }
  if (offer.inventoryQuantity && offer.inventoryQuantity > 0) return `${offer.inventoryQuantity} left`;
  return 'In stock';
}
