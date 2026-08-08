import assert from 'node:assert/strict';
import test from 'node:test';
import { extractRetailerPage } from './extraction';

function productPage(options: {
  price?: string;
  currency?: string;
  availability?: string;
  stockClass?: string;
  stockText?: string;
  name?: string;
  size?: string;
} = {}) {
  const offer = options.price ? `"offers":{"@type":"Offer","price":"${options.price}","priceCurrency":"${options.currency ?? 'NGN'}"${options.availability ? `,"availability":"https://schema.org/${options.availability}"` : ''}}` : '';
  return `<!doctype html><html><head>
    <link rel="canonical" href="https://teeka4.com/shop/example/?utm_source=test">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"${options.name ?? 'Example Serum'}"${options.size ? `,"size":"${options.size}"` : ''}${offer ? `,${offer}` : ''}}</script>
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

test('reads the main WooCommerce product price without taking a related-product price', () => {
  const html = `<!doctype html><html><head>
    <link rel="canonical" href="https://buybetter.ng/product/example-150ml/">
  </head><body>
    <aside><p class="price"><span class="woocommerce-Price-amount"><bdi>&#8358;99,999.00</bdi></span></p></aside>
    <h1 class="product_title entry-title">Example Cleanser 150ml</h1>
    <p class="price"><span class="woocommerce-Price-amount"><bdi><span class="woocommerce-Price-currencySymbol">&#8358;</span>15,265.00</bdi></span> <small>NG</small></p>
    <p class="stock out-of-stock">Out of stock</p>
  </body></html>`;
  const result = extractRetailerPage({ url: new URL('https://buybetter.ng/product/example-150ml/'), html });

  assert.equal(result.adapterKey, 'buybetter');
  assert.equal(result.extraction.priceMinor, 15_265);
  assert.equal(result.extraction.currencyCode, 'NGN');
  assert.equal(result.extraction.inventoryStatus, 'out_of_stock');
  assert.ok(result.extraction.evidence.includes('WooCommerce product price'));
});

test('uses the active WooCommerce sale price instead of concatenating two amounts', () => {
  const html = `<!doctype html><html><body>
    <h1 class="product_title">Example Cleanser 150ml</h1>
    <p class="price">
      <del><span><bdi>&#8358;20,000.00</bdi></span></del>
      <ins><span><bdi>&#8358;15,000.00</bdi></span></ins>
    </p>
  </body></html>`;
  const result = extractRetailerPage({ url: new URL('https://buybetter.ng/product/example-150ml/'), html });

  assert.equal(result.extraction.priceMinor, 15_000);
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

test('extracts actual product size from structured data', () => {
  const result = extractRetailerPage({
    url: new URL('https://teeka4.com/shop/example/'),
    html: productPage({ name: 'Example Serum', size: '30 ml' }),
  });

  assert.equal(result.extraction.productSize, '30 ml');
  assert.ok(result.extraction.evidence.includes('JSON-LD Product size'));
});

test('does not treat generic structured weight as observed product size', () => {
  const html = '<script type="application/ld+json">{"@type":"Product","name":"Example Cleanser","weight":{"@type":"QuantitativeValue","value":226,"unitCode":"GRM"}}</script>';
  const result = extractRetailerPage({ url: new URL('https://luxbeautyng.com/product/example/'), html });

  assert.equal(result.extraction.productSize, undefined);
  assert.ok(!result.extraction.evidence.includes('JSON-LD Product size'));
});

test('prefers a measurable product title over generic structured shipping weight', () => {
  const html = '<script type="application/ld+json">{"@type":"Product","name":"Example Cleanser 150 ml","weight":{"@type":"QuantitativeValue","value":0.6,"unitCode":"KGM"}}</script>';
  const result = extractRetailerPage({ url: new URL('https://beautybydaz.com/shop/example/'), html });

  assert.equal(result.extraction.productSize, '150 ml');
  assert.ok(result.extraction.evidence.includes('Product title size'));
  assert.ok(!result.extraction.evidence.includes('JSON-LD Product size'));
});

test('accepts structured weight only when it explicitly describes net product content', () => {
  const html = '<script type="application/ld+json">{"@type":"Product","name":"Example Cleanser","weight":{"@type":"QuantitativeValue","name":"Net weight","value":226,"unitCode":"GRM"}}</script>';
  const result = extractRetailerPage({ url: new URL('https://luxbeautyng.com/product/example/'), html });

  assert.equal(result.extraction.productSize, '226 g');
  assert.ok(result.extraction.evidence.includes('JSON-LD Product size'));
});

test('keeps a title measurement ahead of an explicitly labelled but conflicting weight', () => {
  const html = '<script type="application/ld+json">{"@type":"Product","name":"Example Sunscreen 50 ml","weight":{"@type":"QuantitativeValue","name":"Net weight","value":0.6,"unitCode":"KGM"}}</script>';
  const result = extractRetailerPage({ url: new URL('https://beautybydaz.com/shop/example/'), html });

  assert.equal(result.extraction.productSize, '50 ml');
  assert.ok(result.extraction.evidence.includes('Product title size'));
});

test('accepts an explicitly named netWeight field', () => {
  const html = '<script type="application/ld+json">{"@type":"Product","name":"Example Balm","netWeight":{"@type":"QuantitativeValue","value":40,"unitCode":"GRM"}}</script>';
  const result = extractRetailerPage({ url: new URL('https://luxbeautyng.com/product/example/'), html });

  assert.equal(result.extraction.productSize, '40 g');
  assert.ok(result.extraction.evidence.includes('JSON-LD Product size'));
});

test('accepts an additional property explicitly labelled net weight', () => {
  const html = '<script type="application/ld+json">{"@type":"Product","name":"Example Cleanser","additionalProperty":{"@type":"PropertyValue","name":"Net Weight","value":"454 g"}}</script>';
  const result = extractRetailerPage({ url: new URL('https://beautybydaz.com/shop/example/'), html });

  assert.equal(result.extraction.productSize, '454 g');
  assert.ok(result.extraction.evidence.includes('JSON-LD Product size'));
});

test('ignores an additional property labelled only weight', () => {
  const html = '<script type="application/ld+json">{"@type":"Product","name":"Example Cleanser","additionalProperty":{"@type":"PropertyValue","name":"Weight","value":"0.5 kg"}}</script>';
  const result = extractRetailerPage({ url: new URL('https://beautybydaz.com/shop/example/'), html });

  assert.equal(result.extraction.productSize, undefined);
});

test('falls back to a measurable size in the observed product title', () => {
  const result = extractRetailerPage({
    url: new URL('https://teeka4.com/shop/example/'),
    html: productPage({ name: 'Example Serum 1.7 fl oz / 50 ml' }),
  });

  assert.equal(result.extraction.productSize, '1.7 fl oz / 50 ml');
  assert.ok(result.extraction.evidence.includes('Product title size'));
});

test('uses one product-scoped Open Graph image size when the title omits it', () => {
  const html = `<!doctype html><html><head>
    <meta property="og:title" content="Example Weightless Conditioner">
    <meta property="og:image:alt" content="Example Weightless Conditioner 828 ml">
  </head></html>`;
  const result = extractRetailerPage({ url: new URL('https://beautybydaz.com/shop/example/'), html });

  assert.equal(result.extraction.productSize, '828 ml');
  assert.ok(result.extraction.evidence.includes('Open Graph product image size'));
});

test('uses one product-scoped description size when stronger evidence omits it', () => {
  const html = `<!doctype html><html><head>
    <meta property="og:title" content="Example Treatment Ointment">
    <meta name="description" content="Example Treatment Ointment 2.6oz is available now.">
  </head></html>`;
  const result = extractRetailerPage({ url: new URL('https://beautybydaz.com/shop/example/'), html });

  assert.equal(result.extraction.productSize, '2.6oz');
  assert.ok(result.extraction.evidence.includes('Product description size'));
});

test('does not use an ambiguous description containing several package sizes', () => {
  const html = `<!doctype html><html><head>
    <meta property="og:title" content="Example Treatment Ointment">
    <meta name="description" content="Available in 30 ml and 50 ml sizes.">
  </head></html>`;
  const result = extractRetailerPage({ url: new URL('https://beautybydaz.com/shop/example/'), html });

  assert.equal(result.extraction.productSize, undefined);
});

test('uses one measurable size from the exact product route as a final fallback', () => {
  const result = extractRetailerPage({
    url: new URL('https://beautybydaz.com/shop/example-conditioner-828-ml/'),
    html: '<meta property="og:title" content="Example Conditioner">',
  });

  assert.equal(result.extraction.productSize, '828 ml');
  assert.ok(result.extraction.evidence.includes('Product route size'));
});

test('does not manufacture a product size when the retailer omits it', () => {
  const result = extractRetailerPage({
    url: new URL('https://teeka4.com/shop/example/'),
    html: productPage({ name: 'Example Serum' }),
  });

  assert.equal(result.extraction.productSize, undefined);
});

test('uses the Deoset adapter for a Woo product page', () => {
  const result = extractRetailerPage({
    url: new URL('https://deoset.com/product/example-150ml/'),
    html: productPage({ price: '24000', availability: 'InStock' }).replaceAll('teeka4.com', 'deoset.com'),
  });

  assert.equal(result.adapterKey, 'deoset');
  assert.equal(result.extraction.priceMinor, 24_000);
  assert.equal(result.extraction.currencyCode, 'NGN');
  assert.equal(result.extraction.inventoryStatus, 'in_stock');
});

test('uses the Rhema Beauty Shop adapter for a Woo product page', () => {
  const result = extractRetailerPage({
    url: new URL('https://rhemabeautyshop.com/shop/example-30ml/'),
    html: productPage({ price: '45000', availability: 'InStock' }).replaceAll('teeka4.com', 'rhemabeautyshop.com'),
  });

  assert.equal(result.adapterKey, 'rhema-beauty-shop');
  assert.equal(result.extraction.priceMinor, 45_000);
});

test('uses the TOS Nigeria adapter for a Woo product page', () => {
  const result = extractRetailerPage({
    url: new URL('https://tosnigeria.com/shop/example-500ml/'),
    html: productPage({ price: '48500', availability: 'InStock' }).replaceAll('teeka4.com', 'tosnigeria.com'),
  });

  assert.equal(result.adapterKey, 'tos-nigeria');
  assert.equal(result.extraction.priceMinor, 48_500);
});

test('uses the Beauty Prism adapter for a Woo product page', () => {
  const result = extractRetailerPage({
    url: new URL('https://thebeautyprismng.com/shop/example-30ml/'),
    html: productPage({ price: '42500', availability: 'InStock' }).replaceAll('teeka4.com', 'thebeautyprismng.com'),
  });

  assert.equal(result.adapterKey, 'the-beauty-prism');
  assert.equal(result.extraction.priceMinor, 42_500);
});

test('uses the Sonavine Beauty adapter for a Woo product page', () => {
  const result = extractRetailerPage({
    url: new URL('https://sonavinebeauty.com/product/example-100ml/'),
    html: productPage({ price: '56500', availability: 'InStock' }).replaceAll('teeka4.com', 'sonavinebeauty.com'),
  });

  assert.equal(result.adapterKey, 'sonavine-beauty');
  assert.equal(result.extraction.priceMinor, 56_500);
});

test('uses the Kadimez Essentials adapter for a Woo product page', () => {
  const result = extractRetailerPage({
    url: new URL('https://kadimezessentials.com/product/example-500ml/'),
    html: productPage({ price: '43000', availability: 'InStock' }).replaceAll('teeka4.com', 'kadimezessentials.com'),
  });

  assert.equal(result.adapterKey, 'kadimez-essentials');
  assert.equal(result.extraction.priceMinor, 43_000);
});

test('uses the Dunes Center adapter for a Woo product page', () => {
  const result = extractRetailerPage({
    url: new URL('https://dunescenter.com/product/example-52ml/'),
    html: productPage({ price: '47500', availability: 'InStock' }).replaceAll('teeka4.com', 'dunescenter.com'),
  });

  assert.equal(result.adapterKey, 'dunes-center');
  assert.equal(result.extraction.priceMinor, 47_500);
});

test('uses the Slique Beauty adapter for a Woo product page', () => {
  const result = extractRetailerPage({
    url: new URL('https://sliquebeautylimited.com/product/example-156g/'),
    html: productPage({ price: '3500', availability: 'InStock' }).replaceAll('teeka4.com', 'sliquebeautylimited.com'),
  });

  assert.equal(result.adapterKey, 'slique-beauty');
  assert.equal(result.extraction.priceMinor, 3_500);
});

test('corrects Shopify kobo prices for NGN products', () => {
  // Shopify stores emit NGN JSON-LD prices in kobo (×100).
  // E.g., ₦145,000 is emitted as "14500000" in JSON-LD.
  const html = `<script type="application/ld+json">{"@type":"Product","name":"Medik8 Crystal Retinal 6 30ml","offers":{"@type":"Offer","price":"14500000","priceCurrency":"NGN","availability":"https://schema.org/InStock"}}</script>`;
  const result = extractRetailerPage({ url: new URL('https://myskinhubng.com/products/medik8-crystal-retinal-6/3176365'), html });

  assert.equal(result.adapterKey, 'my-skin-hub-ng');
  assert.equal(result.extraction.priceMinor, 145_000);
  assert.equal(result.extraction.currencyCode, 'NGN');
  assert.ok(result.extraction.evidence.includes('Shopify kobo-to-naira correction'));
});

test('does not apply kobo correction to reasonable Shopify NGN prices', () => {
  // A price of ₦145,000 (145000) should not be divided by 100 — it's already in naira.
  const html = `<script type="application/ld+json">{"@type":"Product","name":"Medik8 Crystal Retinal 3 30ml","offers":{"@type":"Offer","price":"145000","priceCurrency":"NGN","availability":"https://schema.org/InStock"}}</script>`;
  const result = extractRetailerPage({ url: new URL('https://skincareplugng.com/products/example/123'), html });

  assert.equal(result.extraction.priceMinor, 145_000);
  assert.ok(!result.extraction.evidence.includes('Shopify kobo-to-naira correction'));
});

test('uses the Skincare Plug NG adapter for a Shopify product page', () => {
  const result = extractRetailerPage({
    url: new URL('https://skincareplugng.com/products/example'),
    html: productPage({ price: '145000', availability: 'InStock' }).replaceAll('teeka4.com', 'skincareplugng.com'),
  });

  assert.equal(result.adapterKey, 'skincare-plug-ng');
  assert.equal(result.extraction.priceMinor, 145_000);
});

test('uses the Essentials Hub adapter for a product page', () => {
  const result = extractRetailerPage({
    url: new URL('https://essentialshub.com/product/example-200ml/'),
    html: productPage({ price: '25000', availability: 'InStock' }).replaceAll('teeka4.com', 'essentialshub.com'),
  });

  assert.equal(result.adapterKey, 'essentials-hub');
  assert.equal(result.extraction.priceMinor, 25_000);
});

test('uses the Medplus adapter for a product page', () => {
  const result = extractRetailerPage({
    url: new URL('https://medplusnig.com/product/example-400ml/'),
    html: productPage({ price: '29550', availability: 'InStock' }).replaceAll('teeka4.com', 'medplusnig.com'),
  });

  assert.equal(result.adapterKey, 'medplus');
  assert.equal(result.extraction.priceMinor, 29_550);
});
