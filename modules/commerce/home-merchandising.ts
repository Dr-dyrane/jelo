import type { Product } from '@/data/products';
import { comparableMarketPrice, hasListingEvidence } from './offer-evidence';

export function orderByCuratedSlugs<T extends { slug: string }>(items: T[], curatedSlugs: string[]) {
  const position = new Map(curatedSlugs.map((slug, index) => [slug, index]));
  return [...items].sort((left, right) => {
    const leftPosition = position.get(left.slug) ?? Number.MAX_SAFE_INTEGER;
    const rightPosition = position.get(right.slug) ?? Number.MAX_SAFE_INTEGER;
    return leftPosition - rightPosition || left.slug.localeCompare(right.slug);
  });
}

export function hasVerifiedNigeriaOfferAt(product: Pick<Product, 'offers'>, now: number | Date) {
  return product.offers.some(offer =>
    offer.match !== 'search'
    && offer.available
    && (offer.location.includes('NG') || offer.location.includes('INTL'))
    && hasListingEvidence(offer)
    && comparableMarketPrice(offer, 'NG', now) != null,
  );
}

export function hasVerifiedNigeriaOffer(product: Pick<Product, 'offers'>) {
  return hasVerifiedNigeriaOfferAt(product, Date.now());
}
