import assert from 'node:assert/strict';
import test from 'node:test';
import audit from '@/data/retailer-verification/beauty-by-daz-core-14.json';
import { jeloCoreProductDossier } from '@/data/jelo-core-products';
import { verifiedRetailOffers } from '@/data/retail-offers';

test('every original product has a current rendered Beauty by Daz disposition', () => {
  assert.equal(audit.method, 'rendered-browser-page-review');
  assert.equal(audit.products.length, 14);
  assert.deepEqual(
    new Set(audit.products.map(product => product.slug)),
    new Set(jeloCoreProductDossier.products.map(product => product.slug)),
  );
  assert.equal(audit.products.every(product => new URL(product.requestedUrl).hostname === 'beautybydaz.com'), true);
});

test('only exact rendered matches become Beauty by Daz priced offers', () => {
  const exact = audit.products.filter(product => product.disposition === 'verified-exact-offer');
  assert.deepEqual(exact.map(product => product.slug).sort(), [
    'anua-niacinamide-10-txa-4-serum',
    'cosrx-salicylic-acid-daily-gentle-cleanser',
    'face-facts-bright-clear-face-cream',
  ]);

  for (const product of audit.products) {
    const offer = verifiedRetailOffers[product.slug]?.find(candidate => candidate.retailer === 'Beauty by Daz');
    if (product.disposition === 'verified-exact-offer') {
      assert.ok(offer, product.slug);
      assert.equal(offer.priceNgn, product.priceNgn, product.slug);
      continue;
    }
    assert.equal(offer, undefined, `${product.slug} must remain withheld`);
  }
});

test('conflicting, sibling and unresolved Beauty by Daz pages retain explicit reasons', () => {
  for (const product of audit.products.filter(product => product.disposition !== 'verified-exact-offer')) {
    assert.ok(product.reasons?.length, product.slug);
  }
  const bLab = audit.products.find(product => product.slug === 'b-lab-matcha-hydrating-real-sunscreen');
  assert.ok(bLab?.reasons?.includes('exact-package-conflict'));
  const dove = audit.products.find(product => product.slug === 'dove-moroccan-argan-oil-beauty-bar');
  assert.ok(dove?.reasons?.includes('search-redirected-to-sibling-product'));
});
