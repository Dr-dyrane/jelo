import assert from 'node:assert/strict';
import test from 'node:test';
import { products } from '@/data/catalogue';
import { concernBySlug } from '@/data/knowledge';
import { productMatchesConcern } from './product-matching';

function product(slug: string) {
  const match = products.find(item => item.slug === slug);
  assert.ok(match, `Missing product fixture: ${slug}`);
  return match;
}

function concern(slug: string) {
  const match = concernBySlug(slug);
  assert.ok(match, `Missing concern fixture: ${slug}`);
  return match;
}

test('concern matching uses approved supportive uses, not catalogue concern prose', () => {
  const cleanser = product('cerave-foaming-facial-cleanser');
  assert.equal(cleanser.concerns.includes('acne'), true);
  assert.equal(productMatchesConcern(cleanser, concern('acne-breakouts')), false);
  assert.equal(productMatchesConcern(cleanser, concern('oily-congested-skin')), true);

  const snail = product('cosrx-advanced-snail-96-mucin-power-essence');
  assert.equal(productMatchesConcern(snail, concern('sensitive-barrier')), false);
});

test('pharmacist-review products never enter direct concern matches', () => {
  const cleanser = product('cerave-blemish-control-cleanser');
  assert.equal(productMatchesConcern(cleanser, concern('acne-breakouts')), false);
});
