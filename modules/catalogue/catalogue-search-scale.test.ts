import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { products } from '@/data/catalogue';
import {
  companyCatalogueSearchSuggestions,
  productCatalogueSearchSuggestions,
  rankCatalogueSearchRecords,
  type CatalogueSearchRecord,
} from '@/lib/catalogue/catalogue-search-index';
import {
  catalogueSuggestionMinimumQueryLength,
  parseCatalogueSearchRequest,
} from '@/lib/catalogue/catalogue-search-request';

function record(overrides: Partial<CatalogueSearchRecord> = {}): CatalogueSearchRecord {
  return {
    source: 'reviewed',
    brand: 'Example',
    name: 'Daily Cleanser',
    size: '150 ml',
    href: '/products/example-daily-cleanser',
    ...overrides,
  };
}

test('server search ranking reaches products beyond the former 24-item client ceiling', () => {
  assert.ok(products.length > 24);
  const records = products.map(product => record({
    brand: product.brand,
    name: product.name,
    size: product.size,
    href: `/products/${product.slug}`,
  }));
  const lateProduct = products.at(-1);
  assert.ok(lateProduct);
  assert.ok(products.indexOf(lateProduct) >= 24);

  const [match] = productCatalogueSearchSuggestions(records, lateProduct.name);
  assert.equal(match?.href, `/products/${lateProduct.slug}`);
});

test('catalogue search matches name, brand, size and exact barcode with deterministic priority', () => {
  const records = [
    record({ name: 'Barcode prefix cleanser', href: '/products/prefix', barcode: '850068103000' }),
    record({ brand: 'KeraCare', name: 'Dry & Itchy Conditioner', size: '32 oz', href: '/products/keracare', barcode: '850068103058' }),
    record({ brand: 'KeraCare', name: 'Hydrating Shampoo', size: '950 ml', href: '/products/shampoo' }),
  ];

  assert.equal(rankCatalogueSearchRecords(records, 'dry itchy')[0]?.href, '/products/keracare');
  assert.deepEqual(
    rankCatalogueSearchRecords(records, 'keracare').map(item => item.href),
    ['/products/keracare', '/products/shampoo'],
  );
  assert.equal(rankCatalogueSearchRecords(records, '32 oz')[0]?.href, '/products/keracare');
  assert.equal(rankCatalogueSearchRecords(records, '850068103058')[0]?.href, '/products/keracare');
  assert.deepEqual(
    rankCatalogueSearchRecords(records, '850068103', 1).map(item => item.href),
    ['/products/prefix'],
  );
});

test('company suggestions retain counts and market in a bounded deterministic result', () => {
  const suggestions = companyCatalogueSearchSuggestions([
    { label: 'CeraVe', count: 8 },
    { label: 'CeraVe', count: 6 },
    { label: 'CeraMed', count: 3 },
  ], 'cera', 'US', 2);

  assert.deepEqual(suggestions.map(item => item.label), ['CeraVe', 'CeraMed']);
  assert.equal(suggestions[0]?.detail, '8 products');
  assert.equal(suggestions[0]?.href, '/products?brand=CeraVe&market=US#all-products');
});

test('suggestion requests are bounded, normalized and market aware', () => {
  const parsed = parseCatalogueSearchRequest('https://www.jelocare.com/api/products/suggestions?q=%20%20CeraVe%20%20cleanser%20&market=US');
  assert.deepEqual(parsed, {
    query: 'CeraVe cleanser',
    market: 'US',
    searchable: true,
  });
  assert.equal(
    parseCatalogueSearchRequest('https://www.jelocare.com/api/products/suggestions?q=a').searchable,
    catalogueSuggestionMinimumQueryLength <= 1,
  );
  assert.equal(
    parseCatalogueSearchRequest(`https://www.jelocare.com/api/products/suggestions?q=${'x'.repeat(200)}`).query.length,
    120,
  );
});

test('products page ships compact start suggestions and fetches product matches on demand', async () => {
  const root = process.cwd();
  const [page, client, route, repository] = await Promise.all([
    readFile(path.join(root, 'app/(site)/products/page.tsx'), 'utf8'),
    readFile(path.join(root, 'components/products/catalogue-search.tsx'), 'utf8'),
    readFile(path.join(root, 'app/api/products/suggestions/route.ts'), 'utf8'),
    readFile(path.join(root, 'lib/catalogue/catalogue-search-repository.ts'), 'utf8'),
  ]);

  assert.doesNotMatch(page, /reviewedProducts\.slice\(0,\s*24\)/);
  assert.match(client, /fetch\(`\/api\/products\/suggestions\?/);
  assert.match(client, /AbortController/);
  assert.match(client, /aria-busy=\{isLoading\}/);
  assert.match(route, /parseCatalogueSearchRequest/);
  assert.match(route, /Cache-Control/);
  assert.match(repository, /limit \$\{recordLimit\}/);
  assert.match(repository, /verified static fallback/);
});
