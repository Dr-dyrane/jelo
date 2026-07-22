import assert from 'node:assert/strict';
import test from 'node:test';
import type { Product } from '@/data/products';
import { productStructuredData, serializeJsonLd } from './product-structured-data';

const product: Product = {
  slug: 'example-serum',
  brand: 'Example',
  name: 'Calm Serum',
  size: '30 ml',
  category: 'Face',
  step: 'Treat',
  image: 'https://example.com/serum.webp',
  displayLine: 'Calm · support',
  bestFor: ['barrier support'],
  concerns: ['barrier'],
  skinTypes: ['all'],
  sensitiveFriendly: true,
  usage: 'Use once daily.',
  evidence: 'moderate',
  offers: [
    { retailer: 'Store B', url: 'https://store-b.example/product', trust: 90, available: true, priceNgn: 12_000, checkedAt: '2026-07-22', match: 'exact', location: ['NG'] },
    { retailer: 'Store A', url: 'https://store-a.example/product', trust: 95, available: true, priceNgn: 10_000, checkedAt: '2026-07-22', match: 'exact', location: ['NG'] },
    { retailer: 'Out Store', url: 'https://out.example/product', trust: 90, available: false, priceNgn: 8_000, match: 'exact', location: ['NG'] },
    { retailer: 'Search Store', url: 'https://search.example', trust: 80, available: true, priceNgn: 7_000, match: 'search', location: ['NG'] },
    { retailer: 'US Store', url: 'https://us.example/product', trust: 90, available: true, priceUsd: 20, match: 'exact', location: ['US'] },
  ],
};

test('builds an aggregate only from available exact Nigerian prices', () => {
  const data = productStructuredData(product);

  assert.ok(data);
  assert.equal(data.offers.lowPrice, 10_000);
  assert.equal(data.offers.highPrice, 12_000);
  assert.equal(data.offers.offerCount, 2);
  assert.deepEqual(data.offers.offers.map(offer => offer.seller.name), ['Store B', 'Store A']);
  assert.match(data.offers.offers[0].url, /\/go\?product=example-serum&retailer=Store%20B$/);
});

test('omits product markup when no verified Nigerian price is visible', () => {
  assert.equal(productStructuredData({ ...product, offers: product.offers.slice(2) }), null);
});

test('escapes markup-breaking characters in JSON-LD', () => {
  assert.equal(serializeJsonLd({ name: '</script>' }).includes('</script>'), false);
});
