import assert from 'node:assert/strict';
import test from 'node:test';
import type { CustomerPortalSavedRoutine } from '../../lib/customer/portal-model';
import { deriveRoutineContext, unavailableRoutineContext } from '../../lib/customer/routine-context';

function makeRoutine(id: string, name: string, productSlugs: string[]): CustomerPortalSavedRoutine {
  return {
    id,
    revision: 1,
    name,
    origin: 'customer',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    steps: productSlugs.map((slug, index) => ({
      id: `${id}-step-${index}`,
      position: index,
      label: `Step ${index + 1}`,
      instruction: 'Use as directed.',
      referenceState: 'catalogue' as const,
      product: {
        slug,
        brand: 'Brand',
        name: `Product ${slug}`,
        size: '30 ml',
        category: 'Face',
        step: 'Treat',
        image: '/test.png',
        displayLine: 'Test',
        usage: 'Test',
        priceLabel: null,
        supportedConcernSlugs: [],
        freshExactRetailerNames: [],
      },
    })),
  };
}

test('derives "Not in my Routine" when no routine references the product', () => {
  const routines: CustomerPortalSavedRoutine[] = [
    makeRoutine('r1', 'Morning routine', ['other-product']),
  ];
  const ctx = deriveRoutineContext(routines, 'target-product');
  assert.equal(ctx.state, 'ready');
  if (ctx.state !== 'ready') return;
  assert.equal(ctx.stepCount, 0);
  assert.equal(ctx.routineCount, 0);
  assert.equal(ctx.label, 'Not in my Routine');
});

test('derives "In <routine name>" when one routine references the product', () => {
  const routines: CustomerPortalSavedRoutine[] = [
    makeRoutine('r1', 'Morning routine', ['target-product']),
    makeRoutine('r2', 'Evening routine', ['other-product']),
  ];
  const ctx = deriveRoutineContext(routines, 'target-product');
  assert.equal(ctx.state, 'ready');
  if (ctx.state !== 'ready') return;
  assert.equal(ctx.stepCount, 1);
  assert.equal(ctx.routineCount, 1);
  assert.deepEqual(ctx.routineNames, ['Morning routine']);
  assert.equal(ctx.label, 'In Morning routine');
});

test('derives "In N routines" when multiple routines reference the product', () => {
  const routines: CustomerPortalSavedRoutine[] = [
    makeRoutine('r1', 'Morning routine', ['target-product']),
    makeRoutine('r2', 'Evening routine', ['target-product']),
  ];
  const ctx = deriveRoutineContext(routines, 'target-product');
  assert.equal(ctx.state, 'ready');
  if (ctx.state !== 'ready') return;
  assert.equal(ctx.stepCount, 2);
  assert.equal(ctx.routineCount, 2);
  assert.deepEqual(ctx.routineNames, ['Morning routine', 'Evening routine']);
  assert.equal(ctx.label, 'In 2 routines');
});

test('counts all matching steps across routines, not just the first', () => {
  const routines: CustomerPortalSavedRoutine[] = [
    makeRoutine('r1', 'Morning routine', ['target-product', 'target-product']),
    makeRoutine('r2', 'Evening routine', ['target-product']),
  ];
  const ctx = deriveRoutineContext(routines, 'target-product');
  assert.equal(ctx.state, 'ready');
  if (ctx.state !== 'ready') return;
  assert.equal(ctx.stepCount, 3);
  assert.equal(ctx.routineCount, 2);
  assert.equal(ctx.label, 'In 2 routines');
});

test('handles empty routines array', () => {
  const ctx = deriveRoutineContext([], 'target-product');
  assert.equal(ctx.state, 'ready');
  if (ctx.state !== 'ready') return;
  assert.equal(ctx.stepCount, 0);
  assert.equal(ctx.label, 'Not in my Routine');
});

test('unavailable routine context shows "Routine unavailable"', () => {
  const ctx = unavailableRoutineContext();
  assert.equal(ctx.state, 'unavailable');
  assert.equal(ctx.label, 'Routine unavailable');
});
