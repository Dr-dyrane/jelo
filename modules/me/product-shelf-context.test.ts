import assert from 'node:assert/strict';
import test from 'node:test';
import type { CustomerPortalShelfItem } from '../../lib/customer/portal-model';
import { deriveProductShelfContext, shelfContextLabel } from '../../lib/customer/product-shelf-context';

function makeShelfItem(overrides: Partial<CustomerPortalShelfItem> & { slug?: string }): CustomerPortalShelfItem {
  const slug = overrides.slug ?? 'target-product';
  return {
    identityVersionId: 'iv-1',
    savedAt: '2026-07-01T00:00:00Z',
    saveOrigin: 'customer',
    lifecycleState: 'active',
    availability: 'available',
    snapshot: {
      slug,
      brand: 'Brand',
      name: 'Product',
      size: '30 ml',
      versionNumber: 1,
      packageVersion: 'v1',
      formulaVersion: 'f1',
    },
    product: {
      slug,
      brand: 'Brand',
      name: 'Product',
      size: '30 ml',
      category: 'Face',
      step: 'Treat',
      image: '/test.png',
      displayLine: 'Test',
      usage: 'Test',
      priceLabel: null,
      supportedConcernSlugs: [],
      freshExactRetailerNames: [],
    },
    message: null,
    ...overrides,
  } as CustomerPortalShelfItem;
}

test('saved-current: active shelf item with matching product slug', () => {
  const ctx = deriveProductShelfContext(
    [makeShelfItem({ slug: 'target-product' })],
    'target-product',
    true,
    null,
  );
  assert.equal(ctx.state, 'saved-current');
  if (ctx.state !== 'saved-current') return;
  assert.equal(shelfContextLabel(ctx), 'On my Shelf');
});

test('saved-changed: merged lifecycle state', () => {
  const ctx = deriveProductShelfContext(
    [makeShelfItem({ slug: 'target-product', lifecycleState: 'merged', availability: 'changed', product: null })],
    'target-product',
    true,
    null,
  );
  assert.equal(ctx.state, 'saved-changed');
  if (ctx.state !== 'saved-changed') return;
  assert.equal(shelfContextLabel(ctx), 'Saved version changed');
});

test('saved-changed: superseded lifecycle state', () => {
  const ctx = deriveProductShelfContext(
    [makeShelfItem({ slug: 'target-product', lifecycleState: 'superseded', availability: 'changed', product: null })],
    'target-product',
    true,
    null,
  );
  assert.equal(ctx.state, 'saved-changed');
  assert.equal(shelfContextLabel(ctx), 'Saved version changed');
});

test('saved-changed: retired lifecycle state', () => {
  const ctx = deriveProductShelfContext(
    [makeShelfItem({ slug: 'target-product', lifecycleState: 'retired', availability: 'unavailable', product: null })],
    'target-product',
    true,
    null,
  );
  assert.equal(ctx.state, 'saved-changed');
  assert.equal(shelfContextLabel(ctx), 'Saved version changed');
});

test('not-saved: product not on shelf', () => {
  const ctx = deriveProductShelfContext(
    [makeShelfItem({ slug: 'other-product' })],
    'target-product',
    true,
    null,
  );
  assert.equal(ctx.state, 'not-saved');
  assert.equal(shelfContextLabel(ctx), 'Not on my Shelf');
});

test('unavailable: shelf service is unavailable', () => {
  const ctx = deriveProductShelfContext(
    [],
    'target-product',
    false,
    'Shelf is unavailable right now.',
  );
  assert.equal(ctx.state, 'unavailable');
  if (ctx.state !== 'unavailable') return;
  assert.equal(ctx.message, 'Shelf is unavailable right now.');
  assert.equal(shelfContextLabel(ctx), 'Shelf unavailable');
});

test('matches by snapshot slug when product is null (changed identity)', () => {
  const ctx = deriveProductShelfContext(
    [makeShelfItem({ slug: 'target-product', lifecycleState: 'merged', availability: 'changed', product: null })],
    'target-product',
    true,
    null,
  );
  assert.equal(ctx.state, 'saved-changed');
});

test('prefers saved-current over saved-changed when both identity records match', () => {
  const items = [
    makeShelfItem({
      identityVersionId: 'iv-changed',
      slug: 'target-product',
      savedAt: '2026-07-05T00:00:00Z',
      lifecycleState: 'retired',
      availability: 'unavailable',
      product: null,
    }),
    makeShelfItem({
      identityVersionId: 'iv-current',
      slug: 'target-product',
      savedAt: '2026-07-01T00:00:00Z',
      lifecycleState: 'active',
      availability: 'available',
    }),
  ];
  const ctx = deriveProductShelfContext(items, 'target-product', true, null);
  assert.equal(ctx.state, 'saved-current');
  if (ctx.state !== 'saved-current') return;
  assert.equal(ctx.shelfItem.identityVersionId, 'iv-current');
});

test('selects the most recently saved changed identity when no current identity exists', () => {
  const items = [
    makeShelfItem({
      identityVersionId: 'iv-older',
      slug: 'target-product',
      savedAt: '2026-07-01T00:00:00Z',
      lifecycleState: 'merged',
      availability: 'changed',
      product: null,
    }),
    makeShelfItem({
      identityVersionId: 'iv-newer',
      slug: 'target-product',
      savedAt: '2026-07-10T00:00:00Z',
      lifecycleState: 'superseded',
      availability: 'unavailable',
      product: null,
    }),
  ];
  const ctx = deriveProductShelfContext(items, 'target-product', true, null);
  assert.equal(ctx.state, 'saved-changed');
  if (ctx.state !== 'saved-changed') return;
  assert.equal(ctx.shelfItem.identityVersionId, 'iv-newer');
});
