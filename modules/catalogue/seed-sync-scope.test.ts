import assert from 'node:assert/strict';
import test from 'node:test';
import {
  catalogueSyncTimeouts,
  parseCatalogueSeedScope,
  selectCatalogueSeedProducts,
  shouldRetireStaleCatalogueProducts,
} from '@/lib/catalogue/seed-sync-scope';

const catalogue = [
  { slug: 'first-product' },
  { slug: 'second-product' },
  { slug: 'third-product' },
];

test('a scoped catalogue sync is deduplicated but retains canonical order', () => {
  const scope = parseCatalogueSeedScope([
    '--only',
    'third-product',
    '--only',
    'first-product',
    '--only',
    'third-product',
  ]);

  assert.equal(scope.isScoped, true);
  assert.deepEqual(
    selectCatalogueSeedProducts(catalogue, scope).map(
      (product) => product.slug,
    ),
    ['first-product', 'third-product'],
  );
});

test('a full catalogue sync retains every reviewed product', () => {
  const scope = parseCatalogueSeedScope([]);
  assert.equal(scope.isScoped, false);
  assert.deepEqual(selectCatalogueSeedProducts(catalogue, scope), catalogue);
  assert.equal(shouldRetireStaleCatalogueProducts(scope), true);
});

test('a targeted repair cannot unpublish unrelated catalogue rows', () => {
  const scope = parseCatalogueSeedScope(['--only', 'second-product']);
  assert.equal(shouldRetireStaleCatalogueProducts(scope), false);
});

test('scope parsing fails closed for malformed, missing, and unknown input', () => {
  assert.throws(
    () => parseCatalogueSeedScope(['--only']),
    /Missing product slug/,
  );
  assert.throws(
    () => parseCatalogueSeedScope(['--only', 'Not A Slug']),
    /Invalid product slug/,
  );
  assert.throws(
    () => parseCatalogueSeedScope(['--all']),
    /Unknown catalogue sync argument/,
  );
  assert.throws(
    () =>
      selectCatalogueSeedProducts(
        catalogue,
        parseCatalogueSeedScope(['--only', 'missing-product']),
      ),
    /Unknown public catalogue product: missing-product/,
  );
});

test('sync transaction timeouts are bounded and configurable', () => {
  assert.deepEqual(catalogueSyncTimeouts({}), {
    lockTimeoutMs: 5_000,
    statementTimeoutMs: 45_000,
  });
  assert.deepEqual(
    catalogueSyncTimeouts({
      CATALOGUE_SYNC_LOCK_TIMEOUT_MS: '2500',
      CATALOGUE_SYNC_STATEMENT_TIMEOUT_MS: '60000',
    }),
    {
      lockTimeoutMs: 2_500,
      statementTimeoutMs: 60_000,
    },
  );
  assert.throws(
    () => catalogueSyncTimeouts({ CATALOGUE_SYNC_LOCK_TIMEOUT_MS: '0' }),
    /positive whole number/,
  );
  assert.throws(
    () =>
      catalogueSyncTimeouts({
        CATALOGUE_SYNC_LOCK_TIMEOUT_MS: '60000',
        CATALOGUE_SYNC_STATEMENT_TIMEOUT_MS: '5000',
      }),
    /cannot be lower/,
  );
});
