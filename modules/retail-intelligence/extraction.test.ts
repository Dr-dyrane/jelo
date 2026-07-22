import assert from 'node:assert/strict';
import test from 'node:test';
import { extractRetailerPage } from './extraction';

function productPage(options: { price?: string; currency?: string; availability?: string; stockClass?: string; stockText?: string } = {}) {
  const offer = options.price ? `"offers":{"@type":"Offer","price":"${options.price}","priceCurrency":"${options.currency ?? 'NGN'}"${options.availability ? `,"availability":"https://schema.org/${options.availability}"` : ''}}` : '';
  return `<!doctype html><html><head>
    <link rel="canonical" href="https://teeka4.com/shop/example/?utm_source=test">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Example Serum"${offer ? `,${offer}` : ''}}</script>
  </head><body>
    ${options.stockClass ? `<p class="stock ${options.stockClass}">${options.stockText ?? ''}</p>` : ''}
  </body></html>`;
}

test('uses a known retailer adapter and structured offer evidence', () => {
  const result = extractRetailerPage({
    url: new URL('https://teeka4.com/shop/example/'),
    html: productPage({ price: '13,300.00', availability: 'InStock' }),
  });

  assert.equal(result.adapterKey, 'teeka4');
  assert.equal(result.extraction.priceMinor, 13_300);
  assert.equal(result.extraction.currencyCode, 'NGN');
  assert.equal(result.extraction.inventoryStatus, 'in_stock');
  assert.equal(result.extraction.canonicalUrl, 'https://teeka4.com/shop/example/');
  assert.ok(result.extraction.confidence >= 90);
  assert.ok(result.extraction.evidence.includes('JSON-LD Offer availability'));
});

test('uses a product-scoped WooCommerce stock marker when structured stock is absent', () => {
  const result = extractRetailerPage({
    url: new URL('https://beautybydaz.com/shop/example/'),
    html: productPage({ price: '10500', stockClass: 'out-of-stock', stockText: 'Out of stock' }),
  });

  assert.equal(result.adapterKey, 'beauty-by-daz');
  assert.equal(result.extraction.inventoryStatus, 'out_of_stock');
  assert.ok(result.extraction.evidence.includes('WooCommerce product stock marker'));
});

test('does not treat unrelated add-to-cart text as product availability', () => {
  const result = extractRetailerPage({
    url: new URL('https://unknown.example/products/example'),
    html: '<html><body><aside>Related item <button>Add to cart</button></aside></body></html>',
  });

  assert.equal(result.adapterKey, 'structured-generic');
  assert.equal(result.extraction.inventoryStatus, 'unknown');
  assert.equal(result.extraction.confidence, 0);
});

test('does not accept a cross-origin canonical URL', () => {
  const result = extractRetailerPage({
    url: new URL('https://luxbeautyng.com/product/example/'),
    html: '<link rel="canonical" href="https://tracker.example/redirect"><meta property="product:price:amount" content="17500"><meta property="product:price:currency" content="NGN">',
  });

  assert.equal(result.extraction.canonicalUrl, undefined);
  assert.equal(result.extraction.priceMinor, 17_500);
});

test('stores non-NGN currencies in minor units', () => {
  const result = extractRetailerPage({
    url: new URL('https://www.caretobeauty.com/us/example/'),
    html: productPage({ price: '15.03', currency: 'USD', availability: 'InStock' }).replaceAll('teeka4.com', 'www.caretobeauty.com'),
  });

  assert.equal(result.adapterKey, 'care-to-beauty');
  assert.equal(result.extraction.priceMinor, 1_503);
  assert.equal(result.extraction.currencyCode, 'USD');
});

test('reads a nested unit price specification', () => {
  const html = '<script type="application/ld+json">{"@type":"Product","name":"Wash","offers":{"@type":"Offer","availability":"https://schema.org/InStock","priceSpecification":[{"@type":"UnitPriceSpecification","price":"17500.00","priceCurrency":"NGN"}]}}</script>';
  const result = extractRetailerPage({ url: new URL('https://luxbeautyng.com/product/wash/'), html });

  assert.equal(result.extraction.priceMinor, 17_500);
  assert.equal(result.extraction.currencyCode, 'NGN');
});
