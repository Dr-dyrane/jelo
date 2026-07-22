import type { Product } from '@/data/products';

export function orderByCuratedSlugs<T extends { slug: string }>(items: T[], curatedSlugs: string[]) {
  const position = new Map(curatedSlugs.map((slug, index) => [slug, index]));
  return [...items].sort((left, right) => {
    const leftPosition = position.get(left.slug) ?? Number.MAX_SAFE_INTEGER;
    const rightPosition = position.get(right.slug) ?? Number.MAX_SAFE_INTEGER;
    return leftPosition - rightPosition || left.slug.localeCompare(right.slug);
  });
}

export function hasVerifiedNigeriaOffer(product: Pick<Product, 'offers'>) {
  return product.offers.some(offer =>
    offer.match !== 'search'
    && offer.available
    && (offer.location.includes('NG') || offer.location.includes('INTL'))
    && typeof offer.priceNgn === 'number'
    && offer.priceNgn > 0,
  );
}
