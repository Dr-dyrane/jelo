import assert from 'node:assert/strict';
import test from 'node:test';
import { expandedProducts } from '@/data/expanded-products';
import { products as coreProducts } from '@/data/products';
import { rankProducts } from './product-ranker';

const catalogue = [...coreProducts, ...expandedProducts];

test('ranking uses approved supportive uses instead of catalogue concern copy', () => {
  assert.deepEqual(
    rankProducts(catalogue, { concerns: ['oiliness'] }).map(product => product.slug),
    ['cerave-foaming-facial-cleanser'],
  );
  assert.deepEqual(
    rankProducts(catalogue, { concerns: ['dryness'] }).map(product => product.slug),
    ['cosrx-advanced-snail-96-mucin-power-essence'],
  );
  assert.deepEqual(rankProducts(catalogue, { concerns: ['dark spots'] }), []);
  assert.deepEqual(rankProducts(catalogue, { concerns: ['acne'] }), []);
});

test('normal skin can match the cleanser through its reviewed use, not product skin-type copy', () => {
  assert.deepEqual(
    rankProducts(catalogue, { concerns: [], skinType: 'normal' }).map(product => product.slug),
    ['cerave-foaming-facial-cleanser'],
  );
});
