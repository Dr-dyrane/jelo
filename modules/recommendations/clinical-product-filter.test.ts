import assert from 'node:assert/strict';
import test from 'node:test';
import type { Product } from '@/data/products';
import { assessClinicalRoutine } from '@/modules/clinical/core/engine';
import { evaluateProductClinically } from './clinical-product-filter';

test('uses verified ingredient ids even when the product name omits the active', () => {
  const product: Product = {
    slug: 'night-serum', brand: 'Example', name: 'Night Serum', size: '30 ml', category: 'Face', step: 'Treat', image: '/test.png', displayLine: 'Smooth', bestFor: ['texture'], concerns: ['texture'], skinTypes: ['normal'], sensitiveFriendly: false, usage: 'Use at night.', evidence: 'high', verifiedIngredientIds: ['retinol'], offers: [],
  };
  const clinical = assessClinicalRoutine('I am pregnant and currently use retinol.', { pregnant: true });
  const decision = evaluateProductClinically(product, clinical);

  assert.equal(decision.ingredientIds.includes('retinol'), true);
  assert.equal(decision.eligible, false);
  assert.match(decision.exclusions.join(' '), /blocked ingredient/i);
});
