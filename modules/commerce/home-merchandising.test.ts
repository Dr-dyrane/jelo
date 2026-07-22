import assert from 'node:assert/strict';
import test from 'node:test';
import { orderByCuratedSlugs } from './home-merchandising';

test('keeps live catalogue records in the curated homepage order', () => {
  const live = [
    { slug: 'third', price: 3 },
    { slug: 'first', price: 1 },
    { slug: 'second', price: 2 },
  ];

  assert.deepEqual(
    orderByCuratedSlugs(live, ['first', 'second', 'third']).map(item => item.slug),
    ['first', 'second', 'third'],
  );
  assert.equal(live[0].slug, 'third');
});

test('appends new live products without dropping them', () => {
  const ordered = orderByCuratedSlugs(
    [{ slug: 'new-z' }, { slug: 'known' }, { slug: 'new-a' }],
    ['known'],
  );

  assert.deepEqual(ordered.map(item => item.slug), ['known', 'new-a', 'new-z']);
});
