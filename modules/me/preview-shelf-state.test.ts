import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPreviewShelfExport,
  reducePreviewShelf,
} from '../../components/me/shelf/me-shelf-state';
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
