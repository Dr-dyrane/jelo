import assert from 'node:assert/strict';
import test from 'node:test';
import { jeloCoreProductDossier } from '@/data/jelo-core-products';
import { products } from '@/data/products';

test('the original JeloCare dossier keeps all 14 products and classifications', () => {
  assert.equal(jeloCoreProductDossier.products.length, 14);
  assert.match(jeloCoreProductDossier.sourceSha256, /^[0-9a-f]{64}$/);

  const legacyIds = new Set<string>();
  const slugs = new Set<string>();
  const productsBySlug = new Map(products.map(product => [product.slug, product]));

  for (const classification of jeloCoreProductDossier.products) {
    assert.equal(legacyIds.has(classification.legacyId), false, `duplicate legacy ID: ${classification.legacyId}`);
    assert.equal(slugs.has(classification.slug), false, `duplicate canonical slug: ${classification.slug}`);
    legacyIds.add(classification.legacyId);
    slugs.add(classification.slug);

    const product = productsBySlug.get(classification.slug);
    assert.ok(product, `missing core product: ${classification.slug}`);
    assert.equal(product.category, classification.category, `${classification.slug} category drifted`);
    assert.equal(product.step, classification.step, `${classification.slug} routine step drifted`);
  }
});
