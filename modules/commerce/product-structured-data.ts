import type { Offer, Product } from '@/data/products';

const siteUrl = 'https://jelocare.com';

function nigeriaOffer(offer: Offer) {
  return offer.match !== 'search'
    && offer.available
    && (offer.location.includes('NG') || offer.location.includes('INTL'))
    && typeof offer.priceNgn === 'number'
    && offer.priceNgn > 0;
}

export function productStructuredData(product: Product) {
  const offers = product.offers.filter(nigeriaOffer);
  if (!offers.length) return null;

  const prices = offers.map(offer => offer.priceNgn!);
  const url = `${siteUrl}/products/${product.slug}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    url,
    name: product.name,
    image: [product.image],
    description: `${product.displayLine}. Best for ${product.bestFor.slice(0, 3).join(', ')}.`,
    category: product.category,
    size: product.size,
    brand: {
      '@type': 'Brand',
      name: product.brand,
    },
    offers: {
      '@type': 'AggregateOffer',
      url,
      priceCurrency: 'NGN',
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: offers.length,
      offers: offers.map(offer => ({
        '@type': 'Offer',
        price: offer.priceNgn!,
        priceCurrency: 'NGN',
        availability: 'https://schema.org/InStock',
        url: `${siteUrl}/go?product=${encodeURIComponent(product.slug)}&retailer=${encodeURIComponent(offer.retailer)}`,
        seller: {
          '@type': 'Organization',
          name: offer.retailer,
        },
      })),
    },
  };
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
