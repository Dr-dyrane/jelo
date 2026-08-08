import assert from 'node:assert/strict';
import test from 'node:test';
import { expandedProducts } from '@/data/expanded-products';
import { publishedIntakeProducts } from '@/data/published-intake-products';
import { products as coreProducts } from '@/data/products';
import { rankProducts } from './product-ranker';

const catalogue = [...coreProducts, ...expandedProducts];

test('ranking requires canonical concern slugs instead of raw lexicon concern ids', () => {
  const fullCatalogue = [...catalogue, ...publishedIntakeProducts];
  assert.deepEqual(
    rankProducts(fullCatalogue, { concernSlugs: ['oily-congested-skin'] }).map(product => product.slug),
    ['eucerin-oil-control-sun-gel-cream-spf50-50ml', 'facefacts-ceramide-oil-control-foaming-cleanser-400ml', 'cerave-foaming-facial-cleanser'],
  );
  assert.deepEqual(
    rankProducts(fullCatalogue, { concernSlugs: ['dry-dehydrated-skin'] }).map(product => product.slug),
    ['cerave-hydrating-cleanser-473ml', 'cerave-pm-facial-moisturising-lotion-52ml', 'facefacts-ceramide-moisturising-gel-cream-50ml', 'cosrx-advanced-snail-96-mucin-power-essence', 'facefacts-ceramide-hydrating-gentle-cleanser-400ml'],
  );
  assert.deepEqual(
    rankProducts(fullCatalogue, { concernSlugs: ['oiliness'] }),
    [],
  );
  assert.deepEqual(
    rankProducts(fullCatalogue, { concernSlugs: ['dryness'] }),
    [],
  );
});

test('skin-type copy cannot authorize a product without a canonical care concern', () => {
  assert.deepEqual(
    rankProducts(catalogue, { concernSlugs: ['normal'] }),
    [],
  );
});

test('canonical concern slugs rank only explicitly reviewed supportive uses', () => {
  assert.deepEqual(
    rankProducts(catalogue, {
      concernSlugs: ['daily-sun-protection'],
    }).map(product => product.slug),
    [],
  );

  assert.deepEqual(
    rankProducts([...catalogue, ...publishedIntakeProducts], {
      concernSlugs: ['daily-sun-protection'],
    }).map(product => product.slug),
    ['eucerin-oil-control-sun-gel-cream-spf50-50ml'],
  );
});

test('an explicit product step narrows otherwise eligible products', () => {
  const fullCatalogue = [...catalogue, ...publishedIntakeProducts];

  assert.deepEqual(
    rankProducts(fullCatalogue, {
      concernSlugs: ['oily-congested-skin'],
      productSteps: ['Cleanse'],
    }).map(product => product.slug),
    [
      'facefacts-ceramide-oil-control-foaming-cleanser-400ml',
      'cerave-foaming-facial-cleanser',
    ],
  );
  assert.deepEqual(
    rankProducts(fullCatalogue, {
      concernSlugs: ['oily-congested-skin'],
      productSteps: ['Protect'],
    }).map(product => product.slug),
    ['eucerin-oil-control-sun-gel-cream-spf50-50ml'],
  );
});
