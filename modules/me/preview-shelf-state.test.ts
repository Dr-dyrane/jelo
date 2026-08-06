import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPreviewShelfExport,
  reducePreviewShelf,
} from '../../components/me/shelf/me-shelf-state';
import { deriveProductShelfContext, shelfContextLabel } from '../../lib/customer/product-shelf-context';
import type { CustomerPortalProduct } from '../../lib/customer/portal-model';

const product: CustomerPortalProduct = {
  slug: 'exact-preview-product',
  brand: 'Exact Brand',
  name: 'Exact Preview Product',
  size: '30 ml',
  category: 'Face',
  step: 'Treat',
  image: '/exact-preview.png',
  displayLine: 'Treat · support',
  usage: 'Use as directed.',
  priceLabel: null,
  supportedConcernSlugs: [],
  freshExactRetailerNames: [],
};

const otherProduct: CustomerPortalProduct = {
  ...product,
  slug: 'other-preview-product',
  name: 'Other Preview Product',
};

test('preview Shelf add, remove, and clear are local deterministic state transitions', () => {
  const added = reducePreviewShelf([], [product], {
    kind: 'add',
    productSlug: product.slug,
  }, '2026-08-03T12:00:00.000Z');
  assert.equal(added.result.status, 'saved');
  assert.match(added.result.message, /preview/i);
  assert.equal(added.items[0]?.identityVersionId, `synthetic-development:${product.slug}`);

  const duplicate = reducePreviewShelf(added.items, [product], {
    kind: 'add',
    productSlug: product.slug,
  });
  assert.equal(duplicate.result.status, 'already_saved');
  assert.equal(duplicate.items, added.items);

  const removed = reducePreviewShelf(added.items, [product], {
    kind: 'remove',
    identityVersionId: added.items[0]!.identityVersionId,
  });
  assert.equal(removed.result.status, 'removed');
  assert.deepEqual(removed.items, []);

  const cleared = reducePreviewShelf(added.items, [product], { kind: 'clear' });
  assert.equal(cleared.result.status, 'cleared');
  assert.deepEqual(cleared.items, []);
});

test('preview Shelf export labels non-durable scope and exports the current items', () => {
  const added = reducePreviewShelf([], [product], {
    kind: 'add',
    productSlug: product.slug,
  }, '2026-08-03T12:00:00.000Z');
  const exported = createPreviewShelfExport(added.items, '2026-08-03T12:05:00.000Z');

  assert.equal(exported.scope, 'preview-only');
  assert.equal(exported.resetsOnReload, true);
  assert.equal(exported.items.length, 1);
  assert.equal(exported.items[0]?.reviewedSnapshot.slug, product.slug);
  assert.equal('ownerSubject' in exported.items[0]!, false);
});

// --- Live shelf context convergence tests ---
// After Add/Remove/Clear, deriveProductShelfContext must reflect the new
// live state — not the original server state.

test('Add to Shelf changes Product context from not-saved to saved-current', () => {
  const catalogue = [product, otherProduct];
  // Start with one other product on the shelf, not the target.
  const initial = reducePreviewShelf([], catalogue, {
    kind: 'add', productSlug: otherProduct.slug,
  }, '2026-08-03T12:00:00.000Z');

  // Before add: product is not on the shelf.
  const beforeCtx = deriveProductShelfContext(initial.items, product.slug, true, null);
  assert.equal(beforeCtx.state, 'not-saved');
  assert.equal(shelfContextLabel(beforeCtx), 'Not on my Shelf');

  // Add the target product.
  const afterAdd = reducePreviewShelf(initial.items, catalogue, {
    kind: 'add', productSlug: product.slug,
  }, '2026-08-03T12:01:00.000Z');

  // After add: product is saved-current.
  const afterCtx = deriveProductShelfContext(afterAdd.items, product.slug, true, null);
  assert.equal(afterCtx.state, 'saved-current');
  assert.equal(shelfContextLabel(afterCtx), 'On my Shelf');
  // The shelf count increased by 1.
  assert.equal(afterAdd.items.length, initial.items.length + 1);
});

test('Remove from Shelf changes Product context from saved-current to not-saved', () => {
  const catalogue = [product];
  const added = reducePreviewShelf([], catalogue, {
    kind: 'add', productSlug: product.slug,
  }, '2026-08-03T12:00:00.000Z');

  // Before remove: saved-current.
  const beforeCtx = deriveProductShelfContext(added.items, product.slug, true, null);
  assert.equal(beforeCtx.state, 'saved-current');

  // Remove the product.
  const afterRemove = reducePreviewShelf(added.items, catalogue, {
    kind: 'remove', identityVersionId: added.items[0]!.identityVersionId,
  });

  // After remove: not-saved.
  const afterCtx = deriveProductShelfContext(afterRemove.items, product.slug, true, null);
  assert.equal(afterCtx.state, 'not-saved');
  assert.equal(shelfContextLabel(afterCtx), 'Not on my Shelf');
  assert.equal(afterRemove.items.length, 0);
});

test('Clear Shelf removes every preview item and count becomes zero', () => {
  const catalogue = [product, otherProduct];
  // Add two products.
  const withOne = reducePreviewShelf([], catalogue, {
    kind: 'add', productSlug: product.slug,
  }, '2026-08-03T12:00:00.000Z');
  const withTwo = reducePreviewShelf(withOne.items, catalogue, {
    kind: 'add', productSlug: otherProduct.slug,
  }, '2026-08-03T12:01:00.000Z');
  assert.equal(withTwo.items.length, 2);

  // Clear all.
  const cleared = reducePreviewShelf(withTwo.items, catalogue, { kind: 'clear' });
  assert.equal(cleared.result.status, 'cleared');
  assert.equal(cleared.items.length, 0);

  // After clear: both products are not-saved, count is zero.
  const ctxA = deriveProductShelfContext(cleared.items, product.slug, true, null);
  const ctxB = deriveProductShelfContext(cleared.items, otherProduct.slug, true, null);
  assert.equal(ctxA.state, 'not-saved');
  assert.equal(ctxB.state, 'not-saved');
});

test('Export contains the complete live preview Shelf after Add', () => {
  const catalogue = [product, otherProduct];
  const withOne = reducePreviewShelf([], catalogue, {
    kind: 'add', productSlug: otherProduct.slug,
  }, '2026-08-03T12:00:00.000Z');
  const withTwo = reducePreviewShelf(withOne.items, catalogue, {
    kind: 'add', productSlug: product.slug,
  }, '2026-08-03T12:01:00.000Z');

  const exported = createPreviewShelfExport(withTwo.items, '2026-08-03T12:05:00.000Z');
  assert.equal(exported.items.length, 2);
  const slugs = exported.items.map(item => item.reviewedSnapshot.slug).sort();
  assert.deepEqual(slugs, ['exact-preview-product', 'other-preview-product']);
});
