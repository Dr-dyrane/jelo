import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { products } from '@/data/catalogue';
import {
  appendUniqueInventoryItems,
  inventoryAutoLoadPageLimit,
  inventoryContinuationBatchPageLimit,
  inventoryContinuationHref,
  inventoryContinuationRange,
  inventoryContinuationTargetPage,
  sanitizeInventoryContinuationRequest,
} from '@/lib/catalogue/inventory-continuation';
import { queryInventoryRecordPages } from '@/lib/catalogue/inventory-query';

test('continuation state is bounded and safe for an untrusted server-action request', () => {
  assert.equal(inventoryAutoLoadPageLimit, 2);
  assert.equal(inventoryContinuationBatchPageLimit, 4);
  assert.equal(inventoryContinuationTargetPage('999', 7), 7);
  assert.equal(inventoryContinuationTargetPage('not-a-page', 7), 1);

  assert.deepEqual(inventoryContinuationRange(2, 20, 12), {
    fromPage: 2,
    toPage: 5,
  });
  assert.equal(inventoryContinuationRange(13, 20, 12), null);

  assert.deepEqual(
    sanitizeInventoryContinuationRequest({
      query: {
        q: 'barrier',
        market: 'US',
        page: 91,
        brand: 42,
      },
      fromPage: '-4',
      toPage: 99_999,
    }),
    {
      query: { q: 'barrier', market: 'US' },
      fromPage: 2,
      toPage: 10_000,
    },
  );
});

test('continuation URLs preserve catalogue intent and record only the deepest page', () => {
  assert.equal(
    inventoryContinuationHref('/products?q=barrier&brand=CeraVe&page=2#old', 3),
    '/products?q=barrier&brand=CeraVe&page=3#all-products',
  );
  assert.equal(
    inventoryContinuationHref('/products?q=barrier&page=3', 1),
    '/products?q=barrier#all-products',
  );
});

test('appended inventory is idempotent and keeps settled card order', () => {
  const current = [{ id: 'one' }, { id: 'two' }];
  const appended = appendUniqueInventoryItems(current, [
    { id: 'two' },
    { id: 'three' },
    { id: 'three' },
    { id: 'four' },
  ]);
  assert.deepEqual(appended.map(item => item.id), ['one', 'two', 'three', 'four']);
});

test('server continuation reads a bounded page range without hydrating the full catalogue', () => {
  const template = products[0];
  assert.ok(template);
  const fixtures = Array.from({ length: 130 }, (_, index) => ({
    ...template,
    slug: `continuation-fixture-${index.toString().padStart(3, '0')}`,
    brand: 'Continuation Fixture',
    name: `Product ${index.toString().padStart(3, '0')}`,
  }));

  const range = queryInventoryRecordPages(
    fixtures,
    { review: 'reviewed', sort: 'name' },
    2,
    20,
  );

  assert.equal(range.total, 130);
  assert.equal(range.pageCount, 6);
  assert.equal(range.pageSize, 24);
  assert.equal(range.fromPage, 2);
  assert.equal(range.throughPage, 5);
  assert.equal(range.items.length, 96);
  assert.equal(new Set(range.items.map(item => item.id)).size, range.items.length);
});

test('the active catalogue has one progressive result path and complete feedback states', async () => {
  const root = process.cwd();
  const [
    productsPage,
    pageModel,
    productsStyles,
    results,
    resultsStyles,
    action,
    repository,
    filterStyles,
    inventoryCardStyles,
  ] = await Promise.all([
    readFile(path.join(root, 'app/(site)/products/page.tsx'), 'utf8'),
    readFile(path.join(root, 'lib/catalogue/catalogue-page-model.ts'), 'utf8'),
    readFile(path.join(root, 'app/(site)/products/products.module.css'), 'utf8'),
    readFile(path.join(root, 'components/products/inventory-results.tsx'), 'utf8'),
    readFile(path.join(root, 'components/products/inventory-results.module.css'), 'utf8'),
    readFile(path.join(root, 'components/products/inventory-continuation-action.ts'), 'utf8'),
    readFile(path.join(root, 'lib/catalogue/inventory-repository.ts'), 'utf8'),
    readFile(path.join(root, 'components/products/inventory-filter-sheet.module.css'), 'utf8'),
    readFile(path.join(root, 'components/products/inventory-card.module.css'), 'utf8'),
  ]);

  assert.match(pageModel, /loadInventory\(inventoryQuery\)/);
  assert.match(productsPage, /<InventoryResults/);
  assert.match(productsPage, /requestedPage=\{model\.requestedPage\}/);
  assert.doesNotMatch(
    productsPage,
    /InventoryPagination|CatalogueExplorer|ProductSearchResults/,
  );

  assert.match(results, /new IntersectionObserver/);
  assert.match(results, /inventoryAutoLoadPageLimit/);
  assert.match(results, /rootMargin: '240px 0px'/);
  assert.match(results, /'Load more'/);
  assert.match(results, /'Try again'/);
  assert.match(results, /role="status"/);
  assert.match(results, /aria-live="polite"/);
  assert.match(results, /aria-busy=\{isLoading\}/);
  assert.match(results, /history\.replaceState\(\{ \.\.\.window\.history\.state \}/);
  assert.match(results, /mountedRef\.current/);
  assert.match(results, /appendUniqueInventoryItems/);
  assert.doesNotMatch(
    results,
    /Quick Look|\bratings?\b|\bstars?\b|low stock|popular|personalized/i,
  );

  assert.match(action, /sanitizeInventoryContinuationRequest/);
  assert.match(repository, /queryInventoryRecordPages/);
  assert.match(resultsStyles, /min-height: 2\.75rem/);
  assert.match(resultsStyles, /@media \(max-width: 640px\)/);
  assert.match(resultsStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(productsStyles, /\.grid\{[\s\S]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(productsStyles, /@media\(max-width:1120px\)\{\.grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(productsStyles, /@media\(max-width:820px\)[\s\S]*\.grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(productsStyles, /grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,max\(9\.5rem,46%\)\),1fr\)\)/);
  assert.match(productsStyles, /\.heroStage\{display:contents\}/);
  assert.match(productsStyles, /@media\(max-width:820px\)[\s\S]*\.hero\{display:contents\}/);
  assert.match(inventoryCardStyles, /\.card\{\s*overflow:visible;\s*background:transparent;/);
  assert.match(inventoryCardStyles, /\.copy\{\s*padding:1rem \.35rem 1\.25rem;\s*background:transparent;/);
  assert.match(inventoryCardStyles, /\.visual\{border-radius:1\.75rem\}/);
  assert.match(inventoryCardStyles, /\.card\[data-selected="true"\]/);
  assert.match(filterStyles, /@media \(max-width: 640px\)[\s\S]*margin: auto 0 0/);
});
