import assert from 'node:assert/strict';
import test from 'node:test';
import { ingredientSeeds, verifiedProductIngredients } from '@/data/product-ingredients';

test('every verified product ingredient resolves to one canonical ingredient', () => {
  const canonical = new Set(ingredientSeeds.map(ingredient => ingredient.slug));
  const missing = Object.values(verifiedProductIngredients)
    .flat()
    .map(ingredient => ingredient.ingredientSlug)
    .filter(slug => !canonical.has(slug));

  assert.deepEqual(missing, []);
  assert.equal(new Set(ingredientSeeds.map(ingredient => ingredient.slug)).size, ingredientSeeds.length);
});

test('verified product links use bounded concentrations and official HTTPS sources', () => {
  for (const [productSlug, ingredients] of Object.entries(verifiedProductIngredients)) {
    assert.ok(ingredients.length > 0, `${productSlug} must have at least one ingredient.`);
    assert.equal(new Set(ingredients.map(ingredient => ingredient.position)).size, ingredients.length);
    for (const ingredient of ingredients) {
      assert.match(ingredient.sourceUrl, /^https:\/\//);
      assert.ok(!/beautybydaz|luxbeautyng|teeka4|amazon|walmart|jumia/i.test(ingredient.sourceUrl));
      if (ingredient.concentrationPercent != null) {
        assert.ok(ingredient.concentrationPercent > 0 && ingredient.concentrationPercent <= 100);
      }
      assert.match(ingredient.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    }
  }
});

test('launch coverage includes multiple treatment classes without implying full formula review', () => {
  assert.ok(Object.keys(verifiedProductIngredients).length >= 7);
  assert.ok(Object.values(verifiedProductIngredients).flat().some(ingredient => ingredient.ingredientSlug === 'benzoyl-peroxide'));
  assert.ok(Object.values(verifiedProductIngredients).flat().some(ingredient => ingredient.ingredientSlug === 'ketoconazole'));
  assert.ok(Object.values(verifiedProductIngredients).flat().some(ingredient => ingredient.ingredientSlug === 'tranexamic-acid'));
});
