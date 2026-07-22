import assert from 'node:assert/strict';
import test from 'node:test';
import { concerns } from '@/data/knowledge';
import { productMatchesConcern, rankProductsForConcerns } from './product-matching';

test('never maps body dryness into the facial barrier concern', () => {
  const barrier = concerns.find(concern => concern.slug === 'sensitive-barrier')!;
  assert.equal(productMatchesConcern({ slug: 'body-oil', category: 'Body', concerns: ['body dryness'] }, barrier), false);
  assert.equal(productMatchesConcern({ slug: 'face-cream', category: 'Face', concerns: ['dryness', 'barrier'] }, barrier), true);
});

test('matches any selected concern and ranks broader coverage first', () => {
  const ranked = rankProductsForConcerns([
    { slug: 'tone-only', category: 'Face' as const, concerns: ['dark spots'] },
    { slug: 'both', category: 'Face' as const, concerns: ['dark spots', 'oiliness'] },
    { slug: 'hair', category: 'Hair' as const, concerns: ['dry hair'] },
  ], concerns, ['dark-spots', 'oily-congested-skin']);

  assert.deepEqual(ranked.map(result => [result.product.slug, result.matchedConcernSlugs.length]), [
    ['both', 2],
    ['tone-only', 1],
  ]);
});
